// Production main process, packaged assets, isolated Windows settings and no LIVE/tunnel connection.
const electron=require('electron'),{app}=electron;
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const packageRoot=process.env.STREAMPULSE_TEST_PACKAGE;
if(!packageRoot)throw Error('Set STREAMPULSE_TEST_PACKAGE to the beta app.asar.');
let root,window;
app.whenReady().then(async()=>{
 try {
 root=await fs.mkdtemp(path.join(app.getPath('temp'),'streampulse-beta-main-'));
 const manifest=require(path.join(packageRoot,'package.json'));assert.equal(manifest.version,'0.1.0-beta.1');
 const personal=path.join(root,'streampulse-core');await fs.mkdir(personal);await fs.writeFile(path.join(personal,'settings.json'),JSON.stringify({username:'DoNotLoad',permanentOverlayHostname:'personal.example'}));
 const handlers={};let updateRequests=0;
 const updater=require('electron-updater').autoUpdater;updater.checkForUpdates=async()=>{updateRequests++;throw Error('Beta should never check alpha updates');};
 const original=Module._load;
 const proxyApp=new Proxy(app,{get(target,key){if(key==='isPackaged')return true;if(key==='getVersion')return()=>manifest.version;if(key==='getPath')return name=>name==='appData'?root:target.getPath(name);const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
 const proxyIPC=new Proxy(electron.ipcMain,{get(target,key){if(key==='handle')return(name,fn)=>{handlers[name]=fn;target.handle(name,fn);};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
 class HiddenWindow extends electron.BrowserWindow{constructor(options){super({...options,show:false});window=this;}}
 Module._load=function(name,...rest){if(name==='electron')return{...electron,app:proxyApp,ipcMain:proxyIPC,BrowserWindow:HiddenWindow};if(name==='electron-updater')return{autoUpdater:updater};return original.call(this,name,...rest);};
 const tunnel=require(path.join(packageRoot,'dist-electron/secureTunnel.js'));
 let config; tunnel.startSecureTunnel=async value=>{config=value;return{connected:false}};tunnel.stopSecureTunnel=async()=>{};
 const overlay=require(path.join(packageRoot,'dist-electron/overlayServer.js'));overlay.startOverlayServer=async()=>{};overlay.stopOverlayServer=async()=>{};
 const savedResources=Object.getOwnPropertyDescriptor(process,'resourcesPath');Object.defineProperty(process,'resourcesPath',{value:path.dirname(packageRoot),configurable:true});
 require(path.join(packageRoot,'dist-electron/main.js'));Module._load=original;
 for(let i=0;i<600;i++){if(window&&!window.webContents.isLoading()&&await window.webContents.executeJavaScript("document.body.textContent.includes('Set up your StreamPulse')"))break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(window);assert.equal(app.getPath('userData'),path.join(root,'StreamPulse Beta'));
 const run=code=>window.webContents.executeJavaScript(code);
 assert.ok(await run("document.body.textContent.includes('Set up your StreamPulse')"));
 assert.equal(await run("document.querySelector('main select').value"),'direct');
 assert.equal((await run('window.streamPulseCore.info()')).version,'0.1.0-beta.1');
 assert.equal((await run('window.streamPulseCore.load()')).username,undefined,'Alpha settings must not migrate silently');
 assert.equal((await run('window.streamPulseCore.credentialStatus()')).hasTunnelCredential,false);assert.equal(config.token,'');assert.equal(config.hostname,'');
 assert.equal((await run('window.streamPulseCore.updateCheck()')).phase,'manual');assert.equal(updateRequests,0);
 const status=await run('window.streamPulseCore.video.speechStatus()');assert.equal(status.ready,true,JSON.stringify(status));assert.equal(status.bundled,true);
 const vid=await run('window.streamPulseCore.video.status()');assert.equal(vid.ready,true);assert.equal(path.resolve(vid.folder),path.resolve(path.join(path.dirname(packageRoot),'video-tools')));
 assert.equal(JSON.parse(await fs.readFile(path.join(personal,'settings.json'),'utf8')).username,'DoNotLoad');
 Object.defineProperty(process,'resourcesPath',savedResources);
 console.log('Beta packaged main passed: beta version, separate fresh settings, no alpha domain/credentials, Direct first-run choice, manual updates, packaged tools and offline captions.');
 }catch(e){console.error(e);process.exitCode=1;}
 finally{window?.destroy();if(root)await fs.rm(root,{recursive:true,force:true});app.exit(process.exitCode||0);}
});
