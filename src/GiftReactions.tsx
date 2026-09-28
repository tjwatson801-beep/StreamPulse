import { useState } from "react";
import GiftPicker from "./GiftPicker";
import { giftKey, giftOptions } from "./giftCatalog";
import { GiftReaction, Settings } from "./types";

type Props = {
  settings: Settings; update: (change: (current: Settings) => Settings) => void;
  pickSound: () => Promise<string | null | undefined>;
  preview: (path: string, label: string, volume?: number) => Promise<void>;
};

export default function GiftReactions({ settings, update, pickSound, preview }: Props) {
  const [search, setSearch] = useState("");
  const options = giftOptions(settings);
  const change = (id: string, patch: Partial<GiftReaction>) => update(s => ({ ...s, reactions: s.reactions.map(r => r.id === id ? { ...r, ...patch } : r) }));
  async function chooseSound(id: string) { const soundPath = await pickSound(); if (soundPath) change(id, { soundPath }); }
  function add() {
    setSearch("");
    update(s => ({ ...s, reactions: [...s.reactions, { id: crypto.randomUUID(), giftName: "", message: s.defaultGiftTemplate, speak: true, overlay: true, enabled: true, volume: 1, soundPath: "" }] }));
  }
  const rows = settings.reactions.filter(r => `${r.giftName || "Choose gift"} ${r.message} ${(r.soundPath || "").split(/[\\/]/).pop()}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <>
    <header><div><small>GIFT REACTIONS</small><h1>Thank every supporter</h1></div></header>
    <p>Choose a gift by its picture, then set its sound and response.</p>
    <section className="card sticker-alerts">
      <div className="sticker-toolbar">
        <button className="primary" onClick={add}>＋ Create gift reaction</button>
        <label><input type="checkbox" checked={settings.giftReactionsEnabled !== false} onChange={e => update(s => ({ ...s, giftReactionsEnabled: e.target.checked }))}/> Reactions enabled</label>
        <input aria-label="Search gift reactions" placeholder="Search reactions…" value={search} onChange={e => setSearch(e.target.value)}/>
      </div>
      <div className="sticker-table-wrap"><table className="sticker-table gift-reaction-table">
        <thead><tr><th>Test / remove</th><th>Enabled</th><th>Gift / response</th><th>Sound</th><th>Volume</th><th>Actions</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id}>
          <td><div className="sticker-actions">
            <button aria-label={`Preview ${r.giftName || "gift"} sound`} title="Preview sound" disabled={!r.soundPath} onClick={() => preview(r.soundPath!, r.giftName || "Gift preview", r.volume ?? 1)}>▶</button>
            <button aria-label={`Remove ${r.giftName || "gift"} reaction`} title="Remove reaction" onClick={() => update(s => ({ ...s, reactions: s.reactions.filter(item => item.id !== r.id) }))}>×</button>
          </div></td>
          <td><input aria-label="Enable gift reaction" type="checkbox" checked={r.enabled !== false} onChange={e => change(r.id, { enabled: e.target.checked })}/></td>
          <td>
            <GiftPicker options={options} value={r.giftName} used={settings.reactions.filter(other => other.id !== r.id).map(other => other.giftName)} onChange={giftName => change(r.id, { giftName })}/>
            <label className="gift-response">Response<input aria-label="Gift response" value={r.message} onChange={e => change(r.id, { message: e.target.value })}/></label>
          </td>
          <td><div className="sticker-sound"><button onClick={() => chooseSound(r.id)}>Select sound</button><span title={r.soundPath}>{(r.soundPath || "").split(/[\\/]/).pop() || "No sound selected"}</span>
            {r.soundPath && <button onClick={() => change(r.id, { soundPath: "" })}>Clear sound</button>}
          </div></td>
          <td><label className="sticker-volume"><input aria-label="Gift sound volume" type="range" min="0" max="1" step="0.05" value={r.volume ?? 1} onChange={e => change(r.id, { volume: Number(e.target.value) })}/><span>{Math.round((r.volume ?? 1) * 100)}%</span></label></td>
          <td><div className="gift-action-options"><label><input type="checkbox" checked={r.speak} onChange={e => change(r.id, { speak: e.target.checked })}/> TTS</label><label><input type="checkbox" checked={r.overlay} onChange={e => change(r.id, { overlay: e.target.checked })}/> Overlay</label></div></td>
        </tr>)}
        {!rows.length && <tr><td colSpan={6} className="sticker-empty">{search ? "No reactions match your search." : "Create a gift reaction to choose a gift, sound, and response."}</td></tr>}
        </tbody>
      </table></div>
      <p className="muted">Response placeholders: {"{username}"}, {"{gift}"}, {"{count}"}. ▶ previews the selected sound.</p>
    </section>
    <section className="card form"><h2>Default gift response</h2>
      <label>Response for gifts without a configured reaction<input value={settings.defaultGiftTemplate} onChange={e => update(s => ({ ...s, defaultGiftTemplate: e.target.value }))}/></label>
      <small>Unconfigured gifts use this message for TTS and overlays. Disabling a configured reaction silences that gift. Turning off Reactions enabled silences all gift reactions.</small>
    </section>
    <section className="card"><h2>Your gift library</h2>
      <p>StreamPulse uses your saved gifts and automatically adds gifts received during LIVE.</p>
      <p role="status">{options.length} gifts available in your saved library.</p>

      <p>Gifts received during LIVE are saved automatically. Your saved library remains available offline.</p>
    </section>
  </>;
}