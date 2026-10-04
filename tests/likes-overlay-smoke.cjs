const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");
const { startOverlayServer, stopOverlayServer, setLikesAppearance, likesTracker, publishLikes } = require("../dist-electron/overlayServer");
app.setPath("userData", path.join(app.getPath("temp"), "streampulse-likes-preview-test"));
let win;
async function waitFor(expression) {
  for (let i = 0; i < 50; i++) {
    if (await win.webContents.executeJavaScript(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Overlay did not update: " + expression);
}
app.whenReady().then(async () => {
  try {
    const port = await startOverlayServer(0);
    likesTracker.startStream("test-host", "test-room");
    likesTracker.add({ id: "test", type: "Like", user: "<script>safe</script>", likeCount: 25, totalLikeCount: 200 });
    win = new BrowserWindow({ show: false, width: 480, height: 900, useContentSize: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
    await win.webContents.session.protocol.handle("https", request => request.url === "https://avatar.test/good.png"
      ? new Response('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#35756a"/><circle cx="32" cy="23" r="12" fill="#b6e8d4"/><ellipse cx="32" cy="59" rx="23" ry="20" fill="#b6e8d4"/></svg>', { headers: { "content-type": "image/svg+xml" } })
      : new Response("", { status: 404 }));
    await win.loadURL("http://127.0.0.1:" + port + "/overlay/likes");
    await waitFor("document.querySelector('#total').textContent === '200'");
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('.name').textContent"), "@<script>safe</script>");
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('#leaders script') === null"), true);
    likesTracker.add({ id: "test2", type: "Like", user: "GoldFan", profilePictureUrl: "https://avatar.test/good.png", likeCount: 50, totalLikeCount: 250 });
    publishLikes();
    await waitFor("document.querySelector('#total').textContent === '250'");
    await waitFor("document.querySelector('li img').naturalWidth === 64 && !document.querySelector('li img').hidden");
    await win.webContents.executeJavaScript("window.originalAvatar = document.querySelector('li img')");
    likesTracker.add({ id: "test3", type: "Like", user: "GoldFan", likeCount: 1, totalLikeCount: 251 });
    publishLikes();
    await waitFor("document.querySelector('#total').textContent === '251'");
    assert.equal(await win.webContents.executeJavaScript("window.originalAvatar === document.querySelector('li img')"), true, "Like updates reuse the loaded picture");
    likesTracker.add({ id: "test4", type: "Like", user: "GoldFan", profilePictureUrl: "https://avatar.test/missing.png", likeCount: 1, totalLikeCount: 252 });
    publishLikes();
    await waitFor("document.querySelector('#total').textContent === '252' && document.querySelector('li img').complete && document.querySelector('li img').hidden");
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('li .initial').textContent"), "G");
    likesTracker.add({ id: "test5", type: "Like", user: "GoldFan", profilePictureUrl: "https://avatar.test/good.png", likeCount: 1, totalLikeCount: 253 });
    publishLikes();
    await waitFor("document.querySelector('#total').textContent === '253' && !document.querySelector('li img').hidden");
    await new Promise(resolve => { win.webContents.once("did-finish-load", resolve); win.reload(); });
    await waitFor("document.querySelector('#total').textContent === '253'");
    assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('.crown:not([hidden])').length"), 1);
    likesTracker.add({ id: "new-leader", type: "Like", user: "NewLeader", likeCount: 100 }); publishLikes();
    await waitFor("document.querySelector('li.is-leader .name').textContent === '@NewLeader'");
    assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('.crown:not([hidden])').length"), 1, "Crown follows the new leader");
    likesTracker.add({ id: "tie", type: "Like", user: "GoldFan", likeCount: 47 }); publishLikes();
    await waitFor("document.querySelectorAll('.crown:not([hidden])').length === 2");
    likesTracker.reset();
    publishLikes();
    await waitFor("document.querySelector('#leaders').children.length === 0");
    await win.loadURL("http://127.0.0.1:" + port + "/overlay/likes?preview=1");
    await waitFor("document.querySelector('#leaders').children.length === 5");
    assert.equal(likesTracker.snapshot().trackedLikes, 0, "Sample preview leaves real counts unchanged");
    setLikesAppearance({ likesBackgroundOpacity: 0, likesShowBorder: false });
    await waitFor("getComputedStyle(document.documentElement).getPropertyValue('--panel-opacity') === '0'");
    assert.equal(await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('.board')).borderTopColor"), "rgba(0, 0, 0, 0)");
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('#leaders').children.length"), 5, "Appearance changes preserve demo names");
    setLikesAppearance({ likesBackgroundOpacity: 50, likesShowBorder: true });
    await waitFor("getComputedStyle(document.documentElement).getPropertyValue('--panel-opacity') === '0.5'");
    await new Promise(resolve => { win.webContents.once("did-finish-load", resolve); win.reload(); });
    await waitFor("getComputedStyle(document.documentElement).getPropertyValue('--panel-opacity') === '0.5'");
    assert.equal(await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('.board')).opacity"), "1", "Content stays opaque");
    setLikesAppearance({ likesBackgroundOpacity: 50, likesShowBorder: true, likesFont: "Georgia", likesTextScale: 125, likesWidth: 640 });
    await waitFor("getComputedStyle(document.querySelector('h1')).fontSize === '33.75px'");
    assert.equal(await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('.board')).maxWidth"), "640px");
    assert.match(await win.webContents.executeJavaScript("getComputedStyle(document.body).fontFamily"), /Georgia/);
    await new Promise(resolve => { win.webContents.once("did-finish-load", resolve); win.reload(); });
    await waitFor("getComputedStyle(document.querySelector('h1')).fontSize === '33.75px'");
    setLikesAppearance({ likesFont: "invalid", likesTextScale: 999, likesWidth: -1 });
    await waitFor("getComputedStyle(document.querySelector('h1')).fontSize === '40.5px'");
    assert.equal(await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('.board')).maxWidth"), "320px");
    assert.match(await win.webContents.executeJavaScript("getComputedStyle(document.body).fontFamily"), /Segoe UI/);
    setLikesAppearance({});
    await waitFor("getComputedStyle(document.querySelector('h1')).fontSize === '27px'");
    setLikesAppearance({ likesTextColor: '#123456', likesCountColor: '#abcdef', likesLeaderColor: '#fedcba' });
    await waitFor("getComputedStyle(document.querySelector('h1')).color === 'rgb(18, 52, 86)'");
    assert.equal(await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('#total')).color"), 'rgb(171, 205, 239)');
    assert.equal(await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('li.is-leader .name')).color"), 'rgb(254, 220, 186)');
    assert.equal(await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('li.is-leader .count')).color"), 'rgb(254, 220, 186)');
    await win.reload();
    await waitFor("document.querySelector('li:not(.is-leader) .count') && getComputedStyle(document.querySelector('li:not(.is-leader) .count')).color === 'rgb(171, 205, 239)'");
    setLikesAppearance({ likesTextColor: 'red;display:none', likesCountColor: null, likesLeaderColor: '#bad' });
    await waitFor("getComputedStyle(document.querySelector('h1')).color === 'rgb(239, 255, 249)'");
    assert.equal(await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('li.is-leader .count')).color"), 'rgb(255, 226, 160)');
    setLikesAppearance({ likesFont: "Permanent Marker" });
    await waitFor("document.documentElement.classList.contains('graffiti')");
    await win.webContents.executeJavaScript("document.fonts.load('20px \"Permanent Marker\"')");
    assert.equal(await win.webContents.executeJavaScript("document.fonts.check('20px \"Permanent Marker\"')"), true);
    assert.match(await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('.count')).fontFamily"), /Segoe UI/);
    const fontResponse = await fetch("http://127.0.0.1:" + port + "/fonts/PermanentMarker-Regular.ttf");
    assert.equal(fontResponse.status, 200);assert.ok((await fontResponse.arrayBuffer()).byteLength > 10000);
    await win.webContents.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    await new Promise(resolve => setTimeout(resolve, 250));
    const height = await win.webContents.executeJavaScript("Math.ceil(document.querySelector('.board').getBoundingClientRect().height)");
    const capture = await win.webContents.capturePage({ x: 0, y: 0, width: 480, height });
    if (process.argv[2]) await fs.writeFile(process.argv[2], capture.toPNG());
    console.log("Passed: overlay HTTP page, live WebSocket updates, reload snapshot, reset, safe names, and isolated sample preview.");
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { if (win) win.destroy(); await stopOverlayServer(); app.exit(process.exitCode || 0); }
});






