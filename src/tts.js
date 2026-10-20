// Synthèse vocale (voix neurales Microsoft Edge, gratuites) + cache disque.
// Chaque phrase n'est générée qu'UNE fois, puis relue depuis cache/ : pas de délai pendant le timer.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'cache');

function escapeXml(text) {
  return text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function cachePathFor(text, voice, rate) {
  const hash = crypto.createHash('sha1').update(`${voice}|${rate || ''}|${text}`).digest('hex').slice(0, 16);
  return path.join(CACHE_DIR, `${hash}.mp3`);
}

async function synthesizeToFile(text, file, { voice, rate }) {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(text), rate ? { rate } : undefined);
    const chunks = await new Promise((resolve, reject) => {
      const parts = [];
      const timeout = setTimeout(() => reject(new Error('Délai dépassé pendant la synthèse vocale (20 s).')), 20_000);
      audioStream.on('data', (c) => parts.push(c));
      audioStream.on('error', (e) => { clearTimeout(timeout); reject(e); });
      audioStream.on('end', () => { clearTimeout(timeout); resolve(parts); });
      audioStream.on('close', () => { clearTimeout(timeout); resolve(parts); });
    });
    const buffer = Buffer.concat(chunks);
    if (buffer.length < 1000) throw new Error('Le service vocal n\'a renvoyé aucun son.');
    fs.writeFileSync(file, buffer);
  } finally {
    try { tts.close(); } catch { /* rien */ }
  }
}

/**
 * Renvoie le chemin d'un fichier audio prêt à jouer pour ce texte.
 * - Si AUDIO_FILE est défini dans .env : ce fichier est utilisé tel quel (aucun appel réseau).
 * - Sinon : synthèse vocale avec cache.
 */
async function getAudioFile(text, env = process.env) {
  if (env.AUDIO_FILE) {
    const custom = path.resolve(ROOT, env.AUDIO_FILE);
    if (!fs.existsSync(custom)) throw new Error(`AUDIO_FILE introuvable : ${custom}`);
    return custom;
  }
  const voice = env.TTS_VOICE || 'fr-FR-DeniseNeural';
  const rate = env.TTS_RATE || '';
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = cachePathFor(text, voice, rate);
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) return file;
  try {
    await synthesizeToFile(text, file, { voice, rate });
  } catch (err) {
    try { fs.unlinkSync(file); } catch { /* rien */ }
    throw new Error(`Synthèse vocale impossible (${err.message}). Vérifie ta connexion internet, ou utilise AUDIO_FILE avec un mp3 à toi.`);
  }
  return file;
}

module.exports = { getAudioFile, cachePathFor, escapeXml };
