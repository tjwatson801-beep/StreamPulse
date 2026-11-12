import { useEffect, useState } from "react";

type State = {
  connected: boolean;
  enabled: boolean;
  busy: boolean;
  redirectUri: string;
  pending: { id: string; user: string; trackId: string }[];
};
type Result = Promise<{ error?: string }>;

export type SpotifyApi = {
  status: () => Promise<State>;
  connect: (clientId: string) => Result;
  disconnect: () => Result;
  enable: (enabled: boolean) => Result;
  approve: (id: string) => Result;
  dismiss: (id: string) => Result;
  preview: (id: string) => Result;
  onChange: (handler: (state: State) => void) => () => void;
};

export function SpotifyRequests() {
  const api = window.streamPulseCore?.spotify;
  const [state, setState] = useState<State>();
  const [clientId, setClientId] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!api) return;
    let active = true;
    let receivedChange = false;
    const unsubscribe = api.onChange(next => { receivedChange = true; setState(next); });
    void api.status().then(next => {
      if (active && !receivedChange) setState(next);
    }).catch(() => {
      if (active) { setFailed(true); setMessage("Spotify requests could not be loaded."); }
    });
    return () => { active = false; unsubscribe(); };
  }, [api]);

  async function run(action: () => Result, success = "") {
    setMessage("");
    try {
      const result = await action();
      setFailed(Boolean(result.error));
      setMessage(result.error || success);
    } catch {
      setFailed(true);
      setMessage("The Spotify action failed. Try again.");
    }
  }

  return <>
    <header><div><small>CHAT</small><h1>Song requests</h1></div></header>
    <section className="card form">
      <h2>Spotify</h2>
      <p>Viewers can send <code>!sr &lt;Spotify track link&gt;</code> in LIVE chat. Approve a request to add it to the queue on your active Spotify device.</p>
      {!api && <p>Open the Pearl desktop app to connect Spotify.</p>}
      {api && state && (state.connected ? <>
        <label className="switch"><input type="checkbox" checked={state.enabled} disabled={state.busy} onChange={event => {
          const enabled = event.target.checked;
          void run(() => api.enable(enabled));
        }}/><span>Accept song requests</span></label>
        <small>Enable requests each time you restart Pearl. Spotify Premium and an active playback device are required.</small>
        <div className="row"><button className="danger" disabled={state.busy} onClick={() => void run(api.disconnect)}>Disconnect Spotify</button></div>
      </> : <>
        <p>Create a Spotify developer app with Web API access, register the redirect URI below, and paste its Client ID. Sign in with the Spotify Premium account playing your music.</p>
        <label>Spotify redirect URI<input readOnly value={state.redirectUri} onFocus={event => event.target.select()}/></label>
        <label>Spotify Client ID<input value={clientId} onChange={event => setClientId(event.target.value)} disabled={state.busy} spellCheck={false}/></label>
        <div className="row"><button className="primary" disabled={state.busy || !clientId.trim()} onClick={() => void run(() => api.connect(clientId), "Spotify connected.")}>{state.busy ? "Finish signing in in your browser…" : "Connect Spotify"}</button></div>
      </>)}
      {message && <p role="status" className={failed ? "warning" : "good"}>{message}</p>}
    </section>
    {api && state?.connected && <section className="card form">
      <h2>Pending requests ({state.pending.length})</h2>
      <small>One pending request per viewer, a one-minute cooldown, and up to 25 requests. Pending requests clear when Pearl closes.</small>
      {!state.pending.length && <p>No pending song requests.</p>}
      {state.pending.map(request => <div key={request.id} className="followBox">
        <strong>@{request.user}</strong>
        <small>Spotify track {request.trackId}</small>
        <div className="row">
          <button disabled={state.busy} onClick={() => void run(() => api.preview(request.id))}>Open track</button>
          <button className="primary" disabled={state.busy} onClick={() => void run(() => api.approve(request.id), `Queued @${request.user}’s request in Spotify.`)}>Approve and queue</button>
          <button disabled={state.busy} onClick={() => void run(() => api.dismiss(request.id))}>Dismiss</button>
        </div>
      </div>)}
    </section>}
  </>;
}
