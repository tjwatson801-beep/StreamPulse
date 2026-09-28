export const likesOverlayHtml = String.raw`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@font-face{font-family:"Permanent Marker";src:url("/fonts/PermanentMarker-Regular.ttf") format("truetype");font-weight:400;font-style:normal;font-display:swap}
*{box-sizing:border-box}html,body{margin:0;background:transparent;font-family:var(--overlay-font,"Segoe UI"),sans-serif;color:#effff9}
.board{width:100%;max-width:var(--overlay-width,480px);padding:26px;background:linear-gradient(145deg,rgba(13,28,31,var(--panel-opacity,.95)),rgba(5,12,20,var(--panel-opacity,.95)));border:1px solid var(--panel-border,#386458);border-radius:24px}
.eyebrow{font-size:calc(12px * var(--text-scale,1));letter-spacing:.22em;font-weight:700;color:#6affce}.heading{display:flex;justify-content:space-between;align-items:center;margin:8px 0 20px}h1{margin:0;font-size:calc(27px * var(--text-scale,1));letter-spacing:-.04em}.heart{color:#69ffcd;font-size:calc(32px * var(--text-scale,1))}
.total{padding:16px 0 20px;border-bottom:1px solid #2c423d}.total strong{display:block;font-size:calc(45px * var(--text-scale,1));line-height:1.15;letter-spacing:-.04em;font-variant-numeric:tabular-nums}.total span{font-size:calc(12px * var(--text-scale,1));color:#9db7ad}.columns{display:flex;justify-content:space-between;color:#8da79e;font-size:calc(11px * var(--text-scale,1));letter-spacing:.1em;margin:20px 0 8px}
ol{padding:0;margin:0;list-style:none}li{display:grid;grid-template-columns:calc(26px * var(--text-scale,1)) calc(36px * var(--text-scale,1)) minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #ffffff0b;font-size:calc(15px * var(--text-scale,1))}.rank{color:#8fa99f;font-variant-numeric:tabular-nums}li.is-leader{color:#ffe2a0}li.is-leader .rank{color:#ffd36b}.name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.count{font-weight:700;font-variant-numeric:tabular-nums}footer{margin-top:18px;color:#879f97;font-size:calc(11px * var(--text-scale,1));line-height:1.6}.empty{padding:28px 0;text-align:center;color:#9cb6ac;font-size:calc(14px * var(--text-scale,1))}.status{color:#edc582}.demo{color:#edc582;font-size:calc(11px * var(--text-scale,1))}
.avatar{position:relative;display:grid;place-items:center;width:calc(36px * var(--text-scale,1));height:calc(36px * var(--text-scale,1));border-radius:50%;overflow:hidden;background:#244b43;color:#a6ffe2;font-size:calc(14px * var(--text-scale,1));font-weight:700;border:1px solid #568878}.avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.avatar img[hidden]{display:none}
.rank{display:grid;place-items:center}.crown{display:block;width:calc(23px * var(--text-scale,1));height:calc(23px * var(--text-scale,1));filter:drop-shadow(0 1px 3px #0008)}.crown svg{display:block;width:100%;height:100%}.crown[hidden],.rank-number[hidden]{display:none}.graffiti body{font-family:"Segoe UI",sans-serif}.graffiti h1,.graffiti .name{font-family:"Permanent Marker","Segoe UI",sans-serif;font-weight:400;letter-spacing:.015em}.graffiti .name{padding-block:3px}
</style></head><body><section class="board"><div class="eyebrow">STREAM PULSE · LIVE</div><div class="heading"><h1>Top likes</h1><span class="heart">♥</span></div><div class="total"><strong id="total">0</strong><span id="label">Likes tracked</span></div><div class="columns"><span>TOP SUPPORTERS</span><span>LIKES</span></div><ol id="leaders"></ol><div id="empty" class="empty">Tap the heart to join the leaderboard</div><footer><div id="meta">Waiting for likes…</div><div>Individual ranks count likes received while connected.</div><div id="status" class="status"></div></footer></section>
<script>
const total=document.getElementById('total'),label=document.getElementById('label'),list=document.getElementById('leaders'),empty=document.getElementById('empty'),meta=document.getElementById('meta'),status=document.getElementById('status');
function render(data){
if(data.type==='likes-appearance'){document.documentElement.classList.toggle('graffiti',data.font==='Permanent Marker');document.documentElement.style.setProperty('--overlay-font',data.font);document.documentElement.style.setProperty('--text-scale',String(data.textScale/100));document.documentElement.style.setProperty('--overlay-width',data.width+'px');document.documentElement.style.setProperty('--panel-opacity',String(data.opacity/100));document.documentElement.style.setProperty('--panel-border',data.border?'#386458':'transparent');return;}
if(data.type!=='likes-leaderboard'||(preview&&!data.sample))return;
total.textContent=(data.totalLikes==null?data.trackedLikes:data.totalLikes).toLocaleString();
label.textContent=data.totalLikes==null?'Likes tracked':'Total LIVE likes';
const existing=new Map(Array.from(list.children,row=>[row.dataset.user,row]));
const active=new Set();
for(const person of data.leaders){
const key=person.user.toLowerCase();active.add(key);
let row=existing.get(key);
if(!row){row=document.createElement('li');row.dataset.user=key;
for(const cls of ['rank','avatar','name','count']){const cell=document.createElement('span');cell.className=cls;row.appendChild(cell)}
const rank=row.querySelector('.rank');const number=document.createElement('span');number.className='rank-number';rank.appendChild(number);const crown=document.createElement('span');crown.className='crown';crown.setAttribute('aria-hidden','true');crown.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M3 7l5 4 4-7 4 7 5-4-2 12H5L3 7z" fill="#FFD36B" stroke="#E8A62F" stroke-width="1.2" stroke-linejoin="round"/><path d="M6 16h12" stroke="#FFF0B5" stroke-width="1.4"/><circle cx="12" cy="3.5" r="1.5" fill="#FFF0B5"/></svg>';rank.appendChild(crown);
const avatar=row.querySelector('.avatar');avatar.setAttribute('aria-hidden','true');
const initial=document.createElement('span');initial.className='initial';avatar.appendChild(initial);
const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.hidden=true;
img.onload=()=>{img.hidden=false};img.onerror=()=>{img.hidden=true};avatar.appendChild(img);
}
const leader=person.rank===1;row.classList.toggle('is-leader',leader);row.querySelector('.rank-number').textContent=String(person.rank).padStart(2,'0');row.querySelector('.rank-number').hidden=leader;row.querySelector('.crown').hidden=!leader;row.querySelector('.rank').setAttribute('aria-label',leader?'Rank 1: top liker':'Rank '+person.rank);
row.querySelector('.name').textContent='@'+person.user;
row.querySelector('.count').textContent=person.likes.toLocaleString();
row.querySelector('.initial').textContent=Array.from(person.user)[0]?.toUpperCase()||'?';
let url='';try{const parsed=new URL(person.profilePictureUrl);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)url=parsed.href}catch{}
const img=row.querySelector('img');
if((img.dataset.url||'')!==url){img.dataset.url=url;img.hidden=true;if(url)img.src=url;else img.removeAttribute('src')}
list.appendChild(row);
}
for(const [key,row] of existing)if(!active.has(key))row.remove();
empty.hidden=data.leaders.length>0;
meta.textContent=data.viewers.toLocaleString()+' supporters · '+data.trackedLikes.toLocaleString()+' likes tracked';
}
const preview=new URLSearchParams(location.search).get('preview')==='1';
if(preview){render({type:'likes-leaderboard',sample:true,totalLikes:12840,trackedLikes:3260,viewers:5,leaders:[{rank:1,user:'GoldFan',likes:1250},{rank:2,user:'Spark',likes:840},{rank:3,user:'Luna',likes:620},{rank:4,user:'NightOwl',likes:350},{rank:5,user:'River',likes:200}]});status.textContent='SAMPLE PREVIEW · does not affect live rankings';}
{let delay=1000;function connect(){const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);ws.onopen=()=>{delay=1000;status.textContent=preview?'SAMPLE PREVIEW · does not affect live rankings':''};ws.onmessage=e=>{try{render(JSON.parse(e.data))}catch{}};ws.onerror=()=>ws.close();ws.onclose=()=>{status.textContent='Reconnecting to StreamPulse…';setTimeout(connect,delay);delay=Math.min(delay*2,10000)}}connect();}
</script></body></html>`;



