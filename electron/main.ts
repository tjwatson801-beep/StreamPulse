import { flushRendererSettings } from './settingsFlush';
import { claimInstance } from './singleInstance';
import { SettingsStore } from './settingsStore';
import { probeOverlay } from './connectionHealth';
import { setupUpdater } from './updater';
import { sendWebhook } from './webhook';
import { app, BrowserWindow, dialog, ipcMain, safeStorage } from "electron";
import fs from "fs/promises";
import { appendFileSync, existsSync, mkdirSync, statSync, renameSync, rmSync } from "fs";
import path from "path";
import { LiveEvent, LiveProvider, ProviderStatus } from "./providers/LiveProvider";
import { DirectTikTokProvider } from "./providers/DirectTikTokProvider";
import { TikFinityProvider } from "./providers/TikFinityProvider";
import { OVERLAY_PORT, processLibraryEvent, setLikesAppearance, likesTracker, publishLikes, showOverlayAlert, startOverlayServer, stopOverlayServer } from "./overlayServer";
import { extractTunnelToken, getSecureOverlayInfo, normalizeHostname, restartSecureTunnel, startSecureTunnel, stopSecureTunnel } from "./secureTunnel";

let window: BrowserWindow | null = null;
const primaryInstance = claimInstance(app, () => window);
const settingsStore = new SettingsStore(app.getPath("userData"));
let provider: LiveProvider | null = null;
let closing = false;
let closePending = false;
async function flushSettings() { await flushRendererSettings(window); await settingsStore.flush(); }
async function requestClose() {
  if (closePending || closing) return;
  closePending = true;
  try {
    try { await flushSettings(); }
    catch (error) {
      const result = await dialog.showMessageBox({type:'warning',title:'Settings were not saved',message:error instanceof Error ? error.message : 'Settings could not be saved.',buttons:['Keep StreamPulse open','Close without saving'],defaultId:0,cancelId:0});
      if (result.response !== 1) return;
    }
    closing = true; await disconnect(); await stopSecureTunnel(); await stopOverlayServer(); app.quit();
  } finally { closePending = false; }
}
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
let activeUsername = "";
let reconnectEnabled = false;
let activeProviderKind: "direct" | "tikfinity" = "tikfinity";
let connectRevision = 0;
const statePath = () => path.join(app.getPath("userData"), "settings.json");
const secretPath = () => path.join(app.getPath("userData"), "tiktool-key.bin");
const tunnelSecretPath = () => path.join(app.getPath("userData"), "cloudflare-tunnel-token.bin");

const diagnosticLogPath = () => path.join(app.getPath("userData"), "logs", "connection.log");
let logFailure = "";
function diagnosticLog(message: string) {
  try {
    const file = diagnosticLogPath(); mkdirSync(path.dirname(file), { recursive: true });
    if (existsSync(file) && statSync(file).size > 2 * 1024 * 1024) { const previous = file + ".previous"; if (existsSync(previous)) rmSync(previous); renameSync(file, previous); }
    appendFileSync(file, `${new Date().toISOString()} ${message.replace(/([?&](?:apiKey|jwtKey|token)=)[^&\s]+/gi, "$1[redacted]").replace(/[\r\n]/g, " ")}\n`);
    logFailure = "";
  } catch { logFailure = "Could not save the diagnostic log."; }
}

function send(channel: string, payload: unknown) {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
  window.webContents.send(channel, payload);
}
async function readKey() { try { const data = await fs.readFile(secretPath()); return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(data) : ""; } catch { return ""; } }
async function readTunnelToken() { try { const data = await fs.readFile(tunnelSecretPath()); return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(data) : ""; } catch { return ""; } }
async function readPermanentHostname() { try { const state = JSON.parse(await fs.readFile(statePath(), "utf8")); return normalizeHostname(state?.permanentOverlayHostname || ""); } catch { return ""; } }
async function tunnelConfig() { return { token: await readTunnelToken(), hostname: await readPermanentHostname() }; }
function clearReconnect() { if (reconnectTimer) clearTimeout(reconnectTimer); reconnectTimer = null; }
async function disconnect(manual = true) { if (manual) { connectRevision++; reconnectEnabled = false; activeUsername = ""; } clearReconnect(); const current = provider; provider = null; await current?.disconnect().catch(() => undefined); }
function stopForRateLimit(message?: string) {
  if (/Automatic reconnect is paused/i.test(message || "")) {
    reconnectEnabled = false; clearReconnect();
    send("core:status", { status: "error", message }); return true;
  }
  if (!/rate[\s_-]*limit|too many (?:requests|connections)|\b429\b|\b60 WebSocket connections per hour\b/i.test(message || "")) return false;
  reconnectEnabled = false; clearReconnect();
  const detail = "LIVE connection limit reached. Automatic reconnect is paused. Wait for your quota to reset before connecting again.";
  diagnosticLog(detail); send("core:status", { status: "error", message: detail });
  return true;
}
function scheduleReconnect() {
  if (!reconnectEnabled || closing || reconnectTimer || !activeUsername) return;
  reconnectAttempts += 1;
  const delay = Math.min(60000, 2000 * Math.pow(2, reconnectAttempts - 1));
  send("core:status", { status: "reconnecting", message: `Connection lost. Retrying in ${Math.round(delay / 1000)} seconds...` });
  reconnectTimer = setTimeout(() => { reconnectTimer = null; void connectProvider(activeUsername, true); }, delay);
}
function bind(current: LiveProvider) {
  current.onRoom?.(roomId => { if (current !== provider) return; likesTracker.startStream(activeUsername, roomId); publishLikes(); });
  current.onEvent((event: LiveEvent) => {
    if (current !== provider) return;
    if (event.type === "Like") { const before = likesTracker.viewerLikes(event.user); if (likesTracker.add(event)) { publishLikes(); processLibraryEvent(event, before, likesTracker.viewerLikes(event.user)); } return; }
    if (event.type === "Gift") processLibraryEvent(event);
    send("core:event", event);
  });
  current.onStatus((status: ProviderStatus, message?: string) => {
    if (current !== provider) return;
    if (status === "error" && stopForRateLimit(message)) return;
    send("core:status", { status, message });
    if (status === "connecting") { clearReconnect(); }
    else if (status === "connected") { reconnectAttempts = 0; clearReconnect(); }
    else if (status === "error" || status === "disconnected") scheduleReconnect();
  });
}
async function connectProvider(username: string, reconnecting = false) {
  const revision = ++connectRevision;
  try {
    await disconnect(false);
    if (revision !== connectRevision) return { ok: false, error: "Connection cancelled" };
    const current = activeProviderKind === "direct" ? new DirectTikTokProvider(diagnosticLog) : new TikFinityProvider(diagnosticLog); provider = current; bind(current);
    likesTracker.startStream(username, "");
    await current.connect(username); return revision === connectRevision ? { ok: true } : { ok: false, error: "Connection cancelled" };
  } catch (error) {
    if (revision !== connectRevision) return { ok: false, error: "Connection cancelled" };
    const message = error instanceof Error ? error.message : String(error);
    if (stopForRateLimit(message)) return { ok: false, error: message };
    send("core:status", { status: reconnecting && reconnectEnabled ? "reconnecting" : "error", message });
    scheduleReconnect(); return { ok: false, error: message };
  }
}

async function createWindow() {
  try { setLikesAppearance(JSON.parse(await fs.readFile(statePath(), "utf8"))); } catch { setLikesAppearance({}); }
  await startOverlayServer();
  await startSecureTunnel(await tunnelConfig());
  window = new BrowserWindow({ width: 1180, height: 780, minWidth: 940, minHeight: 620, backgroundColor: "#080c12", title: "StreamPulse Core", webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, autoplayPolicy: "no-user-gesture-required" } });
  window.on("close", event => { if (!closing) { event.preventDefault(); void requestClose(); } });
  window.on("closed", () => { window = null; });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", event => event.preventDefault());
  if (app.isPackaged) await window.loadFile(path.join(__dirname, "../dist/index.html")); else await window.loadURL("http://localhost:5173");
}

app.whenReady().then(async () => {
  if (!primaryInstance) return;
  try { await settingsStore.backup(`Startup ${app.getVersion()}`); } catch { diagnosticLog("Startup backup failed; settings file may need recovery."); }
  setupUpdater(() => reconnectEnabled, async () => { await flushSettings(); await settingsStore.backup("Before update"); await disconnect(); await stopSecureTunnel(); await stopOverlayServer(); closing = true; });
  diagnosticLog(`StreamPulse ${app.getVersion()} started`);
  ipcMain.handle("core:gift-catalog", async () => ({ ok: false, error: "StreamPulse uses your saved gift library and automatically adds gifts received during LIVE. A full catalog download is not available through this connection." }));
  ipcMain.handle("core:diagnostics", async () => {
    const snapshot = provider?.diagnostics?.() || { provider: activeProviderKind, status: "disconnected", receivedCount: 0 };
    diagnosticLog(`Snapshot ${JSON.stringify(snapshot)}`);
    let recent = ""; try { recent = (await fs.readFile(diagnosticLogPath(), "utf8")).split("\n").slice(-60).join("\n"); } catch {}
    return `StreamPulse ${app.getVersion()}\n${JSON.stringify(snapshot, null, 2)}\nLog: ${diagnosticLogPath()}\n${logFailure}\n\n${recent}`;
  });
  ipcMain.handle('core:backup-list', () => settingsStore.list());
  ipcMain.handle('core:backup-create', () => settingsStore.backup('Manual backup'));
  ipcMain.handle('core:backup-restore', async (_event, id: string) => {
    if(reconnectEnabled) return {error:'Disconnect from LIVE before restoring.'};
    const answer = await dialog.showMessageBox({type:'question',buttons:['Cancel','Restore'],defaultId:0,cancelId:0,message:'Restore this settings backup?',detail:'Current settings will be backed up first. Restart StreamPulse afterward if your connection or tunnel settings changed.'});
    if(answer.response!==1)return {cancelled:true};
    if(reconnectEnabled)return {error:'Disconnect from LIVE before restoring.'};
    const state=await settingsStore.restore(id);setLikesAppearance(state);return {state};
  });
  let healthPending: Promise<unknown> | null = null;
  ipcMain.handle('core:health', () => {
    if(healthPending)return healthPending;
    const secure=getSecureOverlayInfo();
    healthPending=(async()=>{const [local,publicHealth]=await Promise.all([probeOverlay(`http://127.0.0.1:${OVERLAY_PORT}/health`),secure.overlayUrl?probeOverlay(new URL('/health',secure.overlayUrl).href):Promise.resolve({ok:false,message:'No active public link'})]);return {live:provider?.status() || (reconnectEnabled?'Connecting':'Disconnected'),local,public:publicHealth,tunnel:secure.processRunning};})().finally(()=>{healthPending=null;});return healthPending;
  });
  ipcMain.handle("core:likes-reset", async () => { likesTracker.reset(); publishLikes(); return { ok: true }; });
  ipcMain.handle("core:webhook", (_event, args: unknown) => sendWebhook(args));
  ipcMain.handle("core:load", async () => { try { return await settingsStore.load(); } catch { return { settingsLoadError: "Settings could not be read. Restore a backup in Settings before making changes." }; } });
  ipcMain.handle("core:save", async (_event, state: unknown) => { await settingsStore.save(state); setLikesAppearance(state as { likesBackgroundOpacity?: unknown; likesShowBorder?: unknown }); return { ok: true }; });
  ipcMain.handle("core:credential-status", async () => ({ hasCredential: Boolean(await readKey()), hasTunnelCredential: Boolean(await readTunnelToken()) }));
  ipcMain.handle("core:credential-save", async (_event, value: string) => { if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: "Windows encryption is unavailable." }; await fs.mkdir(path.dirname(secretPath()), { recursive: true }); await fs.writeFile(secretPath(), safeStorage.encryptString(String(value).trim())); return { ok: true }; });
  ipcMain.handle("core:connect", async (_event, username: string, mode?: string) => {
    const kind = mode === "direct" ? "direct" : "tikfinity";
    const normalized = String(username || "").trim().replace(/^@/, "");
    if (kind === "direct" && !/^[a-zA-Z0-9_.]{1,64}$/.test(normalized)) return { ok: false, error: "Enter your TikTok username in Settings." };
    activeProviderKind = kind; activeUsername = normalized || "TikFinity";
    reconnectEnabled = true; reconnectAttempts = 0; return connectProvider(activeUsername);
  });
  ipcMain.handle("core:disconnect", async () => { await disconnect(); return { ok: true }; });
  ipcMain.handle("core:mock", async (_event, kind: "Chat" | "Gift" | "Follow" | "SuperFanJoin") => { const base = { id: crypto.randomUUID(), user: "GoldFan", time: new Date().toLocaleTimeString(), followRole: 2, isFollower: true, isSubscriber: false }; const event: LiveEvent = kind === "Chat" ? { ...base, type: "Chat", detail: "Hello StreamPulse!" } : kind === "Gift" ? { ...base, type: "Gift", detail: "sent Rose", giftName: "Rose", giftImageUrl: "https://cdn.tik.tools/gifts/dca13c81e1bc524a3d2388b5.png", count: 5, comboComplete: true } : kind === "Follow" ? { ...base, type: "Follow", detail: "followed the LIVE" } : { ...base, type: "SuperFanJoin", detail: "entered as a Super Fan" }; send("core:event", event); return { ok: true }; });
  ipcMain.handle("core:overlay-test", async (_event, body: string) => showOverlayAlert({ title: "Rose received!", body, imageUrl: "https://cdn.tik.tools/gifts/dca13c81e1bc524a3d2388b5.png" }));
  ipcMain.handle("core:overlay-show", async (_event, args: { title: string; body: string; imagePath?: string; imageUrl?: string; durationMs?: number }) => showOverlayAlert(args));
  ipcMain.handle("core:pick-sound", async () => { const result = await dialog.showOpenDialog({ title: "Choose an event sound", properties: ["openFile"], filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "aac"] }] }); return result.canceled ? null : result.filePaths[0] || null; });
  ipcMain.handle("core:pick-image", async () => { const result = await dialog.showOpenDialog({ title: "Choose an overlay image", properties: ["openFile"], filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }] }); return result.canceled ? null : result.filePaths[0] || null; });
  ipcMain.handle("core:info", async () => { const secure = getSecureOverlayInfo(); return { version: app.getVersion(), overlayUrl: secure.overlayUrl || `http://localhost:${OVERLAY_PORT}/overlay/gifts?v=24-repeat`, secure }; });
  ipcMain.handle("core:tunnel-restart", async () => { const secure = await restartSecureTunnel(await tunnelConfig()); return { ...secure, overlayUrl: secure.overlayUrl || `http://localhost:${OVERLAY_PORT}/overlay/gifts?v=24-repeat` }; });
  ipcMain.handle("core:tunnel-configure", async (_event, value: string, hostnameValue: string) => {
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: "Windows encryption is unavailable." };
    const token = extractTunnelToken(value); const hostname = normalizeHostname(hostnameValue);
    if (!token) return { ok: false, error: "No Cloudflare tunnel token was found in that command." };
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) return { ok: false, error: "Enter a valid hostname such as overlay.streampulse.us." };
    await fs.mkdir(path.dirname(tunnelSecretPath()), { recursive: true }); await fs.writeFile(tunnelSecretPath(), safeStorage.encryptString(token));
    let state: Record<string, unknown> = {}; try { state = JSON.parse(await fs.readFile(statePath(), "utf8")); } catch {}
    state.permanentOverlayHostname = hostname; await settingsStore.save(state);
    const secure = await restartSecureTunnel({ token, hostname }); return { ok: secure.connected, ...secure, overlayUrl: secure.overlayUrl || `http://localhost:${OVERLAY_PORT}/overlay/gifts?v=24-repeat` };
  });
  await createWindow();
});
app.on("before-quit", event => { if (primaryInstance && window && !closing) { event.preventDefault(); void requestClose(); } });
app.on("window-all-closed", async () => { await disconnect(); await stopSecureTunnel(); await stopOverlayServer(); if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (!closing && BrowserWindow.getAllWindows().length === 0) void createWindow(); });




