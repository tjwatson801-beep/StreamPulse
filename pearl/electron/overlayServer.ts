import { likesOverlayHtml } from "./likesOverlay";
import { LikesTracker } from "./likesTracker";
import { OverlayLibrary, libraryFonts } from "./overlayLibrary";
import { LiveEvent } from "./providers/LiveProvider";
import express from "express";
import http from "http";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { WebSocket, WebSocketServer } from "ws";
export const OVERLAY_PORT = 17890;
let server: http.Server | null = null;
let wss: WebSocketServer | null = null;
export const likesTracker = new LikesTracker();
export const overlayLibrary = new OverlayLibrary();
export function processLibraryEvent(event: LiveEvent, before = 0, after = 0) {
  const alert = event.type === "Like" ? overlayLibrary.like(event, before, after) : overlayLibrary.gift(event);
  if (alert) void showOverlayAlert(alert);
}
let likesTimer: ReturnType<typeof setTimeout> | null = null;
export function publishLikes() { if (likesTimer) return; likesTimer = setTimeout(() => { likesTimer = null; broadcast(likesTracker.snapshot()); }, 250); }
const likesColor = (value: unknown, fallback: string) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
let likesAppearance = { type: "likes-appearance",
        topCount: 10, opacity: 95, border: true, font: "Segoe UI", textScale: 100, width: 480, textColor: "#effff9", countColor: "#effff9", leaderColor: "#ffe2a0" };
export function setLikesAppearance(state: { likesTopCount?: unknown; likesTextColor?: unknown; likesCountColor?: unknown; likesLeaderColor?: unknown; likesBackgroundOpacity?: unknown; likesShowBorder?: unknown; likesFont?: unknown; likesTextScale?: unknown; likesWidth?: unknown; overlayLibrary?: unknown; giftCatalog?: unknown }) {
    overlayLibrary.configure(state.overlayLibrary, state.giftCatalog);
    likesAppearance = { type: "likes-appearance",
        topCount: typeof state.likesTopCount === "number" && Number.isFinite(state.likesTopCount) ? Math.max(3, Math.min(10, Math.trunc(state.likesTopCount))) : 10,
        textColor: likesColor(state.likesTextColor, "#effff9"), countColor: likesColor(state.likesCountColor, "#effff9"), leaderColor: likesColor(state.likesLeaderColor, "#ffe2a0"),
        opacity: typeof state.likesBackgroundOpacity === "number" && Number.isFinite(state.likesBackgroundOpacity) ? Math.max(0, Math.min(100, state.likesBackgroundOpacity)) : 95,
        font: typeof state.likesFont === "string" && ["Segoe UI", "Permanent Marker", "Arial", "Verdana", "Trebuchet MS", "Georgia", "Courier New"].includes(state.likesFont) ? state.likesFont : "Segoe UI",
        textScale: typeof state.likesTextScale === "number" && Number.isFinite(state.likesTextScale) ? Math.max(75, Math.min(150, state.likesTextScale)) : 100,
        width: typeof state.likesWidth === "number" && Number.isFinite(state.likesWidth) ? Math.max(320, Math.min(800, state.likesWidth)) : 480,
        border: typeof state.likesShowBorder === "boolean" ? state.likesShowBorder : true };
    broadcast(likesAppearance);
}
const overlayImages = new Map<string, string>();
const alertSession = randomUUID();
let alertSequence = 0;
const recentAlerts: Array<{ type: string; id: string; sequence: number; createdAt: number; [key: string]: unknown }> = [];
function publishAlert(data: Record<string, unknown>) {
    const alert = { ...data, type: "gift-alert", id: randomUUID(), sequence: ++alertSequence, createdAt: Date.now() };
    recentAlerts.push(alert);
    while (recentAlerts.length > 100 || (recentAlerts[0] && recentAlerts[0].createdAt < Date.now() - 30000))
        recentAlerts.shift();
    broadcast(alert);
}
const overlayHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:transparent;overflow:hidden;font-family:Segoe UI,sans-serif}
.alert{position:absolute;left:50%;top:55%;transform:translate(-50%,-50%) scale(.85);min-width:440px;padding:28px 40px;border:2px solid #61ffd0;border-radius:26px;background:rgba(8,12,18,.92);color:white;text-align:center;opacity:0;transition:.25s}
.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
img{display:none;max-width:320px;max-height:260px;object-fit:contain;margin:0 auto 14px}
h1{margin:0;color:#61ffd0;font-size:34px}p{margin:8px 0 0;font-size:22px}
</style></head><body><div id="a" class="alert"><img id="i"><h1 id="t"></h1><p id="b"></p></div><script>
const a=document.querySelector('#a'),t=document.querySelector('#t'),b=document.querySelector('#b');
let timer,ws,retry,pollTimer,polling=false,session='',cursor=0;
const seen=new Set();
function receive(d){
  if(d.type!=='gift-alert'||d.channel||(d.id&&seen.has(d.id)))return;
  if(d.id){seen.add(d.id);if(seen.size>200)seen.delete(seen.values().next().value)}
  clearTimeout(timer);a.classList.remove('show');
  t.textContent=d.title||'StreamPulse';b.textContent=d.body||'';
  const old=document.querySelector('#i'),img=document.createElement('img');img.id='i';
  img.onload=()=>{img.style.display='block'};img.onerror=()=>{img.style.display='none'};
  old.replaceWith(img);
  // Do not wait for animation frames: Studio can suspend them in embedded sources.
  if(d.imageUrl)img.src=d.imageUrl;
  void a.offsetWidth;a.classList.add('show');a.dataset.alertId=d.id||'';
  timer=setTimeout(()=>a.classList.remove('show'),Number(d.durationMs)||4000);
}
function connect(){
  clearTimeout(retry);
  if(ws&&(ws.readyState===0||ws.readyState===1))return;
  try{
    ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);
    ws.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.type==='alert-ready'){if(!session){session=d.session;cursor=d.cursor}}else receive(d)}catch{}};
    ws.onclose=()=>{retry=setTimeout(connect,1500)};ws.onerror=()=>ws.close();
  }catch{retry=setTimeout(connect,1500)}
}
async function poll(){
  if(polling)return;polling=true;clearTimeout(pollTimer);
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetch('/api/alerts?session='+encodeURIComponent(session)+'&after='+cursor,{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('Alert connection unavailable');
    const data=await response.json();
    data.alerts.forEach(receive);session=data.session;cursor=data.cursor;
  }catch{}finally{clearTimeout(timeout);polling=false;pollTimer=setTimeout(poll,1000)}
}
connect();poll();
window.addEventListener('online',()=>{connect();poll()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){connect();poll()}});
</script></body></html>`;
function queuedOverlayHtml(channel = "") {
  return overlayHtml.replace("function receive(d){", `const queue=[];let busy=false;
function receive(d){
  if(d.type!=='gift-alert'||(d.channel||'')!==${JSON.stringify(channel)}||(d.id&&seen.has(d.id)))return;
  if(d.id){seen.add(d.id);if(seen.size>200)seen.delete(seen.values().next().value)}
  if(queue.length>=20)queue.shift();queue.push(d);next();
}
function next(){
  if(busy)return;
  while(queue.length&&Date.now()-queue[0].createdAt>30000)queue.shift();
  const d=queue.shift();if(!d)return;busy=true;
  d.durationMs=Math.min(15000,Math.max(1000,Number(d.durationMs)||4000));render(d);
  setTimeout(()=>{busy=false;next()},d.durationMs+300);
}
function render(d){`).replace("  if(d.type!=='gift-alert'||d.channel||(d.id&&seen.has(d.id)))return;", "");
}
function libraryHtml(kind: string) {
  const html = overlayHtml.replace('<body>', kind === 'gift-highlight' ? '<body class="banner">' : '<body>').replace("</style>", `
@font-face{font-family:"Permanent Marker";src:url("/fonts/PermanentMarker-Regular.ttf") format("truetype");font-weight:400;font-style:normal;font-display:swap}
.alert{box-sizing:border-box;transition:opacity .25s,transform .25s;top:50%;min-width:0;width:min(540px,90vw);padding:30px;border-color:var(--accent);box-shadow:0 0 55px color-mix(in srgb,var(--accent) 25%,transparent)}
h1{color:var(--accent);font-size:38px;overflow-wrap:anywhere}p{overflow-wrap:anywhere}.show{animation:pop .45s ease-out}
.alert[data-theme=minimal]{background:rgba(10,15,22,.88);border:0;border-left:5px solid var(--accent);border-radius:8px;box-shadow:none;text-align:left}
.alert[data-theme=spotlight]{background:radial-gradient(ellipse at top,color-mix(in srgb,var(--accent) 35%,#10121c),#10121cf0);border-radius:36px;border-width:3px}
img{width:130px;height:130px;border-radius:18px}#symbol{display:block;color:var(--accent);font-size:68px;line-height:1;margin-bottom:14px}
.banner .alert{width:min(860px,94vw);display:grid;grid-template-columns:96px minmax(0,1fr);grid-template-rows:auto auto;column-gap:22px;align-content:center;min-height:140px;padding:20px 28px;text-align:left;border-radius:20px}
.banner .alert[data-theme=spotlight]{border-radius:20px;background:linear-gradient(110deg,color-mix(in srgb,var(--accent) 30%,#10121c),#10121cf0 65%)}
.banner .alert[data-theme=minimal]{border-radius:8px}
.banner img,.banner #symbol{grid-column:1;grid-row:1 / 3;width:96px;height:96px;margin:0;align-self:center;object-fit:contain}
.banner #symbol{font-size:64px;line-height:96px;text-align:center}
.banner h1{grid-column:2;grid-row:1;align-self:end;font-size:clamp(22px,4.5vw,34px);line-height:1.15;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.banner p{grid-column:2;grid-row:2;align-self:start;margin:6px 0 0;font-size:clamp(16px,3vw,22px);line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
@media(max-width:480px){.banner .alert{grid-template-columns:64px minmax(0,1fr);column-gap:14px;padding:16px;min-height:112px}.banner img,.banner #symbol{width:64px;height:64px}.banner #symbol{font-size:44px;line-height:64px}}
.alert[data-background=transparent],.alert[data-background=solid],.alert[data-background=image]{background:transparent!important;isolation:isolate}
.alert[data-background]::before{content:"";position:absolute;inset:0;border-radius:inherit;z-index:-1;pointer-events:none;background-color:var(--background-color,transparent);background-image:var(--background-image,none);background-position:center;background-size:cover;opacity:var(--background-opacity,1)}
@keyframes pop{0%{transform:translate(-50%,-50%) scale(.65)}70%{transform:translate(-50%,-50%) scale(1.05)}100%{transform:translate(-50%,-50%) scale(1)}}
</style>`).replace('<img id="i">', `<span id="symbol">${kind === "like-pop" ? "&#9829;" : "&#10022;"}</span><img id="i">`)
    .replace("function receive(d){", `const queue=[];let busy=false;
function receive(d){
  if(d.channel!==${JSON.stringify(kind)}||d.type!=='gift-alert'||(d.id&&seen.has(d.id)))return;
  if(d.id){seen.add(d.id);if(seen.size>200)seen.delete(seen.values().next().value)}
  if(queue.length>=20)queue.shift();queue.push(d);next();
}
function next(){
  if(busy)return;
  while(queue.length&&Date.now()-queue[0].createdAt>30000)queue.shift();
  const d=queue.shift();if(!d)return;busy=true;render(d);
  setTimeout(()=>{busy=false;next()},Math.min(15000,Math.max(1000,Number(d.durationMs)||5000))+300);
}
function render(d){
  a.style.setProperty('--accent',/^#[0-9a-f]{6}$/i.test(d.accent)?d.accent:'#62ffd1');
  a.dataset.theme=d.theme||'glow';
  a.dataset.background=['transparent','solid','image'].includes(d.backgroundMode)?d.backgroundMode:'theme';
  a.style.setProperty('--background-opacity',String(Math.min(100,Math.max(0,Number(d.backgroundOpacity)||0))/100));
  a.style.setProperty('--background-color',d.backgroundMode==='solid'&&/^#[0-9a-f]{6}$/i.test(d.backgroundColor)?d.backgroundColor:'transparent');
  a.style.setProperty('--background-image',d.backgroundMode==='image'&&/^[/]media[/][a-f0-9-]+$/.test(d.backgroundImageUrl)?'url("'+d.backgroundImageUrl+'")':'none');
  a.style.fontFamily='"'+((${JSON.stringify(libraryFonts)}).includes(d.font)?d.font:'Segoe UI')+'", sans-serif';`)
    .replace("  if(d.type!=='gift-alert'||d.channel||(d.id&&seen.has(d.id)))return;", "")
    .replace("img.onload=()=>{img.style.display='block'}", "img.onload=()=>{img.style.display='block';document.querySelector('#symbol').style.display='none'}")
    .replace("  old.replaceWith(img);", "  old.replaceWith(img);document.querySelector('#symbol').style.display='block';");
  return kind === "gift-highlight" ? stackedGiftHtml(html) : html;
}
// Give each visible gift its own DOM elements and lifetime, keeping queue order.
function stackedGiftHtml(html: string) {
  return html.replace("</style>", `
.banner #stack{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;gap:16px;width:min(860px,94vw)}
.banner #stack .alert{position:relative;left:auto;top:auto;width:100%;flex-shrink:0;transform:scale(.85)}
.banner #stack .alert[hidden]{display:none}
.banner #stack .alert.show{transform:scale(1);animation:stack-pop .45s ease-out}
@keyframes stack-pop{0%{transform:scale(.85)}70%{transform:scale(1.03)}100%{transform:scale(1)}}
</style>`)
    .replace('<div id="a"', '<main id="stack"><div id="a"')
    .replace('</div><script>', '</div></main><script>')
    .replace('const queue=[];let busy=false;', `const queue=[];let capacity=1;
const stack=document.querySelector('#stack'),template=a.cloneNode(true),active=new Set();
a.hidden=true;`)
    .replace('if(queue.length>=20)queue.shift();queue.push(d);next();', `capacity=Math.min(5,Math.max(1,Math.floor(Number(d.maxBanners)||1)));
  if(queue.length>=20)queue.shift();queue.push(d);next();`)
    .replace(`  if(busy)return;
  while(queue.length&&Date.now()-queue[0].createdAt>30000)queue.shift();
  const d=queue.shift();if(!d)return;busy=true;render(d);
  setTimeout(()=>{busy=false;next()},Math.min(15000,Math.max(1000,Number(d.durationMs)||5000))+300);`, `  while(queue.length&&Date.now()-queue[0].createdAt>30000)queue.shift();
  while(queue.length&&active.size<capacity){
    const d=queue.shift(),card=a.hidden?a:template.cloneNode(true);
    if(card!==a){card.removeAttribute('id');card.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'))}
    card.hidden=false;stack.append(card);active.add(card);
    const duration=Math.min(15000,Math.max(1000,Number(d.durationMs)||5000));
    render({...d,durationMs:duration},card);
    setTimeout(()=>{active.delete(card);if(card===a){card.hidden=true;card.classList.remove('show')}else card.remove();next()},duration+300);
  }`)
    .replace('function render(d){', `function render(d,a){
  const t=a.querySelector('h1'),b=a.querySelector('p');let timer;`)
    .replace("document.querySelector('#i')", "a.querySelector('img')")
    .split("document.querySelector('#symbol')").join("a.querySelector('span')")
    .replace("img.id='i';", "if(a.id)img.id='i';")
    .replace('  clearTimeout(timer);a.classList.remove', '  a.classList.remove');
}
export async function startOverlayServer(port = OVERLAY_PORT) {
    if (server)
        return (server.address() as import("net").AddressInfo).port;
    const app = express();
    app.use(express.json({ limit: "64kb" }));
    app.get("/fonts/PermanentMarker-Regular.ttf", (_req, res) => res.sendFile(path.join(__dirname, "../dist/fonts/PermanentMarker-Regular.ttf")));
    app.get("/health", (_req, res) => res.json({ ok: true, app: "StreamPulse Core" }));
    app.get("/overlay/likes", (_req, res) => res.set("Cache-Control", "no-store").type("html").send(likesOverlayHtml));
    app.get("/overlay/superfans", (_req, res) => res.set("Cache-Control", "no-store").type("html").send(queuedOverlayHtml("superfan")));
    app.get("/overlay/gifts", (_req, res) => res.set("Cache-Control", "no-store").type("html").send(queuedOverlayHtml()));
    app.get("/overlay/library/:kind", (req, res) => {
      if (!["like-pop", "gift-highlight"].includes(req.params.kind)) return res.sendStatus(404);
      res.set("Cache-Control", "no-store").type("html").send(libraryHtml(req.params.kind));
    });
    app.get("/api/alerts", (req, res) => {
        const after = Number(req.query.after);
        const alerts = req.query.session === alertSession && Number.isFinite(after)
            ? recentAlerts.filter(alert => alert.sequence > after && alert.createdAt >= Date.now() - 30000) : [];
        res.set("Cache-Control", "no-store").json({ session: alertSession, cursor: alertSequence, alerts });
    });
    app.get("/media/:id", (req, res) => {
        const file = overlayImages.get(req.params.id);
        if (!file)
            return res.sendStatus(404);
        res.set({ "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", Pragma: "no-cache", Expires: "0" });
        res.sendFile(file);
    });
    app.post("/api/alert", (req, res) => {
        publishAlert({ title: String(req.body?.title || "Gift received!"), body: String(req.body?.body || "Thank you!"), durationMs: Number(req.body?.durationMs || 4000) });
        res.json({ ok: true });
    });
    server = http.createServer(app);
    wss = new WebSocketServer({ server });
    wss.on("connection", client => { client.send(JSON.stringify({ type: "alert-ready", session: alertSession, cursor: alertSequence })); client.send(JSON.stringify(likesAppearance)); client.send(JSON.stringify(likesTracker.snapshot())); });
    await new Promise<void>((resolve, reject) => { server?.once("error", reject); server?.listen(port, "127.0.0.1", resolve); });
    return (server.address() as import("net").AddressInfo).port;
}
export async function showOverlayAlert(args: { title: string; body: string; imagePath?: string; imageUrl?: string; durationMs?: number; channel?: string; accent?: string; theme?: string; font?: string; maxBanners?: number; backgroundMode?: string; backgroundColor?: string; backgroundOpacity?: number; backgroundImagePath?: string }) {
    let imageUrl = "";
    if (typeof args.imageUrl === "string") {
        try {
            const remote = new URL(args.imageUrl);
            if (remote.protocol === "https:" && !remote.username && !remote.password)
                imageUrl = remote.href;
        }
        catch { /* Missing or invalid gift image: keep the text alert. */ }
    }
    let imageError = "";
    if (args.imagePath && path.isAbsolute(args.imagePath) && /\.(png|jpe?g|gif|webp)$/i.test(args.imagePath)) {
        try {
            const file = await fs.readFile(args.imagePath);
            if (file.length > 15 * 1024 * 1024)
                imageError = "Overlay image is larger than 15 MB.";
            else {
                // Each entrance has a new URL so a completed GIF starts again.
                const id = randomUUID();
                overlayImages.set(id, args.imagePath);
                while (overlayImages.size > 200)
                    overlayImages.delete(overlayImages.keys().next().value!);
                imageUrl = `/media/${id}`;
            }
        }
        catch (error) {
            imageError = `Could not read overlay image: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    const backgroundMode = ["theme", "transparent", "solid", "image"].includes(args.backgroundMode || "") ? args.backgroundMode : "theme";
    let backgroundImageUrl = "";
    if (backgroundMode === "image") {
        try {
            if (typeof args.backgroundImagePath !== "string" || !path.isAbsolute(args.backgroundImagePath) || !/\.(png|jpe?g|gif|webp)$/i.test(args.backgroundImagePath)) throw new Error("Choose a PNG, JPG, GIF, or WebP background image.");
            const info = await fs.stat(args.backgroundImagePath);
            if (!info.isFile() || info.size > 15 * 1024 * 1024) throw new Error("Background image must be a file no larger than 15 MB.");
            await fs.access(args.backgroundImagePath);
            const id = randomUUID();
            overlayImages.set(id, args.backgroundImagePath);
            while (overlayImages.size > 200) overlayImages.delete(overlayImages.keys().next().value!);
            backgroundImageUrl = `/media/${id}`;
        } catch (error) { imageError = `Could not load background: ${error instanceof Error ? error.message : String(error)}`; }
    }
    publishAlert({ backgroundMode: backgroundMode === "image" && !backgroundImageUrl ? "theme" : backgroundMode, backgroundImageUrl, backgroundColor: /^#[0-9a-f]{6}$/i.test(args.backgroundColor || "") ? args.backgroundColor : "#10121c", backgroundOpacity: typeof args.backgroundOpacity === "number" && Number.isFinite(args.backgroundOpacity) ? Math.min(100, Math.max(0, args.backgroundOpacity)) : 90, font: libraryFonts.includes(args.font || "") ? args.font : "Segoe UI", maxBanners: typeof args.maxBanners === "number" && Number.isFinite(args.maxBanners) ? Math.min(5, Math.max(1, Math.floor(args.maxBanners))) : 1, channel: ["like-pop", "gift-highlight", "superfan"].includes(args.channel || "") ? args.channel : undefined, accent: /^#[0-9a-f]{6}$/i.test(args.accent || "") ? args.accent : "#62ffd1", theme: ["glow", "minimal", "spotlight"].includes(args.theme || "") ? args.theme : "glow", title: args.title, body: args.body, imageUrl, durationMs: Math.min(15000, Math.max(1000, Number(args.durationMs || 5000))) });
    return { ok: !imageError, error: imageError || undefined };
}
function broadcast(data: unknown) {
    const message = JSON.stringify(data);
    wss?.clients.forEach(client => { if (client.readyState === WebSocket.OPEN)
        client.send(message); });
}
export async function stopOverlayServer() {
    if (likesTimer)
        clearTimeout(likesTimer);
    likesTimer = null;
    wss?.clients.forEach(client => client.terminate());
    await new Promise<void>(resolve => { if (!server)
        return resolve(); wss?.close(); wss = null; server.close(() => resolve()); server = null; });
}
