export type Moment = {start:number;end:number;peakAt:number;levelDb:number;reason:string;categories:string[];sources:string[]};
export type Cue = {phrase:string;category:string};
export type SearchOptions = {spoken:boolean;visual:boolean;audio:boolean;cues:Cue[];before:number;after:number;region:{x:number;y:number;width:number;height:number}};
export function validateSearch(o:SearchOptions){
  if(!o || !['spoken','visual','audio'].every(k=>typeof (o as any)[k]==='boolean') || !(o.spoken||o.visual||o.audio))throw Error('Choose at least one search method.');
  if(!Number.isFinite(o.before)||!Number.isFinite(o.after)||o.before<0||o.after<=0||o.before+o.after>60)throw Error('Use up to 60 seconds of context per moment.');
  if(!Array.isArray(o.cues)||o.cues.length>30||o.cues.some(c=>!c||typeof c.phrase!=='string'||!normalize(c.phrase)||c.phrase.length>80||!['kill','multi-kill','win','general'].includes(c.category)))throw Error('Use plain spoken cue phrases and supported categories.');
  if(o.spoken && !o.cues.length)throw Error('Add a spoken cue.');
  const r=o.region;if(!r||![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>1.001||r.y+r.height>1.001)throw Error('Choose a visual search region within the recording.');
  return o;
}
export const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
export function cueMoment(time:number,duration:number,cue:Cue,source:string,before:number,after:number):Moment {
  return {start:Math.max(0,time-before),end:Math.min(duration,time+after),peakAt:time,levelDb:0,reason:`${source==='spoken'?'Spoken cue':'Screen text'}: “${cue.phrase}” — review for context`,categories:[cue.category],sources:[source]};
}
export function spokenMoments(words:{start:number;text:string}[],cues:Cue[],duration:number,before:number,after:number){
  const tokens=words.flatMap(w=>normalize(w.text).split(' ').filter(Boolean).map(text=>({text,start:w.start})));
  const result:Moment[]=[];
  for(let i=0;i<tokens.length;i++)for(const cue of cues){const phrase=normalize(cue.phrase).split(' ');if(phrase.every((t,n)=>tokens[i+n]?.text===t)&&tokens[i+phrase.length-1].start-tokens[i].start<=5)result.push(cueMoment(tokens[i].start,duration,cue,'spoken',before,after));}
  return result;
}
export function visualCue(text:string):Cue|null {
  const normalized=normalize(text);
  if(/\bvictory royale\b/.test(normalized))return {phrase:'Victory Royale',category:'win'};
  if(/\beliminated\b/.test(normalized))return {phrase:'Eliminated',category:'kill'};
  return null;
}
export function mergeMoments(input:Moment[]):Moment[]{
  const result:Moment[]=[];
  for(const item of [...input].sort((a,b)=>a.peakAt-b.peakAt)){
    const other=result.find(m=>Math.abs(m.peakAt-item.peakAt)<10 && Math.min(m.end,item.end)>Math.max(m.start,item.start));
    if(other){other.categories=[...new Set([...other.categories,...item.categories])];other.sources=[...new Set([...other.sources,...item.sources])];if(!other.reason.includes(item.reason))other.reason+='; '+item.reason;other.start=Math.min(other.start,item.start);other.end=Math.max(other.end,item.end);}
    else result.push({...item,categories:[...item.categories],sources:[...item.sources]});
  }
  return result.slice(0,256);
}
export type MontageClip={start:number;end:number;category:string};
export function montagePlans(clips:MontageClip[],duration:number,target:number,versions:number){
  if(!Array.isArray(clips)||!clips.length||clips.length>64||![15,30,60].includes(target)||![1,2,3].includes(versions))throw Error('Select 1–64 clips, a 15/30/60 second target, and 1–3 versions.');
  for(const c of clips)if(!c||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start||c.end>duration||!['kill','multi-kill','win','general'].includes(c.category))throw Error('Invalid montage clip.');
  const sorted=[...clips].sort((a,b)=>a.start-b.start);
  const orders=[sorted,[...sorted].reverse(),[...sorted.filter((_,i)=>i%2===0),...sorted.filter((_,i)=>i%2===1)]];
  const plans:MontageClip[][]=[];
  for(const order of orders.slice(0,versions)){
    let remaining=target;const plan:MontageClip[]=[];
    for(const c of order){const length=Math.min(c.end-c.start,remaining);if(length<0.05)break;plan.push({...c,end:c.start+length});remaining-=length;}
    if(!plans.some(p=>JSON.stringify(p)===JSON.stringify(plan)))plans.push(plan);
  }
  return plans;
}
