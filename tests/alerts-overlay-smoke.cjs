const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const { startOverlayServer, stopOverlayServer, showOverlayAlert } = require('../dist-electron/overlayServer');
let win, fixture;
app.setPath('userData', path.join(app.getPath('temp'), 'streampulse-alerts-test'));
const evaluate = code => win.webContents.executeJavaScript(code);
async function waitFor(code) {
  for (let n = 0; n < 100; n++) {
    if (await evaluate(code)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out: ' + code);
}
app.whenReady().then(async () => {
  try {
    fixture = await fs.mkdtemp(path.join(app.getPath('temp'), 'streampulse-alert-media-'));
    const gif = path.join(fixture, 'test.gif');
    await fs.writeFile(gif, Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
    const port = await startOverlayServer(0), base = 'http://127.0.0.1:' + port;
    win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' } });
    await win.loadURL(base + '/overlay/gifts');
    await waitFor("session !== '' && ws.readyState === 1");
    // Reproduce a Studio source that stops delivering animation callbacks.
    await evaluate('window.requestAnimationFrame = () => 0; void 0');
    const trigger = body => showOverlayAlert({ title: '<script>safe</script>', body, imagePath: gif, durationMs: 1000 });
    await trigger('first');
    await waitFor("b.textContent === 'first' && document.querySelector('#i').naturalWidth === 1 && a.classList.contains('show')");
    const firstUrl = await evaluate("document.querySelector('#i').src");
    assert.equal(await evaluate('t.textContent'), '<script>safe</script>');
    await waitFor("!a.classList.contains('show')");
    await trigger('second');
    await waitFor("b.textContent === 'second' && document.querySelector('#i').naturalWidth === 1 && a.classList.contains('show')");
    assert.notEqual(await evaluate("document.querySelector('#i').src"), firstUrl, 'Repeated GIFs get a fresh URL');
    const secondId = await evaluate('a.dataset.alertId');
    await waitFor("!a.classList.contains('show')");
    assert.equal(await evaluate('a.dataset.alertId'), secondId, 'Polling must not replay a WebSocket alert');
    await evaluate('ws.close()');
    await waitFor('ws.readyState === 1');
    await trigger('reconnected');
    await waitFor("b.textContent === 'reconnected'");
    // Disable WebSockets entirely: HTTP delivery must still handle repeated alerts.
    await evaluate('ws.onclose = null; ws.close(); clearTimeout(retry); window.WebSocket = function(){throw new Error("blocked")}; void 0');
    await trigger('fallback-one');
    await waitFor("b.textContent === 'fallback-one'");
    await trigger('fallback-two');
    await waitFor("b.textContent === 'fallback-two' && document.querySelector('#i').naturalWidth === 1");
    await new Promise(resolve => { win.webContents.once('did-finish-load', resolve); win.reload(); });
    await waitFor("session !== ''");
    assert.equal(await evaluate('b.textContent'), '', 'Reload does not replay old entrances');
    // A local sound must start repeatedly without a click in the hidden app window.
    const wav = Buffer.alloc(44 + 1600);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write('data', 36); wav.writeUInt32LE(1600, 40);
    const audioUrl = 'data:audio/wav;base64,' + wav.toString('base64');
    for (let n = 0; n < 3; n++) {
      assert.equal(await evaluate(`(async()=>{const sound=new Audio(${JSON.stringify(audioUrl)});await sound.play();sound.pause();return true})()`), true);
    }
    console.log('Passed: repeated images/GIF URLs, suspended animation frames, reconnect, HTTP fallback, duplicate suppression, reload, and repeated background audio.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally {
    if (win) win.destroy();
    await stopOverlayServer();
    if (fixture) { await fs.unlink(path.join(fixture, 'test.gif')); await fs.rmdir(fixture); }
    app.exit(process.exitCode || 0);
  }
});
