// Oponente heurístico. No hace búsqueda: evalúa fuerza de mano, contexto de
// la ronda y mete algo de ruido para que mienta de vez en cuando.

import { envidoPoints } from './envido.js';

const CPU = 1;

// Fuerza normalizada 0..1 de una carta (power va de 0 a 13).
const strength = (card) => card.power / 13;

function handStrength(hand) {
  if (hand.length === 0) return 0;
  const sorted = hand.map(strength).sort((a, b) => b - a);
  // La carta más alta manda, pero tener respaldo cuenta.
  return sorted[0] * 0.6 + (sorted[1] ?? 0) * 0.28 + (sorted[2] ?? 0) * 0.12;
}

export function chooseAction(game, rng = Math.random) {
  const actions = game.legalActions(CPU);
  if (actions.length === 0) return null;

  const hand = game.hands[CPU];
  const force = handStrength(hand);
  const envido = envidoPoints(hand.concat(game.played[CPU]));
  const noise = () => (rng() - 0.5) * 0.18;
  const desperation = (game.scores[0] - game.scores[CPU]) / game.target; // >0 si va perdiendo

  // --- responder a un canto pendiente ---------------------------------
  if (game.pending) {
    if (game.pending.kind === 'envido') {
      const quality = (envido - 20) / 13 + noise() + desperation * 0.25;
      const raises = actions.filter((a) => a.type === 'envido');
      if (quality > 0.72 && raises.length) {
        return raises.find((a) => a.call === 'real-envido') ?? raises[0];
      }
      return quality > 0.08 ? { type: 'accept' } : { type: 'reject' };
    }
    const quality = force + noise() + desperation * 0.2 - game.trucoLevel * 0.06;
    const canRaise = actions.some((a) => a.type === 'truco');
    if (quality > 0.78 && canRaise) return { type: 'truco' };
    return quality > 0.42 ? { type: 'accept' } : { type: 'reject' };
  }

  // --- cantar envido ---------------------------------------------------
  const envidoCalls = actions.filter((a) => a.type === 'envido');
  if (envidoCalls.length) {
    const quality = (envido - 22) / 12 + noise() + desperation * 0.2;
    if (quality > 0.55) return { type: 'envido', call: 'real-envido' };
    if (quality > 0.1) return { type: 'envido', call: 'envido' };
  }

  // --- cantar truco ----------------------------------------------------
  if (actions.some((a) => a.type === 'truco')) {
    const winning = game.trickResults.filter((r) => r === CPU).length;
    const quality = force + winning * 0.22 + noise() + desperation * 0.25;
    if (quality > 0.74) return { type: 'truco' };
  }

  // --- tirar carta -----------------------------------------------------
  return { type: 'play', cardId: pickCard(game, hand).id };
}

function pickCard(game, hand) {
  const sorted = hand.slice().sort((a, b) => a.power - b.power);
  const rival = game.played[0][game.trick]; // carta del humano en esta mano, si ya tiró

  if (rival) {
    // La más barata que gane; si ninguna gana, tiro la basura.
    const winner = sorted.find((c) => c.power > rival.power);
    return winner ?? sorted[0];
  }
  // Soy mano en el truco: abro fuerte en la primera, administro después.
  if (game.trick === 0) return sorted[sorted.length - 1];
  const leading = game.trickResults[0] === CPU;
  return leading ? sorted[0] : sorted[sorted.length - 1];
}
