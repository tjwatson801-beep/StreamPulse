const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const os=require('node:os');
const {app,BrowserWindow}=require('electron');
const {startOverlayServer,stopOverlayServer,showOverlayAlert}=require('../dist-electron/overlayServer');
const {normalizeLibrary}=require('../dist-electron/overlayLibrary');
const windows=[];
let image;
app.whenReady().then(async()=>{try{
 const config=normalizeLibrary({likes:{backgroundMode:'bad',backgroundOpacity:Infinity,backgroundColor:'bad'},gifts:{backgroundMode:'solid',backgroundOpacity:200,backgroundColor:'#123456'}});
 assert.equal(config.likes.backgroundMode,'theme');assert.equal(config.likes.backgroundOpacity,90);assert.equal(config.gifts.backgroundOpacity,100);assert.equal(config.gifts.backgroundColor,'#123456');
 image=path.join(os.tmpdir(),'streampulse-background-'+Date.now()+'.png');
 await fs.writeFile(image,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQ0AAAAASUVORK5CYII=','base64'));
 const port=await startOverlayServer(0);
 for(const channel of ['like-pop','gift-highlight']){
  const win=new BrowserWindow({show:false,width:960,height:600,webPreferences:{sandbox:true,offscreen:true,backgroundThrottling:false}});windows.push(win);
  const run=code=>win.webContents.executeJavaScript(code);
  async function wait(code){for(let i=0;i<160;i++){if(await run(code))return;await new Promise(r=>setTimeout(r,50));}throw Error(code)}
  await win.loadURL(`http://127.0.0.1:${port}/overlay/library/${channel}`);await wait("session!=='' && ws.readyState===1");
  await showOverlayAlert({channel,title:'Solid',body:'Readable',backgroundMode:'solid',backgroundColor:'#123456',backgroundOpacity:35,durationMs:1000});
  await wait("a.dataset.background==='solid' && a.classList.contains('show')");
  assert.equal(await run("getComputedStyle(a,'::before').backgroundColor"),'rgb(18, 52, 86)');
  assert.equal(await run("getComputedStyle(a,'::before').opacity"),'0.35');
  await new Promise(r=>setTimeout(r,300));
  assert.equal(await run("getComputedStyle(a).backgroundColor"),'rgba(0, 0, 0, 0)');
  await new Promise(r=>setTimeout(r,300));assert.equal(await run('getComputedStyle(t).opacity'),'1');
  const result=await showOverlayAlert({channel,title:'Image',body:'Art stays above',backgroundMode:'image',backgroundImagePath:image,backgroundOpacity:70,maxBanners:2,durationMs:1000});assert.equal(result.ok,true);
  await wait("Array.from(document.querySelectorAll('.show')).some(c=>c.dataset.background==='image')");
  assert.equal(await run("(async()=>{const card=Array.from(document.querySelectorAll('.show')).find(c=>c.dataset.background==='image');const url=card.style.getPropertyValue('--background-image').match(/\"([^\"]+)\"/)[1];const response=await fetch(url);return response.ok && response.headers.get('content-type').includes('image/png')})()"),true);
  await showOverlayAlert({channel,title:'Transparent',body:'Text',backgroundMode:'transparent',durationMs:1000});
  await wait("a.dataset.background==='transparent'");
  assert.equal(await run("getComputedStyle(a,'::before').backgroundColor"),'rgba(0, 0, 0, 0)');
  const bad=await showOverlayAlert({channel,title:'Missing',body:'Fallback',backgroundMode:'image',backgroundImagePath:path.join(os.tmpdir(),'missing-background.png'),durationMs:1000});assert.equal(bad.ok,false);assert.match(bad.error,/background/);
  await wait("a.dataset.background==='theme' && t.textContent==='Missing'");
  assert.equal(await run("getComputedStyle(a,'::before').backgroundImage"),'none');
 }
 console.log('Passed: background validation, both overlay channels, solid color and opacity, image delivery, transparent mode, missing-image fallback, and reused-card reset.');
}catch(error){console.error(error);process.exitCode=1}finally{windows.forEach(w=>w.destroy());await stopOverlayServer();if(image)await fs.unlink(image).catch(()=>{});app.exit(process.exitCode||0)}});
