import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
export class SettingsStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private root: string) {}
  private serial<T>(fn: () => Promise<T>): Promise<T> { const next = this.queue.then(fn); this.queue = next.catch(() => {}); return next; }
  private get file() { return path.join(this.root, 'settings.json'); }
  private get directory() { return path.join(this.root, 'backups'); }
  private validate(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Settings must be an object.');
    const state = value as Record<string, any>;
    for (const key of ['reactions','giftActions','giftCatalog','stickerCatalog','stickerReactions','superFans']) if (key in state && !Array.isArray(state[key])) throw new Error(`Invalid ${key} settings.`);
    return state;
  }
  private async read() { try { return this.validate(JSON.parse(await fs.readFile(this.file, 'utf8'))); } catch (e: any) { if (e.code === 'ENOENT') return {}; throw new Error('Settings could not be read. Restore a saved backup in Settings.'); } }
  load() { return this.serial(() => this.read()); }
  private async write(state: unknown) {
    const text = JSON.stringify(this.validate(state), null, 2);
    await fs.mkdir(this.root, { recursive: true });
    const temporary = this.file + '.' + randomUUID() + '.tmp';
    try { await fs.writeFile(temporary, text, { flag: 'wx' }); await fs.rename(temporary, this.file); }
    finally { await fs.unlink(temporary).catch(() => {}); }
  }
  private async entries() {
    await fs.mkdir(this.directory, { recursive: true });
    return (await fs.readdir(this.directory)).filter(n => /^\d{13}-[a-f0-9-]+\.json$/.test(n)).sort().reverse();
  }
  private async snapshot(reason: string) {
    const state = await this.read();
    const id = `${Date.now()}-${randomUUID()}.json`;
    await fs.mkdir(this.directory, { recursive: true });
    await fs.writeFile(path.join(this.directory, id), JSON.stringify({ format: 1, createdAt: new Date().toISOString(), reason, settings: state }, null, 2), { flag: 'wx' });
    for (const old of (await this.entries()).slice(20)) await fs.unlink(path.join(this.directory, old));
    return id;
  }
  backup(reason: string) { return this.serial(() => this.snapshot(reason)); }
  save(state: unknown) { return this.serial(async () => {
    this.validate(state);
    // Refuse to replace a damaged file with empty defaults.
    await this.read();
    const entries = await this.entries();
    if (!entries.length || Date.now() - Number(entries[0].slice(0,13)) > 3600000) await this.snapshot('Automatic before save');
    await this.write(state);
  }); }
  list() { return this.serial(async () => {
    const result = [];
    for (const id of await this.entries()) { try { const data = JSON.parse(await fs.readFile(path.join(this.directory,id),'utf8')); this.validate(data.settings); result.push({ id, createdAt: data.createdAt, reason: data.reason }); } catch {} }
    return result;
  }); }
  restore(id: string) { return this.serial(async () => {
    if (!(await this.entries()).includes(id)) throw new Error('Backup not found.');
    const data = JSON.parse(await fs.readFile(path.join(this.directory,id),'utf8'));
    if (data.format !== 1) throw new Error('Unsupported backup format.');
    const state = this.validate(data.settings);
    try { await this.snapshot('Before restore'); } catch {
      // Preserve damaged settings before restoring a known-good snapshot.
      await fs.copyFile(this.file, this.file + '.damaged-' + Date.now()).catch((e:any) => { if(e.code !== 'ENOENT') throw e; });
    }
    await this.write(state); return state;
  }); }
}
