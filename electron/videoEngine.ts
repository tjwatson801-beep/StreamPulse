import { app, dialog, ipcMain } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import { createServer, Server } from 'http';
import { createReadStream, existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { AudioEnergy, discoverVideoTools, hasVideoTools, suggestAudioHighlights, videoBinary } from './videoTools';
import { captionAss, ClipEditing, framingFilter, validateEditing } from './videoEditing';

export function validateClip(start: unknown, end: unknown, duration: number) {
  if (typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > duration + 0.05) throw Error('Choose a valid start and end within the recording.');
  return { start, length: end - start };
}

export function setupVideoEngine() {
  let folder = '', active: ChildProcess | null = null, busy = false, cancelled = false;
  let folderLoaded = false;
  const configPath = path.join(app.getPath('userData'), 'video-tools.json');
  let server: Server | null = null;
  const recordings = new Map<string, {path: string; duration: number; hasAudio: boolean; width:number; height:number}>();
  const speechConfig = path.join(app.getPath('userData'), 'speech-tools.json');
  ipcMain.handle('video:speech-tools', async () => {
    if (busy) throw Error('Wait for the current video job.');
    const python = await dialog.showOpenDialog({title:'Choose Python with faster-whisper support',properties:['openFile'],filters:[{name:'Python executable',extensions:['exe']}]});
    if(python.canceled)return null;
    const runtime = await dialog.showOpenDialog({title:'Choose local speech runtime (speech-libs and speech-models)',properties:['openDirectory']});
    if(runtime.canceled)return null;
    if(!existsSync(path.join(runtime.filePaths[0],'speech-libs')) || !existsSync(path.join(runtime.filePaths[0],'speech-models')))throw Error('Choose a folder containing speech-libs and the downloaded small.en model in speech-models.');
    await fs.mkdir(path.dirname(speechConfig),{recursive:true});
    await fs.writeFile(speechConfig,JSON.stringify({python:python.filePaths[0],runtime:runtime.filePaths[0]}));
    return runtime.filePaths[0];
  });
  ipcMain.handle('video:transcribe', async (_event, args:{id:string;start:number;end:number}) => {
    if(busy)throw Error('A video job is already running.');
    const source=recordings.get(args?.id);
    if(!source?.hasAudio)throw Error('Import a recording with audio first.');
    const clip=validateClip(args.start,args.end,source.duration);
    if(clip.length>600)throw Error('Select a clip of 10 minutes or less for captions.');
    let config:{python:string;runtime:string};
    try{config=JSON.parse(await fs.readFile(speechConfig,'utf8'));}catch{throw Error('Set up local captions first. Choose your Python executable and speech runtime folder.');}
    busy=true;cancelled=false;
    try {
      await loadFolder();
      const worker=app.isPackaged?path.join(process.resourcesPath,'transcribe.py'):path.join(__dirname,'..','resources','transcribe.py');
      const output=await new Promise<string>((resolve,reject)=>{
        const child=spawn(config.python,[worker,tool('ffmpeg'),source.path,String(clip.start),String(clip.length),config.runtime],{windowsHide:true,shell:false,env:{...process.env,PYTHONPATH:path.join(config.runtime,'speech-libs')}});
        active=child;let out='',err='';
        child.stdout.on('data',c=>out=(out+c).slice(-2000000));child.stderr.on('data',c=>err=(err+c).slice(-4000));
        child.on('error',()=>reject(Error('Python could not start. Set up local captions again.')));
        child.on('close',code=>{if(active===child)active=null;if(cancelled)reject(Error('Captions cancelled.'));else if(code!==0)reject(Error('Local captions failed: '+err.slice(-1200)));else resolve(out);});
      });
      const words=JSON.parse(output);validateEditing({captions:words},clip.length);return words;
    } finally {busy=false;}
  });
  async function loadFolder() {
    if (folderLoaded) return;
    let saved = '';
    try { const config = JSON.parse(await fs.readFile(configPath, 'utf8')); if (typeof config.folder === 'string') saved = config.folder; } catch {}
    folder = saved && hasVideoTools(saved) ? saved : await discoverVideoTools(app.getPath('downloads'), process.resourcesPath);
    folderLoaded = true;
  }
  const tool = (name: string) => {
    const binary = videoBinary(name);
    const bundled = path.join(process.resourcesPath, 'video-tools', binary);
    return folder ? path.join(folder, binary) : existsSync(bundled) ? bundled : binary;
  };
  async function run(name: string, args: string[], onLine?: (line: string) => void, exporting = false, stderrOutput=false): Promise<string> {
    await loadFolder();
    return new Promise((resolve, reject) => {
      const child = spawn(tool(name), args, {windowsHide: true, shell: false});
      if (exporting) active = child;
      let output = '', errors = '', pending = '';
      child.stdout.on('data', chunk => {
        output = (output + chunk.toString()).slice(-2000000);
        pending += chunk.toString();
        const lines = pending.split('\n'); pending = lines.pop() || '';
        lines.forEach(line => onLine?.(line.trim()));
      });
      child.stderr.on('data', chunk => { errors = (errors + chunk.toString()).slice(-4000); });
      child.on('error', () => reject(Error(`Cannot run ${name}. Choose a folder containing ffmpeg.exe and ffprobe.exe.`)));
      child.on('close', code => {
        if (active === child) active = null;
        if (exporting && cancelled) reject(Error('Export cancelled.'));
        else if (code !== 0) reject(Error(`${name} failed: ${errors.slice(-1200)}`));
        else resolve(stderrOutput ? errors : output);
      });
    });
  }
  async function previewUrl(id: string) {
    if (!server) {
      server = createServer(async (req, res) => {
        try {
          const item = recordings.get((req.url || '').slice(1));
          if (!item || !['GET','HEAD'].includes(req.method || '')) { res.writeHead(404).end(); return; }
          const {size} = await fs.stat(item.path);
          const range = req.headers.range;
          let start = 0, end = size - 1;
        if (range) {
            const match = /^bytes=(\d*)-(\d*)$/.exec(range);
            if (!match || (!match[1] && !match[2])) { res.writeHead(416, {'Content-Range': `bytes */${size}`}).end(); return; }
            if (!match[1]) start = Math.max(0, size - Number(match[2]));
            else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
            if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) { res.writeHead(416, {'Content-Range': `bytes */${size}`}).end(); return; }
          }
          const ext = path.extname(item.path).toLowerCase();
          res.writeHead(range ? 206 : 200, {'Content-Type': ext === '.webm' ? 'video/webm' : ext === '.mov' ? 'video/quicktime' : ext === '.mkv' ? 'video/x-matroska' : 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': end-start+1, ...(range ? {'Content-Range': `bytes ${start}-${end}/${size}`} : {})});
          if (req.method === 'HEAD') { res.end(); return; }
          const stream = createReadStream(item.path, {start, end});
          stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
        } catch { if (!res.headersSent) res.writeHead(500); res.end(); }
      });
      await new Promise<void>((resolve, reject) => { server!.once('error', reject); server!.listen(0, '127.0.0.1', resolve); });
    }
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('Video preview unavailable.');
    return `http://127.0.0.1:${address.port}/${id}`;
  }
  ipcMain.handle('video:status', async () => {
    try { await run('ffmpeg', ['-version']); await run('ffprobe', ['-version']); return {ready:true, folder:folder || 'PATH', busy}; }
    catch (error) { return {ready:false, folder, busy, error:error instanceof Error ? error.message : String(error)}; }
  });
  ipcMain.handle('video:tools', async () => {
    if (busy) throw Error('Wait for the current export.');
    const result = await dialog.showOpenDialog({title: 'Choose folder containing FFmpeg and FFprobe', properties: ['openDirectory']});
    if (result.canceled) return null;
    const candidate = result.filePaths[0];
    if (!hasVideoTools(candidate)) throw Error('This folder needs both FFmpeg and FFprobe.');
    await loadFolder(); const previous = folder; folder = candidate;
    try {
      await run('ffmpeg', ['-version']); await run('ffprobe', ['-version']);
      await fs.mkdir(path.dirname(configPath), {recursive:true});
      const temporary = configPath + '.tmp';
      await fs.writeFile(temporary, JSON.stringify({folder}, null, 2)); await fs.rename(temporary, configPath);
    } catch (error) {folder = previous; throw error;}
    return folder;
  });
  ipcMain.handle('video:import', async () => {
    if (busy) throw Error('Wait for the current video job.');
    const result = await dialog.showOpenDialog({title: 'Import livestream recording', properties: ['openFile'], filters: [{name: 'Video', extensions: ['mp4','mov','mkv','webm']}]});
    if (result.canceled) return null;
    const source = result.filePaths[0];
    const info = JSON.parse(await run('ffprobe', ['-v','error','-show_format','-show_streams','-of','json',source]));
    const video = info.streams?.find((s: any) => s.codec_type === 'video' && !s.disposition?.attached_pic);
    const duration = Number(info.format?.duration || video?.duration);
    if (!video || !Number.isFinite(duration) || duration <= 0) throw Error('This recording has no readable video duration.');
    const hasAudio = Boolean(info.streams?.some((s: any) => s.codec_type === 'audio'));
    const id = randomUUID(); recordings.set(id, {path: source, duration, hasAudio, width:video.width, height:video.height});
    return {id, name: path.basename(source), duration, width: video.width, height: video.height, hasAudio, url: await previewUrl(id)};
  });
  ipcMain.handle('video:analyze', async (event, id: unknown) => {
    if (busy) throw Error('A video job is already running.');
    const source = typeof id === 'string' ? recordings.get(id) : undefined;
    if (!source) throw Error('Import a recording first.');
    if (!source.hasAudio) return {highlights:[], message:'This recording has no audio track. Select a moment manually.'};
    busy = true; cancelled = false;
    try {
      await loadFolder();
      const energy = new AudioEnergy();
      await new Promise<void>((resolve, reject) => {
        const child = spawn(tool('ffmpeg'), ['-nostdin','-hide_banner','-v','error','-i',source.path,'-map','0:a:0','-vn','-ac','1','-ar','8000','-f','s16le','pipe:1'], {windowsHide:true,shell:false});
        active = child; let errors = '', previous = -1;
        child.stdout.on('data', chunk => {
          energy.feed(chunk);
          const progress = Math.min(99, Math.floor(energy.levels.length/source.duration*100));
          if (progress !== previous && !event.sender.isDestroyed()) {previous=progress; event.sender.send('video:progress',progress);}
        });
        child.stderr.on('data', chunk => { errors=(errors+chunk.toString()).slice(-2000); });
        child.on('error', () => reject(Error('FFmpeg could not start. Check your video tools folder.')));
        child.on('close', code => {
          if (active === child) active=null;
          if (cancelled) reject(Error('Analysis cancelled.'));
          else if (code !== 0) reject(Error(`Audio analysis failed: ${errors}`));
          else resolve();
        });
      });
      const highlights = suggestAudioHighlights(energy.finish(), source.duration);
      if (!event.sender.isDestroyed()) event.sender.send('video:progress',100);
      return {highlights, message:highlights.length ? 'Audio peaks found. Review each suggestion before exporting.' : 'No distinct audio peaks found. You can still select a moment manually.'};
    } finally {busy=false;}
  });
  ipcMain.handle('video:cancel', () => { if (active) {cancelled = true; active.kill();} });
  ipcMain.handle('video:export', async (event, args: unknown) => {
    if (busy) throw Error('A video job is already running.');
    const input = args as {id: string; start: number; end: number; framing: string; editing?:ClipEditing};
    const source = recordings.get(input?.id);
    if (!source) throw Error('Import a recording first.');
    const clip = validateClip(input.start, input.end, source.duration);
    if (!['original','fit','crop'].includes(input.framing)) throw Error('Invalid framing.');
    const editing=validateEditing(input.editing || {},clip.length);
    if(editing.cameraFocus && Math.abs(source.width/source.height-9/16)>0.02)throw Error('Camera focus needs a vertical recording with the camera at the top.');
    if(editing.captions?.length && input.framing==='original' && !editing.cameraFocus)throw Error('Choose vertical framing when using captions.');
    busy = true; cancelled = false;
    let temporary = '';
    let subtitleDirectory='';
    try {
      const destination = await dialog.showSaveDialog({title: 'Export Golden Moment', defaultPath: path.join(app.getPath('videos'), `Golden-Moment-${Math.floor(input.start)}.mp4`), filters: [{name: 'MP4 video', extensions: ['mp4']}]});
      if (destination.canceled || !destination.filePath) return null;
      const outputPath = /\.mp4$/i.test(destination.filePath) ? destination.filePath : destination.filePath + '.mp4';
      if (path.resolve(outputPath).toLowerCase() === path.resolve(source.path).toLowerCase()) throw Error('Choose a different file from your recording.');
      // Also protect the recording if the destination is an alias or hard link to it.
      try { const [a,b] = await Promise.all([fs.stat(source.path),fs.stat(outputPath)]); if (a.dev === b.dev && a.ino === b.ino) throw Error('Choose a different file from your recording.'); } catch (error: any) {if (error.code !== 'ENOENT') throw error;}
      temporary = path.join(path.dirname(destination.filePath), `.golden-${randomUUID()}.mp4`);
      let filter=framingFilter(input.framing,Boolean(editing.cameraFocus));
      if(editing.captions?.length){
        subtitleDirectory=await fs.mkdtemp(path.join(app.getPath('temp'),'golden-captions-'));
        const subtitles=path.join(subtitleDirectory,'captions.ass');await fs.writeFile(subtitles,captionAss(editing.captions,editing.font,editing.wordHighlight!==false));
        const escaped=subtitles.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"'\\''");
        filter+=`,ass=filename='${escaped}'`;
      }
      const audio:string[]=[];
      if(editing.audioPolish && source.hasAudio){
        const report=await run('ffmpeg',['-nostdin','-hide_banner','-ss',String(clip.start),'-i',source.path,'-t',String(clip.length),'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-'],undefined,true,true);
        const measurement=JSON.parse(report.slice(report.lastIndexOf('{'),report.lastIndexOf('}')+1));
        const values=['input_i','input_tp','input_lra','input_thresh','target_offset'].map(k=>Number(measurement[k]));
        const normalization=values.every(Number.isFinite)?`loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${values[0]}:measured_TP=${values[1]}:measured_LRA=${values[2]}:measured_thresh=${values[3]}:offset=${values[4]}:linear=true`:'loudnorm=I=-16:TP=-1.5:LRA=11';
        audio.push('-af',normalization,'-ar','48000');
      }
      if(cancelled)throw Error('Export cancelled.');
      await run('ffmpeg', ['-nostdin','-hide_banner','-v','error','-ss',String(clip.start),'-i',source.path,'-t',String(clip.length),'-map','0:v:0','-map','0:a:0?','-vf',filter,...audio,'-c:v','libx264','-preset','veryfast','-crf','18','-c:a','aac','-b:a','192k','-movflags','+faststart','-progress','pipe:1','-n',temporary], line => {
        if (line.startsWith('out_time_us=')) { const progress = Math.min(99, Math.round(Number(line.slice(12))/1000000/clip.length*100)); if (!event.sender.isDestroyed()) event.sender.send('video:progress', progress); }
      }, true);
      if (cancelled) throw Error('Export cancelled.');
      await fs.rename(temporary, outputPath); temporary = '';
      if (!event.sender.isDestroyed()) event.sender.send('video:progress', 100);
      return outputPath;
    } finally { busy = false; if (temporary) await fs.unlink(temporary).catch(() => {}); if(subtitleDirectory)await fs.rm(subtitleDirectory,{recursive:true,force:true}).catch(()=>{}); }
  });
  app.on('will-quit', () => {cancelled = true; active?.kill(); server?.close();});
  return {isBusy: () => busy};
}
