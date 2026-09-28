import { Settings } from "./types";
import { Dispatch, SetStateAction, useState } from "react";

export default function LikeRankings({ overlayUrl, secure, settings, update }: { overlayUrl: string; secure: boolean; settings: Settings; update: Dispatch<SetStateAction<Settings>> }) {
  const [demo, setDemo] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const url = new URL("/overlay/likes", overlayUrl).href;
  const previewUrl = "http://localhost:17890/overlay/likes" + (demo ? "?preview=1" : "");
  async function copy() {
    try { await navigator.clipboard.writeText(url); setNotice("Leaderboard URL copied."); }
    catch { setNotice("Could not copy automatically. Select the URL and copy it."); }
  }
  async function reset() {
    setBusy(true);
    try {
      const result = await window.streamPulseCore?.resetLikes();
      setNotice(result?.ok ? "Rankings reset. New likes will begin the next count." : "Could not reset rankings.");
      if (result?.ok) setConfirmReset(false);
    } catch { setNotice("Could not reset rankings."); }
    finally { setBusy(false); }
  }
  return <><header><div><small>LIVE LIKES</small><h1>Every tap counts</h1></div></header>
    <section className="card form">
      <h2>Top 10 like leaderboard</h2>
      <p>Show the total LIVE likes and rank individual supporters with their profile pictures in a separate overlay. A gold crown marks the top liker. Tied leaders share the crown. Missing pictures show an initial.</p>
      <label>{secure ? "TikTok LIVE Studio URL" : "Local overlay URL"}<div className="row"><input readOnly value={url} onFocus={event => event.target.select()}/><button onClick={copy}>Copy URL</button></div></label>
      {!secure && <p className="warning">The local link works on this PC. Connect your secure link in Overlay for a TikTok LIVE Studio HTTPS URL.</p>}
      <p>Add a Link or browser source in your streaming software, paste this URL, and start with a {settings.likesWidth} × {Math.ceil(900 * settings.likesTextScale / 100)} canvas. Keep StreamPulse open and connected to your LIVE.</p>
      <p className="muted">Rankings count likes received while connected, so earlier or undelivered likes cannot be assigned to viewers. The total LIVE count comes from TikTok when supplied. A new room resets rankings automatically; reconnecting to the same room keeps them. Closing StreamPulse clears this session. If no room ID is supplied, use Reset rankings when starting a new stream.</p>
      <div className="row"><button onClick={() => setDemo(value => !value)}>{demo ? "Show live rankings" : "Preview with sample names"}</button><button className="danger" onClick={() => setConfirmReset(true)}>Reset rankings</button></div>
      {confirmReset && <div className="row"><span>Clear all individual counts for this stream?</span><button className="danger" disabled={busy} onClick={reset}>{busy ? "Resetting…" : "Clear rankings"}</button><button disabled={busy} onClick={() => setConfirmReset(false)}>Cancel</button></div>}
      <small role="status">{notice}</small>
    </section>
    <section className="card form"><h2>Overlay appearance</h2>
      <label>Font<select value={settings.likesFont} onChange={event => update(current => ({ ...current, likesFont: event.target.value }))}>{["Segoe UI", "Permanent Marker", "Arial", "Verdana", "Trebuchet MS", "Georgia", "Courier New"].map(font => <option key={font} value={font}>{font === "Permanent Marker" ? "Graffiti · Permanent Marker" : font}</option>)}</select></label>
      <small>Permanent Marker adds a graffiti-style look to headings and names. Counts stay in a clear, easy-to-read font.</small>
      <label>Text size: {settings.likesTextScale}%<input type="range" min="75" max="150" step="5" value={settings.likesTextScale} onChange={event => update(current => ({ ...current, likesTextScale: Number(event.target.value) }))}/></label>
      <label>Overlay width: {settings.likesWidth}px<input type="range" min="320" max="800" step="20" value={settings.likesWidth} onChange={event => update(current => ({ ...current, likesWidth: Number(event.target.value) }))}/></label>
      <small>Use the recommended browser-source dimensions above after resizing. Long names shorten to fit.</small>
      <button onClick={() => update(current => ({ ...current, likesFont: "Segoe UI", likesTextScale: 100, likesWidth: 480 }))}>Reset font and size</button>
      <label>Background transparency: {100 - settings.likesBackgroundOpacity}%<input type="range" min="0" max="100" step="1" value={100 - settings.likesBackgroundOpacity} onChange={event => update(current => ({ ...current, likesBackgroundOpacity: 100 - Number(event.target.value) }))}/></label>
      <small>0% is solid; 100% is fully transparent. Names, pictures, and like counts remain visible.</small>
      <label className="switch"><input type="checkbox" checked={settings.likesShowBorder} onChange={event => update(current => ({ ...current, likesShowBorder: event.target.checked }))}/> Show panel border</label>
      <div className="row"><button onClick={() => update(current => ({ ...current, likesBackgroundOpacity: 100, likesShowBorder: true }))}>Solid</button><button onClick={() => update(current => ({ ...current, likesBackgroundOpacity: 50, likesShowBorder: true }))}>Half transparent</button><button onClick={() => update(current => ({ ...current, likesBackgroundOpacity: 0, likesShowBorder: false }))}>Clear background</button></div>
      <small>Changes save automatically and update your existing overlay link. The checkerboard below shows transparent areas.</small>
    </section>
    <section className="card"><h2>{demo ? "Sample preview" : "Live overlay preview"}</h2><p className="muted">{demo ? "Sample names only appear here and never change your live rankings." : "The same leaderboard your viewers see."}</p><div className="likes-preview" style={{maxWidth: settings.likesWidth + 40}}><iframe style={{height: Math.ceil(900 * settings.likesTextScale / 100)}} key={previewUrl} title={demo ? "Sample like leaderboard" : "Live like leaderboard"} src={previewUrl}/></div></section>
  </>;
}



