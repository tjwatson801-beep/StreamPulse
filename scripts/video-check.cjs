const {spawnSync}=require('node:child_process');
const path=require('node:path');
const result=spawnSync(require('electron'),[path.join(__dirname,'..','tests','video-real-smoke.cjs')],{encoding:'utf8',windowsHide:true,timeout:240000,env:process.env});
process.stdout.write(result.stdout || '');process.stderr.write(result.stderr || '');
if(result.error || result.status!==0 || !(result.stdout || '').includes('Real Golden Moments test passed:')){console.error(result.error || 'Real video test did not report successful completion.');process.exit(1);}
