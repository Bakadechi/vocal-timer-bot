const test = require('node:test');
const assert = require('node:assert');
const { computeTicks, VoiceTimerSession } = require('../src/schedule');

test('toutes les 5 min pendant 60 min : 12 annonces, de 5 à 60 min', () => {
  const t = computeTicks({ firstInSec: 300, intervalSec: 300, durationSec: 3600 });
  assert.strictEqual(t.length, 12);
  assert.strictEqual(t[0], 300);
  assert.strictEqual(t[11], 3600);
});

test('durée non multiple : la dernière annonce reste dans la durée', () => {
  const t = computeTicks({ firstInSec: 300, intervalSec: 300, durationSec: 3720 });
  assert.strictEqual(t[t.length - 1], 3600);
});

test('première annonce décalée', () => {
  const t = computeTicks({ firstInSec: 30, intervalSec: 300, durationSec: 700 });
  assert.deepStrictEqual(t, [30, 330, 630]);
});

test('première annonce après la fin : refusé au démarrage', () => {
  const s = new VoiceTimerSession({ intervalSec: 300, durationSec: 60, message: 'x', speak: async () => {} });
  assert.throws(() => s.start(), /Aucune annonce/);
});

test('session réelle (échelle courte) : bon nombre d\'annonces, puis fin automatique', async () => {
  const times = [];
  let ended = null;
  const t0 = Date.now();
  const s = new VoiceTimerSession({
    intervalSec: 0.2, durationSec: 1.0, message: 'x',
    speak: async () => { times.push(Date.now() - t0); },
    onEnd: (r) => { ended = r; }
  }).start();
  await new Promise((r) => setTimeout(r, 1500));
  assert.strictEqual(times.length, 5);
  assert.strictEqual(ended, 'durée écoulée');
  // pas de dérive : chaque annonce proche de son horaire théorique (200, 400, ... ms)
  times.forEach((t, i) => assert.ok(Math.abs(t - 200 * (i + 1)) < 120, `annonce ${i + 1} à ${t} ms`));
  assert.strictEqual(s.stopped, true);
});

test('une annonce qui échoue ne casse pas le timer', async () => {
  let calls = 0; const errors = [];
  new VoiceTimerSession({
    intervalSec: 0.1, durationSec: 0.5, message: 'x',
    speak: async () => { calls += 1; if (calls === 2) throw new Error('boom'); },
    onError: (e) => errors.push(e.message)
  }).start();
  await new Promise((r) => setTimeout(r, 900));
  assert.strictEqual(calls, 5);
  assert.deepStrictEqual(errors, ['boom']);
});

test('stop() empêche toute annonce suivante et n\'appelle onEnd qu\'une fois', async () => {
  let calls = 0; let ends = 0;
  const s = new VoiceTimerSession({ intervalSec: 0.1, durationSec: 5, message: 'x', speak: async () => { calls += 1; }, onEnd: () => { ends += 1; } }).start();
  await new Promise((r) => setTimeout(r, 250));
  s.stop(); s.stop();
  const before = calls;
  await new Promise((r) => setTimeout(r, 400));
  assert.strictEqual(calls, before);
  assert.strictEqual(ends, 1);
});
