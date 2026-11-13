const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
async function run() {
 const handlers = {}, updater = new EventEmitter(); let live = false, videoBusy = false, installs = 0, prepared = 0, checks = 0, confirm = 1;
 updater.checkForUpdates = async () => { checks++; updater.emit('update-available', {version:'0.1.0-alpha.41',releaseNotes:'New version'}); };
 updater.downloadUpdate = async () => { updater.emit('download-progress',{percent:42}); updater.emit('update-downloaded',{version:'0.1.0-alpha.41'}); };
 updater.quitAndInstall = () => installs++;
 const out = {};
 vm.runInNewContext(fs.readFileSync('dist-electron/updater.js','utf8'), { exports:out, setTimeout:()=>({unref(){}}), require:name=> name==='electron-updater'?{autoUpdater:updater}:{app:{isPackaged:true,getVersion:()=> '0.1.0-alpha.40'},ipcMain:{handle:(name,fn)=>handlers[name]=fn},dialog:{showMessageBox:async()=>({response:confirm})}} });
 out.setupUpdater(()=>live,async()=>{prepared++;},()=>videoBusy);
 const call = name=>handlers['core:update-'+name]();
 assert.equal(updater.autoDownload,false); assert.equal(updater.autoInstallOnAppQuit,false); assert.equal(updater.allowDowngrade,false);
 await call('install');assert.equal(installs,0);
 await call('check');assert.equal(call('status').phase,'available');
 await call('download');assert.equal(call('status').phase,'ready');assert.equal(installs,0);
 await call('check');assert.equal(checks,1,'Checking cannot discard a staged update');
 live=true;await call('install');assert.equal(installs,0);assert.equal(prepared,0);
 live=false;videoBusy=true;await call('install');assert.equal(installs,0);assert.match(call('status').error,/Golden Moments/);
 videoBusy=false;confirm=0;await call('install');assert.equal(installs,0);
 confirm=1;await call('install');assert.equal(installs,1);assert.equal(prepared,1);
 console.log('Updater passed: opt-in downloads and installation, no downgrade, ready-state preservation, LIVE guard, cancellation, and explicit restart.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});

async function verifyPearlChannel() {
 const events = require('node:events');
 for (const version of ['0.1.0-pearl.4','0.1.0-beta.1']) {
  const handlers={}, updater=new events.EventEmitter(); let checks=0;
  Object.defineProperty(updater,'channel',{get(){return this._channel},set(value){this._channel=value;this.allowDowngrade=true}});
  updater.checkForUpdates=async()=>{checks++;updater.emit('update-not-available')};
  const out={};
  vm.runInNewContext(fs.readFileSync('dist-electron/updater.js','utf8'),{exports:out,setTimeout:()=>({unref(){}}),require:name=>name==='electron-updater'?{autoUpdater:updater}:{app:{isPackaged:true,getVersion:()=>version},ipcMain:{handle:(name,fn)=>handlers[name]=fn},dialog:{}}});
  out.setupUpdater(()=>false,async()=>{});
  assert.equal(updater.allowDowngrade,false,'Setting the Pearl channel must not permit downgrades');
  if(version.includes('-pearl.')) {assert.equal(updater.channel,'pearl');assert.equal(handlers['core:update-status']().phase,'idle');await handlers['core:update-check']();assert.equal(checks,1);assert.equal(handlers['core:update-status']().phase,'current');}
  else {await handlers['core:update-check']();assert.equal(checks,0);assert.equal(handlers['core:update-status']().phase,'manual');}
 }
 console.log('Pearl updater channel passed: enabled checks, no downgrades, beta isolation.');
}
verifyPearlChannel().catch(error=>{console.error(error);process.exitCode=1});

async function verifyWaitingForLiveUpdates() {
  const source = fs.readFileSync('electron/main.ts', 'utf8');
  const registration = source.split(/\r?\n/).find(line => line.trim().startsWith('setupUpdater('));
  assert.ok(registration, 'Production updater registration exists');
  const order = [];
  let status = 'connecting';
  let online;
  let prepare;
  const context = {
    reconnectEnabled: true,
    provider: { status: () => status },
    setupUpdater: (guard, setup) => { online = guard; prepare = setup; },
    disconnect: async () => { order.push('disconnect'); },
    flushSettings: async () => { order.push('save'); },
    settingsStore: { backup: async () => { order.push('backup'); } },
    stopSecureTunnel: async () => { order.push('tunnel'); },
    stopOverlayServer: async () => { order.push('overlay'); },
    videoEngine: undefined,
    closing: false,
  };
  vm.runInNewContext(registration, context);
  for (const next of ['disconnected', 'connecting', 'reconnecting', 'error']) {
    status = next;
    assert.equal(online(), false, next + ' must allow installation while automatic connection is enabled');
  }
  status = 'connected';
  assert.equal(online(), true, 'An actual LIVE connection must block installation');
  context.provider = null;
  assert.equal(online(), false);
  await prepare();
  assert.deepEqual(order, ['disconnect', 'save', 'backup', 'tunnel', 'overlay']);
  assert.equal(context.closing, true);
  console.log('Updater connection guard passed: waiting and retrying allow updates, active LIVE blocks updates, pending connections stop before saving.');
}
verifyWaitingForLiveUpdates().catch(error => { console.error(error); process.exitCode = 1; });

async function verifyManualDisconnectStatus() {
  const source = fs.readFileSync('electron/main.ts', 'utf8');
  const disconnectSource = source.split(/\r?\n/).find(line => line.startsWith('async function disconnect('));
  const messages = [];
  const context = {
    connectRevision: 0, reconnectEnabled: true, activeUsername: 'host',
    clearReconnect() {},
    provider: { disconnect: async () => {} },
    send: (_channel, state) => messages.push(state),
  };
  vm.runInNewContext(disconnectSource, context);
  await context.disconnect();
  assert.equal(context.reconnectEnabled, false);
  assert.equal(context.activeUsername, '');
  assert.equal(messages.at(-1).status, 'disconnected');
  const count = messages.length;
  await context.disconnect(false);
  assert.equal(messages.length, count, 'Internal reconnect preparation must not report a manual disconnect');
  let finish;
  context.provider = { disconnect: () => new Promise(resolve => { finish = resolve; }) };
  const pending = context.disconnect();
  context.connectRevision++;
  finish();
  await pending;
  assert.equal(messages.length, count, 'A stale disconnect must not overwrite a newer connection status');
  console.log('Manual disconnect passed: offline status is reported, internal reconnect and stale disconnects preserve newer status.');
}
verifyManualDisconnectStatus().catch(error => { console.error(error); process.exitCode = 1; });
