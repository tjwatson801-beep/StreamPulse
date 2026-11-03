import { useEffect, useState, type FormEvent } from "react";
import type { CreditGroup, CreditSession } from "../electron/credits";

const groups: CreditGroup[] = ["Super Fans", "Active Fans", "Top Supporters", "New Followers"];
export type CreditsApi = {
  source(): Promise<string>;
  state(): Promise<{ session: CreditSession | null; collecting: boolean }>;
  start(): Promise<CreditSession>;
  stop(): Promise<CreditSession | null>;
  history(): Promise<CreditSession[]>;
  save(session: CreditSession): Promise<void>;
  preview(session: CreditSession): Promise<string>;
  show(session: CreditSession): Promise<void>;
  hide(): Promise<void>;
};

export default function CreditsManager({ overlayUrl, visible }: { overlayUrl: string; visible: boolean }) {
  const api = window.streamPulseCore?.credits;
  const [active, setActive] = useState<CreditSession | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [draft, setDraft] = useState<CreditSession | null>(null);
  const [history, setHistory] = useState<CreditSession[]>([]);
  const [group, setGroup] = useState<CreditGroup>("Super Fans");
  const [handle, setHandle] = useState("");
  const [preview, setPreview] = useState<{ html: string; id: number } | null>(null);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!api || !visible || busy) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const state = await api.state();
        if (cancelled) return;
        setActive(state.session);
        setCollecting(state.collecting);
      } catch (cause) {
        if (!cancelled) setError(String(cause));
      } finally {
        if (!cancelled) timer = setTimeout(refresh, 1500);
      }
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [api, visible, busy]);

  useEffect(() => {
    if (!api || !visible) return;
    let cancelled = false;
    Promise.all([api.history(), api.source()]).then(([sessions, pathname]) => {
      if (!cancelled) { setHistory(sessions); setSource(pathname); }
    }).catch(cause => { if (!cancelled) setError(String(cause)); });
    return () => { cancelled = true; };
  }, [api, visible]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    setError("");
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  function updateDraft(next: CreditSession) {
    setDraft(next);
    setPreview(null);
  }

  function add(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const name = handle.trim().replace(/^@/, "").trim();
    if (!name) return;
    const user = name.toLowerCase();
    if (draft.groups[group].some(row => row.user === user)) {
      setError("That viewer is already in this category.");
      return;
    }
    const excluded = groups.some(category => draft.groups[category].some(row => row.user === user && row.excluded));
    updateDraft({ ...draft, groups: { ...draft.groups, [group]: [...draft.groups[group], { user, name, excluded }] } });
    setHandle("");
    setError("");
  }

  function editRow(category: CreditGroup, index: number, operation: "remove" | "up" | "down" | "exclude") {
    if (!draft) return;
    const rows = [...draft.groups[category]];
    if (operation === "exclude") {
      const viewer = rows[index];
      const next = { ...draft.groups };
      for (const key of groups) next[key] = next[key].map(row =>
        row.user === viewer.user ? { ...row, excluded: !viewer.excluded } : row);
      updateDraft({ ...draft, groups: next });
      return;
    }
    if (operation === "remove") rows.splice(index, 1);
    else {
      const target = index + (operation === "up" ? -1 : 1);
      if (target < 0 || target >= rows.length) return;
      [rows[target], rows[index]] = [rows[index], rows[target]];
    }
    updateDraft({ ...draft, groups: { ...draft.groups, [category]: rows } });
  }

  if (!api) return <section className="card">Open Pearl desktop to manage stream credits.</section>;
  const sourceUrl = source ? new URL(source, overlayUrl).href : "";
  const date = (session: CreditSession) => new Date(session.startedAt).toLocaleString();

  return <>
    <header><div><small>xGOLDx · STREAM OUTRO</small><h1>Credits Manager</h1></div></header>
    <section className="card form">
      <h2>Livestream session</h2>
      <p>Start tracking before your LIVE. End tracking to edit and save the roll. Active Fans are ranked by chat, sticker and like events. Top Supporters are ranked by completed gift quantity. Each ranking starts with up to 20 viewers.</p>
      {active && <p>{collecting ? "Tracking since" : "Review pending for"} {date(active)} · {groups.map(key => `${key} ${active.groups[key].length}`).join(" · ")}</p>}
      <div className="row">
        <button className="primary" disabled={busy || !!active} onClick={() => void run(async () => {
          setActive(await api.start());
          setCollecting(true);
        })}>Start tracking</button>
        {active && <button disabled={busy} onClick={() => void run(async () => {
          const session = await api.stop();
          setCollecting(false);
          if (session && draft?.id !== session.id) updateDraft(session);
        })}>{collecting ? "End tracking and edit" : "Open current roll"}</button>}
      </div>
    </section>
    <section className="card form">
      <h2>Saved livestreams</h2>
      {history.length ? <select disabled={busy} aria-label="Open saved livestream" value={history.some(item => item.id === draft?.id) ? draft?.id : ""}
        onChange={event => {
          const session = history.find(item => item.id === event.target.value);
          if (session) updateDraft(session);
        }}>
        <option value="">Choose a livestream</option>
        {history.map(item => <option key={item.id} value={item.id}>{date(item)}</option>)}
      </select> : <p className="muted">Saved rolls will appear here.</p>}
    </section>
    {draft && <section className="card form">
      <h2>Edit roll · {date(draft)}</h2>
      <form className="row" onSubmit={add}>
        <select aria-label="Credit category" value={group} onChange={event => setGroup(event.target.value as CreditGroup)}>
          {groups.map(key => <option key={key}>{key}</option>)}
        </select>
        <input aria-label="Viewer username" placeholder="@username" maxLength={200} value={handle} onChange={event => setHandle(event.target.value)}/>
        <button type="submit" disabled={busy || !handle.trim()}>Add viewer</button>
      </form>
      <p className="muted">Exclude hides the viewer across all categories. Remove deletes the selected entry.</p>
      {groups.map(category => <div key={category}>
        <h3>{category}</h3>
        {!draft.groups[category].length && <p className="muted">No viewers</p>}
        {draft.groups[category].map((row, index, rows) => <div className="row" key={row.user}>
          <span>{row.name}{row.name !== row.user ? ` (@${row.user})` : ""}{row.excluded ? " · Excluded" : ""}</span>
          <button aria-label={`Move ${row.name} up in ${category}`} disabled={busy || index === 0} onClick={() => editRow(category, index, "up")}>↑</button>
          <button aria-label={`Move ${row.name} down in ${category}`} disabled={busy || index === rows.length - 1} onClick={() => editRow(category, index, "down")}>↓</button>
          <button disabled={busy} onClick={() => editRow(category, index, "exclude")}>{row.excluded ? "Include" : "Exclude"}</button>
          <button className="danger" disabled={busy} onClick={() => editRow(category, index, "remove")}>Remove</button>
        </div>)}
      </div>)}
      <div className="row">
        <button className="primary" disabled={busy} onClick={() => void run(async () => {
          await api.save(draft);
          setActive(current => current?.id === draft.id ? null : current);
          setHistory(await api.history());
          setMessage("Credits saved.");
        })}>Save credits</button>
        <button disabled={busy} onClick={() => void run(async () => setPreview({ html: await api.preview(draft), id: Date.now() }))}>{preview ? "Replay preview" : "Preview outro"}</button>
        {preview && <button disabled={busy} onClick={() => setPreview(null)}>Close preview</button>}
        <button disabled={busy || !preview} onClick={() => void run(async () => {
          await api.show(draft);
          setMessage("Outro sent to the LIVE Studio source.");
        })}>Play on stream source</button>
      </div>
      {preview && <iframe key={preview.id} title="Private outro preview" sandbox="allow-scripts" srcDoc={preview.html}
        style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }}/>}
    </section>}
    <section className="card form">
      <h2>TikTok LIVE Studio source</h2>
      <p>Add this link as a browser source in your outro scene. Copy a fresh link after restarting Pearl and keep the link private.</p>
      {sourceUrl && <label>Outro source URL<input readOnly value={sourceUrl}/></label>}
      <div className="row">
        <button disabled={busy || !sourceUrl} onClick={() => void run(async () => {
          await navigator.clipboard.writeText(sourceUrl);
          setMessage("Source link copied.");
        })}>Copy source link</button>
        <button disabled={busy} onClick={() => void run(async () => {
          await api.hide();
          setMessage("Stream outro cleared.");
        })}>Clear stream outro</button>
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p className="warning" role="alert">{error}</p>}
    </section>
  </>;
}
