const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{EventEmitter}=require('node:events');
(async()=>{
 const ipc=new EventEmitter(),out={};let token;
 const sender={send:(_,value)=>token=value},window={isDestroyed:()=>false,webContents:sender};
 vm.runInNewContext(fs.readFileSync('dist-electron/settingsFlush.js','utf8'),{exports:out,setTimeout,clearTimeout,require:n=>n==='electron'?{ipcMain:ipc}:require(n)});
 let done=false;const saved=out.flushRendererSettings(window).then(()=>done=true);
 ipc.emit('core:settings-flushed',{sender:{}},{token});await Promise.resolve();assert.equal(done,false);
 ipc.emit('core:settings-flushed',{sender},{token:'stale'});await Promise.resolve();assert.equal(done,false);
 ipc.emit('core:settings-flushed',{sender},{token});await saved;assert.equal(done,true);assert.equal(ipc.listenerCount('core:settings-flushed'),0);
 const failure=out.flushRendererSettings(window);ipc.emit('core:settings-flushed',{sender},{token,error:'disk full'});await assert.rejects(failure,/disk full/);
 await assert.rejects(out.flushRendererSettings(window,10),/did not finish/);assert.equal(ipc.listenerCount('core:settings-flushed'),0);
 await out.flushRendererSettings(null);
 console.log('Passed: close waits for save acknowledgement, rejects wrong sender/stale responses, reports save failures and timeouts, and removes listeners.');
})().catch(e=>{console.error(e);process.exitCode=1});
