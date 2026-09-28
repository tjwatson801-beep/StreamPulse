const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {normalizeDirectEvent}=require('../dist-electron/providers/directEvents');
const {DirectTikTokProvider,directError}=require('../dist-electron/providers/DirectTikTokProvider');
const {TikToolProvider}=require('../dist-electron/providers/TikToolProvider');
const user={displayId:'real_handle',nickname:'Display Name',followInfo:{followStatus:'1'},avatarThumb:{urlList:['https://example.com/avatar.png']},badgeList:[{sceneType:4}]};
const emitted=[],decoder=new TikToolProvider('');
decoder.onEvent(e=>emitted.push(e));
function send(event,data){const n=normalizeDirectEvent(event,data);if(n)decoder.handle(n);}
send('chat',{common:{msgId:'9007199254740993123'},user,content:'hello',emotes:[]});
assert.equal(emitted[0].detail,'hello');assert.equal(emitted[0].user,'real_handle');
assert.equal(emitted[0].id,'9007199254740993123');
assert.equal(emitted[0].isFollower,true);assert.equal(emitted[0].isSubscriber,true);
send('chat',{common:{msgId:'9007199254740993124'},user,content:'hello',emotes:[]});
assert.equal(emitted.length,2,'Distinct identical chat messages must both arrive');
send('chat',{common:{msgId:'9007199254740993124'},user,content:'hello',emotes:[]});
assert.equal(emitted.length,2,'Repeated delivery ID must be suppressed');
send('chat',{common:{msgId:'3'},user:{displayId:'nonfollower',badgeList:[{sceneType:10}]},content:'hello'});
assert.equal(emitted.at(-1).isFollower,false);assert.equal(emitted.at(-1).isSubscriber,false,'Fan badge is not a subscription');
send('chat',{common:{msgId:'4'},user:{displayId:'subscriber'},userIdentity:{isSubscriberOfAnchor:true},content:'sub'});
assert.equal(emitted.at(-1).isSubscriber,true);
const rawGift={common:{msgId:'g1'},user,giftId:'10',gift:{name:'Rose',type:1,image:{urlList:['https://example.com/rose.png']}},repeatCount:3,repeatEnd:0};
send('gift',rawGift);assert.equal(emitted.at(-1).comboComplete,false);
send('gift',{...rawGift,repeatEnd:1});assert.equal(emitted.at(-1).comboComplete,true);
assert.equal(emitted.at(-1).count,3);assert.equal(emitted.at(-1).giftName,'Rose');
assert.equal(emitted.at(-1).giftImageUrl,'https://example.com/rose.png');
send('gift',{...rawGift,common:{msgId:'g2'},gift:{name:'Heart',type:2},repeatEnd:0});
assert.equal(emitted.at(-1).comboComplete,true,'Non-streak gifts complete immediately');
send('like',{common:{msgId:'l1'},user,count:5,total:'100'});
assert.equal(emitted.at(-1).likeCount,5);assert.equal(emitted.at(-1).totalLikeCount,100);
assert.equal(emitted.at(-1).profilePictureUrl,'https://example.com/avatar.png');
send('social',{common:{msgId:'f1',displayText:{key:'pm_follow'}},user,action:1});
assert.equal(emitted.at(-1).type,'Follow');
send('emote',{common:{msgId:'s1'},user,emoteList:[{emoteId:'55',image:{urlList:['https://example.com/sticker.png']}}]});
assert.equal(emitted.at(-1).stickerId,'55');assert.equal(emitted.at(-1).stickerImageUrl,'https://example.com/sticker.png');
send('chat',{common:{msgId:'s2'},user,content:'with sticker',emotes:[{emote:{emoteId:'56',image:{urlList:['https://example.com/inline.png']}}}]});
assert.equal(emitted.at(-2).type,'Sticker');assert.equal(emitted.at(-1).detail,'with sticker');
send('barrage',{common:{msgId:'b1'},commonBarrageContent:{key:'ttlive_superFan_commentNotif_superFanJoined',pieces:[{userValue:{user}}]}});
assert.equal(emitted.at(-1).type,'SuperFanJoin');assert.equal(emitted.at(-1).user,'real_handle');
const length=emitted.length;
send('barrage',{user,content:{key:'ttlive_superFan_level_up'}});
send('superFan',{user});
assert.equal(emitted.length,length,'Unrelated fan announcements cannot trigger entrances');
send('member',{common:{msgId:'m1'},user});assert.equal(emitted.at(-1).type,'Join');
class Fake extends EventEmitter {
 constructor(){super();this.closed=0;}
 async connect(){return {roomId:'room1'};}
 async disconnect(){this.closed++;this.emit('disconnected');}
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const fake=new Fake(), events=[], statuses=[];
 const p=new DirectTikTokProvider(()=>{},async()=>fake,100);
 p.onEvent(e=>events.push(e));p.onStatus(s=>statuses.push(s));
 await p.connect('@test');
 fake.emit('chat',{common:{msgId:'c1'},user,content:'works'});
 assert.equal(events[0].detail,'works');assert.equal(p.status(),'connected');assert.equal(p.diagnostics().roomId,'room1');
 await p.disconnect();
 fake.emit('chat',{user,content:'stale'});
 assert.equal(events.length,1);assert.equal(p.status(),'disconnected');
 const pendingFake=new Fake();let resolvePending;
 pendingFake.connect=()=>new Promise(r=>resolvePending=r);
 const pending=new DirectTikTokProvider(()=>{},async()=>pendingFake,100);
 const waiting=pending.connect('test');await delay(0);await pending.disconnect();await waiting;
 resolvePending({roomId:'late'});await delay(0);assert.equal(pending.status(),'disconnected');assert.ok(pendingFake.closed>=1);
 const slowFake=new Fake();slowFake.connect=()=>new Promise(()=>{});
 const slow=new DirectTikTokProvider(()=>{},async()=>slowFake,10);
 await assert.rejects(slow.connect('test'),/timed out/);assert.equal(slow.status(),'error');await slow.disconnect();
 const endFake=new Fake(),end=new DirectTikTokProvider(()=>{},async()=>endFake);
 await end.connect('test');endFake.emit('streamEnd');assert.equal(end.status(),'error');assert.ok(endFake.closed);await end.disconnect();
 assert.match(directError({name:'SignatureRateLimitError',message:'limit'}),/Automatic reconnect is paused/);
 assert.match(directError({name:'UserOfflineError',message:'offline'}),/not LIVE/);
 assert.match(directError({name:'PremiumFeatureError'}),/account access/);
 assert.ok(!directError(new Error('failed https://example.com/?token=secret')).includes('secret'));
 console.log('Direct adapter and lifecycle passed: identities, text, roles, gifts, likes, stickers, entrances, cancellation, timeout, and terminal errors');
}
main().catch(e=>{console.error(e);process.exitCode=1});
