const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('electron/main.ts', 'utf8');
const functions = source.slice(source.indexOf('function clearReconnect()'), source.indexOf('async function createWindow()'));
function setup() {
  const messages = [], timers = new Map();
  let onStatus;
  const current = { onEvent() {}, onStatus(handler) { onStatus = handler; } };
  const context = vm.createContext({
    provider: current, reconnectEnabled: true, closing: false, reconnectTimer: null,
    reconnectAttempts: 0, activeUsername: 'tester', activeProviderKind: 'tikfinity', connectRevision: 0,
    send: (_, message) => messages.push(message), diagnosticLog() {},
    setTimeout: (fn, ms) => { const id = timers.size + 1; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    readKey: async () => 'test',
    likesTracker: { startStream() {} },
    TikFinityProvider: class { onEvent() {} onStatus() {} async connect() { throw new Error('Unexpected server response: 429'); } }
  });
  vm.runInContext(ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  vm.runInContext('bind(provider)', context);
  return { context, messages, timers, status: (...args) => onStatus(...args) };
}
async function main() {
  const starting = setup();
  starting.status('disconnected', 'Disconnected');
  assert.equal(starting.timers.size, 1);
  starting.status('connecting', 'Connecting to LIVE');
  assert.equal(starting.timers.size, 0, 'A new connection cancels the retry scheduled by provider initialization');
  starting.status('connecting', 'TikTool reached; waiting for LIVE room confirmation');
  assert.equal(starting.timers.size, 0, 'Waiting for room confirmation must not restart the socket');
  starting.status('error', 'Room confirmation timed out');
  assert.equal(starting.timers.size, 1, 'An actual confirmation failure still retries');
  starting.status('connected', 'LIVE room confirmed');
  assert.equal(starting.timers.size, 0);
  assert.equal(starting.context.reconnectAttempts, 0);
  const run = setup();
  run.status('error', 'Network disconnected');
  assert.equal(run.timers.size, 1, 'Transient errors still schedule a retry');
  run.status('error', 'TikTool closed: Rate Limit Exceeded. Sandbox allows 60 WebSocket connections per hour.');
  assert.equal(run.timers.size, 0, 'Rate limit cancels any pending retry');
  assert.equal(run.context.reconnectEnabled, false);
  assert.match(run.messages.at(-1).message, /Automatic reconnect is paused/);
  run.status('disconnected', 'Disconnected');
  assert.equal(run.timers.size, 0, 'Subsequent close cannot restart retries');
  const rejected = setup();
  rejected.context.provider = null;
  const result = await vm.runInContext('connectProvider("tester", true)', rejected.context);
  assert.equal(result.ok, false);
  assert.equal(rejected.timers.size, 0, 'HTTP 429 rejection does not retry');
  assert.equal(rejected.messages.at(-1).status, 'error');
  console.log('Reconnect rate-limit checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });