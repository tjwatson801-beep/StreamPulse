// Real bundled tools via production preload/UI, isolated settings, no external tool discovery.
const {app,BrowserWindow,ipcMain,dialog}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const packageRoot=process.env.STREAMPULSE_TEST_PACKAGE||path.join(__dirname,'..');
const resources=packageRoot.endsWith('.asar')?path.dirname(packageRoot):path.join(packageRoot,'resources');
let root,win,selected,output,saved={};
function command(binary,args){return new Promise((resolve,reject)=>{const child=spawn(binary,args,{windowsHide:true,shell:false});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',c=>c===0?resolve(out):reject(Error(err)));});}
app.whenReady().then(async()=>{try{
root=await fs.mkdtemp(path.join(app.getPath('temp'),'streampulse-beta-tools-'));app.setPath('userData',path.join(root,'settings'));
// Test the bundle with downloads and executable search paths unavailable.
app.setPath('downloads',root);process.env.PATH=path.join(process.env.SystemRoot||'C:/Windows','System32');
dialog.showOpenDialog=async()=>({canceled:false,filePaths:[selected]});dialog.showSaveDialog=async()=>({canceled:false,filePath:output});
for(const [name,fn]of Object.entries({load:()=>saved,save:(_,value)=>{saved=value;return{ok:true}},'credential-status':()=>({}),info:()=>({beta:true,overlayUrl:'http://localhost:17890/overlay/gifts',secure:{}}),'update-status':()=>({phase:'manual',current:'0.1.0-beta.1'}),'sound-hotkeys':()=>({errors:[],registered:0}),'overlay-test':()=>({ok:true})}))ipcMain.handle('core:'+name,fn);
require(path.join(packageRoot,'dist-electron/videoEngine.js')).setupVideoEngine();
win=new BrowserWindow({show:false,width:1180,height:900,webPreferences:{preload:path.join(packageRoot,'dist-electron/preload.js'),contextIsolation:true,sandbox:true,backgroundThrottling:false}});await win.loadFile(path.join(packageRoot,'dist/index.html'));const run=code=>win.webContents.executeJavaScript(code);
async function wait(code){for(let i=0;i<600;i++){if(await run(code))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+code);}
await wait("document.body.textContent.includes('Set up your StreamPulse')");
await wait("document.body.textContent.includes('Local captions ready')");
assert.ok(await run("document.body.textContent.includes('Video tools ready')"));
const speechStatus=await run('window.streamPulseCore.video.speechStatus()');assert.equal(speechStatus.ready,true);assert.equal(speechStatus.bundled,true);
const status=await run('window.streamPulseCore.video.status()');assert.equal(path.resolve(status.folder),path.resolve(path.join(resources,'video-tools')));
const ffmpeg=path.join(status.folder,'ffmpeg.exe'),ffprobe=path.join(status.folder,'ffprobe.exe');
const wave=path.join(root,'speech.wav'),ps=path.join(root,'speak.ps1');
await fs.writeFile(ps,"Add-Type -AssemblyName System.Speech\n$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer\n$synth.SetOutputToWaveFile($args[0])\n$synth.Speak('Welcome to Stream Pulse. This is a test of local captions. Stay golden.')\n$synth.Dispose()\n".replace(/\\n/g,'\n'));
await command(path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-ExecutionPolicy','Bypass','-File',ps,wave]);
selected=path.join(root,'speech.mp4');await command(ffmpeg,['-v','error','-f','lavfi','-i','color=c=black:s=320x180:r=12','-i',wave,'-shortest','-c:v','libx264','-preset','ultrafast','-c:a','aac',selected]);
const recording=await run('window.streamPulseCore.video.import()');
const words=await run('window.streamPulseCore.video.transcribe('+JSON.stringify({id:recording.id,start:0,end:recording.duration})+')');
assert.ok(words.length>3,JSON.stringify(words));assert.ok(words.every(w=>Number.isFinite(w.start)&&w.end>w.start&&w.end<=recording.duration+0.01));
output=path.join(root,'captioned.mp4');await run('window.streamPulseCore.video.export('+JSON.stringify({id:recording.id,start:0,end:recording.duration,framing:'fit',editing:{font:'Segoe UI',captions:words,audioPolish:false,cameraFocus:false,wordHighlight:true}})+')');
const probe=JSON.parse(await command(ffprobe,['-v','error','-show_streams','-of','json',output]));assert.equal(probe.streams[0].codec_name,'h264');await command(ffmpeg,['-v','error','-i',output,'-f','null','-']);
assert.equal(await fs.access(path.join(root,'settings/speech-tools.json')).then(()=>true,()=>false),false,'No personal caption configuration needed');
await run("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Continue to StreamPulse').click()");await wait("Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent==='Live').className==='active'");await wait('document.querySelector("aside")!==null');
await new Promise(r=>setTimeout(r,400));assert.equal(saved.setupComplete,true);assert.equal(saved.connectionProvider,'direct');
await fs.mkdir(path.join(__dirname,'../work'),{recursive:true});await run("Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent==='Setup').click()");await fs.writeFile(path.join(__dirname,'../work/beta-setup.png'),(await win.webContents.capturePage()).toPNG());
console.log('Beta bundled smoke passed: production setup/preload, isolated settings, restricted PATH, bundled tools, offline model, synthetic speech transcription, captioned H.264 export, decode and setup persistence.');
}catch(e){console.error(e);process.exitCode=1;}finally{win?.destroy();if(root)await fs.rm(root,{recursive:true,force:true});app.exit(process.exitCode||0);}});
