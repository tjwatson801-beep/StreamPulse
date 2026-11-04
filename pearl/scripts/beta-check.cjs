const {spawnSync}=require('node:child_process');
const path=require('node:path');
const result=spawnSync(require('electron'),[path.join(__dirname,'..','tests','beta-tools-smoke.cjs')],{encoding:'utf8',windowsHide:true,timeout:180000,env:process.env});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
if(result.error||result.status!==0||!(result.stdout||'').includes('Beta bundled smoke passed:')){console.error(result.error||'Bundled beta test did not report completion.');process.exit(1);}