const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
app.disableHardwareAcceleration(); let win;
app.whenReady().then(async()=>{try{
const svg=fs.readFileSync(path.join(__dirname,'../assets/pearl-icon.svg'),'utf8');
win=new BrowserWindow({show:false,width:512,height:512,useContentSize:true,transparent:true,backgroundColor:'#00000000',webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}});
await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<html><body style="margin:0;background:transparent;overflow:hidden">'+svg+'</body></html>'));
await new Promise(r=>setTimeout(r,250));
win.webContents.invalidate(); await new Promise(r=>setTimeout(r,300)); const source=await win.webContents.capturePage();assert.equal(source.getSize().width,512);
const root=path.join(__dirname,'../assets');fs.writeFileSync(path.join(root,'pearl-icon.png'),source.toPNG());
const sizes=[16,24,32,48,64,128,256],pngs=sizes.map(size=>source.resize({width:size,height:size,quality:'best'}).toPNG());
const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
sizes.forEach((size,i)=>{const pos=6+i*16;header[pos]=size===256?0:size;header[pos+1]=size===256?0:size;header.writeUInt16LE(1,pos+4);header.writeUInt16LE(32,pos+6);header.writeUInt32LE(pngs[i].length,pos+8);header.writeUInt32LE(offset,pos+12);offset+=pngs[i].length;fs.writeFileSync(path.join(root,'pearl-icon-'+size+'.png'),pngs[i]);});
fs.writeFileSync(path.join(root,'pearl-icon.ico'),Buffer.concat([header,...pngs]));console.log('Pearl PNG and seven-size Windows ICO generated.');
}catch(e){console.error(e);process.exitCode=1;}finally{win?.destroy();app.exit(process.exitCode||0)}});
