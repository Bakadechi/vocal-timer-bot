const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { getAudioFile, cachePathFor, escapeXml } = require('../src/tts');

test('escapeXml protège le SSML', () => {
  assert.strictEqual(escapeXml('a<b>&"c\''), 'a&lt;b&gt;&amp;&quot;c&apos;');
});

test('cache : un fichier déjà généré est relu sans appel réseau', async () => {
  const text = 'phrase de test cache';
  const file = cachePathFor(text, 'fr-FR-DeniseNeural', '');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.alloc(5000, 1));
  try {
    const got = await getAudioFile(text, { TTS_VOICE: 'fr-FR-DeniseNeural' });
    assert.strictEqual(got, file);
  } finally { fs.unlinkSync(file); }
});

test('AUDIO_FILE : un son perso est utilisé tel quel, et un chemin faux donne une erreur claire', async () => {
  const f = path.join(__dirname, 'perso.mp3');
  fs.writeFileSync(f, 'x');
  try {
    assert.strictEqual(await getAudioFile('peu importe', { AUDIO_FILE: 'test/perso.mp3' }), f);
    await assert.rejects(getAudioFile('x', { AUDIO_FILE: 'audio/inexistant.mp3' }), /AUDIO_FILE introuvable/);
  } finally { fs.unlinkSync(f); }
});

test('lecture audio : ffmpeg + opus produisent des paquets à partir d\'un mp3', async () => {
  const ffmpeg = require('ffmpeg-static');
  const mp3 = path.join(__dirname, 'beep.mp3');
  execFileSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=800:duration=1', '-ac', '1', '-ar', '24000', mp3], { stdio: 'ignore' });
  try {
    const { createAudioResource } = require('@discordjs/voice');
    const res = createAudioResource(mp3);
    let packets = 0;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('aucun paquet audio')), 8000);
      res.playStream.on('readable', () => {
        let chunk; while ((chunk = res.playStream.read()) !== null) packets += 1;
        if (packets >= 20) { clearTimeout(timer); resolve(); }
      });
      res.playStream.on('error', reject);
    });
    assert.ok(packets >= 20, `${packets} paquets`);
  } finally { fs.unlinkSync(mp3); }
});

test('la commande /timer est valide pour Discord', () => {
  const { commands } = require('../src/commands');
  const timerCmd = commands[0];
  assert.strictEqual(timerCmd.name, 'timer');
  assert.deepStrictEqual(timerCmd.options.map((o) => o.name), ['start', 'stop', 'status', 'test']);
  const start = timerCmd.options[0].options.map((o) => o.name);
  assert.deepStrictEqual(start, ['intervalle', 'duree', 'message', 'premiere_annonce']);
});
