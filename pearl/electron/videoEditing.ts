export type CaptionWord = {start:number; end:number; text:string};
export type ClipEditing = {cameraFocus?:boolean; audioPolish?:boolean; captions?:CaptionWord[]; font?:string; wordHighlight?:boolean};
export function validateEditing(value:ClipEditing, length:number):ClipEditing {
  if (!value || typeof value !== 'object') throw Error('Invalid editing options.');
  for (const key of ['cameraFocus','audioPolish','wordHighlight'] as const) if (value[key] !== undefined && typeof value[key] !== 'boolean') throw Error('Invalid editing option.');
  if (value.font !== undefined && !['Bauhaus 93','Arial Rounded MT Bold','Segoe UI','Impact','Cooper Black','Berlin Sans FB Demi','Showcard Gothic','Arial'].includes(value.font)) throw Error('Choose a supported caption font.');
  if (value.captions !== undefined) {
    if (!Array.isArray(value.captions) || value.captions.length>10000) throw Error('Too many caption words.');
    let previous=-1;
    for (const w of value.captions) {
      if (!w || typeof w.text!=='string' || !w.text.trim() || w.text.length>80 || /[\r\n{}\\]/.test(w.text) || !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start<0 || w.end<=w.start || w.end>length+0.05 || w.start<previous) throw Error('Caption words need ordered times within the selected clip, and plain text.');
      previous=w.end;
    }
  }
  return value;
}
export function framingFilter(framing:string, camera:boolean) {
  if (camera) return 'split=3[f][g][b];[f]crop=iw*2/3:ih*626/1920:iw*240/1080:0,scale=1080:940[face];[g]crop=iw:ih*820/1920:0:ih*626/1920,scale=1080:820[game];[b]crop=iw:ih*240/1920:0:ih*1590/1920,scale=720:160,pad=1080:160:180:0:color=0x080c12[brand];[face][game][brand]vstack=inputs=3,setsar=1';
  return framing==='crop' ? 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1' : framing==='fit' ? 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1' : 'scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1';
}
export function captionAss(words:CaptionWord[], font='Bauhaus 93', highlight=true) {
  const time=(t:number)=>{const c=Math.round(t*100);return `${Math.floor(c/360000)}:${String(Math.floor(c/6000)%60).padStart(2,'0')}:${String(Math.floor(c/100)%60).padStart(2,'0')}.${String(c%100).padStart(2,'0')}`;};
  let result=`[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${font},66,&H00FFFFFF,&H0000D7FF,&H00101010,&H90000000,-1,0,0,0,100,100,0,0,1,5,2,5,60,60,30,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  for(let i=0;i<words.length;) {
    const group:CaptionWord[]=[];
    while(i<words.length && group.length<6) {
      const w=words[i];
      if(group.length && (group.map(x=>x.text).join(' ').length+w.text.length>38 || w.start-group[group.length-1].end>0.6)) break;
      group.push(w);i++;if(/[.!?]$/.test(w.text))break;
    }
    const text=(current:number)=>group.map((w,n)=>(highlight&&n===current?'{\\c&H0000D7FF&}':'{\\c&H00FFFFFF&}')+w.text).join(' ');
    const event=(a:number,b:number,current:number)=>{if(b-a>=0.01)result+=`Dialogue: 0,${time(a)},${time(b)},Default,,0,0,0,,{\\pos(540,1040)}${text(current)}\n`;};
    if(!highlight)event(group[0].start,group[group.length-1].end,-1);
    else for(let n=0;n<group.length;n++){event(group[n].start,group[n].end,n);if(n+1<group.length)event(group[n].end,group[n+1].start,-1);}
  }
  return result;
}
