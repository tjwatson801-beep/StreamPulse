const {contextBridge,ipcRenderer}=require('electron');
const path=require('node:path');
const folder=process.env.STREAMPULSE_TEST_SOUNDS_FOLDER;
const sound=path.join(folder,'chiptune.wav');
let state={soundClips:[],reactions:[{id:'rose',giftName:'Rose',enabled:true,message:'Thanks!',speak:false,overlay:true,soundPath:''}],stickerReactions:[{id:'sticker',stickerId:'123',soundPath:'',enabled:true}],stickerCatalog:[{id:'123',name:'Happy'}],superFans:[{id:'fan',username:'GoldFan',message:'Welcome!',imagePath:'',soundPath:'',enabled:true,durationMs:6000}]};
let flush;
contextBridge.exposeInMainWorld('streamPulseCore',{
 load:async()=>{state=await ipcRenderer.invoke('test:load-sounds',state);return state;},save:async value=>{state=value;await ipcRenderer.invoke('test:save-sounds',value);return{ok:true};},testState:()=>state,testFlush:()=>flush(),
 onFlushSettings:handler=>{flush=handler;return()=>{};},credentialStatus:async()=>({}),info:async()=>({}),onStatus:()=>()=>{},onEvent:()=>()=>{},
 updateStatus:async()=>({phase:'current',current:'test',version:'',notes:'',percent:0,error:''}),
 soundLibrary:async()=>({folder,files:[{path:sound,filename:'chiptune.wav'},{path:path.join(folder,'welcome.wav'),filename:'welcome.wav'}]}),
 pickSoundFolder:async()=>null,setSoundHotkeys:async clips=>({errors:clips.some(c=>c.hotkey==='invalid')?['Invalid hotkey.']:[],registered:clips.filter(c=>c.hotkey).length}),
 onSoundHotkey:handler=>{const fn=(_,p)=>handler(p);ipcRenderer.on('test:sound-hotkey',fn);return()=>ipcRenderer.removeListener('test:sound-hotkey',fn);}
});
