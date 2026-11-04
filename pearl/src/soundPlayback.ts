export type SoundMode = 'queue' | 'interrupt' | 'overlap';
export type PlaybackState = { active: string[]; queued: number };
type Request = { path: string; label: string; volume: number; added: number };
type Track = { audio: HTMLAudioElement; request: Request; timer?: ReturnType<typeof setTimeout> };
export function soundUrl(path: string) {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.startsWith('//')) {
    const [host, ...parts] = normalized.slice(2).split('/');
    return `file://${host}/${parts.map(encodeURIComponent).join('/')}`;
  }
  return `file:///${normalized.split('/').map((part, i) => i === 0 ? part : encodeURIComponent(part)).join('/')}`;
}
export class SoundPlayback {
  private active = new Set<Track>();
  private queue: Request[] = [];
  private mode: SoundMode = 'overlap';
  private master = 1;
  constructor(private report: (level: 'action' | 'blocked' | 'error', text: string) => void,
    private changed: (state: PlaybackState) => void,
    private create: (url: string) => HTMLAudioElement = url => new Audio(url),
    private now: () => number = Date.now) {}
  configure(master: number, mode: SoundMode) {
    this.master = Number.isFinite(master) ? Math.max(0, Math.min(1, master)) : 1;
    if (mode !== this.mode) { this.stop(); this.mode = mode; }
    for (const track of this.active) track.audio.volume = track.request.volume * this.master;
  }
  private publish() { this.changed({ active: [...this.active].map(t => t.request.label), queued: this.queue.length }); }
  stop() {
    this.queue = [];
    for (const track of this.active) {
      track.audio.onended = track.audio.onerror = null;
      if (track.timer) clearTimeout(track.timer);
      track.audio.pause();
      try { track.audio.currentTime = 0; } catch {}
    }
    this.active.clear(); this.publish();
  }
  async play(path: string, label: string, volume = 1) {
    if (!path) return;
    const request = { path, label, volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1, added: this.now() };
    if (this.mode === 'interrupt') this.stop();
    if (this.mode === 'queue' && this.active.size) {
      if (this.queue.length >= 20) { this.report('blocked', 'Sound queue is full; latest sound skipped.'); return; }
      this.queue.push(request); this.publish(); this.report('action', `Queued sound: ${label}`); return;
    }
    if (this.active.size >= 32) { this.report('blocked', 'Too many overlapping sounds; latest sound skipped.'); return; }
    await this.start(request);
  }
  private async start(request: Request) {
    let track: Track | undefined;
    try {
      const audio = this.create(soundUrl(request.path));
      track = { audio, request };
      const current = track;
      audio.volume = request.volume * this.master;
      audio.onended = () => this.finish(current);
      audio.onerror = () => { if (this.active.has(current)) { this.report('error', `Could not play ${request.label}. Check the file and audio format.`); this.finish(current); } };
      this.active.add(track); this.publish();
      // A damaged or stalled file must not hold a live queue indefinitely.
      track.timer = setTimeout(() => { if (this.active.has(current)) { this.report('blocked', `Sound timed out: ${request.label}`); this.finish(current); } }, 120000);
      await audio.play();
      if (!this.active.has(current)) { audio.pause(); return; }
      if (track.timer) clearTimeout(track.timer);
      track.timer = undefined;
      this.report('action', `Sound (${request.label}): ${request.path.split(/[\\/]/).pop()}`);
    } catch (error) {
      if (!track || this.active.has(track)) this.report('error', `Could not play ${request.label}: ${error instanceof Error ? error.message : String(error)}`);
      if (track) this.finish(track);
    }
  }
  private finish(track: Track) {
    if (!this.active.delete(track)) return;
    if (track.timer) clearTimeout(track.timer);
    track.audio.onended = track.audio.onerror = null;
    track.audio.pause();
    this.publish();
    if (!this.active.size && this.mode === 'queue') {
      let next = this.queue.shift();
      while (next && this.now() - next.added > 30000) { this.report('blocked', `Stale queued sound skipped: ${next.label}`); next = this.queue.shift(); }
      this.publish(); if (next) void this.start(next);
    }
  }
}
