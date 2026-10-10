import { useEffect, useRef, useState } from 'react';
import MomentWorkflow, {MontageCut,SearchMoment} from './MomentWorkflow';

export type Recording = {id: string; name: string; duration: number; width: number; height: number; hasAudio: boolean; url: string};
type Highlight = SearchMoment;
type CaptionWord = {start:number; end:number; text:string};
function timestamp(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
}
export type VideoApi = {
  status: () => Promise<{ready:boolean; folder:string; error?:string}>;
  analyze: (id:string) => Promise<{highlights:Highlight[]; message:string}>;
  tools: () => Promise<string | null>;
  import: () => Promise<Recording | null>;
  speechTools: () => Promise<string|null>;
  search: (args:unknown) => Promise<{highlights:SearchMoment[];message:string}>;
  montage: (args:unknown) => Promise<string[]|null>;
  preview: (args:unknown) => Promise<{url:string;duration:number}>;
  transcribe: (args:{id:string;start:number;end:number}) => Promise<CaptionWord[]>;
  export: (args: {id: string; start: number; end: number; framing: string; editing?:{cameraFocus:boolean;audioPolish:boolean;captions:CaptionWord[];font:string;wordHighlight:boolean}}) => Promise<string | null>;
  cancel: () => Promise<void>;
  onProgress: (handler: (progress: number) => void) => () => void;
};
export default function GoldenMoments() {
  const api = window.streamPulseCore?.video;
  const [recording, setRecording] = useState<Recording | null>(null);
  const [start, setStart] = useState(0), [end, setEnd] = useState(30);
  const [framing, setFraming] = useState('fit');
  const [cameraFocus,setCameraFocus]=useState(false),[audioPolish,setAudioPolish]=useState(true);
  const [font,setFont]=useState('Bauhaus 93'),[wordHighlight,setWordHighlight]=useState(true);
  const [captions,setCaptions]=useState<CaptionWord[]>([]),[captionRange,setCaptionRange]=useState('');
  const [transcribing,setTranscribing]=useState(false);
  const captionsCurrent=captionRange===`${recording?.id}:${start}:${end}`;
  const [playhead, setPlayhead] = useState(0);
  const [busy, setBusy] = useState(false), [exporting, setExporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [reviewedMoment,setReviewedMoment]=useState<number|null>(null);
  const [editedPreview,setEditedPreview]=useState<{url:string;duration:number}|null>(null);
  const [previewing,setPreviewing]=useState(false);
  useEffect(()=>{setEditedPreview(null);},[recording?.id,start,end,framing,cameraFocus,audioPolish,captions,font,wordHighlight]);
  const [cuts,setCuts]=useState<MontageCut[]>([]),[momentFilter,setMomentFilter]=useState('all');
  const [toolsStatus, setToolsStatus] = useState('Checking video tools…');
  const [progress, setProgress] = useState(0), [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const player = useRef<HTMLVideoElement>(null);
  const playingClip = useRef(false);
  useEffect(() => {
    const video = player.current; if (!video) return;
    let frame = 0;
    const update = () => setPlayhead(video.currentTime);
    const tick = () => { update(); if (!video.paused) frame=requestAnimationFrame(tick); };
    const play = () => {cancelAnimationFrame(frame);tick();};
    const pause = () => {cancelAnimationFrame(frame);update();};
    video.addEventListener('play',play);video.addEventListener('pause',pause);video.addEventListener('seeked',update);video.addEventListener('timeupdate',update);
    update();
    return () => {cancelAnimationFrame(frame);video.removeEventListener('play',play);video.removeEventListener('pause',pause);video.removeEventListener('seeked',update);video.removeEventListener('timeupdate',update);};
  }, [recording?.id]);
  function seek(seconds: number) {
    const video=player.current; if (!video || !recording) return;
    playingClip.current=false;video.pause();video.currentTime=Math.max(0,Math.min(recording.duration,seconds));setPlayhead(video.currentTime);
  }
  useEffect(() => api?.onProgress(setProgress), [api]);
  useEffect(() => { let disposed=false; if (!api?.status) return; void api.status().then(status => {if (!disposed) setToolsStatus(status.ready ? 'Video tools ready' : 'Choose a folder containing FFmpeg and FFprobe to begin.');}).catch(() => {if (!disposed) setToolsStatus('Video tools could not be checked. Choose their folder.');}); return () => {disposed=true;}; }, [api]);
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { if (!api) throw Error('Open Golden Moments in the StreamPulse desktop app.'); await work(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setExporting(false); setAnalyzing(false); setTranscribing(false); setPreviewing(false); }
  }
  const valid = Boolean(recording && Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= recording.duration);
  const previewStyle = framing === 'original' ? {width: '100%', maxHeight: 420} : {width: 236, height: 420, objectFit: framing === 'crop' ? 'cover' as const : 'contain' as const};
  return <>
    <header><div><small>RECORDING TO CLIP</small><h1>Golden Moments</h1><p>Find a moment, trim it, and export a shareable MP4.</p></div></header>
    <section className="card form">
      <p role="status">{toolsStatus}</p>
      <div className="row"><button disabled={busy} onClick={() => action(async () => { const item = await api!.import(); if (item) {setRecording(item); setCuts([]); setMomentFilter("all"); setHighlights([]); setReviewedMoment(null); setCaptions([]); setCameraFocus(false); setStart(0); setEnd(Math.min(30, item.duration)); playingClip.current = false;} })}>Import recording</button><button disabled={busy} onClick={() => action(async () => { const folder = await api!.tools(); if (folder) {setToolsStatus('Video tools ready'); setMessage('Video tools folder saved for future sessions.');} })}>Choose video tools folder</button></div>
      <small>Recordings are processed on this computer. MP4, MOV, MKV and WebM can be imported; preview support depends on the video codec.</small>
      {error && <p className="warning" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {recording && <>
        <h2>{recording.name}</h2><small>{recording.width} × {recording.height} · {recording.duration.toFixed(1)} seconds</small>
        <MomentWorkflow key={recording.id} recording={recording} api={api} busy={busy} action={action} found={m=>{setHighlights(m);setReviewedMoment(null);setMomentFilter('all');}} current={{start,end}} cuts={cuts} setCuts={setCuts} style={{cameraFocus,audioPolish,font,wordHighlight}} setMessage={setMessage} setAnalyzing={setAnalyzing} setProgress={setProgress}/>
        <label>Show moments<select value={momentFilter} disabled={busy} onChange={e=>setMomentFilter(e.target.value)}><option value="all">All methods</option><option value="kill">Kills</option><option value="multi-kill">Multi-kills</option><option value="win">Wins</option><option value="general">General highlights</option><option value="spoken">Spoken cues</option><option value="visual">Visual cues</option><option value="audio">Audio peaks</option></select></label>
        <div className="row"><button disabled={busy || !recording.hasAudio} onClick={() => action(async () => {setAnalyzing(true); setProgress(0); const result=await api!.analyze(recording.id); setHighlights(result.highlights); setReviewedMoment(null); setMessage(result.message);})}>Find audio highlights</button><small>{recording.hasAudio ? 'Long streams use overlapping 15-minute sections, with up to 64 distinct moments. Short clips suggest up to 8. Review them for context.' : 'No audio track — choose a clip manually.'}</small></div>
        {highlights.map((item,index) => (momentFilter === "all" || (item.categories || ["general"]).includes(momentFilter) || (item.sources || ["audio"]).includes(momentFilter)) && <div className="row" key={item.peakAt}><button disabled={busy} onClick={() => {setReviewedMoment(index);setStart(item.start);setEnd(item.end);playingClip.current=false;if(player.current){player.current.pause();player.current.currentTime=item.start;}}}>Review moment {index+1}</button><small>{item.start.toFixed(1)}–{item.end.toFixed(1)} sec · {(item.categories || ["general"]).join(" + ")} · {(item.sources || ["audio"]).join(" + ")} · {item.reason}</small></div>)}
        <div className="golden-preview"><video key={recording.id} ref={player} src={recording.url} controls style={previewStyle} onError={() => setError('This codec cannot be previewed here. Try an H.264 MP4 recording; export may still work.')} onTimeUpdate={() => { if (playingClip.current && player.current && player.current.currentTime >= end) {player.current.pause(); playingClip.current = false;} }}/><output className="golden-timecode" aria-label="Current playback timestamp">{timestamp(playhead)} · {playhead.toFixed(3)}s<small className="golden-review-label" aria-label="Moment being reviewed">{reviewedMoment === null ? "Manual clip" : `Moment ${reviewedMoment+1} of ${highlights.length}${highlights[reviewedMoment] && (start !== highlights[reviewedMoment].start || end !== highlights[reviewedMoment].end) ? " · adjusted cut" : ""}`} · {recording.name}</small></output></div>
        <div className="golden-timeline"><div className="row"><strong>{timestamp(playhead)}</strong><small>of {timestamp(recording.duration)}</small></div><input aria-label="Recording playhead" type="range" min={0} max={recording.duration} step={0.001} value={playhead} disabled={busy} onChange={e=>seek(Number(e.target.value))}/><div className="row"><button disabled={busy} onClick={()=>seek(playhead-1)}>−1 sec</button><button disabled={busy} onClick={()=>seek(playhead-0.1)}>−0.1 sec</button><button disabled={busy} onClick={()=>seek(playhead+0.1)}>+0.1 sec</button><button disabled={busy} onClick={()=>seek(playhead+1)}>+1 sec</button></div></div>
        <div className="row"><label>Start (seconds)<input aria-label="Clip start seconds" type="number" min={0} max={recording.duration} step={0.001} value={start} disabled={busy} onChange={e => setStart(Number(e.target.value))}/><small>{timestamp(start)}</small></label><label>End (seconds)<input aria-label="Clip end seconds" type="number" min={0} max={recording.duration} step={0.001} value={end} disabled={busy} onChange={e => setEnd(Number(e.target.value))}/><small>{timestamp(end)}</small></label></div>
        <div className="row"><button disabled={busy} onClick={() => setStart(player.current?.currentTime || 0)}>Set start at playhead</button><button disabled={busy} onClick={() => setEnd(player.current?.currentTime || 0)}>Set end at playhead</button><button disabled={busy || !valid} onClick={() => { if (player.current) {player.current.currentTime = start; playingClip.current = true; void player.current.play().catch(() => setError('Preview playback could not start.'));} }}>Play selected clip</button></div>
        <label>Framing<select value={framing} disabled={busy} onChange={e => setFraming(e.target.value)}><option value="fit">Vertical 9:16 — fit with black bars</option><option value="crop">Vertical 9:16 — center crop</option><option value="original">Original aspect ratio</option></select></label>
        <small>{framing === 'crop' ? 'Center crop removes content at the sides. Check that faces and chat remain visible.' : 'Fit preserves the full recording. Vertical exports are 1080 × 1920.'} Preview framing approximates the export.</small>
        <h2>Golden editing style</h2>
        <label><input type="checkbox" checked={cameraFocus} disabled={busy || Math.abs(recording.width/recording.height-9/16)>0.02} onChange={e=>setCameraFocus(e.target.checked)}/> Camera focus — larger camera, gameplay underneath</label>
        <small>For vertical recordings with your camera in the top third. The camera layout and burned captions appear in the exported video; this player shows the source.</small>
        <label><input type="checkbox" checked={audioPolish} disabled={busy || !recording.hasAudio} onChange={e=>setAudioPolish(e.target.checked)}/> Polish audio volume</label>
        <div className="row"><button disabled={busy} onClick={()=>action(async()=>{if(await api!.speechTools())setMessage('Local caption runtime saved.');})}>Set up local captions</button><button disabled={busy || !valid || !recording.hasAudio} onClick={()=>action(async()=>{setTranscribing(true);const result=await api!.transcribe({id:recording.id,start,end});setCaptions(result);setCaptionRange(`${recording.id}:${start}:${end}`);setMessage(result.length?'Captions generated. Review wording and word times before export.':'No speech found in this clip.');})}>Generate captions for clip</button></div>
        <small>Captions run locally using Python and the small.en speech model. Times below are seconds from the start of your selected clip.</small>
        <label>Caption font<select disabled={busy} value={font} onChange={e=>setFont(e.target.value)}><option value="Bauhaus 93">Bauhaus 93 — chunky rounded</option><option value="Arial Rounded MT Bold">Arial Rounded — soft bold</option><option value="Impact">Impact — tall and bold</option><option value="Cooper Black">Cooper Black — retro rounded</option><option value="Berlin Sans FB Demi">Berlin Sans — playful</option><option value="Showcard Gothic">Showcard Gothic — comic style</option><option value="Arial">Arial — classic bold</option><option value="Segoe UI">Segoe UI — clean bold</option></select></label>
        <div aria-label="Caption font sample" style={{background:'#080c12',padding:'16px',borderRadius:8,textAlign:'center',fontFamily:`"${font}", sans-serif`,fontWeight:700,fontSize:28,color:'white',textShadow:'2px 2px 0 #000,-2px -2px 0 #000'}}>Stay <span style={{color:wordHighlight?'#ffd700':'white'}}>Golden!</span></div>
        <small>Font sample updates as you choose. Fonts must be installed on this computer; unavailable fonts use a fallback.</small>
        <label><input type="checkbox" checked={wordHighlight} disabled={busy} onChange={e=>setWordHighlight(e.target.checked)}/> Gold highlight on the spoken word</label>
        {captions.length>0 && <><p>{captionsCurrent?'Review captions':'Clip selection changed — regenerate captions before exporting.'}</p><button disabled={busy} onClick={()=>setCaptions([])}>Remove captions</button><div style={{maxHeight:260,overflowY:'auto'}}>{captions.map((w,i)=><div className="row" key={i}><input aria-label={`Word ${i+1}`} disabled={busy} value={w.text} onChange={e=>setCaptions(old=>old.map((v,n)=>n===i?{...v,text:e.target.value}:v))}/><input aria-label={`Word ${i+1} start`} type="number" step={0.01} value={w.start} disabled={busy} onChange={e=>setCaptions(old=>old.map((v,n)=>n===i?{...v,start:Number(e.target.value)}:v))}/><input aria-label={`Word ${i+1} end`} type="number" step={0.01} value={w.end} disabled={busy} onChange={e=>setCaptions(old=>old.map((v,n)=>n===i?{...v,end:Number(e.target.value)}:v))}/></div>)}</div></>}
        {transcribing && <p role="status">Generating local captions… <button onClick={()=>api?.cancel()}>Cancel captions</button></p>}
        <p>{valid ? `${timestamp(start)} → ${timestamp(end)} · ${(end-start).toFixed(3)} second clip` : 'Choose an end after the start, within the recording.'}</p>
        <button disabled={busy || !valid || (captions.length>0 && !captionsCurrent)} onClick={()=>action(async()=>{setPreviewing(true);setProgress(0);const result=await api!.preview({id:recording.id,start,end,framing,editing:{cameraFocus,audioPolish,captions:captionsCurrent?captions:[],font,wordHighlight}});setEditedPreview(result);setMessage('Edited preview ready. Play it below, then export when you are happy with it.');})}>Preview edited clip</button>
        <small>Builds a temporary playback copy with your current edits. Generate captions first if you want captions in the preview. Changing the cut or editing settings clears the preview.</small>
        {previewing && <div className="row"><progress max={100} value={progress}/><span>Building preview: {progress}%</span><button onClick={()=>api?.cancel().catch(e=>setError(String(e)))}>Cancel preview</button></div>}
        {editedPreview && <section className="card"><h2>Edited clip preview</h2><video aria-label="Edited clip preview" key={editedPreview.url} src={editedPreview.url} controls style={{width:'100%',maxHeight:560}} onError={()=>setError('The edited preview could not play. Rebuild the preview and try again.')}/><small>{editedPreview.duration.toFixed(3)} seconds · current cut with your selected effects</small></section>}
        <div className="row"><button className="primary" disabled={busy || !valid || (captions.length>0 && !captionsCurrent)} onClick={() => action(async () => { setExporting(true); setProgress(0); const file = await api!.export({id:recording.id,start,end,framing,editing:{cameraFocus,audioPolish,captions:captionsCurrent?captions:[],font,wordHighlight}}); if (file) setMessage(`Clip saved: ${file}`); })}>Export MP4</button>{(exporting || analyzing) && <><progress max={100} value={progress}/><span>{analyzing ? 'Analyzing' : 'Exporting'}: {progress}%</span><button onClick={() => api?.cancel().catch(e => setError(String(e)))}>{analyzing ? 'Cancel analysis' : 'Cancel export'}</button></>}</div>
      </>}
      <small>Audio suggestions identify volume changes. Review suggested moments and generated captions before sharing.</small>
    </section>
  </>;
}
