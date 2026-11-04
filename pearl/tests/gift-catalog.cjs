const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { parseGiftCatalog, fetchGiftCatalog } = require("../dist-electron/giftCatalog");
function loadTs(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, { exports });
  return exports;
}
async function main() {
  const full = parseGiftCatalog({ status_code: 0, data: { gifts: [
    { name: "Rose", icon: { url_list: ["https://example.com/rose.png"] } },
    { name: " rose " }, { name: "Galaxy", icon_url: "https://example.com/galaxy.png" },
    { name: "Bad image", icon: "javascript:alert(1)" }, { name: " " }, null
  ] } });
  assert.equal(full.ok, true);
  assert.equal(full.sample, false);
  assert.equal(full.gifts.length, 3);
  assert.equal(full.gifts[0].imageUrl, "https://example.com/rose.png");
  assert.equal(full.gifts[2].imageUrl, undefined);
  assert.equal(parseGiftCatalog({ data: { gifts: [] } }).ok, false);
  assert.equal(parseGiftCatalog({ status_code: 1, data: { gifts: [{ name: "Rose" }] } }).ok, false);
  assert.equal(parseGiftCatalog({ data: {} }).ok, false);
  assert.equal(parseGiftCatalog({ is_sample: true, data: { gifts: [{ name: "Rose" }] } }).sample, true);
  assert.equal(parseGiftCatalog({ source: "sample", data: { gifts: [{ name: "Rose" }] } }).sample, true);
  let calls = 0;
  const success = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.tik.tools/webcast/gift_info");
    assert.equal(options.headers["x-api-key"], "test-key");
    assert.equal(options.redirect, "error");
    return { ok: true, json: async () => ({ data: { gifts: [{ name: "Rose" }] } }) };
  };
  assert.equal((await fetchGiftCatalog("", success)).ok, false);
  assert.equal(calls, 0);
  assert.equal((await fetchGiftCatalog(" test-key ", success)).ok, true);
  for (const status of [401, 403, 429, 500]) {
    assert.equal((await fetchGiftCatalog("test-key", async () => ({ ok: false, status }))).ok, false);
  }
  const failure = await fetchGiftCatalog("test-key", async () => { throw new Error("secret test-key"); });
  assert.equal(failure.ok, false);
  assert.equal(failure.error.includes("test-key"), false);
  const { defaults } = loadTs("src/types.ts");
  const { mergeGiftCatalog, giftOptions } = loadTs("src/giftCatalog.ts");
  const saved = { ...defaults, giftCatalog: [{ name: "Old gift", imageUrl: "https://example.com/old.png" }], reactions: [{ giftName: "Legacy gift" }] };
  const updated = mergeGiftCatalog(saved, full.gifts, false, 123);
  assert.equal(updated.giftCatalogUpdatedAt, 123);
  assert.equal(updated.giftCatalogSample, false);
  assert.equal(updated.reactions, saved.reactions);
  assert.equal(giftOptions(updated).length, 5);
  assert.equal(saved.giftCatalog.length, 1);
  assert.equal(mergeGiftCatalog(updated, [{ name: "ROSE" }], true).giftCatalog.find(g => g.name === "ROSE").imageUrl, "https://example.com/rose.png");
  console.log("Passed: catalog formats, sample detection, authenticated requests, failures, safe images, saved gifts, and existing reactions.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });

