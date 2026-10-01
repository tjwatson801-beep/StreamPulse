const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
async function run() {
 const handlers = {}, updater = new EventEmitter(); let live = false, installs = 0, prepared = 0, checks = 0, confirm = 1;
 updater.checkForUpdates = async () => { checks++; updater.emit('update-available', {version:'0.1.0-alpha.41',releaseNotes:'New version'}); };
 updater.downloadUpdate = async () => { updater.emit('download-progress',{percent:42}); updater.emit('update-downloaded',{version:'0.1.0-alpha.41'}); };
 updater.quitAndInstall = () => installs++;
 const out = {};
 vm.runInNewContext(fs.readFileSync('dist-electron/updater.js','utf8'), { exports:out, setTimeout:()=>({unref(){}}), require:name=> name==='electron-updater'?{autoUpdater:updater}:{app:{isPackaged:true,getVersion:()=> '0.1.0-alpha.40'},ipcMain:{handle:(name,fn)=>handlers[name]=fn},dialog:{showMessageBox:async()=>({response:confirm})}} });
 out.setupUpdater(()=>live,async()=>{prepared++;});
 const call = name=>handlers['core:update-'+name]();
 assert.equal(updater.autoDownload,false); assert.equal(updater.autoInstallOnAppQuit,false); assert.equal(updater.allowDowngrade,false);
 await call('install');assert.equal(installs,0);
 await call('check');assert.equal(call('status').phase,'available');
 await call('download');assert.equal(call('status').phase,'ready');assert.equal(installs,0);
 await call('check');assert.equal(checks,1,'Checking cannot discard a staged update');
 live=true;await call('install');assert.equal(installs,0);assert.equal(prepared,0);
 live=false;confirm=0;await call('install');assert.equal(installs,0);
 confirm=1;await call('install');assert.equal(installs,1);assert.equal(prepared,1);
 console.log('Updater passed: opt-in downloads and installation, no downgrade, ready-state preservation, LIVE guard, cancellation, and explicit restart.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
