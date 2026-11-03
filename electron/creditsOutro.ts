import { creditGroups, type CreditSession } from "./credits";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function creditsOutro(session: CreditSession) {
  const groups = creditGroups.filter(group => session.groups[group].some(row => !row.excluded));
  const roll = groups.map(group => `<section><h2>${group}</h2><ul>${session.groups[group]
    .filter(row => !row.excluded).map(row => `<li>${escapeHtml(row.name)}</li>`).join("")}</ul></section>`).join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>xGOLDx Stream Credits</title>
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden}
body{background:radial-gradient(ellipse at 50% 100%,#4a290f,#170e0b 45%,#080608 80%);color:#fff1ce;font:clamp(16px,4vmin,60px) Georgia,serif;text-align:center}
body:after{content:"";position:absolute;inset:2.5%;border:1px solid #ba884477;pointer-events:none}
#roll{position:absolute;width:100%;top:100%;padding:0 8%;overflow-wrap:anywhere}
small,h2{color:#edbe68;letter-spacing:.19em;text-transform:uppercase;font:600 .65em system-ui;letter-spacing:.19em}
h1{font-size:3em;margin:.22em 0;color:#ffcf79;text-shadow:0 0 1em #ed9d50aa}
section{margin:2.5em 0}ul{padding:0;list-style:none}li{margin:.45em 0}
#final{position:absolute;inset:0;display:grid;place-content:center;opacity:0;transition:opacity 1.2s}
</style><main id="roll"><small>Thank you, Goldilocks Crew</small><h1>xGOLDx</h1>${roll}</main>
<div id="final"><small>xGOLDx</small><h1>STAY GOLDEN</h1></div>
<script>
const roll = document.getElementById("roll");
const final = document.getElementById("final");
const distance = innerHeight + roll.offsetHeight;
const animation = roll.animate(
  [{transform:"translateY(0)"},{transform:"translateY(-" + distance + "px)"}],
  {duration:Math.max(7000, distance / innerHeight * 5500),fill:"forwards"}
);
animation.onfinish = () => { final.style.opacity = "1"; };
</script></html>`;
}
