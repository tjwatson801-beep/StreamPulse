const assert = require('node:assert/strict');
const { OverlayLibrary, normalizeLibrary } = require('../dist-electron/overlayLibrary');
const { LikesTracker } = require('../dist-electron/likesTracker');
const engine = new OverlayLibrary(), tracker = new LikesTracker();
const config = { likes: { enabled: true, threshold: 100 }, gifts: { enabled: true, minimumCount: 2, names: 'Rose, Galaxy' } };
engine.configure(config);
let sequence=0;
function like(user, count, id=String(++sequence)) {
 const event={id,type:'Like',user,likeCount:count}; const before=tracker.viewerLikes(user);
 return tracker.add(event) ? engine.like(event,before,tracker.viewerLikes(user)) : undefined;
}
assert.equal(like('Alice',99),undefined);
assert.equal(like('Bob',50),undefined);
assert.equal(like('ALICE',1,'boundary').title,'100 likes!');
assert.equal(like('ALICE',1,'boundary'),undefined);
assert.equal(like('Alice',250).title,'300 likes!');
assert.equal(like('Bob',50).title,'100 likes!');
tracker.reset();assert.equal(like('Alice',1),undefined);
assert.equal(like('Alice',99).title,'100 likes!');
const gift=(patch={})=>engine.gift({id:String(++sequence),type:'Gift',user:'Fan',giftName:'rose',count:2,comboComplete:true,...patch});
assert.equal(gift({comboComplete:false}),undefined);
assert.equal(gift({count:1}),undefined);
assert.equal(gift({giftName:'Other'}),undefined);
assert.equal(gift({id:'combo'}).channel,'gift-highlight');
assert.equal(gift({id:'combo'}),undefined);
engine.configure({gifts:{enabled:true}});assert.ok(gift({giftName:'Other',count:1}));
engine.configure({});assert.equal(gift(),undefined);assert.equal(like('Alice',100),undefined);
const normalized=normalizeLibrary({likes:{threshold:NaN,accent:'bad',durationMs:Infinity}});
assert.equal(normalized.likes.threshold,100);assert.equal(normalized.likes.durationMs,5000);
console.log('Passed: independent viewer milestones, batching, duplicate delivery, reset, gift combo completion, filters, and config validation.');

engine.configure({gifts:{enabled:true}}, [{name:' Rose ',imageUrl:'https://example.com/rose.png'}]);
assert.equal(gift().imageUrl,'https://example.com/rose.png');
assert.equal(gift({comboComplete:false,giftImageUrl:'https://example.com/new.png'}),undefined);
assert.equal(gift().imageUrl,'https://example.com/new.png','Final combo retains artwork from earlier updates');
assert.equal(gift({giftImageUrl:'javascript:bad'}).imageUrl,'https://example.com/new.png');
assert.equal(gift({giftName:'Galaxy'}).imageUrl,undefined,'Never substitute artwork from another gift');
console.log('Passed: saved gift artwork, combo image retention, invalid URL fallback, and gift matching.');
