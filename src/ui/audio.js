// Bus de audio.
//
// Web Audio y no <audio>: los sonidos se pisan entre sí (una carta cae
// mientras el contador suma puntos) y <audio> no deja sonar dos veces el
// mismo clip sin cortar el anterior. Además la latencia de play() se nota.
//
// Todo es opcional: si el navegador no deja crear el contexto, o un archivo
// no carga, el juego sigue andando mudo. El audio nunca puede romper la
// partida.

const BASE = 'assets/audio/';

// Varias tomas del mismo gesto. Repetir el clip exacto en cada carta suena a
// máquina; alternar entre tres y variar el tono lo disimula.
const SOUNDS = {
  deal: ['deal-1', 'deal-2', 'deal-3'],
  play: ['play-1', 'play-2', 'play-3'],
  shuffle: ['shuffle'],
  truco: ['shout-truco'],
  envido: ['shout-envido'],
  accept: ['accept'],
  reject: ['reject'],
  trickWin: ['trick-win'],
  trickLose: ['trick-lose'],
  point: ['point'],
  click: ['click'],
  hover: ['hover'],
  gameWin: ['game-win'],
  gameLose: ['game-lose'],
};

// Mezcla. Los sonidos de carta van seguidos y muy a menudo, así que van más
// abajo que los cantos, que tienen que pegar.
const GAIN = {
  deal: 0.5, play: 0.7, shuffle: 0.6,
  truco: 0.9, envido: 0.85,
  accept: 0.7, reject: 0.7,
  trickWin: 0.6, trickLose: 0.55,
  point: 0.65,
  click: 0.4, hover: 0.18,
  gameWin: 0.9, gameLose: 0.8,
};

const MUTED_KEY = 'truco.muted';
const VOLUME_KEY = 'truco.volume';

const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, String(value)); } catch { /* modo privado */ }
};

class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buffers = new Map();
    this.muted = read(MUTED_KEY, '0') === '1';
    const vol = Number(read(VOLUME_KEY, '0.8'));
    this.volume = Number.isFinite(vol) ? Math.min(1, Math.max(0, vol)) : 0.8;
    this.ready = false;
  }

  // Los navegadores no dejan sonar nada hasta que el usuario toca algo, así
  // que el contexto se crea en el primer gesto, no al cargar la página.
  async unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.#level();
      this.master.connect(this.ctx.destination);
      await this.#loadAll();
      this.ready = true;
    } catch {
      this.ctx = null; // sin audio, pero el juego sigue
    }
  }

  async #loadAll() {
    const names = [...new Set(Object.values(SOUNDS).flat())];
    await Promise.all(names.map(async (name) => {
      try {
        const res = await fetch(`${BASE}${name}.ogg`);
        if (!res.ok) return;
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(name, buf);
      } catch { /* ese sonido queda mudo, nada más */ }
    }));
  }

  // `spread` desafina un poco cada toma: es lo que evita que diez cartas
  // seguidas suenen a metralleta.
  // `rate` baja o sube el tono a propósito: un canto más grande suena más
  // grave, y es la forma barata de que un mismo clip tenga escalones.
  play(key, { volume = 1, spread = 0.06, rate = 1 } = {}) {
    if (!this.ready || this.muted) return;
    const variants = SOUNDS[key];
    if (!variants) return;
    const name = variants[(Math.random() * variants.length) | 0];
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate + (Math.random() - 0.5) * 2 * spread;

    const gain = this.ctx.createGain();
    gain.gain.value = (GAIN[key] ?? 0.7) * volume;

    src.connect(gain).connect(this.master);
    src.start();
  }

  #level() { return this.muted ? 0 : this.volume; }

  #applyLevel() {
    if (this.master) this.master.gain.value = this.#level();
  }

  setMuted(muted) {
    this.muted = muted;
    write(MUTED_KEY, muted ? '1' : '0');
    this.#applyLevel();
  }

  // Volumen 0..1. Mover la perilla a cero equivale a silenciar, pero se
  // guardan por separado: si subís el volumen con el sonido apagado y después
  // lo prendés, tiene que sonar a lo que elegiste.
  setVolume(volume) {
    this.volume = Math.min(1, Math.max(0, volume));
    write(VOLUME_KEY, this.volume);
    this.#applyLevel();
  }

  toggle() {
    this.setMuted(!this.muted);
    if (!this.muted) this.play('click');
    return this.muted;
  }
}

export const audio = new AudioBus();

// Un solo enganche para el primer gesto, sea del tipo que sea.
export function armAudio() {
  const once = () => audio.unlock();
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(ev, once, { once: true, passive: true });
  }
}
