const {spawnSync}=require('node:child_process');
const tests=['single-instance','settings-store','connection-health','updater','gift-actions','webhook','tts-filters','reactions','overlay-library','gift-completion','gift-catalog','likes','entrances','direct-tiktok','tikfinity','reconnect'];
for(const test of tests){const result=spawnSync(process.execPath,['tests/'+test+'.cjs'],{stdio:'inherit',windowsHide:true});if(result.status!==0)process.exit(result.status||1);}
console.log('Release regression checks passed.');
