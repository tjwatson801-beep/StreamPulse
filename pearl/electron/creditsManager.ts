import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { LiveEvent } from './providers/LiveProvider';
export type CreditViewer = { user:string; name:string; category:string; excluded:boolean; removed:boolean; chats:number; likes:number; gifts:number; follows:boolean; superFan:boolean };
export type CreditSession = { id:string; host:string; room:string; title:string; startedAt:string; endedAt?:string; viewers:CreditViewer[]; seen:string[] };
export type CreditState = { sessions:CreditSession[]; activeId:string; revision:number };
const categories = ['Super Fans','Top Supporters','Active Fans','New Followers','Special Thanks'];
export class CreditsManager {
  state:CreditState = {sessions:[],activeId:'',revision:0};
  private timer?:NodeJS.Timeout;
  private queue:Promise<void> = Promise.resolve();
  error = '';
  private blocked = false;
  constructor(private root:string, private changed:()=>void = ()=>{}) {}
  async load() {
    try {
      const data = JSON.parse(await fs.readFile(path.join(this.root,'stream-credits.json'),'utf8'));
      if (!Array.isArray(data.sessions) || !data.sessions.every((s:any)=>typeof s.id==='string' && typeof s.host==='string' && typeof s.room==='string' && typeof s.title==='string' && typeof s.startedAt==='string' && Array.isArray(s.viewers) && s.viewers.every((v:any)=>typeof v.user==='string' && typeof v.name==='string' && typeof v.category==='string' && ['chats','likes','gifts'].every(k=>Number.isFinite(v[k]) && v[k]>=0) && ['excluded','removed','follows','superFan'].every(k=>typeof v[k]==='boolean')) && Array.isArray(s.seen) && s.seen.every((id:any)=>typeof id==='string'))) throw new Error('Invalid archive');
      this.state = {...data, revision:0};
    } catch(e:any) { if(e.code!=='ENOENT') { this.blocked=true; this.error='Credits archive could not be read. Preserve stream-credits.json before repairing it.'; } }
  }
  snapshot() { return {...this.state,error:this.error}; }
  private touch() { this.state.revision++; if (!this.timer) this.timer=setTimeout(()=>{ this.timer=undefined; this.changed(); void this.flush().catch(()=>{}); },750); }
  flush() {
    if(this.timer) { clearTimeout(this.timer); this.timer=undefined; }
    if(this.blocked) return Promise.reject(new Error(this.error));
    const text=JSON.stringify(this.state,null,2);
    const write=async()=>{ const file=path.join(this.root,'stream-credits.json'); const temp=file+'.tmp'; try { await fs.mkdir(this.root,{recursive:true}); await fs.writeFile(temp,text); await fs.rename(temp,file); this.error=''; } catch(e) { this.error='Credits could not be saved. Check disk access and retry.'; this.changed(); throw e; } };
    const next=this.queue.then(write); this.queue=next.catch(()=>{}); return next;
  }
  start(host:string,room:string,force=false) {
    if(this.blocked) return;
    const active=this.state.sessions.find(s=>s.id===this.state.activeId);
    if(!force && active && !active.endedAt && active.host===host && (!room || !active.room || active.room===room)) { if(room && !active.room) {active.room=room;this.touch();} return; }
    if(active&&!active.endedAt) active.endedAt=new Date().toISOString();
    const session:CreditSession={id:randomUUID(),host,room,title:`${host ? '@'+host+' · ' : ''}${new Date().toLocaleString()}`,startedAt:new Date().toISOString(),viewers:[],seen:[]};
    this.state.sessions.unshift(session);this.state.activeId=session.id;this.touch();
  }
  end() { const s=this.state.sessions.find(s=>s.id===this.state.activeId); if(s&&!s.endedAt) {s.endedAt=new Date().toISOString();this.touch();} }
  collect(event:LiveEvent) {
    if(this.blocked) return;
    const s=this.state.sessions.find(s=>s.id===this.state.activeId);
    if(!s||s.endedAt||!event.user?.trim()||event.user.trim().toLowerCase()==='viewer'||s.seen.includes(event.id)) return;
    s.seen.push(event.id); if(s.seen.length>20000)s.seen.shift();
    const user=event.user.trim().replace(/^@/,'').toLowerCase();
    let v=s.viewers.find(v=>v.user===user);
    if(!v) {v={user,name:event.displayName||event.user,category:'',excluded:false,removed:false,chats:0,likes:0,gifts:0,follows:false,superFan:false};s.viewers.push(v);}
    if(event.type==='Chat')v.chats++;
    if(event.type==='Like')v.likes+=Math.max(0,Number(event.likeCount)||0);
    if(event.type==='Gift'&&event.comboComplete!==false)v.gifts+=Math.max(0,Number(event.count)||1);
    if(event.type==='Follow')v.follows=true;
    if(event.type==='SuperFanJoin')v.superFan=true;
    this.touch();
  }
  edit(args:any) {
    if(this.blocked)throw new Error(this.error);
    const s=this.state.sessions.find(s=>s.id===args?.sessionId);if(!s)throw new Error('Select a livestream.');
    if(args.action==='title')s.title=String(args.value||'Untitled LIVE').slice(0,160);
    else if(args.action==='add') {
      const user=String(args.user||'').trim().replace(/^@/,'').toLowerCase();if(!/^[a-z0-9_.]{1,64}$/.test(user))throw new Error('Enter a TikTok username.');
      const old=s.viewers.find(v=>v.user===user);if(old){old.removed=false;old.excluded=false;}else s.viewers.push({user,name:user,category:'Special Thanks',excluded:false,removed:false,chats:0,likes:0,gifts:0,follows:false,superFan:false});
    } else {
      const index=s.viewers.findIndex(v=>v.user===args.user);if(index<0)throw new Error('Viewer not found.');const v=s.viewers[index];
      if(args.action==='remove')v.removed=true;
      else if(args.action==='exclude')v.excluded=Boolean(args.value);
      else if(args.action==='name')v.name=String(args.value||v.user).slice(0,100);
      else if(args.action==='category' && (args.value===''||categories.includes(args.value)))v.category=args.value;
      else if(args.action==='move') {const to=index+(args.value===-1?-1:1);if(to>=0&&to<s.viewers.length){s.viewers.splice(index,1);s.viewers.splice(to,0,v);}}
      else throw new Error('Unsupported credits edit.');
    }
    this.touch();return this.snapshot();
  }
}
