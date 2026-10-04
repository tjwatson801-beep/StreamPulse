import { app } from "electron";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import path from "path";
import { OVERLAY_PORT } from "./overlayServer";

export type TunnelConfig = { token?: string; hostname?: string };
let tunnelProcess: ChildProcessWithoutNullStreams | null = null;
let publicUrl = "";
let connected = false;
let permanent = false;
let lastError = "";

function executablePath() { return app.isPackaged ? path.join(process.resourcesPath, "cloudflared.exe") : path.join(app.getAppPath(), "resources", "cloudflared.exe"); }
export function normalizeHostname(value: string) { return String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/\.$/, ""); }
export function extractTunnelToken(value: string) { return String(value || "").match(/\b(eyJ[A-Za-z0-9._-]+)\b/)?.[1] || ""; }
export function getSecureOverlayInfo() { return { processRunning: Boolean(tunnelProcess && !tunnelProcess.killed && tunnelProcess.exitCode === null), connected, permanent, overlayUrl: connected && publicUrl ? `${publicUrl}/overlay/gifts?v=24-repeat` : "", error: lastError }; }

let revision = 0;
let retryTimer: NodeJS.Timeout | undefined;
let stableTimer: NodeJS.Timeout | undefined;
let attempts = 0;
let pending: Promise<ReturnType<typeof getSecureOverlayInfo>> | null = null;
function cancelTimers() { clearTimeout(retryTimer); clearTimeout(stableTimer); retryTimer = undefined; stableTimer = undefined; }
function launch(config: TunnelConfig, generation: number): Promise<ReturnType<typeof getSecureOverlayInfo>> {
  const hostname = normalizeHostname(config.hostname || ''); const useNamed = Boolean(config.token && hostname);
  connected = false; publicUrl = ''; permanent = useNamed;
  return new Promise(resolve => {
    let settled = false; let timeout: NodeJS.Timeout | undefined;
    const finish = () => { if (settled) return; settled = true; clearTimeout(timeout); resolve(getSecureOverlayInfo()); };
    const retry = () => {
      if (generation !== revision || retryTimer) return;
      clearTimeout(stableTimer); stableTimer = undefined;
      if (attempts >= 5) { lastError = 'Secure tunnel recovery paused after five retries. Use Refresh secure link to try again.'; return; }
      const delay = Math.min(60000, 2000 * 2 ** attempts++);
      lastError = `Secure tunnel disconnected. Retrying in ${delay / 1000} seconds.`;
      retryTimer = setTimeout(() => { retryTimer = undefined; if (generation === revision) void launch(config, generation); }, delay);
    };
    try {
      const args = useNamed ? ['tunnel','--no-autoupdate','--protocol','http2','run','--token',config.token!] : ['tunnel','--no-autoupdate','--protocol','http2','--url',`http://127.0.0.1:${OVERLAY_PORT}`];
      const child = spawn(executablePath(), args, {windowsHide:true}); tunnelProcess = child;
      const connections = new Set<string>(); let buffer = '';
      const inspect = (chunk: Buffer) => {
        if (generation !== revision || tunnelProcess !== child) return;
        buffer += chunk.toString(); const lines = buffer.split(/\r?\n/); buffer = lines.pop()!.slice(-12000);
        for (const line of lines) {
          if (!useNamed) { const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i); if (match) publicUrl = match[0]; }
          const index = line.match(/connIndex=(\d+)/)?.[1] || '0';
          if (/Unregistered tunnel connection|Connection terminated/i.test(line)) connections.delete(index);
          else if (/Registered tunnel connection/i.test(line)) connections.add(index);
        }
        if (useNamed) publicUrl = `https://${hostname}`;
        connected = connections.size > 0 && Boolean(publicUrl);
        if (connected) {
          lastError = ''; finish();
          if (!stableTimer) stableTimer = setTimeout(() => { stableTimer = undefined; if(generation === revision && connected) attempts = 0; }, 60000);
        } else { clearTimeout(stableTimer); stableTimer = undefined; lastError = 'Secure tunnel is reconnecting.'; }
      };
      child.stdout.on('data', inspect); child.stderr.on('data', inspect);
      const failed = () => {
        if (generation !== revision || tunnelProcess !== child) { finish(); return; }
        tunnelProcess = null; connected = false; publicUrl = ''; retry(); finish();
      };
      child.on('error', failed); child.on('exit', failed);
      timeout = setTimeout(() => {
        if (generation === revision && tunnelProcess === child && !connected) { failed(); child.kill(); }
        finish();
      }, 25000);
    } catch { connected = false; publicUrl = ''; retry(); finish(); }
  });
}
export function startSecureTunnel(config: TunnelConfig = {}) {
  if (pending) return pending;
  if (tunnelProcess || retryTimer) return Promise.resolve(getSecureOverlayInfo());
  const generation = ++revision; attempts = 0; lastError = '';
  const run = launch({...config}, generation); pending = run;
  void run.finally(() => { if(pending === run) pending = null; });
  return run;
}
export async function restartSecureTunnel(config: TunnelConfig = {}) { await stopSecureTunnel(); return startSecureTunnel(config); }
export async function stopSecureTunnel() {
  revision++; cancelTimers(); pending = null;
  const child = tunnelProcess; tunnelProcess = null; connected = false; permanent = false; publicUrl = ''; lastError = '';
  if (!child || child.killed) return;
  await new Promise<void>(resolve => { const timeout = setTimeout(resolve, 2000); child.once('exit', () => { clearTimeout(timeout); resolve(); }); child.kill(); });
}
