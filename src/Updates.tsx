import { useEffect, useState } from 'react';
export type UpdateState = { phase: string; current: string; version: string; notes: string; percent: number; error: string };
export default function Updates({ live, save, compact, open }: { live: boolean; save: () => Promise<unknown>; compact?: boolean; open?: () => void }) {
  const [state, setState] = useState<UpdateState | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; const refresh = () => window.streamPulseCore?.updateStatus().then(s => { if (active) setState(s); }).catch(() => {}); void refresh(); const timer = setInterval(refresh, 1000); return () => { active = false; clearInterval(timer); }; }, []);
  async function act(kind: 'check' | 'download' | 'install') {
    setError('');
    try { const api = window.streamPulseCore; if (!api) return; if (kind === 'install') await save(); const result = await (kind === 'check' ? api.updateCheck() : kind === 'download' ? api.updateDownload() : api.updateInstall()); setState(result); }
    catch { setError('Could not complete the update request. Please try again.'); }
  }
  const busy = !state || ['checking', 'downloading', 'installing'].includes(state.phase);
  if (compact) return state && ["available", "ready"].includes(state.phase) ? <div className="card row" role="status"><span>StreamPulse {state.version} {state.phase === "ready" ? "is ready to install" : "is available"}.</span><button onClick={open}>View update</button></div> : null;
  return <section className="card form"><h2>StreamPulse updates</h2><p>Installed: {state?.current || 'Checking…'} · Alpha releases</p><p>Updates are checked on startup. Downloads and installation start only when you choose. Installing temporarily stops your overlays.</p>
    <p role="status">{state?.phase === 'current' ? 'You are up to date.' : state?.phase === 'available' ? `Version ${state.version} is available.` : state?.phase === 'ready' ? `Version ${state.version} is ready to install.` : state?.phase === 'development' ? 'Updates are available in installed builds.' : state?.phase === 'checking' ? 'Checking GitHub…' : state?.phase === 'downloading' ? `Downloading: ${state.percent}%` : state?.phase === 'installing' ? 'Starting installer…' : ''}</p>
    {state?.phase === 'downloading' && <progress max="100" value={state.percent} aria-label="Update download progress"/>}
    <div className="row"><button disabled={busy || state?.phase === 'development' || state?.phase === 'ready'} onClick={() => void act('check')}>Check for updates</button>{state?.phase === 'available' && <button className="primary" onClick={() => void act('download')}>Download update</button>}{state?.phase === 'ready' && <button className="primary" disabled={live} onClick={() => void act('install')}>Install and restart</button>}</div>
    {live && <small>Disconnect from LIVE before installing.</small>}
    {(error || state?.error) && <p role="alert">{error || state?.error}</p>}
    {state?.notes && <details><summary>Release notes</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{state.notes}</pre></details>}
  </section>;
}
