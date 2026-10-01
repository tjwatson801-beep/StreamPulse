import { useEffect, useState } from 'react';
import { Settings } from './types';
type Backup = { id: string; createdAt: string; reason: string };
export default function Reliability({ live, save, restore, pause }: { live: boolean; save: () => Promise<void>; restore: (s: Settings) => void; pause: (value: boolean) => void }) {
  const [backups,setBackups] = useState<Backup[]>([]), [selected,setSelected] = useState(''), [notice,setNotice] = useState(''), [busy,setBusy] = useState(false);
  const [health,setHealth] = useState<any>(null);
  const refresh = async () => { const items = await window.streamPulseCore?.backupList(); setBackups(items || []); };
  useEffect(() => { void refresh().catch(() => setNotice('Could not load backups.')); let active = true; const check = async () => { try { const h = await window.streamPulseCore?.health(); if(active) setHealth(h); } catch {} }; void check(); const timer=setInterval(check,15000);return()=>{active=false;clearInterval(timer);}; },[]);
  async function action(kind: 'backup' | 'restore') {
    setBusy(true); pause(true); setNotice('');
    try {
      const api=window.streamPulseCore;if(!api)throw Error('Open StreamPulse to use backups.');
      if(kind==='backup') { await save();await api.backupCreate();setNotice('Backup saved.'); }
      else { const result=await api.backupRestore(selected);if(result?.state){restore(result.state);setNotice('Settings restored. Sound and image files must still exist at their saved locations.');}else if(result?.error)throw Error(result.error); }
      await refresh();
    }catch(e){setNotice(e instanceof Error?e.message:'Backup operation failed.');}finally{pause(false);setBusy(false);}
  }
  return <><section className="card form"><h2>Connection health</h2><p>TikTok: {health?.live || 'Checking…'}</p><p>Local overlay: {health?.local?.message || 'Checking…'}</p><p>Cloudflare process: {health ? health.tunnel ? 'Running' : 'Stopped' : 'Checking…'}</p><p>Public overlay: {health?.public?.message || 'Checking…'}</p><small>Checked every 15 seconds. If the local overlay works but the public link fails, use Refresh secure link on the Overlay page. Refresh the source in LIVE Studio after recovery.</small></section>
  <section className="card form"><h2>Settings backups</h2><p>Automatic snapshots are kept before saves (hourly), on startup, and before updates. The latest 20 are retained locally.</p><small>Includes gift rules, overlay settings and file paths. Sound/image files and encrypted credentials are not copied. Backups stay on this PC.</small>
  <button disabled={busy} onClick={()=>void action('backup')}>Back up now</button><label>Saved backups<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a backup</option>{backups.map(b=><option key={b.id} value={b.id}>{new Date(b.createdAt).toLocaleString()} — {b.reason}</option>)}</select></label><button disabled={busy || live || !selected} onClick={()=>void action('restore')}>Restore selected backup</button>{live&&<small>Disconnect from LIVE before restoring.</small>}<p role="status">{notice}</p></section></>;
}
