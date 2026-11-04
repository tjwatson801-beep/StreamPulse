import fs from 'fs/promises';
import path from 'path';
export const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm']);
export async function scanSounds(folder: string) {
  if (typeof folder !== 'string' || !path.isAbsolute(folder)) throw Error('Choose an absolute Sounds folder.');
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const files = entries.filter(entry => entry.isFile() && audioExtensions.has(path.extname(entry.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { folder, files: files.map(file => ({ path: path.join(folder, file.name), filename: file.name })), truncated: false };
}
export function normalizeHotkey(value: string): string {
  if (typeof value !== 'string') return '';
  const parts = value.trim().split('+').map(p => p.trim().toUpperCase());
  const key = parts.pop() || '';
  const aliases: Record<string, string> = { CTRL: 'Control', CONTROL: 'Control', ALT: 'Alt', SHIFT: 'Shift' };
  if (parts.some(p => !aliases[p])) return '';
  const modifiers = new Set(parts.map(p => aliases[p]));
  if (!/^(?:[A-Z0-9]|F(?:[1-9]|1[0-2]))$/.test(key) || (!modifiers.size && !/^F/.test(key))) return '';
  return [...['Control', 'Alt', 'Shift'].filter(p => modifiers.has(p)), key].join('+');
}
type ShortcutApi = { register: (key: string, callback: () => void) => boolean; unregister: (key: string) => void };
export class SoundHotkeys {
  private registered: string[] = [];
  constructor(private api: ShortcutApi, private fire: (path: string) => void) {}
  clear() { for (const key of this.registered) this.api.unregister(key); this.registered = []; }
  configure(value: unknown) {
    this.clear();
    if (!Array.isArray(value) || value.length > 1000) throw Error('Invalid sound hotkey list.');
    const errors: string[] = []; const used = new Set<string>();
    for (const item of value) {
      if (!item || typeof item.path !== 'string' || !path.isAbsolute(item.path) || !audioExtensions.has(path.extname(item.path).toLowerCase()) || typeof item.hotkey !== 'string') { errors.push('Invalid sound hotkey entry.'); continue; }
      if (!item.hotkey.trim()) continue;
      const key = normalizeHotkey(item.hotkey);
      if (!key) { errors.push(`Invalid hotkey: ${item.hotkey}. Use Ctrl+Alt+1 or F1–F12.`); continue; }
      if (used.has(key)) { errors.push(`Duplicate hotkey ${key}. Only the first clip is registered.`); continue; }
      used.add(key);
      try { if (!this.api.register(key, () => this.fire(item.path))) { errors.push(`Hotkey ${key} is already in use by another app.`); continue; } }
      catch { errors.push(`Could not register hotkey ${key}.`); continue; }
      this.registered.push(key);
    }
    return { errors, registered: this.registered.length };
  }
}
