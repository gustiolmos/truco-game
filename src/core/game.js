// Motor del Truco argentino 1v1 (sin flor). Sin dependencias de UI:
// recibe acciones, emite eventos y expone el estado para que lo pinte quien quiera.

import { makeDeck, shuffle } from './deck.js';
import { envidoPoints, envidoValues, envidoRaises } from './envido.js';

export const TRUCO_CHAIN = [
  { key: 'truco', accept: 2, reject: 1 },
  { key: 'retruco', accept: 3, reject: 2 },
  { key: 'vale-cuatro', accept: 4, reject: 3 },
];

export const HUMAN = 0;
export const CPU = 1;

export class TrucoGame {
  constructor({ target = 15, rng = Math.random } = {}) {
    this.target = target;
    this.rng = rng;
    this.scores = [0, 0];
    this.mano = HUMAN; // quién es mano en la ronda actual
    this.listeners = new Set();
    this.winner = null;
    this.startRound();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, data = {}) { for (const fn of this.listeners) fn({ type, ...data }); }

  startRound() {
    const deck = shuffle(makeDeck(), this.rng);
    this.hands = [deck.slice(0, 3), deck.slice(3, 6)];
    this.played = [[], []];      // cartas jugadas por cada jugador
    this.trickResults = [];      // 0 | 1 | 'parda' por mano jugada
    this.trick = 0;
    this.trickLeader = this.mano;
    this.turn = this.mano;
    this.envidoChain = [];
    this.envidoDone = false;
    this.trucoLevel = 0;         // 0 = sin truco cantado
    this.trucoAccepted = false;
    this.trucoCaller = null;
    this.pending = null;         // { kind: 'envido'|'truco', by }
    this.roundOver = false;
    this.emit('round-start', { mano: this.mano });
  }

  // ---- consultas ------------------------------------------------------

  envidoPointsOf(player) {
    return envidoPoints(this.hands[player].concat(this.played[player]));
  }

  legalActions(player) {
    if (this.roundOver || this.winner !== null || player !== this.turn) return [];
    if (this.pending) {
      const raises = this.pending.kind === 'envido'
        ? envidoRaises(this.envidoChain).map((k) => ({ type: 'envido', call: k }))
        : (this.trucoLevel < 3 ? [{ type: 'truco' }] : []);
      return [{ type: 'accept' }, { type: 'reject' }, ...raises];
    }
    const out = this.hands[player].map((c) => ({ type: 'play', cardId: c.id }));
    // El envido sólo vive en la primera mano, antes de que se resuelva.
    if (!this.envidoDone && this.trick === 0) {
      for (const call of envidoRaises([])) out.push({ type: 'envido', call });
    }
    const canTruco = this.trucoLevel === 0
      ? true
      : this.trucoAccepted && this.trucoCaller !== player && this.trucoLevel < 3;
    if (canTruco) out.push({ type: 'truco' });
    // Irse al mazo: entregar la ronda. Con un canto en el aire no aplica,
    // porque ahí lo que corresponde es no querer.
    out.push({ type: 'fold' });
    return out;
  }

  isLegal(player, action) {
    return this.legalActions(player).some((a) =>
      a.type === action.type && a.cardId === action.cardId && a.call === action.call);
  }

  // ---- acciones -------------------------------------------------------

  act(player, action) {
    if (!this.isLegal(player, action)) return false;
    switch (action.type) {
      case 'play': return this.playCard(player, action.cardId);
      case 'envido': return this.callEnvido(player, action.call);
      case 'truco': return this.callTruco(player);
      case 'accept': return this.accept(player);
      case 'reject': return this.reject(player);
      case 'fold': return this.fold(player);
      default: return false;
    }
  }

  // Irse al mazo: el otro se lleva lo que haya en juego en ese momento.
  // Lo del envido, si se jugó, ya se cobró aparte.
  fold(player) {
    this.emit('fold', { player });
    this.endRound(1 - player);
    return true;
  }

  playCard(player, cardId) {
    const idx = this.hands[player].findIndex((c) => c.id === cardId);
    const card = this.hands[player].splice(idx, 1)[0];
    this.played[player].push(card);
    this.emit('card-played', { player, card });

    if (this.played[0].length === this.played[1].length) this.resolveTrick();
    else this.turn = 1 - player;
    return true;
  }

  resolveTrick() {
    const a = this.played[0][this.trick];
    const b = this.played[1][this.trick];
    const result = a.power === b.power ? 'parda' : (a.power > b.power ? 0 : 1);
    this.trickResults.push(result);
    this.envidoDone = true;
    this.emit('trick-end', { trick: this.trick, result, cards: [a, b] });

    const winner = this.roundWinner();
    if (winner !== null) return this.endRound(winner);

    this.trick++;
    this.trickLeader = result === 'parda' ? this.trickLeader : result;
    this.turn = this.trickLeader;
  }

  roundWinner() {
    const r = this.trickResults;
    const wins = [0, 1].map((p) => r.filter((x) => x === p).length);
    if (wins[0] === 2) return 0;
    if (wins[1] === 2) return 1;
    if (r.length < 2) return null;
    if (r.includes('parda')) {
      // Con pardas de por medio: gana quien ganó la primera mano no parda.
      const decisive = r.find((x) => x !== 'parda');
      if (decisive !== undefined) return decisive;
      return r.length === 3 ? this.mano : null; // tres pardas: gana el mano
    }
    return null;
  }

  callEnvido(player, call) {
    this.envidoChain.push(call);
    this.pending = { kind: 'envido', by: player };
    this.turn = 1 - player;
    this.emit('call', { player, kind: 'envido', call });
    return true;
  }

  callTruco(player) {
    this.trucoLevel++;
    this.trucoCaller = player;
    this.trucoAccepted = false;
    this.pending = { kind: 'truco', by: player };
    this.turn = 1 - player;
    this.emit('call', { player, kind: 'truco', call: TRUCO_CHAIN[this.trucoLevel - 1].key });
    return true;
  }

  accept(player) {
    const { kind } = this.pending;
    this.pending = null;
    if (kind === 'envido') {
      const { accept } = envidoValues(this.envidoChain, this.scores, this.target);
      const pts = [this.envidoPointsOf(0), this.envidoPointsOf(1)];
      const w = pts[0] === pts[1] ? this.mano : (pts[0] > pts[1] ? 0 : 1);
      this.envidoDone = true;
      // Va quién aceptó, además de quién ganó: la UI necesita saber de qué
      // boca sale el "quiero".
      this.emit('envido-showdown', { player, points: pts, winner: w, value: accept });
      this.addScore(w, accept);
    } else {
      this.trucoAccepted = true;
      this.emit('truco-accepted', { player });
    }
    if (!this.roundOver) this.turn = this.resumeTurn();
    return true;
  }

  reject(player) {
    const { kind, by } = this.pending;
    this.pending = null;
    if (kind === 'envido') {
      const { reject } = envidoValues(this.envidoChain, this.scores, this.target);
      this.envidoDone = true;
      this.emit('envido-rejected', { winner: by, value: reject });
      this.addScore(by, reject);
      if (!this.roundOver) this.turn = this.resumeTurn();
    } else {
      const pts = TRUCO_CHAIN[this.trucoLevel - 1].reject;
      this.emit('truco-rejected', { winner: by, value: pts });
      this.addScore(by, pts);
      if (!this.roundOver) {
        this.roundOver = true;
        this.mano = 1 - this.mano;
      }
    }
    return true;
  }

  // Tras un canto resuelto, sigue jugando quien debía tirar carta.
  resumeTurn() {
    const diff = this.played[0].length - this.played[1].length;
    if (diff === 0) return this.trickLeader;
    return diff > 0 ? 1 : 0;
  }

  roundValue() {
    return this.trucoLevel === 0 ? 1 : TRUCO_CHAIN[this.trucoLevel - 1].accept;
  }

  endRound(winner) {
    if (this.roundOver) return;
    this.roundOver = true;
    this.emit('round-end', { winner, value: this.roundValue() });
    this.addScore(winner, this.roundValue());
    this.mano = 1 - this.mano;
  }

  addScore(player, points) {
    this.scores[player] += points;
    this.emit('score', { player, points, scores: this.scores.slice() });
    if (this.scores[player] >= this.target) {
      this.winner = player;
      this.roundOver = true;
      this.emit('game-over', { winner: player });
    }
  }

  nextRound() {
    if (this.winner !== null) return false;
    this.startRound();
    return true;
  }
}
