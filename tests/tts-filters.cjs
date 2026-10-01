const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exported = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/ttsFilters.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
}).outputText, { exports: exported });
const filter = exported.chatTtsFilterReason;
assert.equal(filter('hello !test https://example.com', {}), null);
const settings = { ttsBlockedPhrases: 'bad\nspoiler alert\n\nc++', ttsSkipLinks: true, ttsSkipCommands: true };
for (const message of ['BAD!', 'a bad idea', 'Spoiler   ALERT!', 'c++ tutorial'])
  assert.equal(filter(message, settings), 'blocked word or phrase', message);
for (const message of ['badge', 'badminton', 'notbad', 'hello world', 'version 1.23', 'hello!'])
  assert.equal(filter(message, settings), null, message);
for (const message of ['https://example.com/a', 'visit example.com!', 'WWW.EXAMPLE.COM', 'discord.gg/invite'])
  assert.equal(filter(message, settings), 'link', message);
assert.equal(filter('  !play music', settings), 'command');
assert.equal(filter('hello !play', settings), null);
assert.equal(filter('https://example.com', { ...settings, ttsSkipLinks: false }), null);
assert.equal(filter('!play', { ...settings, ttsSkipCommands: false }), null);
assert.equal(filter('BAD', { ttsBlockedPhrases: '  \n  ' }), null);
assert.equal(filter('ＢＡＤ', settings), 'blocked word or phrase');
assert.equal(filter('bad', JSON.parse(JSON.stringify(settings))), 'blocked word or phrase');
console.log('TTS filter tests passed.');
