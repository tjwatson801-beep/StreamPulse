const {spawnSync}=require('node:child_process');
const tests=['moment-search','video-editing','video-tools','video-engine','soundboard','single-instance','settings-store','settings-flush','secure-tunnel','connection-health','updater','gift-actions','webhook','tts-filters','reactions','overlay-library','gift-completion','gift-catalog','likes','entrances','direct-tiktok','tikfinity','reconnect'];
for(const test of tests){const result=spawnSync(process.execPath,['tests/'+test+'.cjs'],{stdio:'inherit',windowsHide:true});if(result.status!==0)process.exit(result.status||1);}
for(const test of ['soundboard-ui','split-overlays-smoke','alerts-overlay-smoke','reliability-ui']){const result=spawnSync(require('electron'),['tests/'+test+'.cjs'],{stdio:'inherit',windowsHide:true,timeout:90000});if(result.status!==0)process.exit(result.status||1);}
console.log('Release regression checks passed.');
