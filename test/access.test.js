const test = require('node:test');
const assert = require('node:assert');
const { canControl } = require('../src/access');

test('aucun timer actif : tout le monde peut démarrer', () => {
  assert.strictEqual(canControl({ sessionChannelId: null, userChannelId: null, isManager: false }), true);
});
test('timer actif : autorisé depuis le même salon vocal', () => {
  assert.strictEqual(canControl({ sessionChannelId: 'A', userChannelId: 'A', isManager: false }), true);
});
test('timer actif : refusé depuis un autre salon, ou hors vocal', () => {
  assert.strictEqual(canControl({ sessionChannelId: 'A', userChannelId: 'B', isManager: false }), false);
  assert.strictEqual(canControl({ sessionChannelId: 'A', userChannelId: null, isManager: false }), false);
});
test('timer actif : un modérateur (Gérer le serveur) peut toujours reprendre la main', () => {
  assert.strictEqual(canControl({ sessionChannelId: 'A', userChannelId: 'B', isManager: true }), true);
  assert.strictEqual(canControl({ sessionChannelId: 'A', userChannelId: null, isManager: true }), true);
});
