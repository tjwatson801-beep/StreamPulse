import GoldenMoments from './GoldenMoments';
import SoundLibrary from './SoundLibrary';
import { SoundPlayback } from './soundPlayback';
import type { PlaybackState } from './soundPlayback';
import Reliability from './Reliability';
import Updates from './Updates';
import { chatTtsFilterReason } from "./ttsFilters";
import Actions from './Actions';
import { matchesGiftAction, giftWebhookUrl } from './giftActions';
import type { GiftAction } from './types';
import OverlayLibrary from "./OverlayLibrary";
import LikeRankings from "./LikeRankings";
import GiftReactions from "./GiftReactions";
import { rememberGift } from "./giftCatalog";
import StickerSounds from "./StickerSounds";
import { rememberSticker } from "./stickerCatalog";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaults, LiveEvent, Settings, SuperFanProfile } from "./types";

type Page = "Golden Moments" | "Sound Library" | "Actions" | "Live" | "Chat TTS" | "Gift Reactions" | "Sticker Sounds" | "Like Rankings" | "Overlay" | "Settings";
type Activity = { id: string; time: string; level: "event" | "action" | "blocked" | "error"; text: string; stickerImageUrl?: string };
const fill = (template: string, event: LiveEvent) => template.replaceAll("{username}", event.user || "viewer").replaceAll("{message}", event.detail || "").replaceAll("{gift}", event.giftName || "gift").replaceAll("{count}", String(event.count || 1));

export default function App() {
  const [playback, setPlayback] = useState<PlaybackState>({active: [], queued: 0});
  const [hotkeyErrors, setHotkeyErrors] = useState<string[]>([]);
  const soundPlayer = useRef<SoundPlayback | null>(null);
  const savingPaused = useRef(false);
  const [settingsError, setSettingsError] = useState("");
  const [diagnosticReport, setDiagnosticReport] = useState("");
  const [page, setPage] = useState<Page>("Live"); const [settings, setSettings] = useState<Settings>(defaults);
  const [loaded, setLoaded] = useState(false); const [status, setStatus] = useState("disconnected"); const [statusText, setStatusText] = useState("Offline");
  const [events, setEvents] = useState<LiveEvent[]>([]); const [activity, setActivity] = useState<Activity[]>([]); const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [tunnelCommand, setTunnelCommand] = useState(""); const [hasTunnelKey, setHasTunnelKey] = useState(false); const [overlayUrl, setOverlayUrl] = useState("http://localhost:17890/overlay/gifts?v=24-repeat"); const [secureOverlay, setSecureOverlay] = useState(false); const [permanentTunnel, setPermanentTunnel] = useState(false); const [tunnelBusy, setTunnelBusy] = useState(false); const [tunnelError, setTunnelError] = useState("");
  const [stickerNotice, setStickerNotice] = useState("");
  const [superFanDraft, setSuperFanDraft] = useState({ username: "", message: "Welcome {username}!" });
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const saveStateRef = useRef({loaded, settingsError}); saveStateRef.current = {loaded, settingsError};
  useEffect(() => window.streamPulseCore?.onFlushSettings?.(async () => {
    if (!saveStateRef.current.loaded || savingPaused.current) throw Error("Settings are still loading or restoring. Please try closing again shortly.");
    if (saveStateRef.current.settingsError) throw Error(saveStateRef.current.settingsError);
    const result = await window.streamPulseCore?.save(settingsRef.current);
    if (!result?.ok) throw Error("Settings could not be saved.");
  }), []);
  useEffect(() => {
    let disposed = false;
    const timer = setInterval(() => { void window.streamPulseCore?.info().then(info => {
      if(disposed)return;
      if(info?.overlayUrl)setOverlayUrl(info.overlayUrl);
      setSecureOverlay(Boolean(info?.secure?.connected));setPermanentTunnel(Boolean(info?.secure?.permanent));setTunnelError(info?.secure?.error || "");
    }).catch(() => {}); }, 10000);
    return () => { disposed=true;clearInterval(timer); };
  }, []);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]); useEffect(() => { voicesRef.current = voices; }, [voices]);
  const announcedSuperFansRef = useRef(new Set<string>());
  const log = (level: Activity["level"], text: string, stickerImageUrl?: string) => setActivity(current => [{ id: crypto.randomUUID(), time: new Date().toLocaleTimeString(), level, text, stickerImageUrl }, ...current].slice(0, 100));

  useEffect(() => { (async () => { const saved = await window.streamPulseCore?.load(); if (saved?.settingsLoadError) setSettingsError(saved.settingsLoadError); if (saved) setSettings({ ...defaults, ...saved, soundClips: Array.isArray(saved.soundClips) ? saved.soundClips : [], giftActions: Array.isArray(saved.giftActions) ? saved.giftActions : [], giftCatalog: Array.isArray(saved.giftCatalog) ? saved.giftCatalog : [], stickerCatalog: Array.isArray(saved.stickerCatalog) ? saved.stickerCatalog : [], stickerReactions: Array.isArray(saved.stickerReactions) ? saved.stickerReactions : [], reactions: Array.isArray(saved.reactions) ? saved.reactions : [], superFans: Array.isArray(saved.superFans) ? saved.superFans : [] }); const credential = await window.streamPulseCore?.credentialStatus(); setHasTunnelKey(Boolean(credential?.hasTunnelCredential)); const info = await window.streamPulseCore?.info(); if (info?.overlayUrl) setOverlayUrl(info.overlayUrl); setSecureOverlay(Boolean(info?.secure?.connected)); setPermanentTunnel(Boolean(info?.secure?.permanent)); setTunnelError(info?.secure?.error || ""); setLoaded(true); })(); }, []);
  useEffect(() => { if (!loaded || savingPaused.current || settingsError) return; const timer = setTimeout(() => { if (!savingPaused.current) void window.streamPulseCore?.save(settings).catch(() => setSettingsError("Settings could not be saved. Open Settings to recover a backup.")); }, 250); return () => clearTimeout(timer); }, [loaded, settings, settingsError]);
  useEffect(() => { const refresh = () => { const list = speechSynthesis.getVoices(); setVoices(list); setSettings(current => current.voiceURI || !list.length ? current : { ...current, voiceURI: list.find(v => /^en/i.test(v.lang))?.voiceURI || list[0].voiceURI }); }; refresh(); speechSynthesis.onvoiceschanged = refresh; return () => { speechSynthesis.onvoiceschanged = null; }; }, []);
  useEffect(() => { const offStatus = window.streamPulseCore?.onStatus(value => { setStatus(value.status); setStatusText(value.message || value.status); if (value.status === "error") log("error", value.message || "LIVE connection error"); else if (value.status === "reconnecting") log("blocked", value.message || "Reconnecting to LIVE"); else if (value.status === "connecting") log("event", value.message || "Connecting"); else if (value.status === "connected") log("action", value.message || "LIVE connected"); }); const offEvent = window.streamPulseCore?.onEvent(handleEvent); return () => { offStatus?.(); offEvent?.(); }; }, []);

  function allowed(event: LiveEvent) { const audience = settingsRef.current.audience; return audience === "everyone" || (audience === "followers" && Boolean(event.isFollower)) || (audience === "subscribers" && Boolean(event.isSubscriber)); }
  function speak(text: string) { const current = settingsRef.current; if (!current.ttsEnabled || !text.trim()) return; const utterance = new SpeechSynthesisUtterance(text); utterance.voice = voicesRef.current.find(v => v.voiceURI === current.voiceURI) || null; utterance.volume = current.volume; utterance.rate = current.rate; utterance.pitch = current.pitch; speechSynthesis.speak(utterance); log("action", `TTS (${utterance.voice?.name || "Windows default"}): ${text}`); }
  function getSoundPlayer() { if (!soundPlayer.current) soundPlayer.current = new SoundPlayback(log, setPlayback); return soundPlayer.current; }
  async function playSound(path: string, label: string, volume = 1) { const current = settingsRef.current; const player = getSoundPlayer(); player.configure(current.soundMasterVolume, current.soundPlaybackMode); await player.play(path, label, volume); }
  function stopSounds() { soundPlayer.current?.stop(); log('action', 'All sounds stopped; sound queue cleared.'); }
  useEffect(() => { soundPlayer.current?.configure(settings.soundMasterVolume, settings.soundPlaybackMode); }, [settings.soundMasterVolume, settings.soundPlaybackMode]);
  useEffect(() => () => soundPlayer.current?.stop(), []);
  const hotkeyConfig = JSON.stringify(settings.soundClips.map(({path, hotkey}) => ({path, hotkey})));
  useEffect(() => {
    if (!loaded || !window.streamPulseCore?.setSoundHotkeys) return;
    let disposed = false;
    const timer = setTimeout(() => { void window.streamPulseCore!.setSoundHotkeys(JSON.parse(hotkeyConfig)).then(result => { if (!disposed) setHotkeyErrors(result.errors); }).catch(error => { if (!disposed) setHotkeyErrors([String(error)]); }); }, 400);
    return () => { disposed = true; clearTimeout(timer); };
  }, [loaded, hotkeyConfig]);
  useEffect(() => window.streamPulseCore?.onSoundHotkey?.(path => {
    if (document.hasFocus() && document.activeElement?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const clip = settingsRef.current.soundClips.find(item => item.path === path);
    if (clip?.hotkey) void playSound(path, clip.name || path.split(/[\\/]/).pop() || 'Soundboard');
  }), []);
  async function chooseFollowSound() { const path = await window.streamPulseCore?.pickSound(); if (path) setSettings(current => ({ ...current, followSoundPath: path })); }
  async function chooseSuperFanSound() { const path = await window.streamPulseCore?.pickSound(); if (path) setSettings(current => ({ ...current, superFanSoundPath: path })); }
  async function chooseSuperFanImage() { const path = await window.streamPulseCore?.pickImage(); if (path) setSettings(current => ({ ...current, superFanImagePath: path })); }
  async function chooseProfileImage(id: string) { const path = await window.streamPulseCore?.pickImage(); if (path) setSettings(current => ({ ...current, superFans: current.superFans.map(profile => profile.id === id ? { ...profile, imagePath: path } : profile) })); }
  async function chooseProfileSound(id: string) { const path = await window.streamPulseCore?.pickSound(); if (path) setSettings(current => ({ ...current, superFans: current.superFans.map(profile => profile.id === id ? { ...profile, soundPath: path } : profile) })); }
  function updateSuperFan(id: string, change: Partial<SuperFanProfile>) { setSettings(current => ({ ...current, superFans: current.superFans.map(profile => profile.id === id ? { ...profile, ...change } : profile) })); }
  function addSuperFan() { const username = superFanDraft.username.trim().replace(/^@/, ""); if (!username) return; if (settings.superFans.some(profile => profile.username.toLowerCase() === username.toLowerCase())) { log("error", `@${username} already has a Super Fan overlay`); return; } const profile: SuperFanProfile = { id: crypto.randomUUID(), username, message: superFanDraft.message.trim() || "Welcome {username}!", imagePath: "", soundPath: "", durationMs: 6000, enabled: true }; setSettings(current => ({ ...current, superFans: [...current.superFans, profile] })); setSuperFanDraft({ username: "", message: "Welcome {username}!" }); }
  async function showSuperFan(event: LiveEvent, previewProfile?: SuperFanProfile) { const current = settingsRef.current; const normalized = event.user.trim().replace(/^@/, "").toLowerCase(); const profile = previewProfile || current.superFans.find(item => item.enabled && item.username.trim().replace(/^@/, "").toLowerCase() === normalized); const message = fill(profile?.message || current.superFanTemplate, event); const imagePath = profile?.imagePath || current.superFanImagePath; const soundPath = profile?.soundPath || current.superFanSoundPath; const durationMs = profile?.durationMs || current.superFanDurationMs; const result = await window.streamPulseCore?.overlayShow({ channel: "superfan", title: profile ? `Welcome @${profile.username}!` : "Super Fan entered!", body: message, imagePath, durationMs }); if (result?.ok === false) log("error", result.error || "Overlay picture could not be loaded"); if (soundPath) await playSound(soundPath, profile ? `Super Fan @${profile.username}` : "Super Fan"); log("action", `Super Fan overlay${profile ? ` for @${profile.username}` : " (fallback)"}: ${message}`); }
  async function runGiftAction(rule: GiftAction, event: LiveEvent) {
    try {
      const message = fill(rule.message, event);
      if (rule.kind === 'sound') { if (!rule.soundPath) { log('blocked', 'Action has no sound selected'); return; } await playSound(rule.soundPath, `Action: ${rule.giftName}`, rule.volume); }
      else if (rule.kind === 'webhook') { const result = await window.streamPulseCore?.webhook({ url: giftWebhookUrl(rule.webhookUrl || '', event), method: rule.webhookMethod || 'GET', body: rule.webhookBody || '' }); if (!result?.ok) throw new Error(result?.error || 'Webhook unavailable'); }
      else if (rule.kind === 'tts') { if (!settingsRef.current.ttsEnabled) { log('blocked', 'Action skipped: TTS is disabled'); return; } speak(message); }
      else if (rule.kind === 'overlay') { const result = await window.streamPulseCore?.overlayShow({ title: `${event.giftName} received!`, body: message, imagePath: rule.imagePath, imageUrl: rule.imagePath ? undefined : event.giftImageUrl, durationMs: rule.durationMs }); if (!result || result.ok === false) throw new Error(result?.error || 'Overlay unavailable'); }
      log('action', `Gift rule: ${rule.giftName} → ${rule.kind}`);
    } catch (error) { log('error', `Gift action failed: ${String(error)}`); }
  }
  async function handleEvent(event: LiveEvent) {
    if (event.type === "Gift") setSettings(current => rememberGift(current, event));
    if (event.type === "Sticker" && !event.stickerId) { setStickerNotice(event.detail); log("error", event.detail); return; }
    const normalized = event.user.trim().replace(/^@/, "").toLowerCase();
    const profile = settingsRef.current.superFans.find(item => item.username.trim().replace(/^@/, "").toLowerCase() === normalized);
    if (event.type === "Join") { setEvents(items => [event, ...items].slice(0, 100)); if (!profile) { log("event", `Entrance: @${event.user.replace(/^@/, "")} entered the LIVE`); return; } log("action", `Super Fan roster match: @${event.user.replace(/^@/, "")} entered the LIVE`); if (!settingsRef.current.superFanEnabled || !profile.enabled) log("blocked", `Super Fan overlay for ${event.user} is disabled`); else { announcedSuperFansRef.current.add(normalized); await showSuperFan(event, profile); } return; }
    if (event.type !== "SuperFanJoin" && profile && profile.enabled && settingsRef.current.superFanEnabled && !announcedSuperFansRef.current.has(normalized)) { announcedSuperFansRef.current.add(normalized); log("action", `Super Fan first activity detected: @${event.user.replace(/^@/, "")}`); await showSuperFan(event, profile); }
    setEvents(current => [event, ...current].slice(0, 50)); log("event", event.type === "Sticker" ? `${event.user} sent sticker ${event.stickerId}` : `${event.type}: ${event.user} — ${event.detail}`, event.type === "Sticker" ? event.stickerImageUrl : undefined);
    if (event.type === "Sticker") {
      setStickerNotice(`Sticker received at ${event.time}. Your dropdown is up to date.`);
      setSettings(current => rememberSticker(current, event));
      const reaction = settingsRef.current.stickerReactions.find(item => item.stickerId === event.stickerId);
      if (reaction?.enabled && settingsRef.current.stickerSoundsEnabled) await playSound(reaction.soundPath, "sticker", reaction.volume ?? 1);
      else log("blocked", reaction ? `Sticker ${event.stickerId} sound is disabled` : `No sound configured for sticker ${event.stickerId}. Open Sticker Sounds to add one.`);
      return;
    }
    if (event.type === "Chat") { if (!allowed(event)) { log("blocked", `Chat from ${event.user} skipped by ${settingsRef.current.audience} filter`); return; } const reason = chatTtsFilterReason(event.detail || "", settingsRef.current); if (reason) { log("blocked", "Chat from " + event.user + " skipped: " + reason); return; } speak(fill(settingsRef.current.chatTemplate, event)); return; }
    if (event.type === "Follow") { if (settingsRef.current.followEnabled) speak(fill(settingsRef.current.followTemplate, event)); else log("blocked", `Follow response for ${event.user} is disabled`); await playSound(settingsRef.current.followSoundPath, "follow"); return; }
    if (event.type === "SuperFanJoin") { const current = settingsRef.current; if (!current.superFanEnabled || profile?.enabled === false) log("blocked", `Super Fan overlay for ${event.user} is disabled`); else { announcedSuperFansRef.current.add(normalized); await showSuperFan(event, profile); } return; }
    for (const rule of settingsRef.current.giftActions || []) { if (matchesGiftAction(rule, event)) await runGiftAction(rule, event); }
    if (event.type === "Gift" && event.comboComplete !== false) { const reaction = settingsRef.current.reactions.find(item => item.giftName.trim().toLowerCase() === event.giftName?.trim().toLowerCase()); if (settingsRef.current.giftReactionsEnabled === false || reaction?.enabled === false) { log("blocked", "Gift reaction is disabled"); return; } const message = fill(reaction?.message || settingsRef.current.defaultGiftTemplate, event); if (reaction?.speak !== false) speak(message); if (reaction?.soundPath) await playSound(reaction.soundPath, reaction.giftName, reaction.volume ?? 1); if (reaction?.overlay !== false) { const result = await window.streamPulseCore?.overlayShow({ title: `${event.giftName || "Gift"} received!`, body: message, imageUrl: event.giftImageUrl }); if (result?.ok === false) log("error", result.error || "Gift picture could not be loaded"); if (!event.giftImageUrl) log("event", `No gift picture supplied for ${event.giftName || "this gift"}`); log("action", `Overlay: ${message}`); } }
  }
  async function copyDiagnostics() {
    try { const report = await window.streamPulseCore?.diagnostics(); if (!report) throw new Error("Diagnostics unavailable"); setDiagnosticReport(report); await navigator.clipboard.writeText(report); log("action", "Diagnostics copied. Paste them into your support conversation."); }
    catch (error) { log("error", `Could not copy diagnostics: ${String(error)}`); }
  }
  async function connect() { announcedSuperFansRef.current.clear(); const result = await window.streamPulseCore?.connect(settings.username, settings.connectionProvider); if (result?.error === "Connection cancelled") return; if (!result?.ok) { setStatus("error"); setStatusText(result?.error || "Connection failed"); log("error", result?.error || "Connection failed"); } }
  async function refreshSecureLink() { setTunnelBusy(true); setTunnelError(""); const result = await window.streamPulseCore?.restartSecureTunnel(); setTunnelBusy(false); if (result?.overlayUrl) setOverlayUrl(result.overlayUrl); setSecureOverlay(Boolean(result?.connected)); setPermanentTunnel(Boolean(result?.permanent)); setTunnelError(result?.error || ""); log(result?.connected ? "action" : "error", result?.connected ? "Secure overlay link refreshed" : result?.error || "Secure overlay link failed"); }
  async function configurePermanentTunnel() { setTunnelBusy(true); setTunnelError(""); const result = await window.streamPulseCore?.configurePermanentTunnel(tunnelCommand, settings.permanentOverlayHostname); setTunnelBusy(false); if (result?.overlayUrl) setOverlayUrl(result.overlayUrl); setSecureOverlay(Boolean(result?.connected)); setPermanentTunnel(Boolean(result?.permanent)); setTunnelError(result?.error || ""); if (result?.ok) { setTunnelCommand(""); setHasTunnelKey(true); log("action", "Permanent Cloudflare tunnel connected"); } else log("error", result?.error || "Permanent tunnel failed to connect"); }
  const followerLabel = (e: LiveEvent) => e.isSubscriber ? "Subscriber" : e.isFollower ? "Follower" : "Everyone";
  const counts = useMemo(() => ({ chat: events.filter(e => e.type === "Chat").length, gifts: events.filter(e => e.type === "Gift").length, joins: events.filter(e => e.type === "Join").length }), [events]);

  const superFanUrl = new URL("/overlay/superfans", overlayUrl).href;
  const superFanRoster = <section className="card form">
    <h2>Individual Super Fan overlays</h2>
    <p>Add each Super Fan using their exact TikTok username. Matching ignores capitalization and a leading @.</p>
    <div className="row"><input placeholder="TikTok username" value={superFanDraft.username} onChange={e=>setSuperFanDraft(d=>({...d,username:e.target.value}))}/><input placeholder="Welcome message" value={superFanDraft.message} onChange={e=>setSuperFanDraft(d=>({...d,message:e.target.value}))}/><button className="primary" onClick={addSuperFan}>Add Super Fan</button></div>
    {settings.superFans.length===0?<p className="muted">No individual Super Fans configured. The standard overlay above will be used.</p>:settings.superFans.map(profile=><div className="card form" key={profile.id}>
      <div className="row"><strong>@{profile.username}</strong><label className="switch"><input type="checkbox" checked={profile.enabled} onChange={e=>updateSuperFan(profile.id,{enabled:e.target.checked})}/><span>{profile.enabled?"Enabled":"Disabled"}</span></label></div>
      <label>TikTok username<input value={profile.username} onChange={e=>updateSuperFan(profile.id,{username:e.target.value.replace(/^@/,"")})}/></label>
      <label>Custom message<input value={profile.message} onChange={e=>updateSuperFan(profile.id,{message:e.target.value})}/><small>Use {"{username}"}</small></label>
      <label>Display duration (seconds)<input type="number" min="1" max="15" value={profile.durationMs/1000} onChange={e=>updateSuperFan(profile.id,{durationMs:Math.min(15000,Math.max(1000,Number(e.target.value)*1000))})}/></label>
      <div className="row"><button onClick={()=>chooseProfileImage(profile.id)}>{profile.imagePath?"Change image":"Choose image or GIF"}</button>{profile.imagePath&&<button className="danger" onClick={()=>updateSuperFan(profile.id,{imagePath:""})}>Clear image</button>}<small>{profile.imagePath.split(/[\\/]/).pop()}</small></div>
      <div className="row"><button onClick={()=>chooseProfileSound(profile.id)}>{profile.soundPath?"Change sound":"Choose sound"}</button>{profile.soundPath&&<><button onClick={()=>playSound(profile.soundPath,`@${profile.username} preview`)}>Preview sound</button><button className="danger" onClick={()=>updateSuperFan(profile.id,{soundPath:""})}>Clear sound</button></>}<small>{profile.soundPath.split(/[\\/]/).pop()}</small></div>
      <div className="row"><button className="primary" disabled={!profile.enabled} onClick={()=>showSuperFan({id:"preview",type:"SuperFanJoin",user:profile.username,detail:"entered as a Super Fan",time:""},profile)}>Test @{profile.username}</button><button className="danger" onClick={()=>setSettings(current=>({...current,superFans:current.superFans.filter(item=>item.id!==profile.id)}))}>Remove</button></div>
    </div>)}
  </section>;

  const permanentTunnelSetup = <section className="card form">
    <h2>Permanent Cloudflare address</h2>
    <label>Permanent hostname<input value={settings.permanentOverlayHostname} onChange={e=>setSettings(current=>({...current,permanentOverlayHostname:e.target.value}))} placeholder="overlay.streampulse.us"/></label>
    <label>Cloudflare connector command or token<div className="row"><input type="password" value={tunnelCommand} onChange={e=>setTunnelCommand(e.target.value)} placeholder={hasTunnelKey?"Encrypted tunnel token is saved":"Paste the Cloudflare command or token"}/><button className="primary" disabled={!tunnelCommand.trim()||tunnelBusy} onClick={configurePermanentTunnel}>{tunnelBusy?"Connecting…":"Save and connect"}</button></div></label>
    <p className={permanentTunnel?"good":"muted"}>{permanentTunnel?"Permanent tunnel connected. This overlay address will not change.":hasTunnelKey?"A permanent tunnel credential is stored securely on this PC.":"The token is encrypted using Windows protection and is never shown again."}</p>
  </section>;

  return <div className="shell"><aside><div className="brand"><span>⌁</span><div><strong>StreamPulse</strong><small>TikTok Studio Core</small></div></div>{(["Live","Golden Moments","Sound Library","Actions","Chat TTS","Gift Reactions","Sticker Sounds","Like Rankings","Overlay","Settings"] as Page[]).map(item => <button className={page===item?"active":""} onClick={()=>setPage(item)} key={item}>{item}</button>)}<div className={`connection ${status}`}><i/><span>{statusText}</span></div></aside><main><Updates compact={page !== "Settings"} open={() => setPage("Settings")} live={["connected","connecting","reconnecting"].includes(status)} save={async () => { const result = await window.streamPulseCore?.save(settingsRef.current); if (!result?.ok) throw new Error("Settings could not be saved"); }}/>
    <div hidden={page !== 'Golden Moments'}><GoldenMoments/></div>
    {page === 'Sound Library' && <SoundLibrary settings={settings} update={setSettings} play={playSound} stop={stopSounds} playback={playback} hotkeyErrors={hotkeyErrors}/>}
    {page === "Live" && <><header><div><small>LIVE CONTROL</small><h1>Make your LIVE react.</h1><small>{settings.connectionProvider === "direct" ? "Direct TikTok · experimental" : "TikFinity · keep its desktop app connected"}</small></div><button className={["connected","connecting","reconnecting"].includes(status)?"danger":"primary"} onClick={()=>["connected","connecting","reconnecting"].includes(status)?window.streamPulseCore?.disconnect():connect()}>{["connected","connecting","reconnecting"].includes(status)?"Disconnect":"Connect LIVE"}</button></header><section className="stats"><article><small>Chat received</small><strong>{counts.chat}</strong></article><article><small>Gifts received</small><strong>{counts.gifts}</strong></article><article><small>Chat audience</small><strong>{settings.audience}</strong></article></section><section className="card"><div className="row"><h2>Quick test</h2><button className="danger" onClick={stopSounds}>Stop all sounds</button><button onClick={() => setPage("Sound Library")}>Open soundboard</button></div><p>Test the complete pipeline without going LIVE.</p><div className="row"><button onClick={()=>window.streamPulseCore?.mock("Chat")}>Simulate follower chat</button><button onClick={()=>window.streamPulseCore?.mock("Gift")}>Simulate Rose ×5</button><button onClick={()=>window.streamPulseCore?.mock("Follow")}>Simulate new follower</button><button onClick={()=>window.streamPulseCore?.mock("SuperFanJoin")}>Simulate Super Fan entry</button></div></section><section className="card"><h2>Activity</h2><button onClick={copyDiagnostics}>Copy diagnostics</button>{diagnosticReport&&<details><summary>Connection diagnostics</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{diagnosticReport}</pre></details>}{activity.length===0?<p className="muted">Events and actions will appear here.</p>:activity.map(item=><div className={`activity ${item.level}`} key={item.id}><time>{item.time}</time><span className="activity-content">{item.stickerImageUrl?.startsWith("https://") && <img className="activity-sticker" src={item.stickerImageUrl} alt="Sticker" onError={event => { event.currentTarget.hidden = true; }}/>}<span>{item.text}</span></span></div>)}</section></>}
    {page === "Chat TTS" && <>
      <header><div><small>CHAT TTS</small><h1>Read chat aloud</h1></div><label className="switch"><input type="checkbox" checked={settings.ttsEnabled} onChange={e=>setSettings(s=>({...s,ttsEnabled:e.target.checked}))}/><span>{settings.ttsEnabled?"Enabled":"Disabled"}</span></label></header>
      <section className="card form">
        <label>Who can be read?<select value={settings.audience} onChange={e=>setSettings(s=>({...s,audience:e.target.value as Settings["audience"]}))}><option value="everyone">Everyone</option><option value="followers">Followers only</option><option value="subscribers">Subscribers only</option></select></label>
        <fieldset className="followBox">
          <legend>Message filters</legend>
          <label>Blocked words or phrases<textarea rows={5} value={settings.ttsBlockedPhrases} onChange={e=>setSettings(s=>({...s,ttsBlockedPhrases:e.target.value}))} placeholder="One word or phrase per line"/></label>
          <small>Skip the entire chat message when it contains a listed word or phrase. One entry per line; capitalization is ignored. Whole words match, so “bad” does not match “badge”.</small>
          <label className="switch"><input type="checkbox" checked={settings.ttsSkipLinks} onChange={e=>setSettings(s=>({...s,ttsSkipLinks:e.target.checked}))}/><span>Skip messages containing links</span></label>
          <label className="switch"><input type="checkbox" checked={settings.ttsSkipCommands} onChange={e=>setSettings(s=>({...s,ttsSkipCommands:e.target.checked}))}/><span>Skip commands starting with !</span></label>
          <small>Filters apply to chat read aloud. Skipped messages remain visible in Recent chat.</small>
        </fieldset>
        <label>Voice<select value={settings.voiceURI} onChange={e=>setSettings(s=>({...s,voiceURI:e.target.value}))}>{voices.map(v=><option value={v.voiceURI} key={v.voiceURI}>{v.name}</option>)}</select><small>Selected: {voices.find(v=>v.voiceURI===settings.voiceURI)?.name || "Windows default"}</small></label>
        <label>Chat message template<input value={settings.chatTemplate} onChange={e=>setSettings(s=>({...s,chatTemplate:e.target.value}))}/><small>Use {"{username}"} and {"{message}"}</small></label>
        <div className="followBox"><label className="switch"><input type="checkbox" checked={settings.followEnabled} onChange={e=>setSettings(s=>({...s,followEnabled:e.target.checked}))}/><span>Speak when someone follows</span></label><label>Custom follow response<input value={settings.followTemplate} disabled={!settings.followEnabled} onChange={e=>setSettings(s=>({...s,followTemplate:e.target.value}))}/><small>Use {"{username}"}</small></label><div className="row"><button onClick={chooseFollowSound}>{settings.followSoundPath?"Change follow sound":"Choose follow sound"}</button>{settings.followSoundPath&&<><button onClick={()=>playSound(settings.followSoundPath,"follow preview")}>Preview sound</button><button className="danger" onClick={()=>setSettings(s=>({...s,followSoundPath:""}))}>Clear sound</button></>}</div>{settings.followSoundPath&&<small>{settings.followSoundPath.split(/[\\/]/).pop()}</small>}<button disabled={!settings.followEnabled} onClick={()=>speak(fill(settings.followTemplate,{id:"preview",type:"Follow",user:"GoldFan",detail:"followed the LIVE",time:""}))}>Test follow response</button></div>
        <div className="sliders"><label>Volume<input type="range" min="0" max="1" step=".05" value={settings.volume} onChange={e=>setSettings(s=>({...s,volume:Number(e.target.value)}))}/></label><label>Speed<input type="range" min=".5" max="2" step=".1" value={settings.rate} onChange={e=>setSettings(s=>({...s,rate:Number(e.target.value)}))}/></label><label>Pitch<input type="range" min=".5" max="2" step=".1" value={settings.pitch} onChange={e=>setSettings(s=>({...s,pitch:Number(e.target.value)}))}/></label></div>
        <button className="primary" onClick={()=>speak("StreamPulse chat TTS is ready")}>Test selected voice</button>
      </section>
      <section className="card"><h2>Recent chat</h2>{events.filter(e=>e.type==="Chat").slice(0,15).map(e=><div className="activity" key={e.id}><time>{e.time}</time><span><b>{e.user}</b> · {followerLabel(e)} · {e.detail}</span></div>)}</section>
    </>}
    {page === "Actions" && <Actions settings={settings} update={setSettings} test={rule => runGiftAction(rule, { id: crypto.randomUUID(), type: "Gift", user: "GoldFan", detail: "Action test", time: new Date().toLocaleTimeString(), giftName: rule.giftName, count: rule.minimumCount, comboComplete: true })}/>}
    {page === "Gift Reactions" && <GiftReactions settings={settings} update={setSettings} pickSound={()=>window.streamPulseCore?.pickSound() || Promise.resolve(null)} preview={playSound}/>}
    {page === "Like Rankings" && <LikeRankings overlayUrl={overlayUrl} secure={secureOverlay} settings={settings} update={setSettings}/>}
    {page === "Sticker Sounds" && <StickerSounds settings={settings} update={setSettings} pickSound={()=>window.streamPulseCore?.pickSound() || Promise.resolve(null)} preview={playSound} connected={status === "connected"} notice={stickerNotice}/>}
    {page === "Overlay" && <><OverlayLibrary settings={settings} update={setSettings} overlayUrl={overlayUrl} secure={secureOverlay}/><header><div><small>TIKTOK STUDIO OVERLAY</small><h1>Gift alerts</h1></div></header><section className="card form"><label>{secureOverlay?"Gift browser-source URL":"Gift local fallback URL"}<div className="row"><input readOnly value={overlayUrl}/><button onClick={()=>navigator.clipboard.writeText(overlayUrl)}>Copy URL</button><button onClick={refreshSecureLink} disabled={tunnelBusy}>{tunnelBusy?"Connecting…":"Refresh secure link"}</button></div></label><p className={secureOverlay?"good":"warning"}>{secureOverlay?"Secure HTTPS link ready. It remains active while StreamPulse is open.":tunnelError||"Secure link is not connected; the local fallback may be rejected by TikTok Studio."}</p><button className="primary" onClick={()=>window.streamPulseCore?.overlayTest("GoldFan sent Rose ×5")}>Test gift overlay</button><ol><li>Keep StreamPulse running.</li><li>In TikTok LIVE Studio, add a Link or browser/webpage source.</li><li>Paste the gift URL above and size it to your canvas.</li><li>Use the test buttons to position it before going LIVE.</li></ol></section><section className="card form"><h2>Super Fan entrance overlay</h2><p>Use a separate browser source to position Super Fan entrances independently from gifts. Your existing gift source now shows only gifts and gift actions.</p><label>Super Fan browser-source URL<div className="row"><input readOnly value={superFanUrl}/><button onClick={()=>navigator.clipboard.writeText(superFanUrl)}>Copy Super Fan URL</button></div></label><small>Add this URL as a new Link source in LIVE Studio. Suggested starting size: 640 × 480. Individual Super Fan profiles below use this same source.</small><label className="switch"><input type="checkbox" checked={settings.superFanEnabled} onChange={e=>setSettings(s=>({...s,superFanEnabled:e.target.checked}))}/><span>Show an overlay every time a Super Fan enters</span></label><label>Super Fan message<input value={settings.superFanTemplate} onChange={e=>setSettings(s=>({...s,superFanTemplate:e.target.value}))}/><small>Use {"{username}"}</small></label><label>Display duration (seconds)<input type="number" min="1" max="15" value={settings.superFanDurationMs/1000} onChange={e=>setSettings(s=>({...s,superFanDurationMs:Math.min(15000,Math.max(1000,Number(e.target.value)*1000))}))}/></label><div className="row"><button onClick={chooseSuperFanImage}>{settings.superFanImagePath?"Change image":"Choose image or GIF"}</button>{settings.superFanImagePath&&<button className="danger" onClick={()=>setSettings(s=>({...s,superFanImagePath:""}))}>Clear image</button>}<small>{settings.superFanImagePath.split(/[\\/]/).pop()}</small></div><div className="row"><button onClick={chooseSuperFanSound}>{settings.superFanSoundPath?"Change sound":"Choose sound"}</button>{settings.superFanSoundPath&&<><button onClick={()=>playSound(settings.superFanSoundPath,"Super Fan preview")}>Preview sound</button><button className="danger" onClick={()=>setSettings(s=>({...s,superFanSoundPath:""}))}>Clear sound</button></>}<small>{settings.superFanSoundPath.split(/[\\/]/).pop()}</small></div><button className="primary" disabled={!settings.superFanEnabled} onClick={()=>showSuperFan({id:"preview",type:"SuperFanJoin",user:"GoldFan",detail:"entered as a Super Fan",time:""})}>Test Super Fan overlay</button></section></>}
    {settingsError && <p className="card" role="alert">{settingsError}</p>}
    {page === 'Settings' && <Reliability live={['connected','connecting','reconnecting'].includes(status)} pause={value => { savingPaused.current = value; }} save={async () => { if(settingsError) throw Error(settingsError); await window.streamPulseCore?.save(settingsRef.current); }} restore={value => { const restored={...defaults,...value}; settingsRef.current=restored;setSettings(restored);setSettingsError(''); }}/>}
    {page === "Settings" && <><header><div><small>SETTINGS</small><h1>LIVE connection</h1></div></header><section className="card form">
      <label>Connection source<select value={settings.connectionProvider} disabled={["connected","connecting","reconnecting"].includes(status)} onChange={e=>setSettings(s=>({...s,connectionProvider:e.target.value as Settings["connectionProvider"]}))}><option value="tikfinity">TikFinity (local desktop app)</option><option value="direct">Direct TikTok (experimental)</option></select></label>
      {["connected","connecting","reconnecting"].includes(status)&&<small>Disconnect on the Live page before changing the connection source.</small>}
      <label>TikTok LIVE username<input value={settings.username} onChange={e=>setSettings(s=>({...s,username:e.target.value}))} placeholder="username without @"/></label>
      {settings.connectionProvider==="direct"?<><p>Connect from StreamPulse with your LIVE username. TikFinity can be closed.</p><p className="muted">Direct mode uses Euler Stream for connection signing. Keyless access is available in this test build but is subject to service limits. Choose TikFinity if direct access is unavailable.</p></>:<><p>Keep TikFinity Desktop open on this PC and connected to your LIVE, then click Connect LIVE in StreamPulse.</p><small>Choose the LIVE account in TikFinity. This username labels your StreamPulse session; it does not switch TikFinity accounts.</small></>}
    </section></>}
    {page === "Overlay" && superFanRoster}
    {page === "Overlay" && permanentTunnelSetup}
  </main></div>;
}
