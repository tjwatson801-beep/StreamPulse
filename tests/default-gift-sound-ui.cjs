const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const pkg=process.env.STREAMPULSE_TEST_PACKAGE||path.join(__dirname,'..');let win;
let saved={username:'host',setupComplete:true,ttsEnabled:false,soundMasterVolume:0.5,soundPlaybackMode:'overlap',reactions:[{id:'rose',giftName:'Rose',enabled:true,soundPath:'C:/test/rose.wav',volume:0.8,speak:false,overlay:false},{id:'heart',giftName:'Heart',enabled:true,soundPath:'',speak:false,overlay:false},{id:'star',giftName:'Star',enabled:false,soundPath:'',speak:false,overlay:false}],giftActions:[{id:'lightning',enabled:true,giftName:'Lightning',minimumCount:1,kind:'sound',soundPath:'C:/test/lightning.wav',volume:0.6,message:'',imagePath:'',durationMs:1000}]};
app.whenReady().then(async()=>{try{
for(const[name,fn]of Object.entries({load:()=>saved,save:(_,state)=>{saved=state;return{ok:true}},'credential-status':()=>({}),info:()=>({}),'update-status':()=>({phase:'development'}),'sound-hotkeys':()=>({errors:[]}),'overlay-show':()=>({ok:true}),'pick-sound':()=> 'C:/test/default.wav','sound-library':()=>({folder:'C:/test',files:[{path:'C:/test/library.wav',filename:'library.wav'}]})}))ipcMain.handle('core:'+name,fn);
ipcMain.handle('video:status',()=>({ready:true,folder:'test'}));ipcMain.handle('video:speech-status',()=>({ready:true,bundled:true}));
win=new BrowserWindow({show:false,width:Number(process.env.STREAMPULSE_TEST_WIDTH)||1180,height:900,webPreferences:{preload:path.join(pkg,'dist-electron/preload.js'),contextIsolation:true,sandbox:true,backgroundThrottling:false}});await win.loadFile(path.join(pkg,'dist/index.html'));
const run=code=>win.webContents.executeJavaScript(code);
async function wait(code){for(let i=0;i<150;i++){if(await run(code))return;await new Promise(r=>setTimeout(r,30));}throw Error('Timed out: '+code);}
const click=text=>run(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(text)}).click()`);
async function input(selector,value,event='input'){await run(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${event==='change'?'HTMLSelectElement':'HTMLInputElement'}.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);}
async function mockAudio(){await run("window.played=[];window.Audio=class{constructor(url){this.src=url;this.volume=1;this.currentTime=0}play(){window.played.push({src:this.src,volume:this.volume});return Promise.resolve()}pause(){}};void 0");}
await wait("document.querySelector('aside')!==null");await new Promise(r=>setTimeout(r,200));await mockAudio();
await click('Gift Reactions');await wait("document.body.textContent.includes('Default gift response')");await click('Choose default gift sound');await wait("document.body.textContent.includes('default.wav')");
await input('input[aria-label="Default gift sound volume"]','0.4');await new Promise(r=>setTimeout(r,50));
await click('Preview default gift sound');await wait('window.played.length===1');assert.equal((await run('window.played[0]')).volume,0.2);
let count=1,sequence=0;
async function gift(name,expected,partial=false){win.webContents.send('core:event',{id:'gift-'+sequence++,type:'Gift',user:'viewer',displayName:'Nice Viewer',giftName:name,detail:'sent '+name,count:2,comboComplete:!partial,time:'now'});if(expected){count++;await wait('window.played.length==='+count);const played=await run('window.played.at(-1)');assert.ok(played.src.endsWith(expected),JSON.stringify(played));}else{await new Promise(r=>setTimeout(r,150));assert.equal(await run('window.played.length'),count,'Unexpected fallback for '+name);}}
await gift('Rose','rose.wav');assert.equal((await run('window.played.at(-1)')).volume,0.4);
await gift('Heart','default.wav');assert.equal((await run('window.played.at(-1)')).volume,0.2);
await gift('Fire','default.wav');await gift('Fire',null,true);await gift('Star',null);await gift('Lightning','lightning.wav');
await run("Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes('Reactions enabled')).querySelector('input').click()");await new Promise(r=>setTimeout(r,50));await gift('Fire',null);
await run("Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes('Reactions enabled')).querySelector('input').click()");
await new Promise(r=>setTimeout(r,350));assert.equal(saved.defaultGiftSoundPath,'C:/test/default.wav');assert.equal(saved.defaultGiftSoundVolume,0.4);
await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.reload();});await wait("document.querySelector('aside')!==null");await new Promise(r=>setTimeout(r,200));await mockAudio();count=0;await click('Gift Reactions');await wait("document.body.textContent.includes('default.wav')");assert.equal(await run("document.querySelector('input[aria-label=\"Default gift sound volume\"]').value"),'0.4');
await gift('Fire','default.wav');
await click('Sound Library');await wait("document.querySelector('.sound-tile')!==null");await click('Assign to alert');await wait("document.querySelector('select[aria-label=\"Assign sound to alert\"]')!==null");await input('select[aria-label="Assign sound to alert"]','gift-default','change');await run("document.querySelector('.sound-assignment .primary').click()");await wait("document.body.textContent.includes('to Default gift sound')");
await click('Gift Reactions');await wait("document.body.textContent.includes('library.wav')");await gift('Fire','library.wav');
await run("Array.from(document.querySelectorAll('h2')).find(el=>el.textContent==='Default gift response').scrollIntoView({block:'start'})");win.webContents.invalidate();await win.webContents.capturePage();await new Promise(r=>setTimeout(r,150));await fs.mkdir(path.join(__dirname,'../work'),{recursive:true});await fs.writeFile(path.join(__dirname,'../work/default-gift-sound.png'),(await win.webContents.capturePage()).toPNG());
assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'),true,'Default sound controls must fit the window');
await click('Clear default gift sound');await wait("document.body.textContent.includes('No default sound selected')");await gift('Fire',null);await gift('Rose','rose.wav');
console.log('Default gift sound UI passed: choose, preview/master volume, dedicated priority, configured-without-sound fallback, unconfigured gifts, partial/disabled suppression, sound action priority, save/reload, library assignment and clear.');
}catch(e){console.error(e);process.exitCode=1;}finally{win?.destroy();app.exit(process.exitCode||0);}});
