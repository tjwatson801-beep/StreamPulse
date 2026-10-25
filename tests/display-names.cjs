const assert=require('node:assert/strict');
const {TikToolProvider}=require('../dist-electron/providers/TikToolProvider');
const {normalizeDirectEvent}=require('../dist-electron/providers/directEvents');
const {LikesTracker}=require('../dist-electron/likesTracker');
const {OverlayLibrary}=require('../dist-electron/overlayLibrary');
const p=new TikToolProvider(''),events=[];p.onEvent(e=>events.push(e));
for(const kind of ['chat','gift','like','follow','member','emotechat']){p.handle({event:kind,data:{msgId:kind,user:{uniqueId:'real_handle',nickname:'  Display Name ✨  '},comment:'hello',giftName:'Rose',repeatCount:1,repeatEnd:true,likeCount:5,emoteId:'sticker'}});assert.equal(events.at(-1).user,'real_handle');assert.equal(events.at(-1).displayName,'Display Name ✨');}
p.handle({event:'chat',data:{msgId:'flat',uniqueId:'flat_handle',nickname:'Flat Name',comment:'hi'}});assert.equal(events.at(-1).displayName,'Flat Name');
p.handle({event:'chat',data:{msgId:'fallback',user:{uniqueId:'fallback',nickname:'  '},comment:'hi'}});assert.equal(events.at(-1).user,'fallback');assert.equal(events.at(-1).displayName,undefined);
const n=normalizeDirectEvent('chat',{user:{displayId:'direct_handle',nickname:'Direct Name'},content:'hello'});p.handle(n);assert.equal(events.at(-1).user,'direct_handle');assert.equal(events.at(-1).displayName,'Direct Name');
const t=new LikesTracker();t.add({id:'1',type:'Like',user:'first',displayName:'Same Name',likeCount:2});t.add({id:'2',type:'Like',user:'second',displayName:'Same Name',likeCount:3});t.add({id:'3',type:'Like',user:'FIRST',likeCount:2});assert.equal(t.snapshot().viewers,2);assert.equal(t.viewerLikes('first'),4);assert.equal(t.snapshot().leaders[0].displayName,'Same Name');t.add({id:'4',type:'Like',user:'first',displayName:'New Name',likeCount:1});assert.equal(t.snapshot().viewers,2);assert.equal(t.snapshot().leaders[0].displayName,'New Name');
const l=new OverlayLibrary();l.configure({likes:{enabled:true,threshold:1},gifts:{enabled:true}});assert.equal(l.like({user:'handle',displayName:'Nice Name'},0,1).body,'Nice Name is spreading the love');assert.equal(l.gift({id:'g',type:'Gift',user:'handle',displayName:'Nice Name',giftName:'Rose',count:1}).body,'Thank you, Nice Name!');
console.log('Display names passed: providers, fallback, distinct handles with identical names, renamed viewers, retained like totals and overlay labels.');
