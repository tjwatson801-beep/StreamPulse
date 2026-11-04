const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{EventEmitter}=require('node:events');
(async()=>{
 const timers=new Map(),children=[],out={};let id=0;
 const setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id},clearTimeout=id=>timers.delete(id);
 const fire=ms=>{const item=[...timers].find(([,v])=>v.ms===ms);assert.ok(item,'Missing timer '+ms);timers.delete(item[0]);item[1].fn();};
 const spawn=()=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.exitCode=null;child.killed=false;child.kill=()=>{child.killed=true;child.emit('exit',0);};children.push(child);return child;};
 vm.runInNewContext(fs.readFileSync('dist-electron/secureTunnel.js','utf8'),{exports:out,setTimeout,clearTimeout,process:{resourcesPath:''},require:n=>n==='electron'?{app:{isPackaged:false,getAppPath:()=>'.'}}:n==='child_process'?{spawn}:n==='./overlayServer'?{OVERLAY_PORT:17890}:require(n)});
 const log=(child,text)=>child.stderr.emit('data',Buffer.from(text+'\n'));
 const start=out.startSecureTunnel({token:'secret',hostname:'overlay.test'});assert.equal(out.startSecureTunnel(),start);
 log(children[0],'Registered tunnel connection connIndex=0');await start;assert.equal(out.getSecureOverlayInfo().connected,true);
 log(children[0],'Connection terminated connIndex=0');assert.equal(out.getSecureOverlayInfo().connected,false);
 log(children[0],'Registered tunnel connection connIndex=0');assert.equal(out.getSecureOverlayInfo().connected,true);
 children[0].emit('exit',1);assert.equal(out.getSecureOverlayInfo().connected,false);
 for(let i=0;i<5;i++){fire(2000*2**i);children.at(-1).emit('exit',1);}
 assert.match(out.getSecureOverlayInfo().error,/paused/);assert.equal(children.length,6);
 await out.stopSecureTunnel();assert.equal(timers.size,0);
 const next=out.startSecureTunnel();const child=children.at(-1);log(child,'https://example.trycloudflare.com');assert.equal(out.getSecureOverlayInfo().connected,false);
 log(child,'Registered tunnel connection connIndex=0');await next;assert.equal(out.getSecureOverlayInfo().connected,true);
 child.emit('exit',1);await out.stopSecureTunnel();assert.equal(timers.size,0);
 const count=children.length;log(child,'Registered tunnel connection connIndex=0');assert.equal(out.getSecureOverlayInfo().connected,false);assert.equal(children.length,count);
 console.log('Passed: tunnel registration status, bounded exponential retries, manual cancellation, stale-event isolation, and temporary URL readiness.');
})().catch(e=>{console.error(e);process.exitCode=1});
