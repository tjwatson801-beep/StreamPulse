import type { App, BrowserWindow } from 'electron';
export function claimInstance(app: Pick<App, 'requestSingleInstanceLock' | 'quit' | 'on'>, current: () => BrowserWindow | null) {
  if (!app.requestSingleInstanceLock()) { app.quit(); return false; }
  app.on('second-instance', () => { const window = current(); if (window && !window.isDestroyed()) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  return true;
}
