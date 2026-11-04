import { useState } from "react";
import { Settings, OverlayStyle, overlayLibraryDefaults } from "./types";
type Props = { settings: Settings; update: (fn: (state: Settings) => Settings) => void; overlayUrl: string; secure: boolean };
export default function OverlayLibrary({ settings, update, overlayUrl, secure }: Props) {
  const roseImage = settings.giftCatalog.find(g => g.name.trim().toLowerCase() === "rose")?.imageUrl || "https://cdn.tik.tools/gifts/dca13c81e1bc524a3d2388b5.png";
  const [failedImage, setFailedImage] = useState("");
  const [notice, setNotice] = useState("");
  const config = { likes: { ...overlayLibraryDefaults.likes, ...settings.overlayLibrary?.likes }, gifts: { ...overlayLibraryDefaults.gifts, ...settings.overlayLibrary?.gifts } };
  const change = (key: "likes" | "gifts", patch: Partial<OverlayStyle> & { threshold?: number; minimumCount?: number; names?: string; maxBanners?: number }) => update(s => ({ ...s, overlayLibrary: { likes: { ...overlayLibraryDefaults.likes, ...s.overlayLibrary?.likes, ...(key === "likes" ? patch : {}) }, gifts: { ...overlayLibraryDefaults.gifts, ...s.overlayLibrary?.gifts, ...(key === "gifts" ? patch : {}) } } }));
  const link = (kind: string) => { const url = new URL(overlayUrl); url.pathname = `/overlay/library/${kind}`; url.search = ""; url.hash = ""; return url.href; };
  async function preview(key: "likes" | "gifts") {
    try {
      let result;
      for (let index = 0; index < (key === "gifts" ? config.gifts.maxBanners : 1); index++) {
      result = await window.streamPulseCore?.overlayShow({ ...config[key], channel: key === "likes" ? "like-pop" : "gift-highlight", title: key === "likes" ? `${config.likes.threshold.toLocaleString()} likes!` : "Rose ×5", body: key === "likes" ? "@GoldFan is spreading the love" : "Thank you, @GoldFan!", imageUrl: key === "gifts" ? roseImage : undefined });
      if (!result?.ok) break;
      }
      setNotice(result?.ok ? "Test sent to the preview and connected browser sources." : result?.error || "Open this page in Pearl to test an overlay.");
    } catch { setNotice("Could not send the test overlay. Please try again."); }
  }
  async function pickBackground(key: "likes" | "gifts") {
    try {
      const path = await window.streamPulseCore?.pickImage();
      if (path) { change(key, { backgroundImagePath: path, backgroundMode: "image" }); setNotice("Background selected. Press Test overlay to preview it."); }
      else if (!window.streamPulseCore) setNotice("Open this page in Pearl to choose a background image.");
    } catch { setNotice("Could not select a background image. Please try again."); }
  }
  async function copy(url: string) { try { await navigator.clipboard.writeText(url); setNotice("Browser-source URL copied."); } catch { setNotice("Select and copy the URL from the field."); } }
  return <section className="overlay-library"><header><div><small>OVERLAY LIBRARY</small><h1>Give every moment a spotlight.</h1></div></header>
    <p>Choose a style, set a trigger, and add each URL as a separate browser source in TikTok LIVE Studio. Suggested source sizes: Gift highlight 960 × {config.gifts.maxBanners === 1 ? 240 : config.gifts.maxBanners * 180 + 40}; Like celebration 640 × 480.</p>
    {!secure && <p className="warning">These are local preview links. Use the secure link controls below for TikTok LIVE Studio.</p>}
    <div className="overlay-library-grid">{(["likes", "gifts"] as const).map(key => { const item = config[key], isLikes = key === "likes", url = link(isLikes ? "like-pop" : "gift-highlight"); return <article className="card form" key={key}>
      <div><small>{isLikes ? "01 / COMMUNITY" : "02 / APPRECIATION"}</small><h2>{isLikes ? "Like celebration" : "Gift highlight"}</h2><p>{isLikes ? "Celebrate each viewer at every like milestone." : "Show completed gifts in a wide banner with artwork and a sender thank-you."}</p></div>
      <div className={`overlay-swatch${isLikes ? "" : " gift-banner-swatch"}`} style={{ borderColor: item.accent, fontFamily: `"${item.font}", sans-serif` }}>{!isLikes && failedImage !== roseImage ? <img className="overlay-gift-image" src={roseImage} alt="Rose gift" onError={() => setFailedImage(roseImage)}/> : <span style={{ color: item.accent }}>{isLikes ? "♥" : "✦"}</span>}<strong>{isLikes ? `${config.likes.threshold.toLocaleString()} likes!` : "Rose ×5"}</strong><small>{isLikes ? "@GoldFan is spreading the love" : "Thank you, @GoldFan!"}</small></div>
      <label className="overlay-enable"><input type="checkbox" checked={item.enabled} onChange={e => change(key, { enabled: e.target.checked })}/> Enable live alerts</label>
      {isLikes ? <label>Likes per viewer<input type="number" min="1" max="1000000" value={config.likes.threshold} onChange={e => change(key, { threshold: Math.max(1, Math.min(1000000, Math.floor(Number(e.target.value)) || 1)) })}/><small>Repeats at each multiple. Counts follow the Like Rankings session and reset with it. A batch crossing several milestones celebrates the highest one.</small></label> : <><label>Banners at once<select value={config.gifts.maxBanners} onChange={e => change(key, { maxBanners: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map(count => <option key={count} value={count}>{count === 1 ? "1 banner" : `${count} stacked banners`}</option>)}</select><small>Each banner keeps its own duration. Extra gifts wait for an open spot. Increase your browser-source height to fit the stack.</small></label><label>Minimum gift quantity<input type="number" min="1" max="1000000" value={config.gifts.minimumCount} onChange={e => change(key, { minimumCount: Math.max(1, Math.min(1000000, Math.floor(Number(e.target.value)) || 1)) })}/></label><label>Gift names to include<input placeholder="All gifts, or Rose, Galaxy…" value={config.gifts.names} maxLength={4000} onChange={e => change(key, { names: e.target.value })}/><small>Leave blank for every gift. Separate exact gift names with commas. Quantity is the combo count, not coin value. This overlay has its own enable switch, independent of Gift Reactions.</small></label></>}
      <label>Style<select value={item.theme} onChange={e => change(key, { theme: e.target.value as OverlayStyle["theme"] })}><option value="glow">Neon glow</option><option value="minimal">Minimal card</option><option value="spotlight">Spotlight</option></select></label>
      <label>Font<select value={item.font} onChange={e => change(key, { font: e.target.value })}>{["Segoe UI", "Permanent Marker", "Arial", "Verdana", "Trebuchet MS", "Georgia", "Courier New"].map(font => <option key={font} value={font}>{font === "Permanent Marker" ? "Graffiti · Permanent Marker" : font}</option>)}</select></label>
      <div className="row"><label>Accent color<input type="color" value={item.accent} onChange={e => change(key, { accent: e.target.value })}/></label><label>Duration (seconds)<input type="number" min="1" max="15" value={item.durationMs / 1000} onChange={e => change(key, { durationMs: Math.max(1000, Math.min(15000, Number(e.target.value) * 1000 || 1000)) })}/></label></div>
      <label>Background<select value={item.backgroundMode} onChange={e => change(key, { backgroundMode: e.target.value as OverlayStyle["backgroundMode"] })}><option value="theme">Use selected style</option><option value="transparent">Transparent</option><option value="solid">Solid color</option><option value="image">Custom image</option></select></label>
      {item.backgroundMode === "solid" && <label>Background color<input type="color" value={item.backgroundColor} onChange={e => change(key, { backgroundColor: e.target.value })}/></label>}
      {item.backgroundMode === "image" && <div><label>Background image<input readOnly value={item.backgroundImagePath} placeholder="Choose a background image"/></label><div className="row"><button onClick={() => pickBackground(key)}>Choose image</button>{item.backgroundImagePath && <button onClick={() => change(key, { backgroundImagePath: "", backgroundMode: "theme" })}>Remove image</button>}</div><small>PNG, JPG, GIF, or WebP, up to 15 MB. Images fill each card and crop to fit. Press Test overlay to preview.</small></div>}
      {(item.backgroundMode === "solid" || item.backgroundMode === "image") && <label>Background opacity: {item.backgroundOpacity}%<input type="range" min="0" max="100" value={item.backgroundOpacity} onChange={e => change(key, { backgroundOpacity: Number(e.target.value) })}/><small>Changes only the background; text and gift artwork stay visible.</small></label>}
      <label>Browser-source URL<input readOnly value={url}/></label><div className="row"><button onClick={() => copy(url)}>Copy URL</button><button className="primary" onClick={() => preview(key)}>Test overlay</button></div>
      <details><summary>Live preview</summary><iframe style={{ height: isLikes ? 330 : Math.max(330, config.gifts.maxBanners * 180 + 40) }} title={`${isLikes ? "Likes" : "Gift"} overlay preview`} src={url}/><small>Open this preview, then press Test overlay. Tests also appear in connected Studio sources.</small></details>
    </article>; })}</div><p role="status">{notice}</p><p className="muted">Alerts play in order, with gift highlights filling the selected number of banner spots. During a busy burst, the queue keeps up to 20 alerts and skips alerts older than 30 seconds.</p>
  </section>;
}
