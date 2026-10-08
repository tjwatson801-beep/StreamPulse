import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Settings, SoundClip } from './types';
import type { PlaybackState } from './soundPlayback';
type File = { path: string; filename: string };
type Props = { settings: Settings; update: Dispatch<SetStateAction<Settings>>; play: (path: string, label: string) => Promise<void>; stop: () => void; playback: PlaybackState; hotkeyErrors: string[] };
export default function SoundLibrary({ settings, update, play, stop, playback, hotkeyErrors }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [folder, setFolder] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState(false);
  const [assignClip, setAssignClip] = useState<File | null>(null);
  const [target, setTarget] = useState('');
  async function refresh() {
    setBusy(true);
    try { const result = await window.streamPulseCore?.soundLibrary(settings.soundLibraryFolder || ''); if (!result) throw Error('Sound library is unavailable. Restart the updated app.'); setFiles(result.files); setFolder(result.folder); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let disposed = false;
    const scan = async () => { try { const result = await window.streamPulseCore?.soundLibrary(settings.soundLibraryFolder || ''); if (disposed) return; if (!result) throw Error('Sound library is unavailable. Restart the updated app.'); setFiles(result.files); setFolder(result.folder); setError(''); } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : String(e)); } };
    void scan(); const timer = setInterval(() => void scan(), 10000);
    return () => { disposed = true; clearInterval(timer); };
  }, [settings.soundLibraryFolder]);
  function metadata(file: File): SoundClip { return settings.soundClips.find(c => c.path.toLowerCase() === file.path.toLowerCase()) || { path: file.path, name: file.filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), tags: '', favorite: false, hotkey: '' }; }
  function change(file: File, patch: Partial<SoundClip>) {
    update(current => { const previous = current.soundClips.find(c => c.path.toLowerCase() === file.path.toLowerCase()) || metadata(file); return { ...current, soundClips: [...current.soundClips.filter(c => c.path.toLowerCase() !== file.path.toLowerCase()), { ...previous, ...patch, path: file.path }] }; });
  }
  const targets = [
    ...settings.reactions.map(r => ({ id: `gift:${r.id}`, label: `Gift: ${r.giftName || 'Unnamed gift'}` })),
    ...settings.stickerReactions.map(r => ({ id: `sticker:${r.id}`, label: `Sticker: ${settings.stickerCatalog.find(s => s.id === r.stickerId)?.name || r.stickerId || 'Unnamed sticker'}` })),
    ...settings.superFans.map(r => ({ id: `fan:${r.id}`, label: `Super Fan: @${r.username}` })),
    { id: 'follow', label: 'New follower' }, { id: 'superfan', label: 'Default Super Fan entrance' }
  ];
  function assign() {
    if (!assignClip || !target) return;
    const path = assignClip.path;
    update(current => ({ ...current,
      reactions: current.reactions.map(r => `gift:${r.id}` === target ? { ...r, soundPath: path } : r),
      stickerReactions: current.stickerReactions.map(r => `sticker:${r.id}` === target ? { ...r, soundPath: path } : r),
      superFans: current.superFans.map(r => `fan:${r.id}` === target ? { ...r, soundPath: path } : r),
      followSoundPath: target === 'follow' ? path : current.followSoundPath,
      superFanSoundPath: target === 'superfan' ? path : current.superFanSoundPath
    }));
    setNotice(`Assigned ${metadata(assignClip).name || assignClip.filename} to ${targets.find(t => t.id === target)?.label}.`); setAssignClip(null); setTarget('');
  }
  const shown = files.filter(file => { const clip = metadata(file); return (!favorites || clip.favorite) && `${clip.name} ${clip.tags} ${file.filename}`.toLowerCase().includes(search.toLowerCase()); });
  return <>
    <header><div><small>SOUND LIBRARY</small><h1>Your LIVE soundboard</h1><p>Trigger a clip or attach it to an alert.</p></div><button className="danger" onClick={stop}>Stop all sounds</button></header>
    <section className="card form sound-controls">
      <div className="sound-controls-grid"><label>Sound master volume · {Math.round(settings.soundMasterVolume * 100)}%<input aria-label="Sound master volume" type="range" min="0" max="1" step=".05" value={settings.soundMasterVolume} onChange={e => update(s => ({ ...s, soundMasterVolume: Number(e.target.value) }))}/></label>
      <label>When another sound triggers<select aria-label="Sound playback mode" value={settings.soundPlaybackMode} onChange={e => update(s => ({ ...s, soundPlaybackMode: e.target.value as Settings['soundPlaybackMode'] }))}><option value="overlap">Allow overlap</option><option value="queue">Queue in order</option><option value="interrupt">Interrupt current sound</option></select></label></div>
      <small>Applies to soundboard clips and all alert sounds. Chat TTS keeps its own volume. Changing playback mode stops current sounds. Queues hold up to 20 clips and skip clips waiting over 30 seconds.</small>
      <div className="sound-now" role="status"><span>{playback.active.length ? `Playing: ${playback.active.join(', ')}` : 'Ready to play'}</span><span>{playback.queued} queued</span></div>
    </section>
    <section className="card sound-browser">
      <div className="sound-toolbar"><input aria-label="Search sounds" placeholder="Search names, tags, or filenames…" value={search} onChange={e => setSearch(e.target.value)}/><button aria-pressed={favorites} onClick={() => setFavorites(v => !v)}>{favorites ? '★ Favorites only' : '☆ All sounds'}</button><button disabled={busy} onClick={() => void refresh()}>{busy ? 'Scanning…' : 'Refresh'}</button><button onClick={async () => { try { const selected = await window.streamPulseCore?.pickSoundFolder(); if (selected) update(s => ({ ...s, soundLibraryFolder: selected })); } catch (e) { setError(String(e)); } }}>Choose folder</button></div>
      <p className="sound-folder">{folder || settings.soundLibraryFolder || 'Loading Sounds folder…'}</p><small className="muted">New files appear automatically. Hotkeys work while StreamPulse is open, including from other apps. Use Ctrl+Alt+1 or F1–F12; hotkeys pause while editing a field here.</small>
      {error && <p role="alert" className="warning">{error}</p>}{hotkeyErrors.map((message, i) => <p role="alert" className="warning" key={i}>{message}</p>)}
      <div className="sound-grid">{shown.map(file => { const clip = metadata(file); return <article className="sound-tile" key={file.path}>
        <div className="sound-tile-top"><button className="sound-play primary" aria-label={`Play ${clip.name || file.filename}`} onClick={() => void play(file.path, clip.name || file.filename)}>▶ Play</button><button className="sound-favorite" aria-label={`Favorite ${clip.name || file.filename}`} aria-pressed={clip.favorite} onClick={() => change(file, { favorite: !clip.favorite })}>{clip.favorite ? '★' : '☆'}</button></div>
        <label>Clip name<input aria-label={`Name ${file.filename}`} value={clip.name} onChange={e => change(file, { name: e.target.value })}/></label><span className="sound-filename" title={file.path}>{file.filename}</span>
        <label>Tags<input aria-label={`Tags ${file.filename}`} value={clip.tags} placeholder="funny, entrance, chiptune" onChange={e => change(file, { tags: e.target.value })}/></label>
        <label>Global hotkey<input aria-label={`Hotkey ${file.filename}`} value={clip.hotkey} placeholder="Ctrl+Alt+1" onChange={e => change(file, { hotkey: e.target.value })}/></label>
        <button onClick={() => { setAssignClip(file); setTarget(''); }}>Assign to alert</button>
      </article>; })}</div>
      {!error && !shown.length && <p className="sound-empty">{files.length ? 'No clips match your filters.' : 'Add MP3, WAV, OGG, M4A, AAC, FLAC, or WebM files to this folder, or choose another folder.'}</p>}
      <p className="muted">{shown.length} of {files.length} sounds</p>
    </section>
    {assignClip && <section className="card form sound-assignment"><h2>Assign {metadata(assignClip).name || assignClip.filename}</h2><label>Alert<select aria-label="Assign sound to alert" value={target} onChange={e => setTarget(e.target.value)}><option value="">Choose an alert…</option>{targets.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label><small>Create gift, sticker, or individual Super Fan alerts on their pages first. This updates the selected sound; the alert’s enable switch stays as configured.</small><div className="row"><button className="primary" disabled={!target || !targets.some(t => t.id === target)} onClick={assign}>Assign sound</button><button onClick={() => setAssignClip(null)}>Cancel</button></div></section>}
    {notice && <p role="status" className="good">{notice}</p>}
  </>;
}
