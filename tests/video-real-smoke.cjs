// Real FFmpeg plus the production preload/UI, using isolated settings and synthetic media.
const {app,BrowserWindow,ipcMain,dialog}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const packageRoot=process.env.STREAMPULSE_TEST_PACKAGE || path.join(__dirname,'..');
let root,win,selected,output;
function command(binary,args){return new Promise((resolve,reject)=>{const child=spawn(binary,args,{windowsHide:true});let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('error',reject);child.on('close',code=>code===0?resolve(stdout):reject(Error(stderr)));});}
app.whenReady().then(async()=>{
 try {
  root=await fs.mkdtemp(path.join(app.getPath('temp'),'streampulse-video-real-'));
  app.setPath('userData',path.join(root,'settings'));
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[selected]});
  dialog.showSaveDialog=async()=>({canceled:false,filePath:output});
  for(const [name,fn] of Object.entries({load:()=>({ttsEnabled:false}),save:()=>({ok:true}),'credential-status':()=>({}),info:()=>({}),'update-status':()=>({phase:'current',current:'test'}),'sound-hotkeys':()=>({errors:[],registered:0})}))ipcMain.handle('core:'+name,fn);
  require(path.join(packageRoot,'dist-electron','videoEngine.js')).setupVideoEngine();
  win=new BrowserWindow({show:false,width:1180,height:1000,webPreferences:{preload:path.join(packageRoot,'dist-electron','preload.js'),contextIsolation:true,sandbox:true,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});
  await win.loadFile(path.join(packageRoot,'dist','index.html'));
  const run=code=>win.webContents.executeJavaScript(code);
  async function wait(code){for(let i=0;i<150;i++){if(await run(code))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+code);}
  const status=await run('window.streamPulseCore.video.status()');assert.equal(status.ready,true,JSON.stringify(status));
  const binary=name=>path.join(status.folder,name+'.exe');
  const source=path.join(root,'recording.mp4'),silent=path.join(root,'silent.mp4');
  await command(binary('ffmpeg'),['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=12','-f','lavfi','-i',"aevalsrc=if(between(t\\,18\\,21)\\,0.65\\,0.01)*sin(2*PI*440*t):s=16000",'-t','44','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',source]);
  await command(binary('ffmpeg'),['-v','error','-i',source,'-t','3','-an','-c:v','copy',silent]);
  selected=status.folder;await run('window.streamPulseCore.video.tools()');
  const saved=JSON.parse(await fs.readFile(path.join(root,'settings','video-tools.json'),'utf8'));assert.equal(saved.folder,status.folder);
  const sourceBefore=await fs.readFile(source);
  selected=source;
  await wait("document.querySelector('aside')!==null");
  await run("Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent==='Golden Moments').click()");
  await wait("document.body.textContent.includes('Video tools ready')");
  await run("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Import recording').click()");
  await wait("document.querySelector('video')?.readyState>=2");
  assert.ok(await run("Math.abs(document.querySelector('video').duration-44)<0.2"));
  await run("(()=>{const slider=document.querySelector('input[aria-label=\"Recording playhead\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(slider,'4.125');slider.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await wait("document.querySelector('output[aria-label=\"Current playback timestamp\"]').textContent.includes('00:00:04.125')");
  await run("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Set start at playhead').click()");
  await wait("document.querySelector('input[aria-label=\"Clip start seconds\"]').value==='4.125'");
  await run("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='+0.1 sec').click()");
  await wait("document.querySelector('output[aria-label=\"Current playback timestamp\"]').textContent.includes('00:00:04.225')");
  await run("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Find audio highlights').click()");
  await wait("document.querySelector('select[aria-label=\"Moment selection\"] option[value=\"0\"]')");
  await run("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Next moment').click()");
  assert.equal(await run("document.querySelector('select[aria-label=\"Moment selection\"]').value"),'0');
  assert.ok(await run("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Previous moment').disabled"));
  await run("(()=>{const s=document.querySelector('select[aria-label=\"Moment filter\"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'kill');s.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await wait("document.querySelector('select[aria-label=\"Moment selection\"]').disabled");
  assert.ok(await run("document.body.textContent.includes('No moments match this filter.')"));
  await run("(()=>{const s=document.querySelector('select[aria-label=\"Moment filter\"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'all');s.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await wait("document.querySelector('select[aria-label=\"Moment selection\"]').value==='0'");
  await run("document.querySelector('.golden-review-layout').scrollIntoView({block:'center'})");
  await new Promise(r=>setTimeout(r,150));
  await fs.mkdir(path.join(__dirname,'..','work'),{recursive:true});await fs.writeFile(path.join(__dirname,'..','work','golden-moment-selector.png'),(await win.webContents.capturePage()).toPNG());
  assert.ok(await run("Number([document.querySelector('input[aria-label=\"Clip start seconds\" ]'),document.querySelector('input[aria-label=\"Clip end seconds\" ]')][0].value)<=21 && Number([document.querySelector('input[aria-label=\"Clip start seconds\" ]'),document.querySelector('input[aria-label=\"Clip end seconds\" ]')][1].value)>=18"));
  async function inputs(start,end){await run(`(()=>{const inputs=[document.querySelector('input[aria-label=\"Clip start seconds\" ]'),document.querySelector('input[aria-label=\"Clip end seconds\" ]')];for(const [i,value] of [[0,${start}],[1,${end}]]){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(inputs[i],String(value));inputs[i].dispatchEvent(new Event('input',{bubbles:true}));}})()`);}
  await inputs(4.125,6.125);
  await run("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Play selected clip').click()");
  await wait("document.querySelector('video').paused && document.querySelector('video').currentTime>=6.125");
  for(const framing of ['original','fit','crop']){
   output=path.join(root,framing+'.mp4');
   await run(`(()=>{const select=Array.from(document.querySelectorAll('main select')).find(s=>s.querySelector('option[value="original"]'));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(framing)});select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   await run("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Export MP4').click()");
   await wait(`document.body.textContent.includes(${JSON.stringify('Clip saved: '+output)})`);
   const probe=JSON.parse(await command(binary('ffprobe'),['-v','error','-show_format','-show_streams','-of','json',output]));
   const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');
   assert.equal(video.codec_name,'h264');assert.equal(audio.codec_name,'aac');assert.ok(Math.abs(Number(probe.format.duration)-2)<0.25);
   assert.equal(video.width,framing==='original'?320:1080);assert.equal(video.height,framing==='original'?180:1920);
   await command(binary('ffmpeg'),['-v','error','-i',output,'-f','null','-']);
  }
  // Edited preview is playable in the UI without opening a save dialog.
  const saveDialog=dialog.showSaveDialog;dialog.showSaveDialog=async()=>{throw Error('Preview must not ask for an export destination');};
  await run("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Preview edited clip').click()");
  await wait("document.querySelector('video[aria-label=\"Edited clip preview\"]')?.readyState>=2");
  assert.ok(await run("Math.abs(document.querySelector('video[aria-label=\"Edited clip preview\"]').duration-2)<0.2"));
  await run("document.querySelector('video[aria-label=\"Edited clip preview\"]').play()");
  await wait("document.querySelector('video[aria-label=\"Edited clip preview\"]').currentTime>0.1");
  await run("document.querySelector('video[aria-label=\"Edited clip preview\"]').pause()");
  await inputs(4.125,6.025);await wait("!document.querySelector('video[aria-label=\"Edited clip preview\"]')");
  dialog.showSaveDialog=saveDialog;
  console.log('Edited preview playback, no save dialog, and invalidation after trimming passed.');
  // Camera focus, ASS word highlights, and two-pass audio through the real engine.
  const portrait=path.join(root,'portrait.mp4');
  await command(binary('ffmpeg'),['-v','error','-f','lavfi','-i','testsrc2=size=360x640:rate=12','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libx264','-preset','ultrafast','-c:a','aac',portrait]);
  selected=portrait;const vertical=await run('window.streamPulseCore.video.import()');output=path.join(root,'styled.mp4');
  const editing={cameraFocus:true,audioPolish:true,font:'Bauhaus 93',wordHighlight:true,captions:[{start:0,end:0.8,text:'Stay'},{start:0.8,end:1.8,text:'Golden!'}]};
  await run(`window.streamPulseCore.video.export(${JSON.stringify({id:vertical.id,start:0,end:2,framing:'fit',editing})})`);
  const styled=JSON.parse(await command(binary('ffprobe'),['-v','error','-show_streams','-of','json',output]));assert.equal(styled.streams[0].width,1080);assert.equal(styled.streams[0].height,1920);
  await command(binary('ffmpeg'),['-v','error','-i',output,'-f','null','-']);
  const preview=await run(`window.streamPulseCore.video.preview(${JSON.stringify({id:vertical.id,start:0,end:2,framing:'fit',editing})})`);
  const previewInfo=JSON.parse(await command(binary('ffprobe'),['-v','error','-show_streams','-show_format','-of','json',preview.url]));assert.equal(previewInfo.streams[0].width,1080);assert.ok(Math.abs(Number(previewInfo.format.duration)-2)<0.2);
  if(process.env.STREAMPULSE_SPEECH_ROOT && process.env.STREAMPULSE_SPEECH_PYTHON && process.env.STREAMPULSE_SPEECH_VIDEO){
    await fs.writeFile(path.join(root,'settings','speech-tools.json'),JSON.stringify({python:process.env.STREAMPULSE_SPEECH_PYTHON,runtime:process.env.STREAMPULSE_SPEECH_ROOT}));
    selected=process.env.STREAMPULSE_SPEECH_VIDEO;const speech=await run('window.streamPulseCore.video.import()');
    const captions=await run(`window.streamPulseCore.video.transcribe(${JSON.stringify({id:speech.id,start:0,end:speech.duration})})`);
    assert.ok(captions.length>20);assert.ok(captions.some(w=>/neo/i.test(w.text)));
    output=path.join(root,'speech-styled.mp4');await run(`window.streamPulseCore.video.export(${JSON.stringify({id:speech.id,start:0,end:speech.duration,framing:'fit',editing:{...editing,captions}})})`);
    await command(binary('ffmpeg'),['-v','error','-i',output,'-f','null','-']);
    console.log('Local speech captions and camera-focus export passed with real Neo Joins footage.');
  }
  // Visual OCR, multi-source search and montage exports through the production preload.
  const visualSource=path.join(root,'visual-cue.mp4');
  await command(binary('ffmpeg'),['-v','error','-f','lavfi','-i','color=c=black:s=640x360:r=12','-vf',"drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='VICTORY ROYALE':fontsize=40:fontcolor=white:x=(w-tw)/2:y=(h-th)/2",'-t','4','-c:v','libx264','-preset','ultrafast',visualSource]);
  selected=visualSource;const visualRecording=await run('window.streamPulseCore.video.import()');
  const options={spoken:false,audio:false,visual:true,cues:[],before:1,after:2,region:{x:0,y:0,width:1,height:1}};
  const visualResults=await run(`window.streamPulseCore.video.search(${JSON.stringify({id:visualRecording.id,options})})`);
  assert.ok(visualResults.highlights.some(m=>m.categories.includes('win')),JSON.stringify(visualResults));
  assert.equal(visualResults.highlights.length,1,'Persistent victory banner deduplicated');
  selected=root;
  const montage=await run(`window.streamPulseCore.video.montage(${JSON.stringify({id:visualRecording.id,clips:[{start:0,end:1,category:'win'},{start:2,end:4,category:'general'}],target:15,versions:3,cameraFocus:false,audioPolish:true,captions:false,font:'Bauhaus 93',wordHighlight:true})})`);
  assert.equal(montage.length,2,'Duplicate alternating version skipped');
  for(const file of montage){const p=JSON.parse(await command(binary('ffprobe'),['-v','error','-show_format','-show_streams','-of','json',file]));assert.ok(Math.abs(Number(p.format.duration)-3)<0.2);assert.equal(p.streams[0].width,1080);assert.ok(p.streams.some(s=>s.codec_type==='audio'));await command(binary('ffmpeg'),['-v','error','-i',file,'-f','null','-']);}
  const general=await run(`window.streamPulseCore.video.search(${JSON.stringify({id:vertical.id,options:{...options,visual:false,audio:true}})})`);assert.ok(Array.isArray(general.highlights));
  if(process.env.STREAMPULSE_SPEECH_ROOT){

    // The existing speech-video import above remains in the recording registry.
    selected=process.env.STREAMPULSE_SPEECH_VIDEO;const speech=await run('window.streamPulseCore.video.import()');
    const cues=await run(`window.streamPulseCore.video.search(${JSON.stringify({id:speech.id,options:{...options,visual:false,spoken:true,cues:[{phrase:'big baller',category:'general'}]}})})`);
    assert.ok(cues.highlights.some(m=>m.sources.includes('spoken')),JSON.stringify(cues));
    selected=root;
    const captionedMontage=await run(`window.streamPulseCore.video.montage(${JSON.stringify({id:speech.id,clips:[{start:0,end:4,category:'general'}],target:15,versions:1,cameraFocus:true,audioPolish:true,captions:true,font:'Bauhaus 93',wordHighlight:true})})`);
    assert.equal(captionedMontage.length,1);await command(binary('ffmpeg'),['-v','error','-i',captionedMontage[0],'-f','null','-']);
    console.log('Real spoken-cue search and captioned camera-focus montage passed.');
  }
  console.log('Visual OCR search, audio search, deduplication and real montage exports passed.');
  // Exercise backend paths through the actual preload as well as UI clicks.
  selected=silent;const noAudio=await run('window.streamPulseCore.video.import()');assert.equal(noAudio.hasAudio,false);
  const noSuggestions=await run(`window.streamPulseCore.video.analyze(${JSON.stringify(noAudio.id)})`);assert.equal(noSuggestions.highlights.length,0);
  output=path.join(root,'silent-export.mp4');await run(`window.streamPulseCore.video.export({id:${JSON.stringify(noAudio.id)},start:0,end:1,framing:'original'})`);
  const silentProbe=JSON.parse(await command(binary('ffprobe'),['-v','error','-show_streams','-of','json',output]));assert.equal(silentProbe.streams.some(s=>s.codec_type==='audio'),false);
  selected=source;const recording=await run('window.streamPulseCore.video.import()');output=path.join(root,'cancelled.mp4');
  await run(`window.__exportDone=false;window.__cancelResult='';window.__off=window.streamPulseCore.video.onProgress(p=>{if(p>0)window.streamPulseCore.video.cancel()});void window.streamPulseCore.video.export({id:${JSON.stringify(recording.id)},start:0,end:44,framing:'fit'}).then(()=>{window.__exportDone=true},e=>{window.__cancelResult=String(e);window.__exportDone=true})`);
  await wait('window.__exportDone');assert.match(await run('window.__cancelResult'),/cancelled/);await run('window.__off();void 0');
  assert.equal((await fs.readdir(root)).includes('cancelled.mp4'),false);assert.equal((await fs.readdir(root)).some(f=>f.startsWith('.golden-')),false);
  assert.ok((await fs.readFile(source)).equals(sourceBefore),'Source preserved');
  await wait("!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Import recording').disabled");
  await new Promise(resolve=>setTimeout(resolve,100));
  const image=await win.webContents.capturePage();await fs.mkdir(path.join(__dirname,'..','work'),{recursive:true});await fs.writeFile(path.join(__dirname,'..','work','golden-moments-test.png'),image.toPNG());
  console.log('Real Golden Moments test passed: automatic tool discovery, saved tools, production preload/UI, Chromium playback and selection, audio highlight detection, original/fit/crop H.264+A​AC exports, silent video, decode verification, cancellation, cleanup, source preservation.');
 }catch(error){console.error(error);process.exitCode=1;}
 finally{win?.destroy();if(root)await fs.rm(root,{recursive:true,force:true});app.exit(process.exitCode||0);}
});
