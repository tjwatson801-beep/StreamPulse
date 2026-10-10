const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { TikToolProvider } = require('../dist-electron/providers/TikToolProvider');

function loadTs(file, dependencies, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2021 }
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: name => dependencies[name], ...globals });
  return exports;
}

async function main() {
  const provider = new TikToolProvider('test');
  const received = [];
  provider.onEvent(event => received.push(event));
  const send = (event, data) => provider.handle({ event, data: { user: { uniqueId: 'GoldFan' }, ...data } });
  send('member', { msgId: 'join-1' });
  send('member', { msgId: 'join-1' });
  send('member', { msgId: 'join-2' });
  assert.equal(received.length, 2, 'Distinct entries pass; duplicate delivery is ignored');
  send('member', {}); send('member', {});
  assert.equal(received.length, 4, 'Entries without an event ID are not rate limited');
  send('gift', { transactionId: 'combo', giftName: 'Rose', repeatCount: 5, repeatEnd: false });
  send('gift', { transactionId: 'combo', giftName: 'Rose', repeatCount: 5, repeatEnd: true, giftPictureUrl: 'https://example.com/rose.png' });
  assert.equal(received.at(-1).comboComplete, true, 'Combo completion is not swallowed by deduplication');
  assert.equal(received.at(-1).giftImageUrl, 'https://example.com/rose.png');
  send('emoteChat', { messageUuid: 'sticker-1', emoteId: '123', emoteUrl: 'https://example.com/sticker.png' });
  assert.equal(received.at(-1).type, 'Sticker');
  assert.equal(received.at(-1).stickerId, '123');
  assert.equal(received.at(-1).stickerImageUrl, 'https://example.com/sticker.png');
  send('emoteChat', { messageUuid: 'sticker-2', emoteId: '456' });
  assert.equal(received.at(-1).stickerId, '456', 'Different stickers remain distinct');

  send('emote', { msgId: 'alias-sticker', emoteId: '123', emoteUrl: 'https://example.com/sticker.png' });
  assert.equal(received.at(-1).type, 'Sticker', 'TikTool emote alias is recognized');
  assert.equal(received.at(-1).stickerId, '123');
  const afterAlias = received.length;
  send('emoteChat', { msgId: 'alias-sticker', emoteId: '123' });
  assert.equal(received.length, afterAlias, 'Same sticker message delivered under aliases is deduplicated');
  send('emote', { emoteList: [{ emoteId: 'repeat-alias' }] });
  send('emote', { emoteList: [{ emoteId: 'repeat-alias' }] });
  assert.equal(received.length, afterAlias + 2, 'Distinct no-ID sends still trigger');
  const beforeCompact = received.length;
  send('chat', { msgId: 'compact-list', comment: '', emotes: [{ id: 'compact-1', url: 'https://example.com/one.png', name: 'One' }, { id: 'compact-2', url: 'https://example.com/two.png', name: 'Two' }] });
  assert.deepEqual(received.slice(beforeCompact).map(e => e.type), ['Sticker', 'Sticker', 'Chat']);
  assert.equal(received[beforeCompact].stickerId, 'compact-1');
  assert.equal(received[beforeCompact].stickerImageUrl, 'https://example.com/one.png');
  assert.equal(received[beforeCompact].stickerName, 'One');
  send('chat', { msgId: 'http-sticker', emotes: [{ id: 'http-id', url: 'http://example.com/http.png' }] });
  assert.equal(received.at(-2).stickerImageUrl, 'https://example.com/http.png', 'HTTP sticker URLs are upgraded for display');
  send('chat', { msgId: 'array-sticker', emotes: [{ id: 'array-id', url: { urlList: ['//example.com/array.png'] } }] });
  assert.equal(received.at(-2).stickerImageUrl, 'https://example.com/array.png', 'Nested sticker image URLs are recognized');
  send('chat', { id: 'plain-message-id', comment: 'Hello' });
  assert.equal(received.at(-1).type, 'Chat', 'A chat message ID must not become a sticker');
  assert.equal(received.length, beforeCompact + 8);
  const beforeList = received.length;
  send('emoteChat', { msgId: 'list', emotes: [{ emoteId: 'a', emoteImageUrl: 'https://example.com/a.png' }, { emoteId: 'b' }] });
  assert.deepEqual(received.slice(beforeList).map(e => e.stickerId), ['a', 'b']);
  assert.equal(received[beforeList].stickerImageUrl, 'https://example.com/a.png');
  const beforeInline = received.length;
  send('chat', { msgId: 'inline', comment: 'hello', emotes: [{ emote: { emoteId: 'inline-a', image: { imageUrl: 'https://example.com/inline.png' } } }] });
  assert.deepEqual(received.slice(beforeInline).map(e => e.type), ['Sticker', 'Chat']);
  assert.equal(received[beforeInline].stickerImageUrl, 'https://example.com/inline.png');
  send('emoteChat', { msgId: 'raw-list', emoteList: [{ emoteId: 'raw', image: { urlList: ['https://example.com/raw.png'] } }] });
  assert.equal(received.at(-1).stickerId, 'raw');
  assert.equal(received.at(-1).stickerImageUrl, 'https://example.com/raw.png');
  const beforeRepeat = received.length;
  send('emoteChat', { emotes: [{ emoteId: 'repeat' }] });
  send('emoteChat', { emotes: [{ emoteId: 'repeat' }] });
  assert.equal(received.length, beforeRepeat + 2, 'No-ID sticker sends are not silently rate limited');
  for (const [index, image] of ['https://example.com/actual.png', { url: 'https://example.com/actual.png' }, { url_list: ['', 'https://example.com/actual.png'] }].entries()) {
    send('emoteChat', { msgId: `image-shape-${index}`, emoteId: 'actual', emoteUrl: {}, image });
    assert.equal(received.at(-1).stickerImageUrl, 'https://example.com/actual.png', 'Sticker artwork survives alternate image formats and empty earlier fields');
  }
  send('emoteChat', { msgId: 'empty', emotes: [null, {}] });
  assert.match(received.at(-1).detail, /without a readable sticker ID/);
  send('chat', { msgId: 'plain', comment: 'plain text' });
  assert.equal(received.at(-1).type, 'Chat');

  const diagnosticLines = [];
  const diagnosticProvider = new TikToolProvider('private-test-key', message => diagnosticLines.push(message));
  diagnosticProvider.handle({ event: 'roomInfo', roomId: 'room' });
  assert.equal(diagnosticProvider.status(), 'connected');
  assert.equal(diagnosticProvider.diagnostics().roomConfirmed, true);
  diagnosticProvider.handle({ event: 'like', data: { likeCount: 1 } });
  assert.equal(diagnosticProvider.diagnostics().receivedCount, 2, 'Ignored reaction types still count as incoming traffic');
  assert.equal(diagnosticProvider.diagnostics().eventCounts.like, 1);
  diagnosticProvider.handle({ event: 'error', data: { message: 'Invalid private-test-key' } });
  assert.equal(diagnosticProvider.status(), 'error', 'Upstream error events must not be ignored');
  assert.ok(!diagnosticLines.join(' ').includes('private-test-key'), 'Credentials are redacted');
  diagnosticProvider.handle({ event: 'chat', data: { comment: 'PRIVATE CHAT CONTENT' } });
  assert.ok(!diagnosticLines.join(' ').includes('PRIVATE CHAT CONTENT'), 'Chat contents are not logged');

  diagnosticProvider.handle({ event: 'chat', data: { comment: 'PRIVATE CHAT CONTENT', emotes: [{ unknownStickerField: 'PRIVATE STICKER VALUE' }] } });
  assert.ok(diagnosticLines.some(line => line.includes('unknownStickerField')), 'Unknown inline sticker format exposes field names for diagnosis');
  assert.ok(!diagnosticLines.join(' ').includes('PRIVATE STICKER VALUE'));
  assert.ok(!diagnosticLines.join(' ').includes('PRIVATE CHAT CONTENT'));
  const { EventEmitter } = require('node:events');
  const sockets = [], timers = [];
  class FakeSocket extends EventEmitter {
    static CLOSING = 2;
    readyState = 1;
    constructor() { super(); sockets.push(this); }
    close() { this.readyState = 3; this.emit('close', 1000, Buffer.from('')); }
  }
  const { TikToolProvider: TestProvider } = loadTs('electron/providers/TikToolProvider.ts', { ws: { default: FakeSocket } }, {
    URL, setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout: () => {}
  });
  const handshake = new TestProvider('key');
  const connection = handshake.connect('viewer');
  await Promise.resolve(); sockets.at(-1).emit('open'); await connection;
  assert.equal(handshake.status(), 'connecting', 'An open socket alone must not claim the LIVE is connected');
  sockets.at(-1).emit('message', Buffer.from(JSON.stringify({ event: 'roomInfo', roomId: 'room' })));
  assert.equal(handshake.status(), 'connected');
  await handshake.disconnect();
  assert.equal(handshake.status(), 'disconnected');
  const waiting = handshake.connect('viewer');
  await Promise.resolve(); sockets.at(-1).emit('open'); await waiting;
  timers.at(-1)();
  assert.equal(handshake.status(), 'error', 'Missing room confirmation produces a visible timeout');
  await handshake.disconnect();

  const { defaults } = loadTs('src/types.ts', {});
  const gifts = loadTs('src/giftCatalog.ts', {});
  let giftSettings = gifts.rememberGift(defaults, { type: 'Gift', giftName: ' Rose ', giftImageUrl: 'https://example.com/rose.png' });
  giftSettings = gifts.rememberGift(JSON.parse(JSON.stringify(giftSettings)), { type: 'Gift', giftName: 'ROSE' });
  assert.equal(giftSettings.giftCatalog.length, 1, 'Repeated gifts merge regardless of spacing or case');
  assert.equal(gifts.giftOptions(giftSettings).find(g => g.name === 'Rose').imageUrl, 'https://example.com/rose.png', 'Gift images survive reload and events without pictures');
  assert.equal(gifts.rememberGift(giftSettings, { type: 'Gift', giftName: ' ' }), giftSettings);
  const legacyGifts = gifts.giftOptions({ ...defaults, reactions: [{ giftName: 'Galaxy' }, { giftName: ' rose ' }] });
  assert.equal(legacyGifts.length, 2, 'Existing reactions are selectable without duplicating starter gifts');
  const catalog = loadTs('src/stickerCatalog.ts', {});
  let saved = catalog.rememberSticker(defaults, { stickerId: 'new', stickerImageUrl: 'https://example.com/sticker.png' });
  saved.stickerCatalog[0].name = 'Happy dance';
  saved = catalog.rememberSticker(JSON.parse(JSON.stringify(saved)), { stickerId: 'new' });
  assert.equal(saved.stickerCatalog.length, 1);
  assert.equal(saved.stickerCatalog[0].name, 'Happy dance');
  assert.equal(saved.stickerCatalog[0].imageUrl, 'https://example.com/sticker.png');
  let renamedBySource = catalog.rememberSticker(defaults, { stickerId: 'named', stickerName: 'Rainbow' });
  assert.equal(renamedBySource.stickerCatalog[0].name, 'Rainbow');
  renamedBySource.stickerCatalog[0].name = 'My label';
  renamedBySource = catalog.rememberSticker(renamedBySource, { stickerId: 'named', stickerName: 'Rainbow' });
  assert.equal(renamedBySource.stickerCatalog[0].name, 'My label');
  assert.equal(catalog.stickerOptions({ ...defaults, stickerReactions: [{ stickerId: 'legacy' }] })[0].id, 'legacy');
  const settings = { ...defaults, ttsEnabled: false, superFans: [{ id: 'fan', username: 'GoldFan', enabled: true, message: 'Welcome {username}!', imagePath: '', soundPath: 'C:\\sounds\\welcome.wav', durationMs: 6000 }],
    stickerReactions: [{ id: 's', stickerId: '123', soundPath: 'C:\\sounds\\hello.wav', enabled: true }] };
  let handleEvent;
  const overlays = [], sounds = [], soundVolumes = [], effects = [];
  const react = {
    createElement: () => null,
    useState: initial => [initial === defaults ? settings : initial, () => {}],
    useRef: current => ({ current }), useMemo: fn => fn(), useEffect: fn => effects.push(fn)
  };
  const core = { onStatus: () => () => {}, onEvent: fn => { handleEvent = fn; return () => {}; },
    overlayShow: async args => { overlays.push(args); return { ok: true }; } };
  const TestAudio = class { constructor(url) { this.url = url; } async play() { sounds.push(this.url); soundVolumes.push(this.volume); } pause() {} };
  const { default: App } = loadTs('src/App.tsx', { react, './GoldenMoments': { default: () => null }, './soundPlayback': loadTs('src/soundPlayback.ts', {}, { setTimeout: () => 1, clearTimeout: () => {}, Audio: TestAudio }), './Updates': { default: () => null }, './giftActions': loadTs('src/giftActions.ts', {}), './types': { defaults }, './giftCatalog': gifts, './GiftPicker': { default: () => null }, './stickerCatalog': catalog, './StickerSounds': { default: () => null } }, {
    URL, React: react, window: { streamPulseCore: core }, crypto: require('node:crypto').webcrypto,
    Audio: TestAudio
  });
  App();
  effects.find(fn => fn.toString().includes('onStatus'))();
  const event = { id: 'one', user: '@GOLDFAN', time: '', detail: '' };
  await handleEvent({ ...event, type: 'Join' });
  await handleEvent({ ...event, id: 'two', type: 'Join' });
  await handleEvent({ ...event, type: 'SuperFanJoin' });
  await handleEvent({ ...event, id: 'four', type: 'SuperFanJoin' });
  assert.ok(overlays.every(a => a.channel === 'superfan'), 'Every Super Fan entrance targets the dedicated source');
  assert.equal(overlays.length, 4, 'Every entry announces, without double announcements for explicit SuperFanJoin');
  assert.equal(sounds.length, 4, 'Every Super Fan entrance starts its sound again');
  const entranceProvider = new TikToolProvider('test');
  const entrances = [];
  entranceProvider.onEvent(value => entrances.push(value));
  for (const msgId of ['raw-1', 'raw-2']) entranceProvider.handle({ event: 'barrage', data: {
    msgId, user: { uniqueId: 'GoldFan' }, displayType: 'ttlive_superFan_commentNotif_superFanJoined'
  } });
  for (const entrance of entrances) await handleEvent(entrance);
  assert.equal(overlays.length, 6, 'Each raw entrance reaches the configured overlay');
  assert.equal(sounds.length, 6, 'Each raw entrance reaches the configured sound');
  overlays.length = 4;
  sounds.length = 0;
  settings.superFanEnabled = false;
  await handleEvent({ ...event, type: 'Join' });
  assert.equal(overlays.length, 4, 'Disabled Super Fan overlays stay disabled');
  await handleEvent({ ...event, type: 'Gift', giftName: 'Rose', giftImageUrl: 'https://example.com/rose.png', comboComplete: false });
  assert.equal(overlays.length, 4);
  await handleEvent({ ...event, type: 'Gift', giftName: 'Rose', giftImageUrl: 'https://example.com/rose.png', comboComplete: true });
  assert.equal(overlays.at(-1).imageUrl, 'https://example.com/rose.png');
  await handleEvent({ ...event, type: 'Sticker', stickerId: '123' });
  await handleEvent({ ...event, type: 'Sticker', stickerId: '123' });
  await handleEvent({ ...event, type: 'Sticker', stickerId: 'unknown' });
  assert.equal(sounds.length, 2, 'Each matching sticker plays; unmatched stickers are silent');
  const compactProvider = new TikToolProvider('test');
  const compactEvents = [];
  compactProvider.onEvent(e => compactEvents.push(e));
  compactProvider.handle({ event: 'chat', data: { msgId: 'real-format', user: { uniqueId: 'viewer' }, comment: '', emotes: [{ id: '123', url: 'https://example.com/sticker.png', name: 'Sticker' }] } });
  const compactSticker = compactEvents.find(e => e.type === 'Sticker');
  const remembered = catalog.rememberSticker(defaults, compactSticker);
  assert.equal(remembered.stickerCatalog[0].id, '123');
  assert.equal(remembered.stickerCatalog[0].imageUrl, 'https://example.com/sticker.png');
  await handleEvent(compactSticker);
  assert.equal(sounds.length, 3, 'Observed compact chat sticker format reaches the assigned sound');
  sounds.pop();
  settings.stickerSoundsEnabled = false;
  await handleEvent({ ...event, type: 'Sticker', stickerId: '123' });
  assert.equal(sounds.length, 2, 'Global sticker mute is respected');
  settings.stickerSoundsEnabled = true;
  settings.stickerReactions[0].enabled = false;
  await handleEvent({ ...event, type: 'Sticker', stickerId: '123' });
  assert.equal(sounds.length, 2, 'Disabled sticker sounds stay silent');
  settings.reactions = [{ id: 'heart', giftName: 'Heart Me', message: 'Thanks {username}!', speak: false, overlay: true, soundPath: 'C:/sounds/heart.wav', volume: 0.35 }];
  const heart = { ...event, type: 'Gift', giftName: 'Heart Me', comboComplete: true };
  const beforeGifts = overlays.length;
  const beforeGiftSounds = sounds.length;
  await handleEvent(heart);
  assert.equal(overlays.length, beforeGifts + 1, 'Legacy reactions without enabled still work');
  assert.equal(sounds.length, beforeGiftSounds + 1);
  assert.equal(soundVolumes.at(-1), 0.35, 'Gift volume reaches audio playback');
  settings.reactions[0].enabled = false;
  await handleEvent(heart);
  assert.equal(overlays.length, beforeGifts + 1, 'Disabled gift does not fall back to the default overlay');
  assert.equal(sounds.length, beforeGiftSounds + 1);
  settings.giftReactionsEnabled = false;
  await handleEvent({ ...heart, giftName: 'Unconfigured gift' });
  assert.equal(overlays.length, beforeGifts + 1, 'Master switch also disables default reactions');
  settings.giftReactionsEnabled = true;
  await handleEvent({ ...heart, giftName: 'Unconfigured gift' });
  assert.equal(overlays.length, beforeGifts + 2, 'Unconfigured gift fallback is preserved');
  settings.giftReactionsEnabled = false;
  settings.giftActions = [{ id: 'action', enabled: true, giftName: 'Rose', minimumCount: 2, kind: 'overlay', message: '{username}: {gift} x{count}', imagePath: 'C:/images/rose.gif', durationMs: 3000 }];
  const beforeActions = overlays.length;
  await handleEvent({ ...event, type: 'Gift', giftName: 'Rose', count: 2, comboComplete: false });
  await handleEvent({ ...event, type: 'Gift', giftName: 'Rose', count: 1, comboComplete: true });
  assert.equal(overlays.length, beforeActions, 'Rules wait for completed combos and the minimum quantity');
  await handleEvent({ ...event, type: 'Gift', giftName: 'Rose', count: 2, comboComplete: true });
  assert.equal(overlays.length, beforeActions + 1, 'Actions run independently of Gift Reactions');
  assert.equal(overlays.at(-1).body, '@GOLDFAN: Rose x2');
  assert.equal(overlays.at(-1).imagePath, 'C:/images/rose.gif');
  settings.giftActions[0].enabled = false;
  await handleEvent({ ...event, type: 'Gift', giftName: 'Rose', count: 2, comboComplete: true });
  assert.equal(overlays.length, beforeActions + 1, 'Disabled action does not execute');
  console.log('Passed: repeated joins, duplicate deliveries, gift combo completion and images, sticker parsing, matching, repeats, and disabled settings.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
