import { useState } from "react";
import { Settings, OverlayStyle, overlayLibraryDefaults } from "./types";
type Props = { settings: Settings; update: (fn: (state: Settings) => Settings) => void; overlayUrl: string; secure: boolean };
export default function OverlayLibrary({ settings, update, overlayUrl, secure }: Props) {
  const roseImage = settings.giftCatalog.find(g => g.name.trim().toLowerCase() === "rose")?.imageUrl || "https://cdn.tik.tools/gifts/dca13c81e1bc524a3d2388b5.png";
  const [failedImage, setFailedImage] = useState("");
  const [notice, setNotice] = useState("");
  const config = { likes: { ...overlayLibraryDefaults.likes, ...settings.overlayLibrary?.likes }, gifts: { ...overlayLibraryDefaults.gifts, ...settings.overlayLibrary?.gifts } };
  const change = (key: "likes" | "gifts", patch: Partial<OverlayStyle> & { threshold?: number; minimumCount?: number; names?: string }) => update(s => ({ ...s, overlayLibrary: { likes: { ...overlayLibraryDefaults.likes, ...s.overlayLibrary?.likes, ...(key === "likes" ? patch : {}) }, gifts: { ...overlayLibraryDefaults.gifts, ...s.overlayLibrary?.gifts, ...(key === "gifts" ? patch : {}) } } }));
  const link = (kind: string) => { const url = new URL(overlayUrl); url.pathname = `/overlay/library/${kind}`; url.search = ""; url.hash = ""; return url.href; };
  async function preview(key: "likes" | "gifts") {
    try {
      const result = await window.streamPulseCore?.overlayShow({ ...config[key], channel: key === "likes" ? "like-pop" : "gift-highlight", title: key === "likes" ? `${config.likes.threshold.toLocaleString()} likes!` : "Rose ×5", body: key === "likes" ? "@GoldFan is spreading the love" : "Thank you, @GoldFan!", imageUrl: key === "gifts" ? roseImage : undefined });
      setNotice(result?.ok ? "Test sent to the preview and connected browser sources." : result?.error || "Open this page in StreamPulse to test an overlay.");
    } catch { setNotice("Could not send the test overlay. Please try again."); }
  }
  async function copy(url: string) { try { await navigator.clipboard.writeText(url); setNotice("Browser-source URL copied."); } catch { setNotice("Select and copy the URL from the field."); } }
  return <section className="overlay-library"><header><div><small>OVERLAY LIBRARY</small><h1>Give every moment a spotlight.</h1></div></header>
    <p>Choose a style, set a trigger, and add each URL as a separate browser source in TikTok LIVE Studio. Suggested source size: 640 × 480.</p>
    {!secure && <p className="warning">These are local preview links. Use the secure link controls below for TikTok LIVE Studio.</p>}
    <div className="overlay-library-grid">{(["likes", "gifts"] as const).map(key => { const item = config[key], isLikes = key === "likes", url = link(isLikes ? "like-pop" : "gift-highlight"); return <article className="card form" key={key}>
      <div><small>{isLikes ? "01 / COMMUNITY" : "02 / APPRECIATION"}</small><h2>{isLikes ? "Like celebration" : "Gift highlight"}</h2><p>{isLikes ? "Celebrate each viewer at every like milestone." : "Give completed gifts their own moment on screen."}</p></div>
      <div className="overlay-swatch" style={{ borderColor: item.accent }}>{!isLikes && failedImage !== roseImage ? <img className="overlay-gift-image" src={roseImage} alt="Rose gift" onError={() => setFailedImage(roseImage)}/> : <span style={{ color: item.accent }}>{isLikes ? "♥" : "✦"}</span>}<strong>{isLikes ? `${config.likes.threshold.toLocaleString()} likes!` : "Rose ×5"}</strong><small>{isLikes ? "@GoldFan is spreading the love" : "Thank you, @GoldFan!"}</small></div>
      <label className="overlay-enable"><input type="checkbox" checked={item.enabled} onChange={e => change(key, { enabled: e.target.checked })}/> Enable live alerts</label>
      {isLikes ? <label>Likes per viewer<input type="number" min="1" max="1000000" value={config.likes.threshold} onChange={e => change(key, { threshold: Math.max(1, Math.min(1000000, Math.floor(Number(e.target.value)) || 1)) })}/><small>Repeats at each multiple. Counts follow the Like Rankings session and reset with it. A batch crossing several milestones celebrates the highest one.</small></label> : <><label>Minimum gift quantity<input type="number" min="1" max="1000000" value={config.gifts.minimumCount} onChange={e => change(key, { minimumCount: Math.max(1, Math.min(1000000, Math.floor(Number(e.target.value)) || 1)) })}/></label><label>Gift names to include<input placeholder="All gifts, or Rose, Galaxy…" value={config.gifts.names} maxLength={4000} onChange={e => change(key, { names: e.target.value })}/><small>Leave blank for every gift. Separate exact gift names with commas. Quantity is the combo count, not coin value. This overlay has its own enable switch, independent of Gift Reactions.</small></label></>}
      <label>Style<select value={item.theme} onChange={e => change(key, { theme: e.target.value as OverlayStyle["theme"] })}><option value="glow">Neon glow</option><option value="minimal">Minimal card</option><option value="spotlight">Spotlight</option></select></label>
      <div className="row"><label>Accent color<input type="color" value={item.accent} onChange={e => change(key, { accent: e.target.value })}/></label><label>Duration (seconds)<input type="number" min="1" max="15" value={item.durationMs / 1000} onChange={e => change(key, { durationMs: Math.max(1000, Math.min(15000, Number(e.target.value) * 1000 || 1000)) })}/></label></div>
      <label>Browser-source URL<input readOnly value={url}/></label><div className="row"><button onClick={() => copy(url)}>Copy URL</button><button className="primary" onClick={() => preview(key)}>Test overlay</button></div>
      <details><summary>Live preview</summary><iframe title={`${isLikes ? "Likes" : "Gift"} overlay preview`} src={url}/><small>Open this preview, then press Test overlay. Tests also appear in connected Studio sources.</small></details>
    </article>; })}</div><p role="status">{notice}</p><p className="muted">Alerts play in order. During a busy burst, the queue keeps up to 20 alerts and skips alerts older than 30 seconds.</p>
  </section>;
}
