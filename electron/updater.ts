import { app, dialog, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
export function setupUpdater(isLive: () => boolean, prepare: () => Promise<void>, isVideoBusy: () => boolean = () => false) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = true;
  autoUpdater.allowDowngrade = false;
  let state = { phase: app.isPackaged ? 'idle' : 'development', current: app.getVersion(), version: '', notes: '', percent: 0, error: '' };
  let busy = false;
  const set = (patch: Partial<typeof state>) => { state = { ...state, ...patch }; };
  autoUpdater.on('update-available', info => set({ phase: 'available', version: info.version, notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : (info.releaseNotes || []).map(n => n.note).join('\n'), error: '' }));
  autoUpdater.on('update-not-available', () => set({ phase: 'current', error: '' }));
  autoUpdater.on('download-progress', progress => set({ phase: 'downloading', percent: Math.round(progress.percent) }));
  autoUpdater.on('update-downloaded', info => set({ phase: 'ready', version: info.version, percent: 100, error: '' }));
  autoUpdater.on('error', () => set({ phase: 'error', error: 'Update failed. Check your internet connection and try again. The release may not have update files yet.' }));
  async function check() {
    if (!app.isPackaged || busy || ['ready', 'installing'].includes(state.phase)) return state;
    busy = true; set({ phase: 'checking', error: '', percent: 0 });
    try { await autoUpdater.checkForUpdates(); } catch { set({ phase: 'error', error: 'Could not check GitHub for updates. Check your connection and try again.' }); }
    finally { busy = false; }
    return state;
  }
  ipcMain.handle('core:update-status', () => state);
  ipcMain.handle('core:update-check', check);
  ipcMain.handle('core:update-download', async () => {
    if (busy || state.phase !== 'available') return state;
    busy = true; set({ phase: 'downloading', percent: 0, error: '' });
    try { await autoUpdater.downloadUpdate(); } catch { set({ phase: 'error', error: 'Download failed. Check for updates to retry.' }); }
    finally { busy = false; }
    return state;
  });
  ipcMain.handle('core:update-install', async () => {
    if (busy || state.phase !== 'ready') return state;
    if (isLive()) { set({ error: 'Disconnect from LIVE before installing.' }); return state; }
    if (isVideoBusy()) { set({ error: 'Finish or cancel the Golden Moments job before installing.' }); return state; }
    busy = true;
    try {
      const answer = await dialog.showMessageBox({ type: 'question', buttons: ['Cancel', 'Install and restart'], defaultId: 0, cancelId: 0, title: 'Update StreamPulse', message: `Install StreamPulse ${state.version}?`, detail: 'StreamPulse and its overlay links will close during installation. Your saved settings and gift rules will be kept.' });
      if (answer.response !== 1) return state;
      if (isLive()) { set({ error: 'Disconnect from LIVE before installing.' }); return state; }
      if (isVideoBusy()) { set({ error: 'Finish or cancel the Golden Moments job before installing.' }); return state; }
      set({ phase: 'installing', error: '' });
      await prepare();
      autoUpdater.quitAndInstall(false, true);
    } catch { set({ phase: 'ready', error: 'Installation could not start. Please try again.' }); }
    finally { busy = false; }
    return state;
  });
  if (app.isPackaged) setTimeout(() => void check(), 15000).unref();
}
