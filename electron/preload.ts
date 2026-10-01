import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("streamPulseCore", {
  load: () => ipcRenderer.invoke("core:load"), save: (state: unknown) => ipcRenderer.invoke("core:save", state),
  credentialStatus: () => ipcRenderer.invoke("core:credential-status"), credentialSave: (value: string) => ipcRenderer.invoke("core:credential-save", value),
  connect: (username: string, mode?: string) => ipcRenderer.invoke("core:connect", username, mode), disconnect: () => ipcRenderer.invoke("core:disconnect"),
  mock: (kind: "Chat" | "Gift" | "Follow" | "SuperFanJoin") => ipcRenderer.invoke("core:mock", kind), overlayTest: (body: string) => ipcRenderer.invoke("core:overlay-test", body),
  overlayShow: (args: unknown) => ipcRenderer.invoke("core:overlay-show", args),
  webhook: (args: unknown) => ipcRenderer.invoke("core:webhook", args),
  updateStatus: () => ipcRenderer.invoke("core:update-status"), updateCheck: () => ipcRenderer.invoke("core:update-check"), updateDownload: () => ipcRenderer.invoke("core:update-download"), updateInstall: () => ipcRenderer.invoke("core:update-install"),
  pickSound: () => ipcRenderer.invoke("core:pick-sound"),
  pickImage: () => ipcRenderer.invoke("core:pick-image"),
  giftCatalog: () => ipcRenderer.invoke("core:gift-catalog"),
  resetLikes: () => ipcRenderer.invoke("core:likes-reset"),
  diagnostics: () => ipcRenderer.invoke("core:diagnostics"),
  info: () => ipcRenderer.invoke("core:info"),
  restartSecureTunnel: () => ipcRenderer.invoke("core:tunnel-restart"),
  configurePermanentTunnel: (value: string, hostname: string) => ipcRenderer.invoke("core:tunnel-configure", value, hostname),
  onEvent: (handler: (event: unknown) => void) => { const listener = (_: unknown, event: unknown) => handler(event); ipcRenderer.on("core:event", listener); return () => ipcRenderer.removeListener("core:event", listener); },
  onStatus: (handler: (status: unknown) => void) => { const listener = (_: unknown, status: unknown) => handler(status); ipcRenderer.on("core:status", listener); return () => ipcRenderer.removeListener("core:status", listener); }
});


