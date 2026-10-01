const {app,BrowserWindow}=require('electron');const path=require('node:path');const assert=require('node:assert/strict');
app.setPath('userData',path.join(app.getPath('temp'),'streampulse-reliability-ui'));
app.whenReady().then(async()=>{let win;try{
 win=new BrowserWindow({show:false,width:1180,height:900,webPreferences:{preload:path.join(__dirname,'reliability-preload.cjs'),contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 await win.loadFile(path.join(__dirname,'../dist/index.html'));
 const run=code=>win.webContents.executeJavaScript(code);
 async function wait(code){for(let i=0;i<80;i++){if(await run(code))return;await new Promise(r=>setTimeout(r,100));}throw Error(code);}
 await wait("document.querySelector('aside')!==null");
 await run("Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent==='Settings').click()");
 await wait("document.body.textContent.includes('Public overlay: HTTP 502')");
 await run("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Back up now').click()");
 await wait("document.body.textContent.includes('Backup saved.')");
 await run("const s=Array.from(document.querySelectorAll('select')).find(s=>s.textContent.includes('Choose a backup'));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'backup');s.dispatchEvent(new Event('change',{bubbles:true}));");
 await run("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Restore selected backup').click()");
 await wait("Array.from(document.querySelectorAll('input')).some(i=>i.value==='AfterRestore')");
 await wait("window.streamPulseCore.testLastSave().username==='AfterRestore'");
 assert.ok(await run("document.body.textContent.includes('Cloudflare process: Running')"));
 console.log('Passed: Settings renders health, creates a backup, restores settings, and autosaves the restored value.');
 }catch(e){console.error(e);process.exitCode=1;}finally{win?.destroy();app.exit(process.exitCode||0);}});
