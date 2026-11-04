const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {CreditsManager}=require('../dist-electron/creditsManager');
(async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'pearl-credits-'));const c=new CreditsManager(root);try{
 await c.load();c.start('gold','room1');const id=c.state.activeId;c.collect({id:'unknown',type:'Chat',user:'viewer',detail:'',time:''});assert.equal(c.state.sessions[0].viewers.length,0,'Generic connector placeholder is not a real viewer');
 const send=(id,type,extra={})=>c.collect({id,type,user:'Alice',detail:'',time:'',...extra});
 send('chat','Chat');send('chat','Chat');send('like','Like',{user:'@ALICE',likeCount:7});send('progress','Gift',{count:4,comboComplete:false});send('final','Gift',{count:5,comboComplete:true});send('follow','Follow');send('super','SuperFanJoin');
 let v=c.state.sessions[0].viewers[0];assert.equal(v.chats,1);assert.equal(v.likes,7);assert.equal(v.gifts,5);assert.equal(v.follows,true);assert.equal(v.superFan,true);assert.equal(c.state.sessions[0].viewers.length,1);
 c.start('gold','room1');assert.equal(c.state.activeId,id,'Reconnect retains session');
 const edit=(action,user,value)=>c.edit({sessionId:id,action,user,value});
 edit('exclude','alice',true);send('more','Chat');assert.equal(v.excluded,true);edit('remove','alice');send('again','Chat');assert.equal(v.removed,true);
 edit('add','alice');assert.equal(v.removed,false);assert.equal(v.excluded,false);edit('name','alice','Gold Alice');edit('category','alice','Special Thanks');edit('add','bob');edit('move','bob',-1);assert.equal(c.state.sessions[0].viewers[0].user,'bob');
 c.start('gold','room2');assert.notEqual(c.state.activeId,id);assert.ok(c.state.sessions[1].endedAt);assert.equal(c.state.sessions[0].viewers.length,0);c.end();send('ended','Chat');assert.equal(c.state.sessions[0].viewers.length,0);
 await c.flush();const restored=new CreditsManager(root);await restored.load();assert.equal(restored.state.sessions.length,2);assert.equal(restored.state.sessions[1].viewers[1].name,'Gold Alice');
 await fs.writeFile(path.join(root,'stream-credits.json'),'broken');const bad=new CreditsManager(root);await bad.load();assert.ok(bad.error);await assert.rejects(bad.flush());assert.equal(await fs.readFile(path.join(root,'stream-credits.json'),'utf8'),'broken');
 console.log('PASS credits: deduplication, engagement, completed gifts, edits, exclusion, reconnect, sessions, end, persistence, corrupt-file preservation');
 }finally{await c.flush();await fs.rm(root,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
