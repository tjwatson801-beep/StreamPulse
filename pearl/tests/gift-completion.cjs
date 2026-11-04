const assert = require('node:assert/strict');
const { TikToolProvider } = require('../dist-electron/providers/TikToolProvider');
const provider = new TikToolProvider('test');
const events = [];
provider.onEvent(event => events.push(event));
let id = 0;
function gift(fields) {
  provider.handle({ event: 'gift', data: { msgId: String(++id), giftName: 'Heart Me', user: { uniqueId: 'tester' }, ...fields } });
  return events.at(-1);
}
assert.equal(gift({ giftType: 0, repeatEnd: false }).comboComplete, true, 'Non-combo gifts trigger without a combo-end frame');
assert.equal(gift({ giftType: '0', repeatEnd: false }).comboComplete, true);
assert.equal(gift({ giftType: 1, giftName: 'Rose', repeatCount: 5, repeatEnd: false }).comboComplete, false, 'Active Rose combos must wait');
assert.equal(gift({ giftType: 1, giftName: 'Rose', repeatCount: 5, repeatEnd: true }).comboComplete, true);
assert.equal(gift({ repeatEnd: false }).comboComplete, false, 'Missing gift type preserves existing combo handling');
assert.equal(gift({}).comboComplete, true);
console.log('Gift completion regression checks passed');