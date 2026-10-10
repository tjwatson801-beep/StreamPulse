import {app,dialog,ipcMain} from 'electron';
import {spawn,ChildProcess} from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import {randomUUID} from 'crypto';
import {AudioEnergy,suggestAudioHighlights} from './videoTools';
import {captionAss,CaptionWord,framingFilter,validateEditing} from './videoEditing';
import {cueMoment,mergeMoments,Moment,montagePlans,MontageClip,SearchOptions,spokenMoments,validateSearch,visualCue} from './momentSearch';
type Source={path:string;duration:number;hasAudio:boolean;width:number;height:number};
type Services={recordings:Map<string,Source>;run:(name:string,args:string[],onLine?: (line:string)=>void,active?:boolean,stderr?:boolean)=>Promise<string>;speechWords:(source:string,start:number,length:number)=>Promise<CaptionWord[]>;tool:(name:string)=>string;loadFolder:()=>Promise<void>;begin:()=>void;finish:()=>void;check:()=>void;setActive:(child:ChildProcess|null)=>void};
export function setupMomentEngine(s:Services){
  const progress=(event:any,value:number)=>{if(!event.sender.isDestroyed())event.sender.send('video:progress',Math.min(100,Math.round(value)));};
  async function external(binary:string,args:string[]){
    s.check();return new Promise<string>((resolve,reject)=>{const child=spawn(binary,args,{windowsHide:true,shell:false});s.setActive(child);let out='',err='';child.stdout.on('data',c=>out=(out+c).slice(-2000000));child.stderr.on('data',c=>err=(err+c).slice(-4000));child.on('error',reject);child.on('close',code=>{s.setActive(null);try{s.check();if(code!==0)throw Error(err||'Visual scan failed.');resolve(out);}catch(e){reject(e);}});});
  }
  ipcMain.handle('video:search',async(event,args:{id:string;options:SearchOptions})=>{
    const source=s.recordings.get(args?.id);if(!source)throw Error('Import a recording first.');const o=validateSearch(args.options);
    if((o.spoken||o.audio)&&!source.hasAudio)throw Error('This recording has no audio. Use visual search.');
    s.begin();let scratch='';const results:Moment[]=[];const warnings:string[]=[];
    const steps=Number(o.audio)+Number(o.spoken)+Number(o.visual);let step=0;
    try{
      await s.loadFolder();
      if(o.audio){
        const energy=new AudioEnergy();
        await new Promise<void>((resolve,reject)=>{const child=spawn(s.tool('ffmpeg'),['-nostdin','-v','error','-i',source.path,'-vn','-map','0:a:0','-ac','1','-ar','8000','-f','s16le','pipe:1'],{windowsHide:true,shell:false});s.setActive(child);let err='';child.stdout.on('data',c=>{energy.feed(c);progress(event,energy.levels.length/source.duration*100/steps);});child.stderr.on('data',c=>err=(err+c).slice(-2000));child.on('error',reject);child.on('close',code=>{s.setActive(null);try{s.check();if(code!==0)throw Error(err);resolve();}catch(e){reject(e);}});});
        results.push(...suggestAudioHighlights(energy.finish(),source.duration).map(m=>({...m,categories:['general'],sources:['audio']})));step++;
      }
      if(o.spoken){
        try{
          // Overlap speech windows so cue phrases crossing a boundary are retained.
          for(let start=0;start<source.duration;start+=298){s.check();const length=Math.min(300,source.duration-start);const words=await s.speechWords(source.path,start,length);results.push(...spokenMoments(words.map(w=>({...w,start:w.start+start})),o.cues,source.duration,o.before,o.after));progress(event,(step+Math.min(1,(start+length)/source.duration))*100/steps);if(start+length>=source.duration)break;}
        }catch(e){s.check();warnings.push('Spoken search: '+(e instanceof Error?e.message:String(e)));}step++;
      }
      if(o.visual){
        try{
          if(process.platform!=='win32')throw Error('Visual text search currently requires Windows OCR.');
          scratch=await fs.mkdtemp(path.join(app.getPath('temp'),'golden-visual-'));
          const r=o.region;
          const worker=app.isPackaged?path.join(process.resourcesPath,'visual-ocr.ps1'):path.join(__dirname,'..','resources','visual-ocr.ps1');
          let last:{category:string;time:number}|null=null;
          for(let start=0;start<source.duration;start+=60){
            s.check();const frames=path.join(scratch,'frames');await fs.mkdir(frames);
            await s.run('ffmpeg',['-nostdin','-v','error','-ss',String(start),'-i',source.path,'-t',String(Math.min(60,source.duration-start)),'-vf',`fps=1/2,crop=iw*${r.width}:ih*${r.height}:iw*${r.x}:ih*${r.y},scale=1280:-2`,'-n',path.join(frames,'%05d.png')],undefined,true);
            const text=await external(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',worker,'-FrameFolder',frames]);
            const readings=JSON.parse(text.replace(/^\uFEFF/,''));
            for(const reading of readings){const time=Math.min(source.duration,start+(Number(path.basename(reading.frame,'.png'))-1)*2+1);const cue=visualCue(reading.text);if(cue && (!last || last.category!==cue.category || time-last.time>10))results.push(cueMoment(time,source.duration,cue,'visual',o.before,o.after));last=cue?{category:cue.category,time}:null;}
            await fs.rm(frames,{recursive:true,force:true});progress(event,(step+Math.min(1,(start+60)/source.duration))*100/steps);
          }
        }catch(e){s.check();warnings.push('Visual search: '+(e instanceof Error?e.message:String(e)));}step++;
      }
      s.check();progress(event,100);const highlights=mergeMoments(results);
      return {highlights,message:`Found ${highlights.length} review candidates. ${warnings.join(' ')}${o.visual?' Visual search samples every 2 seconds; short messages can be missed.':''}`};
    }finally{s.finish();if(scratch)await fs.rm(scratch,{recursive:true,force:true}).catch(()=>{});}
  });
  ipcMain.handle('video:montage',async(event,args:{id:string;clips:MontageClip[];target:number;versions:number;cameraFocus:boolean;audioPolish:boolean;captions:boolean;font:string;wordHighlight:boolean})=>{
    const source=s.recordings.get(args?.id);if(!source)throw Error('Import a recording first.');const plans=montagePlans(args.clips,source.duration,args.target,args.versions);
    if(args.cameraFocus && Math.abs(source.width/source.height-9/16)>0.02)throw Error('Camera focus needs a vertical recording.');
    // Validate caption font and boolean options through the same export validator.
    validateEditing({font:args.font,cameraFocus:args.cameraFocus,audioPolish:args.audioPolish,wordHighlight:args.wordHighlight},args.target);
    if(typeof args.captions!=='boolean')throw Error('Invalid caption option.');
    s.begin();let scratch='';const staged:{temporary:string;output:string}[]=[];const outputs:string[]=[];
    try{
      const pick=await dialog.showOpenDialog({title:'Choose montage export folder',properties:['openDirectory']});if(pick.canceled)return null;
      scratch=await fs.mkdtemp(path.join(app.getPath('temp'),'golden-montage-'));const batch=randomUUID().slice(0,8);
      const total=plans.reduce((sum,p)=>sum+p.length,0)+plans.length;let done=0;
      for(let version=0;version<plans.length;version++){
        const list:string[]=[];
        for(let i=0;i<plans[version].length;i++){
          s.check();const c=plans[version][i],length=c.end-c.start;let filter=framingFilter('fit',args.cameraFocus);
          if(args.captions && source.hasAudio){const words=await s.speechWords(source.path,c.start,length);const subtitle=path.join(scratch,`caption-${version}-${i}.ass`);await fs.writeFile(subtitle,captionAss(words,args.font,args.wordHighlight));filter+=`,ass=filename='${subtitle.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"'\\''")}'`;}
          const part=path.join(scratch,`part-${version}-${i}.mp4`);
          const input=['-nostdin','-v','error','-ss',String(c.start),'-i',source.path];
          if(!source.hasAudio)input.push('-f','lavfi','-i','anullsrc=r=48000:cl=stereo');
          await s.run('ffmpeg',[...input,'-t',String(length),'-map','0:v:0','-map',source.hasAudio?'0:a:0':'1:a:0','-vf',filter,'-c:v','libx264','-preset','veryfast','-crf','18','-r','30','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-n',part],undefined,true);
          list.push(`file '${path.basename(part)}'`);progress(event,++done/total*99);
        }
        const manifest=path.join(scratch,`list-${version}.txt`);await fs.writeFile(manifest,list.join('\n'));
        const output=path.join(pick.filePaths[0],`Golden-Montage-${batch}-v${version+1}.mp4`);const temporary=path.join(pick.filePaths[0],`.golden-montage-${batch}-${version}.mp4`);staged.push({temporary,output});
        await s.run('ffmpeg',['-nostdin','-v','error','-f','concat','-safe','1','-i',manifest,'-c:v','copy',...(args.audioPolish?['-af','loudnorm=I=-16:TP=-1.5:LRA=11','-c:a','aac','-b:a','192k','-ar','48000']:['-c:a','copy']),'-movflags','+faststart','-n',temporary],undefined,true);progress(event,++done/total*99);
      }
      s.check();for(const file of staged){await fs.rename(file.temporary,file.output);outputs.push(file.output);}progress(event,100);return outputs;
    }catch(e){if(outputs.length)throw Error(`Some versions saved: ${outputs.join(', ')}. ${String(e)}`);throw e;}
    finally{s.finish();for(const file of staged)await fs.unlink(file.temporary).catch(()=>{});if(scratch)await fs.rm(scratch,{recursive:true,force:true}).catch(()=>{});}
  });
}
