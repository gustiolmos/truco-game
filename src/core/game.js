// Motor del Truco argentino 1v1 (sin flor). Sin dependencias de UI:
// recibe acciones, emite eventos y expone el estado para que lo pinte quien quiera.

import { makeDeck, shuffle } from './deck.js';
import { envidoPoints, envidoValues, envidoRaises } from './envido.js';
import { equipped } from './mods.js';

export const TRUCO_CHAIN = [
  { key: 'truco', accept: 2, reject: 1 },
  { key: 'retruco', accept: 3, reject: 2 },
  { key: 'vale-cuatro', accept: 4, reject: 3 },
];

export const HUMAN = 0;
export const CPU = 1;

export class TrucoGame {
  constructor({ target = 15, rng = Math.random, mods = [], owner = HUMAN } = {}) {
    this.target = target;
    this.rng = rng;
    this.scores = [0, 0];
    this.mano = HUMAN; // quién es mano en la ronda actual
    this.listeners = new Set();
    this.winner = null;
    // Modificadores equipados, en orden de ranura, y de quién son. Sin
    // modificadores todos los enganches devuelven el valor tal cual, así
    // que el reglamento base queda intacto.
    this.mods = equipped(mods.map((m) => (typeof m === 'string' ? m : m?.id)));
    this.owner = owner;
    this.quiet = false;
    this.startRound();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, data = {}) { for (const fn of this.listeners) fn({ type, ...data }); }

  // ---- enganches de los modificadores --------------------------------

  // Enganche de valor: cada modificador recibe el número que dejó el
  // anterior, en orden de ranura. Si lo cambia, se avisa, porque un
  // modificador que actúa sin que se vea no se entiende.
  hook(name, value, ctx = {}) {
    let out = value;
    for (const mod of this.mods) {
      const fn = mod.hooks[name];
      if (!fn) continue;
      const next = fn(out, { ...ctx, owner: this.owner });
      if (next !== undefined && next !== out) {
        out = next;
        this.fired(mod, name);
      }
    }
    return out;
  }

  // Enganche de efecto: reacciona a algo que pasó. Sólo puede tocar la
  // partida por `api`, que es chica a propósito.
  effect(name, ctx = {}) {
    for (const mod of this.mods) {
      const fn = mod.hooks[name];
      if (!fn) continue;
      fn(this.modApi(mod), { ...ctx, owner: this.owner });
    }
  }

  modApi(mod) {
    return {
      score: (player, points) => {
        if (!(points > 0) || this.winner !== null) return;
        this.fired(mod, 'score');
        this.addScore(player, points);
      },
      swapWorst: (player) => {
        const swap = this.swapWorst(player);
        if (swap) this.fired(mod, 'swap');
        return swap;
      },
    };
  }

  fired(mod, hook) {
    if (this.quiet) return;
    this.emit('mod-fire', { id: mod.id, hook });
  }

  // La UI pregunta cuánto pagaría la ronda en cada repintado, y eso pasa por
  // los mismos enganches. Preguntar no es disparar: dentro de `peek` los
  // modificadores calculan igual pero no avisan.
  peek(fn) {
    this.quiet = true;
    try { return fn(); } finally { this.quiet = false; }
  }

  // Cambiar la peor carta de la mano por una del resto del mazo. Es lo
  // único que un efecto puede hacerle a las cartas.
  swapWorst(player) {
    const hand = this.hands[player];
    if (!hand.length || !this.stock.length) return null;
    let worst = 0;
    for (let i = 1; i < hand.length; i++) if (hand[i].power < hand[worst].power) worst = i;
    const out = hand[worst];
    const into = this.stock.shift();
    hand[worst] = into;
    this.emit('card-swapped', { player, out, into });
    return { out, into };
  }

  startRound() {
    const deck = shuffle(makeDeck(), this.rng);
    this.hands = [deck.slice(0, 3), deck.slice(3, 6)];
    this.stock = deck.slice(6);  // lo que queda del mazo, para los efectos
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
    this.effect('on-round-start', { mano: this.mano });
  }

  // ---- consultas ------------------------------------------------------

  envidoPointsOf(player) {
    const cards = this.hands[player].concat(this.played[player]);
    return this.hook('envido-count', envidoPoints(cards), { player, cards });
  }

  // Cuánto puede una carta en la mesa. Todo lo que compara cartas pasa por
  // acá: si no, un modificador que sube una carta la subiría para el
  // resultado pero no para el marcador, o al revés.
  powerOf(card, player) {
    return this.hook('card-power', card.power, { card, player, trick: this.trick });
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
    const pa = this.powerOf(a, 0);
    const pb = this.powerOf(b, 1);
    const result = pa === pb ? 'parda' : (pa > pb ? 0 : 1);
    this.trickResults.push(result);
    this.envidoDone = true;
    this.emit('trick-end', { trick: this.trick, result, cards: [a, b] });
    if (result !== 'parda') this.effect('on-trick-won', { player: result, trick: this.trick });

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
      const base = envidoValues(this.envidoChain, this.scores, this.target).accept;
      const pts = [this.envidoPointsOf(0), this.envidoPointsOf(1)];
      const w = pts[0] === pts[1] ? this.mano : (pts[0] > pts[1] ? 0 : 1);
      const value = this.hook('envido-stake', base,
        { winner: w, chain: this.envidoChain.slice(), kind: 'accept' });
      this.envidoDone = true;
      // Va quién aceptó, además de quién ganó: la UI necesita saber de qué
      // boca sale el "quiero".
      this.emit('envido-showdown', { player, points: pts, winner: w, value });
      this.effect('on-accept', { player, kind });
      this.addScore(w, value);
    } else {
      this.trucoAccepted = true;
      this.emit('truco-accepted', { player });
      this.effect('on-accept', { player, kind });
    }
    if (!this.roundOver) this.turn = this.resumeTurn();
    return true;
  }

  reject(player) {
    const { kind, by } = this.pending;
    this.pending = null;
    if (kind === 'envido') {
      const base = envidoValues(this.envidoChain, this.scores, this.target).reject;
      const value = this.hook('envido-stake', base,
        { winner: by, chain: this.envidoChain.slice(), kind: 'reject' });
      this.envidoDone = true;
      this.emit('envido-rejected', { winner: by, value });
      this.addScore(by, value);
      this.effect('on-reject', { player, kind, winner: by });
      if (!this.roundOver) this.turn = this.resumeTurn();
    } else {
      const pts = this.hook('truco-stake', TRUCO_CHAIN[this.trucoLevel - 1].reject,
        { winner: by, level: this.trucoLevel });
      this.emit('truco-rejected', { winner: by, value: pts });
      this.addScore(by, pts);
      this.effect('on-reject', { player, kind, winner: by });
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

  // Lo que paga la ronda. `winner` se pasa cuando ya se sabe quién cobra,
  // porque hay modificadores que sólo valen a favor de su dueño; la UI
  // pregunta con el jugador propio para mostrar lo que pagaría, y lo hace
  // dentro de `peek` para que preguntar no cuente como disparo.
  roundValue(winner = null) {
    const base = this.trucoLevel === 0 ? 1 : TRUCO_CHAIN[this.trucoLevel - 1].accept;
    return this.hook('round-stake', base, { winner, level: this.trucoLevel });
  }

  endRound(winner) {
    if (this.roundOver) return;
    this.roundOver = true;
    const value = this.roundValue(winner);
    this.emit('round-end', { winner, value });
    this.addScore(winner, value);
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
