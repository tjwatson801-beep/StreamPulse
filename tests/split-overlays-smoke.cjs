const assert=require('node:assert/strict');const path=require('node:path');const {app,BrowserWindow}=require('electron');const {startOverlayServer,stopOverlayServer,showOverlayAlert}=require('../dist-electron/overlayServer');
app.setPath('userData',path.join(app.getPath('temp'),'streampulse-split-overlay-test'));const windows=[];
app.whenReady().then(async()=>{try{
 const port=await startOverlayServer(0);
 const run=(w,s)=>w.webContents.executeJavaScript(s);
 async function wait(w,s){for(let i=0;i<100;i++){if(await run(w,s))return;await new Promise(r=>setTimeout(r,100));}throw Error(s);}
 async function open(route){const w=new BrowserWindow({show:false,webPreferences:{sandbox:true,backgroundThrottling:false}});windows.push(w);await w.loadURL('http://127.0.0.1:'+port+route);await wait(w,"session!=='' && ws.readyState===1");return w;}
 const gifts=await open('/overlay/gifts'),fans=await open('/overlay/superfans'),highlight=await open('/overlay/library/gift-highlight');
 await showOverlayAlert({title:'Gift only',body:'Rose',durationMs:15000});await wait(gifts,"t.textContent==='Gift only'");assert.equal(await run(fans,'t.textContent'),'');
 await showOverlayAlert({channel:'superfan',title:'Fan only',body:'Welcome',durationMs:1000});await wait(fans,"t.textContent==='Fan only'");assert.equal(await run(gifts,'t.textContent'),'Gift only');assert.equal(await run(highlight,'t.textContent'),'');
 await showOverlayAlert({channel:'gift-highlight',title:'Highlight only',body:'Rose'});await wait(highlight,"t.textContent==='Highlight only'");assert.equal(await run(fans,'t.textContent'),'Fan only');
 await run(fans,"ws.onclose=null;ws.close();clearTimeout(retry);window.WebSocket=function(){throw Error('test')};void 0");
 await showOverlayAlert({channel:'superfan',title:'Fan polling',body:'Welcome again'});await wait(fans,"t.textContent==='Fan polling'");assert.equal(await run(gifts,'t.textContent'),'Gift only');
 await showOverlayAlert({channel:'superfan',title:'Fan queued',body:'Next',durationMs:1000});
 assert.equal(await run(fans,'t.textContent'),'Fan polling');
 await wait(fans,"t.textContent==='Fan queued'");
 assert.equal(await run(gifts,'t.textContent'),'Gift only');
 await run(gifts,"for(let n=0;n<25;n++)receive({type:'gift-alert',id:'burst-'+n,createdAt:Date.now(),title:'Burst '+n,durationMs:1000});void 0");
 assert.equal(await run(gifts,'queue.length'),20);
 assert.equal(await run(gifts,'queue[0].title'),'Burst 5');
 await run(gifts,"receive({type:'gift-alert',id:'burst-24',createdAt:Date.now(),title:'Duplicate'});void 0");
 assert.equal(await run(gifts,'queue.length'),20);
 await run(gifts,"queue.forEach(d=>d.createdAt=Date.now()-31000);busy=false;next();void 0");
 assert.equal(await run(gifts,'queue.length'),0);
 console.log('Passed: independent gift/Super Fan/highlight sources, concurrent display, and Super Fan HTTP fallback.');
 }catch(e){console.error(e);process.exitCode=1;}finally{windows.forEach(w=>w.destroy());await stopOverlayServer();app.exit(process.exitCode||0);}});
