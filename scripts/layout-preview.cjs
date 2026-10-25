const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const pkg=process.env.STREAMPULSE_TEST_PACKAGE||path.join(__dirname,'..');
let win;
app.whenReady().then(async()=>{try{
const soundFolder='C:\\Users\\Tester\\Documents\\StreamPulse\\Sounds';
const saved={username:'example_streamer',ttsEnabled:false,setupComplete:true,connectionProvider:'direct',superFans:[{id:'fan',username:'golden_supporter',message:'Welcome {username}!',enabled:true,imagePath:'',soundPath:'',durationMs:6000}],giftActions:[{id:'action',enabled:true,giftName:'Rose',minimumCount:5,kind:'tts',message:'Thank you {username} for {gift}!',volume:1,soundPath:'',imagePath:'',durationMs:5000}],reactions:[{id:'rose',giftName:'Rose',message:'Thanks {username}!',speak:true,overlay:true,enabled:true,soundPath:''}],soundClips:[],stickerCatalog:[{id:'1',name:'Happy'}],stickerReactions:[{id:'s',stickerId:'1',soundPath:'',enabled:true}]};
for(const[name,fn]of Object.entries({load:()=>saved,save:()=>({ok:true}),'credential-status':()=>({}),info:()=>({overlayUrl:'http://127.0.0.1:1/overlay/gifts',secure:{connected:false}}),'update-status':()=>({phase:'development',current:'layout preview'}),'sound-hotkeys':()=>({errors:[]}),health:()=>({live:'Disconnected',local:{ok:true,message:'Ready'},public:{ok:false,message:'Not connected'},tunnel:false}),'backup-list':()=>[],'sound-library':()=>({folder:soundFolder,files:[{path:soundFolder+'\\welcome.wav',filename:'welcome.wav'},{path:soundFolder+'\\celebration-for-super-fans.wav',filename:'celebration-for-super-fans.wav'}]})}))ipcMain.handle('core:'+name,fn);
ipcMain.handle('video:status',()=>({ready:true,folder:'bundled'}));ipcMain.handle('video:speech-status',()=>({ready:true,bundled:true}));
ipcMain.handle('video:import',()=>({id:'recording',name:'Friday evening stream highlights.mp4',duration:3600,width:1080,height:1920,hasAudio:true,url:''}));
ipcMain.handle('video:analyze',()=>({highlights:[],message:'No sample analysis requested.'}));
win=new BrowserWindow({show:false,width:1180,height:900,webPreferences:{preload:path.join(pkg,'dist-electron/preload.js'),contextIsolation:true,sandbox:true,backgroundThrottling:false}});
await win.loadFile(path.join(pkg,'dist/index.html'));const run=code=>win.webContents.executeJavaScript(code);
for(let i=0;i<100;i++){if(await run("document.querySelector('aside')!==null"))break;await new Promise(r=>setTimeout(r,30));}
await new Promise(r=>setTimeout(r,250));
const tag=process.env.STREAMPULSE_LAYOUT_TAG||'after';const output=path.join(__dirname,'../work/layout-alpha55',tag);await fs.mkdir(output,{recursive:true});
const reports=[];
const pages=['Setup','Live','Golden Moments','Sound Library','Actions','Chat TTS','Gift Reactions','Sticker Sounds','Like Rankings','Overlay','Settings'];
for(const width of [1180,940]){
win.setSize(width,900);await new Promise(r=>setTimeout(r,60));
for(const page of pages){
await run(`Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent===${JSON.stringify(page)}).click();window.scrollTo(0,0);`);
for(let attempt=0;attempt<100;attempt++){if(await run('document.querySelector('+JSON.stringify('aside button.active')+').textContent==='+JSON.stringify(page)))break;await new Promise(r=>setTimeout(r,30));}
await new Promise(r=>setTimeout(r,150));
if(page==='Golden Moments') {await run("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Import recording').click()");await new Promise(r=>setTimeout(r,100));}
const report=await run(`(()=>{const main=document.querySelector('main');const checks=Array.from(main.querySelectorAll('input[type=checkbox]')).filter(el=>el.getBoundingClientRect().width>0).map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,mainWidth:main.clientWidth,mainContentWidth:main.scrollWidth,checkboxes:checks};})()`);
reports.push({page,...report});
win.webContents.invalidate();await win.webContents.capturePage();await new Promise(r=>setTimeout(r,150));
await fs.writeFile(path.join(output,width+'-'+page.replace(/ /g,'-')+'.png'),(await win.webContents.capturePage()).toPNG());
if(page==='Golden Moments'){
await run("document.querySelector('.golden-review-layout')?.scrollIntoView({block:'start'})");win.webContents.invalidate();await win.webContents.capturePage();await new Promise(r=>setTimeout(r,150));await fs.writeFile(path.join(output,width+'-Golden-controls.png'),(await win.webContents.capturePage()).toPNG());
}
}
}
await fs.writeFile(path.join(output,'layout-report.json'),JSON.stringify(reports,null,2));
const overflow=reports.filter(r=>r.documentWidth>r.width+1||r.mainContentWidth>r.mainWidth+1);
console.log(JSON.stringify({tag,screens:reports.length,overflow:overflow.map(r=>({page:r.page,width:r.width,documentWidth:r.documentWidth,mainContentWidth:r.mainContentWidth,mainWidth:r.mainWidth}))}));
if(tag!=='before') {assert.equal(overflow.length,0,'Pages should not overflow horizontally; tables have their own scroll containers');for(const r of reports)for(const c of r.checkboxes)assert.ok(c.width<=24&&c.height<=24,'Checkboxes should stay compact');}
console.log('Layout preview completed.');
}catch(e){console.error(e);process.exitCode=1;}finally{win?.destroy();app.exit(process.exitCode||0);}});
