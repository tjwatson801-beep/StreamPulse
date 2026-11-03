const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { CreditsHistory, CreditsTracker, validateCredits } = require('../dist-electron/credits');
const { creditsOutro } = require('../dist-electron/creditsOutro');
const { creditsSourcePath, setCreditsPlayback, startOverlayServer, stopOverlayServer } = require('../dist-electron/overlayServer');

async function test() {
  const tracker = new CreditsTracker();
  const roster = new Set(['rosterfan']);
  const emit = (type, user, id, data = {}) => tracker.add({ type, user, id, ...data }, roster);
  emit('Follow', 'early', 'before-start');
  assert.equal(tracker.snapshot(), null);
  const first = tracker.start('@xGOLDx');
  assert.throws(() => tracker.start(), /Finish/);
  tracker.confirmRoom('xgoldx', 'room-one');
  emit('Join', '@RosterFan', 'join', { displayName: 'Roster Fan' });
  emit('SuperFanJoin', 'Entrance', 'superfan');
  emit('Gift', 'One', 'gift', { count: 2, comboComplete: false });
  emit('Gift', 'One', 'gift', { count: 3, comboComplete: true });
  emit('Gift', 'One', 'gift', { count: 3, comboComplete: true });
  emit('Gift', 'Two', 'other-gift', { count: 4, comboComplete: true });
  emit('Chat', 'One', 'chat');
  emit('Chat', 'One', 'chat');
  emit('Chat', 'Two', 'chat-two');
  emit('Like', '@TWO', 'like');
  emit('Follow', 'Two', 'follow');
  emit('Follow', 'TWO', 'another-follow');
  tracker.confirmRoom('xgoldx', '');
  tracker.confirmRoom('xgoldx', 'room-one');
  assert.equal(tracker.active, true);
  tracker.confirmRoom('xgoldx', 'room-two');
  assert.equal(tracker.active, false);
  emit('Follow', 'late', 'after-room-change');
  const roll = tracker.stop();
  assert.equal(roll.id, first.id);
  assert.deepEqual(roll.groups['Super Fans'].map(row => row.name), ['Roster Fan', 'entrance']);
  assert.deepEqual(roll.groups['Top Supporters'].map(row => row.user), ['two', 'one']);
  assert.deepEqual(roll.groups['Active Fans'].map(row => row.user), ['two', 'one']);
  assert.deepEqual(roll.groups['New Followers'].map(row => row.user), ['two']);

  roll.groups['Super Fans'] = [
    { user: 'test', name: '<img src=x onerror=alert(1)>' },
    { user: 'rosterfan', name: 'Roster Fan', excluded: true },
    { user: 'another', name: 'Another Viewer' },
  ];
  const validated = validateCredits(roll);
  const html = creditsOutro(validated);
  assert.match(html, /STAY GOLDEN/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img|Roster Fan/);
  assert.ok(html.indexOf('&lt;img') < html.indexOf('Another Viewer'));
  assert.throws(() => validateCredits({ ...roll, id: '../outside' }), /Invalid/);

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pearl-credits-'));
  try {
    await new CreditsHistory(directory).save(validated);
    tracker.finish(first.id);
    const second = tracker.start();
    await new CreditsHistory(directory).save(second);
    assert.equal(tracker.snapshot().groups['Super Fans'].length, 0);
    const history = await new CreditsHistory(directory).list();
    assert.equal(history.length, 2);
    assert.deepEqual(history.find(session => session.id === first.id), validated);

    const base = 'http://127.0.0.1:' + await startOverlayServer(0);
    const url = base + creditsSourcePath();
    assert.match(await (await fetch(url)).text(), /xGOLDx Outro Source/);
    assert.equal((await (await fetch(url + '/playback')).json()).html, '');
    setCreditsPlayback(html);
    const playing = await (await fetch(url + '/playback')).json();
    assert.equal(playing.html, html);
    assert.notEqual((await fetch(base + '/overlay/credits/guess/playback')).status, 200);
    setCreditsPlayback('');
    const cleared = await (await fetch(url + '/playback')).json();
    assert.equal(cleared.html, '');
    assert.notEqual(cleared.id, playing.id);
  } finally {
    await stopOverlayServer();
    await fs.rm(directory, { recursive: true, force: true });
  }
  console.log('Passed: credits tracking, room changes, completed gifts, exclusions, history, and playback routes.');
}
test().catch(error => { console.error(error); process.exitCode = 1; });
