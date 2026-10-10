const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const {EventEmitter} = require('node:events');
const {PassThrough} = require('node:stream');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-test-'));
process.resourcesPath = temp;
const source = path.join(temp, 'recording.mp4');
const destination = path.join(temp, 'clip.mp4');
fs.writeFileSync(source, '0123456789');
const handlers = {}, lifecycle = {}, commands = [], updates = [];
let fail = false, hold = false, savePath = destination, openPath = source, lastBinary = '';
const original = Module._load;
Module._load = function(name, ...rest) {
  if (name === 'electron') return {
    app: {getPath: () => temp, on: (name, fn) => lifecycle[name] = fn},
    dialog: {showOpenDialog: async () => ({canceled:false,filePaths:[openPath]}), showSaveDialog: async () => ({canceled:false,filePath:savePath})},
    ipcMain: {handle: (name, fn) => handlers[name] = fn}
  };
  if (name === 'child_process') return {spawn: (binary, args, options) => {
    lastBinary = binary;
    assert.equal(options.shell, false);
    commands.push(args);
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => setImmediate(() => child.emit('close', 1));
    setImmediate(() => {
      if (args.includes('-version')) {child.stdout.write('test tools');child.emit('close',0);}
      else if (binary.includes('ffprobe')) { child.stdout.write(JSON.stringify({streams:[{codec_type:'video',width:1920,height:1080}],format:{duration:'60'}})); child.emit('close',0); }
      else {
        fs.writeFileSync(args.at(-1), 'rendered');
        child.stdout.write('out_time_us=5000000\n');
        if (!hold) child.emit('close', fail ? 1 : 0);
      }
    });
    return child;
  }};
  return original.call(this, name, ...rest);
};
const {setupVideoEngine, validateClip} = require('../dist-electron/videoEngine.js');
Module._load = original;
const event = {sender:{isDestroyed:()=>false,send:(_, value)=>updates.push(value)}};
(async () => {
  for (const [start,end] of [[-1,2],[2,2],[0,61],[NaN,3],['1',3]]) assert.throws(() => validateClip(start,end,60));
  setupVideoEngine();
  const item = await handlers['video:import']();
  const response = await fetch(item.url, {headers:{Range:'bytes=2-5'}});
  assert.equal(response.status,206); assert.equal(await response.text(),'2345');
  assert.equal((await fetch(item.url,{headers:{Range:'bytes=99-'}})).status,416);
  assert.equal((await fetch(item.url,{headers:{Range:'bytes=90071992547409999-'}})).status,416);
  assert.equal((await fetch(item.url.replace(item.id, 'unknown'))).status,404);
  assert.deepEqual((await handlers['video:analyze'](event,item.id)).highlights,[]);
  const args = {id:item.id,start:10,end:20,framing:'fit'};
  assert.equal(await handlers['video:export'](event,args),destination);
  assert.equal(fs.readFileSync(destination,'utf8'),'rendered');
  const command = commands.at(-1);
  assert.equal(command[command.indexOf('-ss')+1],'10');
  assert.equal(command[command.indexOf('-t')+1],'10');
  assert.match(command[command.indexOf('-vf')+1],/pad=1080:1920/);
  assert.equal(updates.at(-1),100);
  await assert.rejects(handlers['video:export'](event,{...args,end:80}),/valid start/);
  savePath = source;
  await assert.rejects(handlers['video:export'](event,args),/different file/);
  savePath = destination; fail = true;
  await assert.rejects(handlers['video:export'](event,args),/failed/);
  assert.equal(fs.readFileSync(destination,'utf8'),'rendered');
  assert.equal(fs.readdirSync(temp).filter(x=>x.startsWith('.golden')).length,0);
  fail = false; hold = true;
  const pending = handlers['video:export'](event,args);
  for(let i=0;i<100 && !fs.readdirSync(temp).some(x=>x.startsWith('.golden'));i++)await new Promise(resolve=>setTimeout(resolve,10));
  await assert.rejects(handlers['video:export'](event,args),/already running/);
  handlers['video:cancel'](); await assert.rejects(pending,/cancelled/);
  assert.equal(fs.readdirSync(temp).filter(x=>x.startsWith('.golden')).length,0);
  hold = false; const tools = path.join(temp,'tools');fs.mkdirSync(tools);
  const {videoBinary}=require('../dist-electron/videoTools');for(const name of ['ffmpeg','ffprobe'])fs.writeFileSync(path.join(tools,videoBinary(name)),'');
  openPath = tools; assert.equal(await handlers['video:tools'](),tools);
  assert.equal(JSON.parse(fs.readFileSync(path.join(temp,'video-tools.json'),'utf8')).folder,tools);
  lifecycle['will-quit']();setupVideoEngine();assert.equal((await handlers['video:status']()).ready,true);
  assert.equal(lastBinary,path.join(tools,videoBinary('ffprobe')),'Saved tool path is loaded by a fresh engine instance');
  console.log('Video engine tests passed: ranges, trim arguments, progress, validation, source protection, failure cleanup, cancellation, concurrency, and saved tool paths across restarts.');
})().catch(error => {console.error(error);process.exitCode=1;}).finally(()=>{lifecycle['will-quit']?.();fs.rmSync(temp,{recursive:true,force:true});});
