import { luckyWheelUrl } from './giftActions';
import { useState } from 'react';
import GiftPicker from './GiftPicker';
import { giftOptions } from './giftCatalog';
import type { GiftAction, Settings } from './types';
export default function Actions({ settings, update, test }: { settings: Settings; update: (fn: (s: Settings) => Settings) => void; test: (rule: GiftAction) => Promise<void> }) {
  const [testing, setTesting] = useState<string | null>(null);
  const rules = settings.giftActions || [];
  const change = (id: string, patch: Partial<GiftAction>) => update(s => ({ ...s, giftActions: (s.giftActions || []).map(r => r.id === id ? { ...r, ...patch } : r) }));
  const add = () => update(s => ({ ...s, giftActions: [...(s.giftActions || []), { id: crypto.randomUUID(), enabled: false, giftName: '', minimumCount: 1, kind: 'webhook', webhookUrl: luckyWheelUrl, webhookMethod: 'GET', webhookBody: '', message: 'Thanks {username} for {gift} ×{count}!', soundPath: '', imagePath: '', volume: 1, durationMs: 5000 }] }));
  async function pick(rule: GiftAction, image: boolean) {
    const path = image ? await window.streamPulseCore?.pickImage() : await window.streamPulseCore?.pickSound();
    if (path) change(rule.id, image ? { imagePath: path } : { soundPath: path });
  }
  return <>
    <header><div><small>ACTIONS</small><h1>If this gift, then that action</h1></div><button className="primary" onClick={add}>＋ Add rule</button></header>
    <p>Choose a gift and what it triggers. Each matching rule runs once when the gift combo finishes. Rules save automatically.</p>
    <p className="muted">Actions run alongside Gift Reactions. TTS actions use your voice settings and require TTS to be enabled. Overlays appear on your gift overlay source.</p>
    {!rules.length && <section className="card"><h2>Create your first action</h2><p>For example: if someone sends a Rose, then send a spin request to Lucky Wheel.</p><button onClick={add}>Add a gift rule</button></section>}
    {rules.map((r, index) => <section className="card form" key={r.id}>
      <div className="row"><h2>Rule {index + 1}</h2><label><input type="checkbox" checked={r.enabled} onChange={e => change(r.id, { enabled: e.target.checked })}/> Enabled</label><button onClick={() => update(s => ({ ...s, giftActions: (s.giftActions || []).filter(x => x.id !== r.id) }))}>Remove rule</button></div>
      <h3>IF someone sends</h3>
      <GiftPicker options={giftOptions(settings)} value={r.giftName} used={[]} onChange={giftName => change(r.id, { giftName })}/>
      <label>Exact gift name<input value={r.giftName} placeholder="Rose" onChange={e => change(r.id, { giftName: e.target.value })}/><small>Choose from your library or type a gift name. Capitalization does not matter.</small></label>
      <label>Minimum quantity in one combo<input type="number" min="1" step="1" value={r.minimumCount} onChange={e => change(r.id, { minimumCount: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}/></label>
      <h3>THEN</h3>
      <label>Action<select value={r.kind} onChange={e => change(r.id, { kind: e.target.value as GiftAction['kind'] })}><option value="webhook">Lucky Wheel / webhook</option><option value="sound">Play a sound</option><option value="tts">Speak a message</option><option value="overlay">Show an overlay / image / GIF</option></select></label>
      {r.kind !== 'webhook' && (r.kind === 'sound' ? <><div className="row"><button onClick={() => pick(r, false)}>Choose sound</button><span>{r.soundPath.split(/[\\/]/).pop() || 'No sound selected'}</span></div><label>Volume: {Math.round(r.volume * 100)}%<input type="range" min="0" max="1" step=".05" value={r.volume} onChange={e => change(r.id, { volume: Number(e.target.value) })}/></label></> : <label>Message<input value={r.message} onChange={e => change(r.id, { message: e.target.value })}/><small>Use {'{username}'}, {'{gift}'}, and {'{count}'}.</small></label>)}
      {r.kind === 'overlay' && <><div className="row"><button onClick={() => pick(r, true)}>Choose image or GIF</button><span>{r.imagePath.split(/[\\/]/).pop() || 'Uses the gift picture by default'}</span>{r.imagePath && <button onClick={() => change(r.id, { imagePath: '' })}>Clear image</button>}</div><label>Duration (seconds)<input type="number" min="1" max="15" value={r.durationMs / 1000} onChange={e => change(r.id, { durationMs: Math.min(15000, Math.max(1000, Number(e.target.value) * 1000 || 5000)) })}/></label></>}
      {r.kind === 'webhook' && <>
        <button onClick={() => change(r.id, { webhookUrl: luckyWheelUrl, webhookMethod: 'GET', webhookBody: '' })}>Use Lucky Wheel preset</button><small>{'{nickname}'} is replaced with the gift sender name. Each completed matching combo sends one spin request.</small>
        <label>Spin webhook URL<input type="url" value={r.webhookUrl || ''} placeholder="Paste the URL from Lucky Wheel" onChange={e => change(r.id, { webhookUrl: e.target.value })}/></label>
        <label>Request method<select value={r.webhookMethod || 'GET'} onChange={e => change(r.id, { webhookMethod: e.target.value as 'GET' | 'POST' })}><option>GET</option><option>POST</option></select></label>
        {r.webhookMethod === 'POST' && <label>JSON request body (only if required)<textarea value={r.webhookBody || ''} onChange={e => change(r.id, { webhookBody: e.target.value })}/></label>}
        <small>Copy the spin URL and method from Lucky Wheel or its TikFinity setup. Keep Lucky Wheel running. Test action sends a real request; check the wheel and the Live activity log for the result.</small>
      </>}
      <button disabled={testing !== null || (r.kind === 'webhook' && !r.webhookUrl?.trim()) || !r.giftName.trim() || (r.kind === 'sound' && !r.soundPath) || (r.kind === 'tts' && !r.message.trim())} onClick={async () => { setTesting(r.id); try { await test(r); } finally { setTesting(null); } }}>{testing === r.id ? "Testing…" : "Test action"}</button><small>Tests use viewer “GoldFan” and the minimum quantity, even when this rule is disabled.</small>
    </section>)}
  </>;
}
