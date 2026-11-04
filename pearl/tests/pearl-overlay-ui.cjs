const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
const target=process.env.PEARL_PACKAGE_ROOT||path.resolve('.');
let win,saved={username:'host',setupComplete:true,ttsEnabled:false},calls=[];
app.whenReady().then(async()=>{try{
 for(const [name,fn] of Object.entries({load:()=>saved,save:(_,s)=>{saved=s;return{ok:true}},'credential-status':()=>({}),info:()=>({overlayUrl:'http://127.0.0.1:17890/overlay'}),'update-status':()=>({phase:'development'}),'sound-hotkeys':()=>({errors:[]}),'overlay-show':(_,d)=>{calls.push(d);return{ok:true}},'pick-image':()=> 'C:\\Pictures\\custom-background.png'}))ipcMain.handle('core:'+name,fn);
 ipcMain.handle('video:status',()=>({ready:true}));ipcMain.handle('video:speech-status',()=>({ready:true}));
 win=new BrowserWindow({show:false,width:940,height:1100,webPreferences:{preload:path.join(target,'dist-electron/preload.js'),contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 const run=code=>win.webContents.executeJavaScript(code);
 async function wait(code){for(let i=0;i<180;i++){if(await run(code))return;await new Promise(r=>setTimeout(r,50));}throw Error(code)}
 async function open(){await win.loadFile(path.join(target,'dist/index.html'));await wait("Array.from(document.querySelectorAll('aside button')).some(b=>b.textContent==='Overlay')");await run("Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent==='Overlay').click();void 0");await wait("document.querySelectorAll('.overlay-library-grid article').length===2")}
 async function select(index,label,value){await run(`(()=>{const card=document.querySelectorAll('.overlay-library-grid article')[${index}];const el=Array.from(card.querySelectorAll('label')).find(l=>l.firstChild.textContent.trim()===${JSON.stringify(label)}).querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('change',{bubbles:true}));})()`)}
 await open();await select(0,'Font','Georgia');await select(0,'Background','solid');await select(1,'Font','Permanent Marker');await select(1,'Banners at once','5');await select(1,'Background','image');
 await run("Array.from(document.querySelectorAll('.overlay-library-grid article')[1].querySelectorAll('button')).find(b=>b.textContent==='Choose image').click();void 0");
 await wait("document.querySelectorAll('.overlay-library-grid article')[1].textContent.includes('Remove image')");
 await run("document.querySelectorAll('.overlay-library-grid article').forEach(c=>Array.from(c.querySelectorAll('button')).find(b=>b.textContent==='Test overlay').click());void 0");
 for(let i=0;i<150 && calls.length<6;i++)await new Promise(r=>setTimeout(r,30));
 assert.equal(calls.length,6);assert.equal(calls[0].font,'Georgia');assert.equal(calls[0].backgroundMode,'solid');assert.equal(calls.filter(c=>c.channel==='gift-highlight'&&c.maxBanners===5&&c.font==='Permanent Marker'&&c.backgroundImagePath.endsWith('custom-background.png')).length,5);
 await new Promise(r=>setTimeout(r,500));assert.equal(saved.overlayLibrary.gifts.maxBanners,5);assert.equal(saved.overlayLibrary.likes.backgroundMode,'solid');
 await open();assert.equal(await run("document.querySelectorAll('.overlay-library-grid article')[1].querySelector('input[placeholder=\"Choose a background image\"]').value"),'C:\\Pictures\\custom-background.png');
 assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'),true);
 assert.equal(await run("document.fonts.load('34px \"Permanent Marker\"').then(f=>f.length)"),1);
 await fs.writeFile(path.resolve('review/overlay-customization-ui.png'),(await win.webContents.capturePage()).toPNG());
 console.log('Pearl overlay UI passed: independent font/background choices, image picker, five preview events, persistence/reload, bundled font, and 940px layout. Target: '+target);
}catch(e){console.error(e);process.exitCode=1}finally{win?.destroy();app.exit(process.exitCode||0)}});
