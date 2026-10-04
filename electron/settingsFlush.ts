import { randomUUID } from 'crypto';
import { BrowserWindow, ipcMain } from 'electron';
export function flushRendererSettings(window: BrowserWindow | null, timeoutMs = 10000): Promise<void> {
  if (!window || window.isDestroyed()) return Promise.resolve();
  const token = randomUUID();
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); ipcMain.removeListener('core:settings-flushed', reply); };
    const reply = (event: Electron.IpcMainEvent, result: {token: string; error?: string}) => {
      if (event.sender !== window.webContents || result?.token !== token) return;
      cleanup(); result.error ? reject(Error(result.error)) : resolve();
    };
    const timer = setTimeout(() => { cleanup(); reject(Error('The app did not finish saving settings.')); }, timeoutMs);
    ipcMain.on('core:settings-flushed', reply);
    try { window.webContents.send('core:flush-settings', token); } catch (error) { cleanup(); reject(error); }
  });
}
