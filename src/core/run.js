// Corrida: el contenedor roguelike alrededor del motor de truco.
//
// Una corrida son ocho antes. Cada ante es una partida corta: hay que llegar
// a un objetivo de puntos antes de que se acaben las manos, con el rival
// anotando contra el mismo objetivo. Si el rival llega primero, o si las
// manos se terminan sin haber llegado, la corrida se termina ahí.
//
// Entre antes se pasa por la tienda, que todavía está vacía: es el hueco
// donde después viven los modificadores. Por eso el estado ya lleva dinero y
// una lista de equipados aunque nada los llene: el resto del juego puede
// empezar a leerlos desde hoy.
//
// Este archivo no toca el DOM: recibe resultados y devuelve estado, así se
// puede testear sin navegador.

import { MODS, MOD_LIMIT, modById } from './mods.js';

export const ANTE_COUNT = 8;

// Los antes son datos, no una fórmula: una curva de dificultad se afina a
// mano, ante por ante, y una fórmula bonita obliga a pelearse con ella.
// `goal` son los puntos a los que se juega ese ante; `hands` es el techo de
// manos (rondas) para llegar. Una mano rinde entre 1 y 4 puntos, así que el
// techo deja aire al principio y se va cerrando.
export const ANTES = [
  { goal: 5, hands: 5 },
  { goal: 7, hands: 6 },
  { goal: 9, hands: 6 },
  { goal: 11, hands: 7 },
  { goal: 14, hands: 8 },
  { goal: 17, hands: 8 },
  { goal: 20, hands: 9 },
  { goal: 24, hands: 10 },
];

// `ante` es 1..8 de cara afuera: así se lee igual en la pantalla, en el
// resumen y en los textos.
export const anteConfig = (ante) => ANTES[Math.min(ante, ANTE_COUNT) - 1];

// Dinero del ante ganado: una base que crece con el ante y una propina por
// cada mano que sobró. Premiar el margen es lo que hace que cerrar rápido
// valga la pena en vez de estirar la partida.
export const anteReward = (ante, handsLeft) => 3 + ante + Math.max(0, handsLeft);

// ---- semilla ---------------------------------------------------------

// La semilla se muestra y se escribe a mano, así que es corta, en
// mayúsculas y sin caracteres que se confundan al dictarla: ni O ni 0, ni I
// ni 1.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SEED_LENGTH = 6;

export function makeSeed(rng = Math.random) {
  let out = '';
  for (let i = 0; i < SEED_LENGTH; i++) out += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return out;
}

// Normaliza lo que escribió el jugador: lo que no esté en el alfabeto se
// cae, y las letras que se confunden se mandan a la que sí existe.
const CONFUSED = { O: 'Q', '0': 'Q', I: 'J', '1': 'J' };

export function normalizeSeed(text) {
  let out = '';
  for (const raw of String(text ?? '').toUpperCase()) {
    const ch = CONFUSED[raw] ?? raw;
    if (ALPHABET.includes(ch)) out += ch;
    if (out.length === SEED_LENGTH) break;
  }
  return out;
}

export const isSeed = (text) => normalizeSeed(text).length === SEED_LENGTH;

// Hash de cadena a entero (xmur3) y generador de 32 bits (mulberry32). Dos
// funciones conocidas y cortas: lo que importa es que de la misma semilla
// salga siempre la misma corrida, en cualquier navegador.
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Un generador por ante, no uno para toda la corrida: si el jugador cierra
// la pestaña a mitad de un ante, el ante vuelve a empezar con el mismo
// reparto. Si el azar fuera un hilo único, cerrar y volver cambiaría las
// cartas y la semilla dejaría de significar nada.
export const rngFor = (seed, ante) => mulberry32(xmur3(`${seed}#${ante}`)());

// La oferta de la tienda sale de la misma semilla pero de otro hilo, para
// que repartir cartas y ofrecer modificadores no se pisen: si fueran el
// mismo hilo, cambiar lo que se ofrece cambiaría los repartos siguientes.
export const offerRng = (seed, ante) => mulberry32(xmur3(`${seed}#tienda#${ante}`)());

// Cuántos se ofrecen por tienda, y cuánto pesa cada rareza en el sorteo.
// Lo común sale seguido y lo épico es el hallazgo.
export const SHOP_OFFER = 3;
const WEIGHTS = { common: 6, rare: 3, epic: 1 };

// Oferta de una tienda: tres modificadores distintos, sin ofrecer los que ya
// llevás puestos. Depende sólo de la semilla y del ante, así que es la misma
// oferta cada vez que se entra a esa tienda, incluso si se cerró el juego.
export function offerFor(seed, ante, owned = []) {
  const rng = offerRng(seed, ante);
  const pool = MODS.filter((m) => !owned.includes(m.id));
  const out = [];
  while (out.length < SHOP_OFFER && pool.length) {
    const total = pool.reduce((sum, m) => sum + WEIGHTS[m.rarity], 0);
    let roll = rng() * total;
    let i = 0;
    while (i < pool.length - 1 && (roll -= WEIGHTS[pool[i].rarity]) > 0) i++;
    out.push(pool.splice(i, 1)[0].id);
  }
  return out;
}

// ---- estado de la corrida --------------------------------------------

export const PHASES = ['ante', 'shop', 'won', 'lost'];

export class Run {
  constructor({ seed = makeSeed(), ante = 1, money = 0, mods = [], phase = 'ante', history = [] } = {}) {
    this.seed = seed;
    this.ante = ante;
    this.money = money;
    this.mods = mods;        // modificadores equipados; todavía nada los llena
    this.phase = phase;
    this.history = history;  // un registro por ante jugado, para el resumen
  }

  get config() { return anteConfig(this.ante); }
  get goal() { return this.config.goal; }
  get hands() { return this.config.hands; }
  get over() { return this.phase === 'won' || this.phase === 'lost'; }
  get antesCleared() { return this.history.filter((h) => h.won).length; }

  // El azar del ante en curso. El motor lo recibe tal cual.
  rng() { return rngFor(this.seed, this.ante); }

  // Cierra el ante con lo que pasó en la mesa: `handsPlayed` son las manos
  // que se jugaron y `scores` el puntaje final [jugador, rival].
  //
  // El ante se gana llegando al objetivo. Se pierde de dos maneras: porque
  // el rival llegó antes, o porque se acabaron las manos sin llegar.
  finishAnte({ scores, handsPlayed }) {
    if (this.phase !== 'ante') return null;
    const [mine, theirs] = scores;
    const won = mine >= this.goal && mine > theirs;
    const handsLeft = Math.max(0, this.hands - handsPlayed);
    const reason = won ? 'goal' : (theirs >= this.goal ? 'rival' : 'hands');
    const earned = won ? anteReward(this.ante, handsLeft) : 0;

    this.history.push({
      ante: this.ante, won, reason, scores: [mine, theirs],
      goal: this.goal, handsPlayed, earned,
    });
    this.money += earned;

    if (!won) this.phase = 'lost';
    else if (this.ante === ANTE_COUNT) this.phase = 'won';
    else this.phase = 'shop';

    return { won, reason, earned, handsLeft };
  }

  // Lo que ofrece la tienda de este ante. Se recalcula de la semilla en vez
  // de guardarse: así lo guardado no puede quedar en desacuerdo con ella.
  offer() { return offerFor(this.seed, this.ante, this.mods); }

  get full() { return this.mods.length >= MOD_LIMIT; }

  // Llevarse uno de la oferta. Por ahora sale gratis y es uno por tienda:
  // los precios llegan con la tienda de verdad, y el dinero ya se acumula
  // esperándolos.
  takeMod(id) {
    if (this.phase !== 'shop' || this.full) return false;
    if (!this.offer().includes(id) || !modById(id)) return false;
    this.mods.push(id);
    return true;
  }

  // Salir de la tienda: arranca el ante siguiente.
  leaveShop() {
    if (this.phase !== 'shop') return false;
    this.ante++;
    this.phase = 'ante';
    return true;
  }

  // Resumen de fin de corrida, lo único que necesita la pantalla final.
  summary() {
    return {
      seed: this.seed,
      won: this.phase === 'won',
      ante: this.ante,
      antes: ANTE_COUNT,
      cleared: this.antesCleared,
      money: this.money,
      last: this.history[this.history.length - 1] ?? null,
    };
  }

  toJSON() {
    const { seed, ante, money, mods, phase, history } = this;
    return { v: 1, seed, ante, money, mods, phase, history };
  }

  // Lo guardado viene de otra sesión, y puede ser de una versión anterior o
  // estar editado a mano, así que se valida antes de confiar: una corrida en
  // un ante que no existe colgaría la pantalla.
  static fromJSON(data) {
    if (!data || data.v !== 1) return null;
    const { seed, ante, money, mods, phase, history } = data;
    if (typeof seed !== 'string' || seed.length !== SEED_LENGTH || normalizeSeed(seed) !== seed) return null;
    if (!Number.isInteger(ante) || ante < 1 || ante > ANTE_COUNT) return null;
    if (!Number.isFinite(money) || money < 0) return null;
    if (!PHASES.includes(phase)) return null;
    if (!Array.isArray(mods) || !Array.isArray(history)) return null;
    // Los modificadores guardados son ids: los que ya no existan se caen
    // solos, pero una lista con basura adentro no entra.
    if (mods.some((id) => typeof id !== 'string') || mods.length > MOD_LIMIT) return null;
    return new Run({ seed, ante, money, mods, phase, history });
  }
}

// ---- persistencia ----------------------------------------------------

// La corrida en curso sobrevive a cerrar la pestaña. No se guarda la mesa:
// si se cierra a mitad de un ante, el ante vuelve a empezar desde cero con
// el mismo reparto, que para eso el azar va por ante.
export const RUN_KEY = 'truco.run';

const defaultStore = () => {
  try { return globalThis.localStorage ?? null; } catch { return null; }   // modo privado
};

export function saveRun(run, store = defaultStore()) {
  if (!store) return false;
  try {
    if (!run || run.over) store.removeItem(RUN_KEY);
    else store.setItem(RUN_KEY, JSON.stringify(run.toJSON()));
    return true;
  } catch { return false; }
}

export function loadRun(store = defaultStore()) {
  if (!store) return null;
  try {
    const raw = store.getItem(RUN_KEY);
    return raw ? Run.fromJSON(JSON.parse(raw)) : null;
  } catch { return null; }
}

export function clearRun(store = defaultStore()) {
  if (!store) return;
  try { store.removeItem(RUN_KEY); } catch { /* modo privado */ }
}
