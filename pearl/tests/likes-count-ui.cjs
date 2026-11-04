const {app,BrowserWindow,ipcMain}=require('electron');
const {startOverlayServer,stopOverlayServer,likesTracker,setLikesAppearance}=require('../dist-electron/overlayServer');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
let ui,overlay,saved={username:'host',setupComplete:true,ttsEnabled:false};const delay=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{try{
const port=await startOverlayServer(0);likesTracker.startStream('host','count-test');for(let i=0;i<12;i++)likesTracker.add({id:'like'+i,type:'Like',user:'fan'+i,likeCount:i+1});
for(const [name,fn] of Object.entries({load:()=>saved,save:(_,state)=>{saved=state;setLikesAppearance(state);return{ok:true}},'credential-status':()=>({}),info:()=>({overlayUrl:'http://127.0.0.1:'+port+'/overlay/gifts'}),'update-status':()=>({phase:'development'}),'sound-hotkeys':()=>({errors:[]})}))ipcMain.handle('core:'+name,fn);
ipcMain.handle('video:status',()=>({ready:true}));ipcMain.handle('video:speech-status',()=>({ready:true}));
ui=new BrowserWindow({show:false,width:940,height:900,webPreferences:{preload:path.join(__dirname,'../dist-electron/preload.js'),contextIsolation:true,sandbox:true,backgroundThrottling:false}});
ui.webContents.session.webRequest.onBeforeRequest({urls:['http://localhost:17890/overlay/likes*']},(details,done)=>done({redirectURL:details.url.replace('localhost:17890','127.0.0.1:'+port)}));
await ui.loadFile(path.join(__dirname,'../dist/index.html'));overlay=new BrowserWindow({show:false,width:480,height:1000,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}});await overlay.loadURL('http://127.0.0.1:'+port+'/overlay/likes');
const run=code=>ui.webContents.executeJavaScript(code),read=code=>overlay.webContents.executeJavaScript(code);
const wait=async(fn,code)=>{for(let i=0;i<150;i++){if(await fn(code))return;await delay(30)}throw Error('Timed out: '+code)};
await wait(run,"document.querySelector('aside')!==null");await delay(250);await run("Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent==='Like Rankings').click()");await wait(run,"document.querySelector('[aria-label=\"Top likers to show\"]')!==null");
assert.equal(await run("document.querySelector('[aria-label=\"Top likers to show\"]').value"),'10');assert.equal(await run("document.querySelector('[aria-label=\"Top likers to show\"]').options.length"),8);await wait(read,"document.querySelectorAll('#leaders li').length===10");
const set=async count=>{await run(`(()=>{const el=document.querySelector('[aria-label="Top likers to show"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,${JSON.stringify(String(count))});el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait(read,`document.querySelectorAll('#leaders li').length===${count}`)};
const total=likesTracker.snapshot().trackedLikes;
for(const count of [3,4,5,6,7,8,9,10]){await set(count);assert.equal(likesTracker.snapshot().trackedLikes,total);assert.equal(likesTracker.snapshot().viewers,12)}
await set(3);await new Promise(resolve=>{overlay.webContents.once('did-finish-load',resolve);overlay.reload()});await wait(read,"document.querySelectorAll('#leaders li').length===3");
await set(10);assert.equal(await read("document.querySelector('#leaders li .name').textContent"),'@fan11');
await overlay.loadURL('http://127.0.0.1:'+port+'/overlay/likes?preview=1');await wait(read,"document.querySelectorAll('#leaders li').length===10");await set(3);await set(8);assert.equal(likesTracker.snapshot().trackedLikes,total,'Sample count never resets live likes');
await delay(350);assert.equal(saved.likesTopCount,8);await new Promise(resolve=>{ui.webContents.once('did-finish-load',resolve);ui.reload()});await wait(run,"document.querySelector('aside')!==null");await delay(250);await run("Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent==='Like Rankings').click()");await wait(run,"document.querySelector('[aria-label=\"Top likers to show\"]')?.value==='8'");
await run("document.querySelector('[aria-label=\"Top likers to show\"]').scrollIntoView({block:'center'})");await delay(100);assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'),true);ui.webContents.invalidate();await ui.webContents.capturePage();await delay(150);fs.writeFileSync(path.join(__dirname,'../review/likes-top-count.png'),(await ui.webContents.capturePage()).toPNG());
console.log('Top liker count passed: all counts 3–10, legacy default 10, live and sample redraws, reload snapshot, saved setting, narrow layout, and preserved viewer totals.');
}catch(e){console.error(e);process.exitCode=1}finally{ui?.destroy();overlay?.destroy();await stopOverlayServer();app.exit(process.exitCode||0)}});
