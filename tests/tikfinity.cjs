const assert = require('node:assert/strict');
const { once } = require('node:events');
const { WebSocketServer } = require('ws');
const { TikFinityProvider } = require('../dist-electron/providers/TikFinityProvider');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) {
  for (let i=0;i<100;i++) { if(check()) return; await delay(10); }
  assert.ok(check(), 'Timed out waiting for provider');
}
async function main() {
  const server = new WebSocketServer({host:'127.0.0.1', port:0});
  await once(server,'listening');
  const provider = new TikFinityProvider(()=>{}, 'ws://127.0.0.1:'+server.address().port);
  const events=[], statuses=[];
  provider.onEvent(e=>events.push(e));provider.onStatus(s=>statuses.push(s));
  try {
    let accepted=once(server,'connection');
    await provider.connect('');
    let [socket]=await accepted;
    socket.send(JSON.stringify({event:'state_update',state:{tts_toggle_state:1}}));
    socket.send(JSON.stringify({event:'config',data:{events:[]}}));
    await delay(30);
    assert.equal(provider.status(),'connecting','Desktop connected is not LIVE confirmed');
    const send=(event,data)=>socket.send(JSON.stringify({event,data}));
    send('chat',{uniqueId:'testuser',followRole:1,isSubscriber:true,msgId:'chat1',comment:'hello',
      emotes:[{emoteId:'sticker1',emoteImageUrl:'https://example.com/sticker.png'}]});
    await until(()=>events.length===2);
    assert.equal(provider.status(),'connected');
    assert.equal(events[0].type,'Sticker');assert.equal(events[1].type,'Chat');
    assert.equal(events[1].user,'testuser');assert.equal(events[1].isFollower,true);assert.equal(events[1].isSubscriber,true);
    send('gift',{uniqueId:'testuser',msgId:'gift1',giftName:'Rose',giftType:1,repeatCount:2,repeatEnd:false,giftPictureUrl:'https://example.com/rose.png'});
    send('gift',{uniqueId:'testuser',msgId:'gift1',giftName:'Rose',giftType:1,repeatCount:2,repeatEnd:true,giftPictureUrl:'https://example.com/rose.png'});
    send('gift',{uniqueId:'testuser',msgId:'gift1',giftName:'Rose',giftType:1,repeatCount:2,repeatEnd:true});
    send('like',{uniqueId:'testuser',msgId:'like1',likeCount:4,totalLikeCount:100,profilePictureUrl:'https://example.com/avatar.png'});
    send('member',{uniqueId:'testuser',msgId:'join1'});
    send('follow',{uniqueId:'testuser',msgId:'follow1'});
    await until(()=>events.length===7);
    const gifts=events.filter(e=>e.type==='Gift');
    assert.equal(gifts.length,2);assert.equal(gifts[0].comboComplete,false);assert.equal(gifts[1].comboComplete,true);
    assert.equal(gifts[1].giftImageUrl,'https://example.com/rose.png');
    assert.equal(events.find(e=>e.type==='Like').profilePictureUrl,'https://example.com/avatar.png');
    assert.ok(events.some(e=>e.type==='Join'));assert.ok(events.some(e=>e.type==='Follow'));
    socket.send('bad json');send('roomUser',{viewerCount:50});
    await delay(30);assert.equal(provider.status(),'connected');
    assert.equal(provider.diagnostics().provider,'TikFinity');
    send('streamEnd',{});
    await until(()=>provider.status()==='connecting');
    assert.equal(provider.diagnostics().roomConfirmed,false);
    send('roomUser',{viewerCount:51});
    await until(()=>provider.status()==='connected');
    socket.close();await until(()=>provider.status()==='error');
    accepted=once(server,'connection');await provider.connect('');
    [socket]=await accepted;
    send('chat',{uniqueId:'testuser',msgId:'chat1',comment:'new session'});
    await until(()=>provider.status()==='connected');
    assert.equal(events.at(-1).detail,'new session');
    await provider.disconnect();await delay(30);
    assert.equal(provider.status(),'disconnected');assert.equal(statuses.at(-1),'disconnected');
  } finally {
    await provider.disconnect();
    for(const socket of server.clients) socket.terminate();
    await new Promise(resolve=>server.close(resolve));
  }
  console.log('TikFinity socket, LIVE confirmation, flat user fields, gifts, stickers, joins, disconnect, and reconnect checks passed');
}
main().catch(e=>{console.error(e);process.exitCode=1});
