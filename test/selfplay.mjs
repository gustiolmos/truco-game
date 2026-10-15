// Prueba de humo: miles de partidas con acciones legales al azar.
// Verifica que el motor siempre termina, nunca se queda sin turno válido
// y que los puntos cierran contra el objetivo.

import { TrucoGame } from '../src/core/game.js';
import { envidoPoints } from '../src/core/envido.js';
import { makeCard } from '../src/core/deck.js';

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
