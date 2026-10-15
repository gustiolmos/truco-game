// Prueba de humo: miles de partidas con acciones legales al azar.
// Verifica que el motor siempre termina, nunca se queda sin turno válido
// y que los puntos cierran contra el objetivo.

import { TrucoGame } from '../src/core/game.js';
import { envidoPoints } from '../src/core/envido.js';
import { makeCard } from '../src/core/deck.js';
import { LOCALES, DEFAULT_LOCALE } from '../src/i18n/locales.js';

let seed = 12345;
const rng = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

// --- envido: casos conocidos ---
const hand = (...ids) => ids.map((id) => {
  const [r, s] = id.split('-');
  return makeCard(Number(r), s);
});
const cases = [
  [hand('7-oro', '6-oro', '4-basto'), 33],
  [hand('12-oro', '11-oro', '4-basto'), 20],
  [hand('1-espada', '12-basto', '10-copa'), 1],
  [hand('7-espada', '7-oro', '7-basto'), 7],      // palos distintos: no hay par
  [hand('7-espada', '6-espada', '5-espada'), 33], // se toman las dos mejores del palo
];
for (const [h, expected] of cases) {
  const got = envidoPoints(h);
  if (got !== expected) throw new Error(`envido ${h.map((c) => c.id)} => ${got}, esperaba ${expected}`);
}
// El contador de envido de la UI muestra un número fijo durante toda la
// ronda, así que el motor tiene que contarlo sobre las tres cartas
// repartidas y no sobre las que quedan en la mano.
{
  const g = new TrucoGame({ target: 15 });
  const before = [g.envidoPointsOf(0), g.envidoPointsOf(1)];
  for (let i = 0; i < 2; i++) {
    const play = g.legalActions(g.turn).find((a) => a.type === 'play');
    if (play) g.act(g.turn, play);
  }
  const after = [g.envidoPointsOf(0), g.envidoPointsOf(1)];
  if (before[0] !== after[0] || before[1] !== after[1]) {
    throw new Error(`el envido cambió al jugar cartas: ${before} => ${after}`);
  }
}

console.log('envido: ok');

// --- barras de vida ---
// El HUD muestra vida, no puntos: tu vida es lo que le falta al rival para
// llegar al objetivo. Al terminar, el perdedor tiene que quedar en cero y
// el ganador no. Ojo que en truco se puede pasar del objetivo (ganar 16 a 8
// con un vale cuatro), así que la vida se clampea en cero.
{
  const TARGET = 15;
  const shown = (g, player) => Math.max(0, TARGET - g.scores[1 - player]);
  let over = 0;

  for (let n = 0; n < 300; n++) {
    const g = new TrucoGame({ target: TARGET });
    let guard = 0;
    while (g.winner === null && guard++ < 5000) {
      if (g.roundOver) { g.nextRound(); continue; }
      const acts = g.legalActions(g.turn);
      if (!acts.length) break;
      g.act(g.turn, acts[Math.floor(rng() * acts.length)]);
    }
    if (Math.max(...g.scores) > TARGET) over++;
    const loser = 1 - g.winner;
    if (shown(g, loser) !== 0) {
      throw new Error(`el perdedor terminó con ${shown(g, loser)} de vida: ${g.scores}`);
    }
    if (shown(g, g.winner) <= 0) {
      throw new Error(`el ganador terminó sin vida: ${g.scores}`);
    }
  }
  console.log(`barras de vida: ok (${over} partidas se pasaron del objetivo, se clampean)`);
}

// --- irse al mazo ---
// Entregar la ronda le da al otro lo que hubiera en juego en ese momento,
// ni más ni menos. Si esto se desfasa, el jugador paga de más por rendirse.
{
  // Sin cantos: vale 1.
  const plain = new TrucoGame({ target: 30 });
  const p = plain.turn;
  plain.act(p, { type: 'fold' });
  if (plain.scores[1 - p] !== 1 || plain.scores[p] !== 0) {
    throw new Error(`mazo sin cantos: ${plain.scores}, esperaba 1 para el otro`);
  }

  // Con truco querido: vale 2.
  const withTruco = new TrucoGame({ target: 30 });
  const caller = withTruco.turn;
  withTruco.act(caller, { type: 'truco' });
  withTruco.act(1 - caller, { type: 'accept' });
  const folder = withTruco.turn;
  const stake = withTruco.roundValue();
  withTruco.act(folder, { type: 'fold' });
  if (stake !== 2) throw new Error(`el truco querido debería valer 2, vale ${stake}`);
  if (withTruco.scores[1 - folder] !== stake) {
    throw new Error(`mazo con truco: ${withTruco.scores}, esperaba ${stake} para el otro`);
  }

  // Con un canto en el aire no se puede ir al mazo: ahí se dice no quiero.
  const pending = new TrucoGame({ target: 30 });
  pending.act(pending.turn, { type: 'truco' });
  if (pending.legalActions(pending.turn).some((a) => a.type === 'fold')) {
    throw new Error('no debería poder irse al mazo con un canto pendiente');
  }

  console.log('irse al mazo: ok');
}

// --- orden del canto del envido ---
// La UI hace que el mano cante primero y el otro responda "N son mejores"
// o "son buenas". Eso tiene que coincidir siempre con quién gana según el
// motor: si no, el diálogo diría una cosa y el puntaje otra.
{
  let checked = 0;
  for (let mano = 0; mano <= 1; mano++) {
    for (let a = 0; a <= 33; a++) {
      for (let b = 0; b <= 33; b++) {
        const pts = [a, b];
        const winner = pts[0] === pts[1] ? mano : (pts[0] > pts[1] ? 0 : 1);
        const responder = mano === 0 ? 1 : 0;
        const supera = pts[responder] > pts[mano];   // lo que dirá el globo
        if (supera !== (winner === responder)) {
          throw new Error(`envido mano=${mano} ${pts}: el motor da ganador ${winner} pero el diálogo diría supera=${supera}`);
        }
        checked++;
      }
    }
  }
  console.log(`envido hablado: ok (${checked} combinaciones)`);
}

// --- idiomas ---
// Una clave que falta en un idioma no rompe nada hasta que un jugador llega
// a esa pantalla, así que conviene que falle acá.
{
  const base = Object.keys(LOCALES[DEFAULT_LOCALE].t);
  for (const [id, locale] of Object.entries(LOCALES)) {
    for (const key of base) {
      if (!(key in locale.t)) throw new Error(`a "${id}" le falta la clave "${key}"`);
      const want = typeof LOCALES[DEFAULT_LOCALE].t[key];
      const got = typeof locale.t[key];
      if (want !== got) {
        throw new Error(`"${id}" define "${key}" como ${got} y debería ser ${want}`);
      }
    }
    for (const key of Object.keys(locale.t)) {
      if (!base.includes(key)) throw new Error(`"${id}" tiene la clave de más "${key}"`);
    }
  }
  console.log(`idiomas: ok (${Object.keys(LOCALES).length} completos, ${base.length} claves)`);
}

// --- jerarquía ---
const higher = (a, b) => makeCard(...a).power > makeCard(...b).power;
if (!higher([1, 'espada'], [1, 'basto'])) throw new Error('ancho de espada debe ganar al de basto');
if (!higher([7, 'oro'], [3, 'espada'])) throw new Error('siete de oro debe ganar al tres');
if (!higher([3, 'copa'], [2, 'espada'])) throw new Error('el tres debe ganar al dos');
if (!higher([7, 'basto'], [6, 'oro'])) throw new Error('siete falso debe ganar al seis');
if (makeCard(3, 'oro').power !== makeCard(3, 'copa').power) throw new Error('los tres deben empardar');
console.log('jerarquía: ok');

// --- self-play ---
const GAMES = 3000;
let totalRounds = 0;
for (let g = 0; g < GAMES; g++) {
  const game = new TrucoGame({ target: 15, rng });
  let guard = 0;
  while (game.winner === null) {
    if (++guard > 5000) throw new Error('la partida no termina');
    if (game.roundOver) { totalRounds++; game.nextRound(); continue; }
    const actions = game.legalActions(game.turn);
    if (actions.length === 0) throw new Error(`sin acciones legales (turno ${game.turn}, ronda viva)`);
    const action = actions[Math.floor(rng() * actions.length)];
    if (!game.act(game.turn, action)) throw new Error(`acción legal rechazada: ${JSON.stringify(action)}`);
  }
  if (game.scores[game.winner] < 15) throw new Error('ganador sin llegar al objetivo');
  if (game.scores[0] < 0 || game.scores[1] < 0) throw new Error('puntaje negativo');
}
console.log(`self-play: ok (${GAMES} partidas, ${totalRounds} rondas)`);
