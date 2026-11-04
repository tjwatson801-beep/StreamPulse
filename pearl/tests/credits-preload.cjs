const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('streamPulseCore',{
 load:async()=>({username:'xGOLDx',setupComplete:true}),save:async()=>({ok:true}),credentialStatus:async()=>({}),info:async()=>({}),onStatus:()=>()=>{},onEvent:()=>()=>{},updateStatus:async()=>({phase:'current',current:'test',version:'',notes:'',percent:0,error:''}),
 credits:{load:()=>ipcRenderer.invoke('credits:load'),edit:args=>ipcRenderer.invoke('credits:edit',args),start:()=>ipcRenderer.invoke('credits:start'),end:()=>ipcRenderer.invoke('credits:end'),export:html=>ipcRenderer.invoke('credits:export',html),onChange:()=>()=>{}}
});
