const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const ts = require('typescript');
const { scanSounds, normalizeHotkey, SoundHotkeys } = require('../dist-electron/soundLibrary');
const { SettingsStore } = require('../dist-electron/settingsStore');
function renderer(file) {
  const text = ts.transpileModule(require('node:fs').readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  const exports = {};
  vm.runInNewContext(text, {exports, setTimeout, clearTimeout, Date});
  return exports;
}
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'streampulse-soundboard-'));
  try {
    for (const name of ['clip 2.MP3','clip 10.wav','ignore.amr','ignore.txt','music.flac']) await fs.writeFile(path.join(root,name),'audio');
    await fs.mkdir(path.join(root,'fake.mp3'));
    const scan = await scanSounds(root);
    assert.deepEqual(scan.files.map(f=>f.filename),['clip 2.MP3','clip 10.wav','music.flac']);
    await fs.writeFile(path.join(root,'new.ogg'),'audio');
    assert.equal((await scanSounds(root)).files.length,4,'New sounds appear on rescanning');
    await assert.rejects(scanSounds('relative'));
    await assert.rejects(scanSounds(path.join(root,'missing')));
    assert.equal(normalizeHotkey(' ctrl + alt + 1 '),'Control+Alt+1');
    assert.equal(normalizeHotkey('F12'),'F12');
    for (const invalid of ['A','Ctrl+Space','Meta+A','F13','Ctrl++','Ctrl+Alt']) assert.equal(normalizeHotkey(invalid),'');
    const registered=new Map(), fired=[];
    const hotkeys=new SoundHotkeys({register:(key,cb)=>{if(key==='F2')return false;registered.set(key,cb);return true;},unregister:key=>registered.delete(key)},p=>fired.push(p));
    const clipPath=path.join(root,'clip 2.MP3');
    const result=hotkeys.configure([{path:clipPath,hotkey:'Ctrl+Alt+1'},{path:clipPath,hotkey:'Control+Alt+1'},{path:clipPath,hotkey:'F2'},{path:clipPath,hotkey:'bad'}]);
    assert.equal(result.registered,1);assert.equal(result.errors.length,3);
    registered.get('Control+Alt+1')();assert.deepEqual(fired,[clipPath]);
    hotkeys.configure([{path:clipPath,hotkey:'F1'}]);assert.deepEqual([...registered.keys()],['F1']);hotkeys.clear();assert.equal(registered.size,0);
    const store=new SettingsStore(path.join(root,'settings'));
    const settings={soundMasterVolume:.65,soundPlaybackMode:'queue',soundLibraryFolder:root,soundClips:[{path:clipPath,name:'Welcome',tags:'entrance, chiptune',favorite:true,hotkey:'F1'}]};
    await store.save(settings);const id=await store.backup('Soundboard');await store.save({...settings,soundClips:[]});assert.deepEqual(await store.restore(id),settings);
    for(const bad of [{soundMasterVolume:2},{soundMasterVolume:NaN},{soundPlaybackMode:'invalid'},{soundClips:[{path:clipPath}]},{soundLibraryFolder:42}])await assert.rejects(store.save(bad));
    const {SoundPlayback,soundUrl}=renderer('src/soundPlayback.ts');
    assert.equal(soundUrl('C:\\sounds\\hello #1%.mp3'),'file:///C:/sounds/hello%20%231%25.mp3');
    assert.equal(soundUrl('\\\\server\\share\\a b.wav'),'file://server/share/a%20b.wav');
    let now=0;const audios=[],logs=[],states=[];
    const player=new SoundPlayback((level,text)=>logs.push({level,text}),state=>states.push(state),url=>{const audio={url,volume:1,currentTime:0,onended:null,onerror:null,pause(){this.paused=true;},async play(){this.played=true;if(url.includes('broken'))throw Error('bad file');}};audios.push(audio);return audio;},()=>now);
    player.configure(.5,'queue');await player.play(clipPath,'First',.4);await player.play(clipPath,'Second');assert.equal(audios.length,1);assert.equal(audios[0].volume,.2);assert.equal(states.at(-1).queued,1);
    player.configure(.25,'queue');assert.equal(audios[0].volume,.1,'Master volume applies to active tracks');
    audios[0].onended();await Promise.resolve();assert.equal(audios.length,2);assert.equal(audios[1].volume,.25);
    await player.play(clipPath,'Stale');now=31000;audios[1].onended();await Promise.resolve();assert.equal(audios.length,2);assert.ok(logs.some(l=>l.text.includes('Stale')));
    now=32000;await player.play(clipPath,'Burst');for(let i=0;i<21;i++)await player.play(clipPath,`Queue ${i}`);assert.equal(states.at(-1).queued,20);assert.ok(logs.some(l=>l.text.includes('queue is full')));
    player.stop();assert.equal(states.at(-1).queued,0);assert.equal(states.at(-1).active.length,0);assert.ok(audios.at(-1).paused);
    await player.play(path.join(root,'broken.wav'),'Broken');await player.play(clipPath,'Recovery');assert.ok(audios.at(-1).played);assert.ok(logs.some(l=>l.level==='error'));
    player.configure(1,'interrupt');await player.play(clipPath,'One');const old=audios.at(-1);await player.play(clipPath,'Two');assert.ok(old.paused);assert.equal(states.at(-1).active.length,1);
    player.configure(1,'overlap');await player.play(clipPath,'Overlap 1');await player.play(clipPath,'Overlap 2');assert.equal(states.at(-1).active.length,2);player.stop();
    let resolve;const pending={volume:1,pause(){this.paused=true;},play:()=>new Promise(r=>resolve=r)};
    const race=new SoundPlayback(()=>{},()=>{},()=>pending);const promise=race.play(clipPath,'Pending');race.stop();resolve();await promise;assert.ok(pending.paused,'A late play resolution cannot restart stopped playback');race.stop();
    console.log('Passed: folder discovery, safe URLs, hotkey conflicts and cleanup, metadata backup/restore, master volume, queue/interrupt/overlap, queue limits/expiry, error recovery, and stop/play races.');
  } finally {await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
