const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const handlers = new Map();
let stored = JSON.stringify({ clientId: "a".repeat(32), refreshToken: "refresh" });
let mode = "ok";
let attempts = 0;
let changes = 0;
let authorizationChallenge = "";
let authorizationExchanges = 0;
const exportsObject = {};
const context = {
  exports: exportsObject, URL, URLSearchParams, AbortSignal, Date, setTimeout, clearTimeout,
  require(name) {
    if (name === "electron") return {
      ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
      safeStorage: { isEncryptionAvailable: () => true, decryptString: value => value.toString(), encryptString: value => Buffer.from(value) },
      shell: { openExternal: async url => {
        const target = new URL(url);
        if (target.hostname === "accounts.spotify.com") {
          assert.equal(target.searchParams.get("redirect_uri"), "http://127.0.0.1:8888/spotify/callback");
          assert.equal(target.searchParams.get("code_challenge_method"), "S256");
          authorizationChallenge = target.searchParams.get("code_challenge");
          const callback = new URL(target.searchParams.get("redirect_uri"));
          callback.searchParams.set("state", "wrong");
          callback.searchParams.set("code", "test-code");
          assert.equal((await fetch(callback)).status, 404);
          callback.searchParams.set("state", target.searchParams.get("state"));
          assert.equal((await fetch(callback)).status, 200);
          return;
        }
        assert.match(url, /^https:\/\/open.spotify.com\/track\/[a-zA-Z0-9]{22}$/);
      } },
    };
    if (name === "node:fs/promises") return {
      readFile: async () => Buffer.from(stored),
      mkdir: async () => {}, writeFile: async (_file, value) => { stored = value.toString(); },
      rename: async () => {}, rm: async () => { stored = ""; },
    };
    return require(name);
  },
  fetch: async (url, options) => {
    if (String(url).includes("/api/token")) {
      if (options.body.get("grant_type") === "authorization_code") {
        authorizationExchanges++;
        assert.equal(options.body.get("redirect_uri"), "http://127.0.0.1:8888/spotify/callback");
        assert.equal(options.body.get("code"), "test-code");
        assert.equal(require("node:crypto").createHash("sha256").update(options.body.get("code_verifier")).digest("base64url"), authorizationChallenge);
      }
      return { ok: true, json: async () => ({ access_token: "access", expires_in: 3600, refresh_token: "rotated" }) };
    }
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer access");
    assert.match(String(url), /^https:\/\/api.spotify.com\/v1\/me\/player\/queue\?uri=spotify%3Atrack%3A/);
    attempts++;
    const status = mode === "unauthorized" && attempts === 1 ? 401 : mode === "offline" ? 404 : mode === "limited" ? 429 : 204;
    return { ok: status === 204, status };
  },
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist-electron/spotifyRequests.js"), "utf8"), context);
const { SpotifyRequests } = exportsObject;
const call = (name, value) => handlers.get("spotify:" + name)(null, value);
const track = n => String(n).padStart(22, "0");
const request = n => "!sr https://open.spotify.com/track/" + track(n);

(async () => {
  const spotify = new SpotifyRequests("/virtual/pearl", () => changes++);
  await spotify.load();
  spotify.register();
  assert.equal(spotify.snapshot().redirectUri, "http://127.0.0.1:8888/spotify/callback");
  const occupied = require("node:http").createServer();
  await new Promise((resolve, reject) => { occupied.once("error", reject); occupied.listen(8888, "127.0.0.1", resolve); });
  try { assert.match((await call("connect", "a".repeat(32))).error, /Port 8888 is in use/); }
  finally { await new Promise(resolve => occupied.close(resolve)); }
  assert.equal((await call("connect", "a".repeat(32))).error, undefined);
  assert.equal(authorizationExchanges, 1);
  await call("enable", false);
  assert.equal(spotify.snapshot().connected, true);
  assert.equal(spotify.snapshot().enabled, false);
  spotify.collect("viewer", request(1));
  assert.equal(spotify.snapshot().pending.length, 0);
  assert.equal((await call("enable", true)).error, undefined);
  for (const text of ["!sr https://evil.example/track/" + track(1), "!sr https://open.spotify.com/playlist/" + track(1), "!sr spotify:track:abc", "!sr https://open.spotify.com/track/" + track(1) + "/extra"]) spotify.collect("viewer", text);
  assert.equal(spotify.snapshot().pending.length, 0);
  spotify.collect("viewer", request(1) + "?si=test");
  spotify.collect("VIEWER", request(2));
  spotify.collect("other", request(1));
  assert.equal(spotify.snapshot().pending.length, 1);
  let id = spotify.snapshot().pending[0].id;
  mode = "offline";
  assert.match((await call("approve", id)).error, /Start playback/);
  assert.equal(spotify.snapshot().pending.length, 1);
  mode = "ok";
  assert.equal((await call("approve", id)).error, undefined);
  assert.equal(spotify.snapshot().pending.length, 0);
  assert.match((await call("approve", id)).error, /no longer pending/);
  spotify.collect("viewer", request(3));
  assert.equal(spotify.snapshot().pending.length, 0);
  spotify.collect("another", "!sr spotify:track:" + track(3));
  id = spotify.snapshot().pending[0].id;
  mode = "unauthorized"; attempts = 0;
  await call("approve", id);
  assert.equal(attempts, 2);
  assert.equal(spotify.snapshot().pending.length, 0);
  assert.equal(JSON.parse(stored).refreshToken, "rotated");
  spotify.collect("limited", request(4));
  id = spotify.snapshot().pending[0].id;
  mode = "limited"; attempts = 0;
  assert.match((await call("approve", id)).error, /limiting/);
  assert.equal(attempts, 1);
  assert.equal(spotify.snapshot().pending.length, 1);
  await call("preview", id);
  await call("dismiss", id);
  for (let n = 10; n < 40; n++) spotify.collect("user" + n, request(n));
  assert.equal(spotify.snapshot().pending.length, 25);
  await call("enable", false);
  await call("dismiss", spotify.snapshot().pending[0].id);
  spotify.collect("paused", request(99));
  assert.equal(spotify.snapshot().pending.length, 24);
  await call("disconnect");
  assert.equal(spotify.snapshot().connected, false);
  assert.equal(spotify.snapshot().enabled, false);
  assert.equal(spotify.snapshot().pending.length, 0);
  assert.ok(changes > 0);
  console.log("Spotify request checks passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
