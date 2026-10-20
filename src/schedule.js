// Planning des annonces : fonction pure + session avec timers à horodatages absolus
// (pas de setInterval brut : pas de dérive sur plusieurs dizaines de minutes).

/**
 * Décalages (en secondes depuis le démarrage) de chaque annonce.
 * Ex. firstInSec=300, intervalSec=300, durationSec=3600 -> 300, 600, ..., 3600
 */
function computeTicks({ firstInSec, intervalSec, durationSec }) {
  if (!(intervalSec > 0)) throw new Error('intervalSec doit être > 0');
  const ticks = [];
  for (let t = firstInSec; t <= durationSec + 1e-9; t += intervalSec) ticks.push(Number(t.toFixed(3)));
  return ticks;
}

class VoiceTimerSession {
  /**
   * @param {object} o
   * @param {number} o.intervalSec  secondes entre deux annonces
   * @param {number} o.durationSec  durée totale du timer en secondes
   * @param {number} [o.firstInSec] délai avant la 1re annonce (défaut : intervalSec)
   * @param {string} o.message      texte annoncé (affichage / statut)
   * @param {() => Promise<void>} o.speak  joue l'annonce
   * @param {(reason: string) => void} [o.onEnd]  appelé une seule fois à la fin
   * @param {(err: Error) => void} [o.onError]    erreur pendant une annonce (le timer continue)
   */
  constructor({ intervalSec, durationSec, firstInSec, message, speak, onEnd = () => {}, onError = () => {} }) {
    this.intervalSec = intervalSec;
    this.durationSec = durationSec;
    this.firstInSec = firstInSec ?? intervalSec;
    this.message = message;
    this.speak = speak;
    this.onEnd = onEnd;
    this.onError = onError;
    this.ticks = computeTicks({ firstInSec: this.firstInSec, intervalSec, durationSec });
    this.index = 0;
    this.announced = 0;
    this.startAt = 0;
    this.stopped = false;
    this.timer = null;
    this.endTimer = null;
  }

  get endAt() { return this.startAt + this.durationSec * 1000; }

  get nextAt() {
    return this.index < this.ticks.length ? this.startAt + this.ticks[this.index] * 1000 : null;
  }

  start() {
    if (this.ticks.length === 0) throw new Error('Aucune annonce possible : la durée est plus courte que le délai de la première annonce.');
    this.startAt = Date.now();
    this.endTimer = setTimeout(() => this.stop('durée écoulée'), Math.max(0, this.endAt - Date.now() + 250));
    this._scheduleNext();
    return this;
  }

  _scheduleNext() {
    if (this.stopped || this.nextAt === null) return;
    const delay = Math.max(0, this.nextAt - Date.now());
    this.timer = setTimeout(async () => {
      if (this.stopped) return;
      this.index += 1;
      try {
        await this.speak();
        this.announced += 1;
      } catch (err) {
        this.onError(err);
      }
      this._scheduleNext();
    }, delay);
  }

  stop(reason = 'arrêt manuel') {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.endTimer);
    this.onEnd(reason);
  }
}

module.exports = { computeTicks, VoiceTimerSession };
