// Pegamento entre el motor y la pantalla. El motor nunca toca el DOM;
// acá sólo traducimos eventos a efectos y clics a acciones.

import { TrucoGame, TRUCO_CHAIN, HUMAN, CPU } from './core/game.js';
import { chooseAction } from './core/ai.js';
import { ENVIDO_CALLS } from './core/envido.js';
import { renderCard } from './ui/card.js';
import { Fx, countUp } from './ui/fx.js';

const $ = (id) => document.getElementById(id);
const el = {
  stage: $('stage'), fx: $('fx'), actions: $('actions'), log: $('log'),
  handHuman: $('hand-human'), handCpu: $('hand-cpu'),
  slotHuman: $('slot-human'), slotCpu: $('slot-cpu'),
  numHuman: $('num-human'), numCpu: $('num-cpu'),
  pot: $('pot'), tricks: $('tricks'),
  overlay: $('overlay'), oTitle: $('overlay-title'), oText: $('overlay-text'), oBtn: $('overlay-btn'),
};

const fx = new Fx(el.fx, el.stage);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let game;
let busy = false;

const TRICK_SLOT = [el.slotHuman, el.slotCpu];

function newGame() {
  game = new TrucoGame({ target: 15 });
  game.on(onEvent);
  el.overlay.hidden = true;
  el.numHuman.textContent = '0';
  el.numCpu.textContent = '0';
  startRoundUI();
}

function startRoundUI() {
  TRICK_SLOT.forEach((s) => (s.innerHTML = ''));
  el.handCpu.innerHTML = '';
  el.handHuman.innerHTML = '';
  game.hands[CPU].forEach((_, i) => {
    const c = renderCard(null, { faceDown: true });
    c.style.animationDelay = `${i * 70}ms`;
    el.handCpu.appendChild(c);
  });
  drawHumanHand();
  say(game.mano === HUMAN ? 'Sos mano.' : 'Es mano el rival.');
  render();
  if (game.turn === CPU) queueCpu();
}

function drawHumanHand() {
  el.handHuman.innerHTML = '';
  game.hands[HUMAN].forEach((card, i) => {
    const c = renderCard(card);
    c.style.animationDelay = `${i * 70}ms`;
    c.addEventListener('click', () => human({ type: 'play', cardId: card.id }));
    el.handHuman.appendChild(c);
  });
}

// ---- entrada del jugador ---------------------------------------------

function human(action) {
  if (busy || game.turn !== HUMAN || !game.isLegal(HUMAN, action)) return;
  busy = true;
  game.act(HUMAN, action);
  render();
  afterAction();
}

async function afterAction() {
  await sleep(260);
  if (game.winner !== null) { busy = false; return; }
  if (game.roundOver) { busy = false; return nextRoundPrompt(); }
  if (game.turn === CPU) return queueCpu();
  busy = false;
  render();
}

async function queueCpu() {
  busy = true;
  render();
  await sleep(520 + Math.random() * 420);
  const action = chooseAction(game);
  if (action) game.act(CPU, action);
  render();
  await afterAction();
}

// ---- render -----------------------------------------------------------

function render() {
  // marcador de manos ganadas
  el.tricks.innerHTML = game.trickResults
    .map((r) => `<i class="${r === HUMAN ? 'w' : r === CPU ? 'l' : 'p'}"></i>`)
    .join('') + '<i></i>'.repeat(Math.max(0, 3 - game.trickResults.length));

  const v = game.roundValue();
  el.pot.textContent = `${v} ${v === 1 ? 'punto' : 'puntos'} en juego`;

  // cartas de la mano propia habilitadas sólo si se pueden tirar
  const legal = game.legalActions(HUMAN);
  const playable = new Set(legal.filter((a) => a.type === 'play').map((a) => a.cardId));
  for (const node of el.handHuman.children) {
    node.classList.toggle('disabled', !playable.has(node.dataset.cardId));
  }
  renderActions(legal);
}

function renderActions(legal) {
  el.actions.innerHTML = '';
  if (game.turn !== HUMAN || busy) return;

  const add = (label, cls, action) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', () => human(action));
    el.actions.appendChild(b);
  };

  if (game.pending) {
    add('Quiero', 'good', { type: 'accept' });
    add('No quiero', 'bad', { type: 'reject' });
  }
  for (const a of legal) {
    if (a.type === 'truco') {
      add(TRUCO_CHAIN[game.trucoLevel].label, 'hot', a);
    } else if (a.type === 'envido') {
      add(ENVIDO_CALLS[a.call].label, '', a);
    }
  }
}

function say(text) { el.log.textContent = text; }

// ---- eventos del motor -> efectos -------------------------------------

function onEvent(e) {
  switch (e.type) {
    case 'card-played': {
      const slot = TRICK_SLOT[e.player];
      const node = renderCard(e.card);
      node.classList.add('played');
      slot.innerHTML = '';
      slot.appendChild(node);
      if (e.player === HUMAN) drawHumanHand();
      else el.handCpu.lastElementChild?.remove();
      fx.burstAt(node, { count: 12, hue: 200, power: 4 });
      break;
    }
    case 'trick-end': {
      if (e.result === 'parda') { say('Parda.'); break; }
      const slot = TRICK_SLOT[e.result];
      slot.firstElementChild?.classList.add('winner');
      fx.burstAt(slot, { count: 26, hue: e.result === HUMAN ? 120 : 350, power: 6 });
      fx.kick(e.result === HUMAN ? 9 : 6);
      say(e.result === HUMAN ? 'Ganaste la mano.' : 'Se la lleva el rival.');
      break;
    }
    case 'call': {
      const label = e.kind === 'truco'
        ? TRUCO_CHAIN.find((t) => t.key === e.call).label
        : ENVIDO_CALLS[e.call].label;
      fx.shout(label + '!', { tone: e.kind });
      say(`${e.player === HUMAN ? 'Cantaste' : 'El rival canta'} ${label}.`);
      break;
    }
    case 'truco-accepted':
      say('Quiero. Sube la apuesta.');
      fx.kick(8);
      break;
    case 'truco-rejected':
      fx.shout('No quiero', { tone: e.winner === HUMAN ? 'good' : 'bad' });
      break;
    case 'envido-showdown': {
      const mine = e.points[HUMAN];
      const theirs = e.points[CPU];
      fx.shout(`${e.winner === HUMAN ? mine : theirs} son mejores`,
        { tone: e.winner === HUMAN ? 'good' : 'bad' });
      say(`Vos ${mine} · Rival ${theirs}`);
      break;
    }
    case 'envido-rejected':
      say(`No quiero el envido: ${e.value} para ${e.winner === HUMAN ? 'vos' : 'el rival'}.`);
      break;
    case 'round-end':
      fx.shout(e.winner === HUMAN ? `+${e.value}` : `−${e.value}`,
        { tone: e.winner === HUMAN ? 'good' : 'bad' });
      break;
    case 'score': {
      const node = e.player === HUMAN ? el.numHuman : el.numCpu;
      const from = e.scores[e.player] - e.points;
      countUp(node, from, e.scores[e.player], () => {
        fx.burstAt(node, { count: 14, hue: e.player === HUMAN ? 50 : 340, power: 5 });
        fx.kick(7);
      });
      break;
    }
    case 'game-over':
      setTimeout(() => showOverlay(
        e.winner === HUMAN ? '¡Ganaste!' : 'Perdiste',
        `${game.scores[HUMAN]} a ${game.scores[CPU]}`,
        'Revancha', newGame), 900);
      break;
  }
}

function nextRoundPrompt() {
  setTimeout(() => {
    if (game.winner !== null) return;
    game.nextRound();
    startRoundUI();
  }, 1100);
}

function showOverlay(title, text, btn, onClick) {
  el.oTitle.textContent = title;
  el.oText.textContent = text;
  el.oBtn.textContent = btn;
  el.oBtn.onclick = onClick;
  el.overlay.hidden = false;
  if (title.startsWith('¡Gan')) {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => fx.burst(Math.random() * innerWidth, innerHeight * 0.6,
        { count: 40, hue: Math.random() * 360, power: 12 }), i * 180);
    }
  }
}

showOverlay('Truco', 'Primero a 15 puntos. Envido y truco incluidos.', 'Jugar', newGame);
