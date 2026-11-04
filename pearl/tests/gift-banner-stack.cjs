const assert = require('node:assert/strict');
const { app, BrowserWindow } = require('electron');
const { startOverlayServer, stopOverlayServer, showOverlayAlert } = require('../dist-electron/overlayServer');
const { normalizeLibrary } = require('../dist-electron/overlayLibrary');
let win;
app.whenReady().then(async () => {
  try {
    for (const [value, expected] of [[undefined,1],[0,1],[9,5],[3.8,3],[NaN,1]])
      assert.equal(normalizeLibrary({gifts:{maxBanners:value}}).gifts.maxBanners, expected);
    const port = await startOverlayServer(0);
    win = new BrowserWindow({show:false,width:960,height:940,webPreferences:{sandbox:true,backgroundThrottling:false,offscreen:true}});
    await win.loadURL(`http://127.0.0.1:${port}/overlay/library/gift-highlight`);
    const run = code => win.webContents.executeJavaScript(code);
    async function wait(code) { for(let i=0;i<300;i++) {if(await run(code)) return; await new Promise(r=>setTimeout(r,50));} throw Error(code); }
    await wait("session!=='' && ws.readyState===1");
    assert.equal(await run("getComputedStyle(a).display"), 'none');
    for(let i=0;i<6;i++) await showOverlayAlert({channel:'gift-highlight',title:'Gift '+i,body:'Thanks fan '+i,maxBanners:5,durationMs:i===0?1000:4000});
    await wait('active.size===5 && queue.length===1');
    await new Promise(r=>setTimeout(r,500));
    assert.equal(await run("document.querySelectorAll('#stack .show').length"),5);
    const boxes=await run("Array.from(active,c=>{const r=c.getBoundingClientRect();return {top:r.top,bottom:r.bottom}})");
    for(let i=0;i<boxes.length;i++){assert.ok(boxes[i].top>=0 && boxes[i].bottom<=940);if(i)assert.ok(boxes[i].top>boxes[i-1].bottom);}
    await wait("Array.from(active).some(c=>c.textContent.includes('Gift 5'))");
    assert.equal(await run('active.size'),5,'Only expired banner is replaced');
    assert.ok(await run("Array.from(active).some(c=>c.textContent.includes('Gift 1'))"));
    await run("receive({type:'gift-alert',channel:'gift-highlight',id:'duplicate',createdAt:Date.now(),title:'Duplicate',maxBanners:5});receive({type:'gift-alert',channel:'gift-highlight',id:'duplicate',createdAt:Date.now(),title:'Duplicate',maxBanners:5});void 0");
    assert.equal(await run('queue.length'),1);
    await wait('active.size===0');
    assert.equal(await run("getComputedStyle(a).display"),'none');
    await showOverlayAlert({channel:'gift-highlight',title:'Single first',body:'',durationMs:1000});
    await showOverlayAlert({channel:'gift-highlight',title:'Single queued',body:'',durationMs:1000});
    await wait('active.size===1 && queue.length===1');
    await wait("a.querySelector('h1').textContent==='Single queued'");
    console.log('Passed: 1–5 limits, five nonoverlapping banners, independent expiry, queue refill, deduplication, hidden idle state, and single-banner default.');
  } catch(error) { console.error(error); process.exitCode=1; }
  finally { if(win)win.destroy();await stopOverlayServer();app.exit(process.exitCode||0); }
});
