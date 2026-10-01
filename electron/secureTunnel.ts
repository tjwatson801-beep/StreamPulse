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

export async function startSecureTunnel(config: TunnelConfig = {}) {
  if (tunnelProcess && connected) return getSecureOverlayInfo();
  await stopSecureTunnel(); connected = false; permanent = false; publicUrl = ""; lastError = "";
  const hostname = normalizeHostname(config.hostname || ""); const useNamed = Boolean(config.token && hostname);
  return new Promise<ReturnType<typeof getSecureOverlayInfo>>(resolve => {
    let settled = false; let timeout: NodeJS.Timeout; let outputBuffer = "";
    const finish = () => { if (settled) return; settled = true; clearTimeout(timeout); resolve(getSecureOverlayInfo()); };
    try {
      const args = useNamed ? ["tunnel", "--no-autoupdate", "--protocol", "http2", "run", "--token", config.token!] : ["tunnel", "--no-autoupdate", "--protocol", "http2", "--url", `http://127.0.0.1:${OVERLAY_PORT}`];
      const child = spawn(executablePath(), args, { windowsHide: true }); tunnelProcess = child;
      const inspect = (chunk: Buffer) => { outputBuffer = (outputBuffer + chunk.toString()).slice(-12000); if (useNamed && /Registered tunnel connection/i.test(outputBuffer)) { connected = true; permanent = true; publicUrl = `https://${hostname}`; finish(); return; } const match = outputBuffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i); if (!useNamed && match) { connected = true; publicUrl = match[0]; finish(); } };
      child.stdout.on("data", inspect); child.stderr.on("data", inspect);
      child.on("error", error => { lastError = error.message; finish(); });
      child.on("exit", code => { if (tunnelProcess !== child) { finish(); return; } tunnelProcess = null; connected = false; publicUrl = ""; lastError = `Secure tunnel stopped${code === null ? "" : ` (code ${code})`}.`; finish(); });
    } catch (error) { lastError = error instanceof Error ? error.message : String(error); finish(); }
    timeout = setTimeout(() => { lastError = `${useNamed ? "Permanent" : "Temporary"} secure tunnel did not connect within 25 seconds.`; finish(); }, 25000);
  });
}
export async function restartSecureTunnel(config: TunnelConfig = {}) { await stopSecureTunnel(); return startSecureTunnel(config); }
export async function stopSecureTunnel() { const child = tunnelProcess; tunnelProcess = null; connected = false; permanent = false; publicUrl = ""; if (!child || child.killed) return; child.kill(); await new Promise<void>(resolve => { const timeout = setTimeout(resolve, 2000); child.once("exit", () => { clearTimeout(timeout); resolve(); }); }); }

