const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {AudioEnergy,suggestAudioHighlights,discoverVideoTools,videoBinary}=require('../dist-electron/videoTools');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'video-tools-test-'));
(async()=>{
 const originalPath=process.env.PATH;process.env.PATH='';
 try {
  const directory=path.join(root,'downloads','ffmpeg-build','ffmpeg-build','bin');fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,videoBinary('ffmpeg')),'');
  assert.equal(await discoverVideoTools(path.join(root,'downloads'),root),'');
  fs.writeFileSync(path.join(directory,videoBinary('ffprobe')),'');
  assert.equal(await discoverVideoTools(path.join(root,'downloads'),root),directory);
 }finally{process.env.PATH=originalPath;}
 const energy=new AudioEnergy(), pcm=Buffer.alloc(8000*2*3);
 for(let i=0;i<8000*3;i++)pcm.writeInt16LE(i<8000?0:i<16000?3276:16384,i*2);
 // Split on an odd byte to catch partial-sample boundary mistakes.
 energy.feed(pcm.subarray(0,123));energy.feed(pcm.subarray(123));
 const levels=energy.finish();assert.equal(levels.length,3);assert.equal(levels[0],-120);assert.ok(Math.abs(levels[1]+20)<0.01);assert.ok(Math.abs(levels[2]+6.02)<0.01);
 assert.deepEqual(suggestAudioHighlights(Array(90).fill(-120),90),[]);
 assert.deepEqual(suggestAudioHighlights(Array(90).fill(-20),90),[]);
 const peaks=Array(100).fill(-40);peaks[4]=-8;peaks[5]=-9;peaks[94]=-6;
 const highlights=suggestAudioHighlights(peaks,100);assert.equal(highlights.length,2);assert.ok(highlights.every(h=>h.start>=0&&h.end<=100));
 const stream=Array.from({length:1800},(_,i)=>i<900?-15:-38);
 stream[890]=-5;stream[1500]=-25;stream[1798]=-20;
 const sections=suggestAudioHighlights(stream,1800);
 assert.ok(sections.some(h=>h.peakAt===1500),'Quiet-section highlight survives a louder first section');
 assert.equal(sections.filter(h=>h.peakAt===890).length,1,'Overlapping windows do not duplicate the boundary peak');
 assert.ok(sections.some(h=>h.peakAt===1798),'Final partial window is analyzed');
 assert.ok(sections.every(h=>h.start>=0&&h.end<=1800),'Times remain in the original recording');
 assert.deepEqual(sections.map(h=>h.peakAt),[...sections.map(h=>h.peakAt)].sort((a,b)=>a-b));
 const many=Array(18000).fill(-38);for(let i=40;i<many.length;i+=80)many[i]=-10;
 assert.ok(suggestAudioHighlights(many,18000).length<=64);
 assert.ok(suggestAudioHighlights(many,18000).length>8,'Long streams have more than eight suggestions');
 assert.deepEqual(suggestAudioHighlights(Array(1800).fill(-20),1800),[]);
 assert.deepEqual(suggestAudioHighlights(Array(1800).fill(-120),1800),[]);
 console.log('Video tools tests passed: detection, PCM chunk boundaries, silence/uniform audio, bounded distinct highlight suggestions.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
