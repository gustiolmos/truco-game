// Pegamento entre el motor y la pantalla. El motor nunca toca el DOM;
// acá sólo traducimos eventos a efectos y clics a acciones.

import { TrucoGame, TRUCO_CHAIN, HUMAN, CPU } from './core/game.js';
import { chooseAction } from './core/ai.js';
import { ENVIDO_CALLS } from './core/envido.js';
import { renderCard } from './ui/card.js';
import { Fx, countUp } from './ui/fx.js';
import { audio, armAudio } from './ui/audio.js';
import { t, callLabel, locales, getLocale, setLocale, onLocaleChange } from './i18n/index.js';
import { flagSprite } from './ui/flags.js';

const $ = (id) => document.getElementById(id);
const el = {
  stage: $('stage'), fx: $('fx'), actions: $('actions'), log: $('log'),
  handHuman: $('hand-human'), handCpu: $('hand-cpu'),
  slotHuman: $('slot-human'), slotCpu: $('slot-cpu'),
  numHuman: $('num-human'), numCpu: $('num-cpu'),
  pot: $('pot'), tricks: $('tricks'),
  envido: $('envido'), envidoNum: $('envido-num'),
  whoRival: $('who-rival'), whoYou: $('who-you'), whoEnvido: $('who-envido'),
  langsHud: $('langs-hud'), langsOverlay: $('langs-overlay'),
  mute: $('mute'),
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
  dealSounds();
  lastEnvido = null;
  say(game.mano === HUMAN ? t('log.youAreMano') : t('log.rivalIsMano'));
  render();
  if (game.turn === CPU) queueCpu();
}

function drawHumanHand() {
  el.handHuman.innerHTML = '';
  game.hands[HUMAN].forEach((card, i) => {
    const c = renderCard(card);
    c.style.animationDelay = `${i * 70}ms`;
    c.addEventListener('click', () => human({ type: 'play', cardId: card.id }));
    c.addEventListener('pointerenter', () => {
      if (!c.classList.contains('disabled')) audio.play('hover');
    });
    el.handHuman.appendChild(c);
  });
}

// El reparto acompaña a la animación de las cartas: una toma por carta,
// escalonada igual que el deal del CSS. Sonar todo junto lo aplana.
function dealSounds() {
  audio.play('shuffle');
  const total = game.hands[HUMAN].length + game.hands[CPU].length;
  for (let i = 0; i < total; i++) {
    setTimeout(() => audio.play('deal'), 140 + i * 70);
  }
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
  el.pot.textContent = t('hud.pot', v);

  renderEnvido();

  // cartas de la mano propia habilitadas sólo si se pueden tirar
  const legal = game.legalActions(HUMAN);
  const playable = new Set(legal.filter((a) => a.type === 'play').map((a) => a.cardId));
  for (const node of el.handHuman.children) {
    node.classList.toggle('disabled', !playable.has(node.dataset.cardId));
  }
  renderActions(legal);
}

// El envido no cambia durante la ronda (se cuenta sobre las tres cartas
// repartidas, se hayan jugado o no), así que sólo late cuando cambia de
// verdad: al repartir.
let lastEnvido = null;

function renderEnvido() {
  const points = game.envidoPointsOf(HUMAN);
  const live = !game.envidoDone && game.trick === 0;

  if (points !== lastEnvido) {
    el.envidoNum.textContent = points;
    el.envidoNum.classList.remove('pulse');
    void el.envidoNum.offsetWidth;   // reinicia la animación
    el.envidoNum.classList.add('pulse');
    lastEnvido = points;
  }
  el.envido.classList.toggle('spent', !live);
}

function renderActions(legal) {
  el.actions.innerHTML = '';
  if (game.turn !== HUMAN || busy) return;

  const add = (label, cls, action) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', () => { audio.play('click'); human(action); });
    b.addEventListener('pointerenter', () => audio.play('hover'));
    el.actions.appendChild(b);
  };

  if (game.pending) {
    add(t('action.accept'), 'good', { type: 'accept' });
    add(t('action.reject'), 'bad', { type: 'reject' });
  }
  for (const a of legal) {
    if (a.type === 'truco') {
      add(callLabel(TRUCO_CHAIN[game.trucoLevel].key), 'hot', a);
    } else if (a.type === 'envido') {
      add(callLabel(a.call), '', a);
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
      audio.play('play');
      break;
    }
    case 'trick-end': {
      if (e.result === 'parda') { say(t('log.parda')); audio.play('reject', { volume: 0.6 }); break; }
      const slot = TRICK_SLOT[e.result];
      slot.firstElementChild?.classList.add('winner');
      fx.burstAt(slot, { count: 26, hue: e.result === HUMAN ? 120 : 350, power: 6 });
      fx.kick(e.result === HUMAN ? 9 : 6);
      audio.play(e.result === HUMAN ? 'trickWin' : 'trickLose');
      say(e.result === HUMAN ? t('log.youWinTrick') : t('log.rivalWinsTrick'));
      break;
    }
    case 'call': {
      const label = callLabel(e.call);
      fx.shout(label + '!', { tone: e.kind });
      audio.play(e.kind === 'truco' ? 'truco' : 'envido');
      say(e.player === HUMAN ? t('log.youCall', label) : t('log.rivalCalls', label));
      break;
    }
    case 'truco-accepted':
      say(t('log.accepted'));
      fx.kick(8);
      audio.play('accept');
      break;
    case 'truco-rejected':
      fx.shout(t('shout.reject'), { tone: e.winner === HUMAN ? 'good' : 'bad' });
      audio.play('reject');
      break;
    case 'envido-showdown': {
      const mine = e.points[HUMAN];
      const theirs = e.points[CPU];
      fx.shout(t('shout.envidoBetter', e.winner === HUMAN ? mine : theirs),
        { tone: e.winner === HUMAN ? 'good' : 'bad' });
      audio.play(e.winner === HUMAN ? 'trickWin' : 'trickLose');
      say(t('log.envidoScore', mine, theirs));
      break;
    }
    case 'envido-rejected':
      audio.play('reject');
      say(t('log.envidoRejected', e.value, e.winner === HUMAN));
      break;
    case 'round-end':
      fx.shout(e.winner === HUMAN ? `+${e.value}` : `−${e.value}`,
        { tone: e.winner === HUMAN ? 'good' : 'bad' });
      break;
    case 'score': {
      const node = e.player === HUMAN ? el.numHuman : el.numCpu;
      const from = e.scores[e.player] - e.points;
      let step = 0;
      countUp(node, from, e.scores[e.player], () => {
        fx.burstAt(node, { count: 14, hue: e.player === HUMAN ? 50 : 340, power: 5 });
        fx.kick(7);
        audio.play('point', { volume: 0.8 + step * 0.06, spread: 0 });
        step++;
      });
      break;
    }
    case 'game-over':
      audio.play(e.winner === HUMAN ? 'gameWin' : 'gameLose');
      setTimeout(() => showOverlay(
        e.winner === HUMAN ? 'game.win' : 'game.lose',
        ['game.score', game.scores[HUMAN], game.scores[CPU]],
        'game.rematch', newGame), 900);
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

// El overlay se queda con las claves, no con el texto ya resuelto: si el
// jugador cambia de idioma con el cartel abierto (que es justo cuando el
// selector está a la vista), tiene que repintarse solo.
let overlayKeys = null;

function showOverlay(title, text, btn, onClick) {
  overlayKeys = { title, text, btn };
  paintOverlay();
  el.oBtn.onclick = () => { audio.play('click'); onClick(); };
  el.overlay.hidden = false;
  if (title === 'game.win') {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => fx.burst(Math.random() * innerWidth, innerHeight * 0.6,
        { count: 40, hue: Math.random() * 360, power: 12 }), i * 180);
    }
  }
}

// Una clave suelta, o una clave con argumentos: ['hud.pot', 3].
const resolve = (k) => (Array.isArray(k) ? t(...k) : t(k));

function paintOverlay() {
  if (!overlayKeys) return;
  el.oTitle.textContent = resolve(overlayKeys.title);
  el.oText.textContent = resolve(overlayKeys.text);
  el.oBtn.textContent = resolve(overlayKeys.btn);
}

// ---- idioma -----------------------------------------------------------

function buildLangPicker(container) {
  container.innerHTML = '';
  container.setAttribute('role', 'group');
  for (const { id, name } of locales()) {
    const b = document.createElement('button');
    b.className = 'lang';
    b.type = 'button';
    b.title = name;
    b.setAttribute('aria-label', name);
    b.innerHTML = flagSprite(id);
    b.addEventListener('click', () => { audio.play('click'); setLocale(id); });
    container.appendChild(b);
  }
  paintLangPicker(container);
}

function paintLangPicker(container) {
  container.setAttribute('aria-label', t('lang.label'));
  for (const [i, { id }] of locales().entries()) {
    container.children[i]?.classList.toggle('is-on', id === getLocale());
  }
}

// Repintar todo lo que ya está en pantalla. Los textos que dependen del
// estado de la partida salen de render(); los demás se pintan acá.
function paintAll() {
  el.whoRival.textContent = t('hud.rival');
  el.whoYou.textContent = t('hud.you');
  el.whoEnvido.textContent = t('hud.envido');
  el.envido.title = t('hud.envidoTip');
  paintMute();
  paintOverlay();
  for (const c of [el.langsHud, el.langsOverlay]) paintLangPicker(c);
  if (game) render();
}

onLocaleChange(paintAll);

// Botón de silencio. El estado queda guardado entre partidas.
function paintMute() {
  el.mute.textContent = audio.muted ? t('hud.muted') : t('hud.sound');
  el.mute.setAttribute('aria-pressed', String(audio.muted));
  el.mute.classList.toggle('is-muted', audio.muted);
}
el.mute.addEventListener('click', () => { audio.toggle(); paintMute(); });
paintMute();

for (const c of [el.langsHud, el.langsOverlay]) buildLangPicker(c);
paintAll();

armAudio();
showOverlay('game.title', ['game.subtitle'], 'game.play', newGame);
