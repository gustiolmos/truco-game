// Pegamento entre el motor y la pantalla. El motor nunca toca el DOM;
// acá sólo traducimos eventos a efectos y clics a acciones.

import { TrucoGame, TRUCO_CHAIN, HUMAN, CPU } from './core/game.js';
import { chooseAction } from './core/ai.js';
import { ENVIDO_CALLS } from './core/envido.js';
import { renderCard, crack } from './ui/card.js';
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
  pot: $('pot'), tricks: $('tricks'), table: $('table'),
  deck: $('deck'), deckLabel: $('deck-label'),
  envido: $('envido'), envidoNum: $('envido-num'),
  whoRival: $('who-rival'), whoYou: $('who-you'), whoEnvido: $('who-envido'),
  vitalHuman: $('vital-human'), vitalCpu: $('vital-cpu'),
  langsOverlay: $('langs-overlay'), langsMenu: $('langs-menu'),
  menuBtn: $('menu-btn'), menu: $('menu'), menuTitle: $('menu-title'),
  menuSound: $('menu-sound'), menuVolume: $('menu-volume'),
  menuResume: $('menu-resume'), menuQuit: $('menu-quit'),
  labelSound: $('label-sound'), labelVolume: $('label-volume'),
  labelLanguage: $('label-language'),
  overlay: $('overlay'), oTitle: $('overlay-title'), oText: $('overlay-text'), oBtn: $('overlay-btn'),
};

const fx = new Fx(el.fx, el.stage);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let game;
let busy = false;

const TRICK_SLOT = [el.slotHuman, el.slotCpu];
const TARGET = 15;

function newGame() {
  game = new TrucoGame({ target: TARGET });
  game.on(onEvent);
  el.overlay.hidden = true;
  paintVitals();
  startRoundUI();
}

// ---- barras de vida ---------------------------------------------------

// No se muestra cuántos puntos hiciste sino cuánta vida te queda: los
// puntos del otro son el daño. Tu vida es lo que le falta al rival para
// llegar al objetivo.
const lifeOf = (player) => game.target - game.scores[other(player)];

const vitalOf = (player) => (player === HUMAN ? el.vitalHuman : el.vitalCpu);
const numOf = (player) => (player === HUMAN ? el.numHuman : el.numCpu);

// Barras llenas, sin partida en curso.
function resetVitals() {
  for (const root of [el.vitalHuman, el.vitalCpu]) {
    root.querySelector('.vital-fill').style.transform = 'scaleX(1)';
    root.querySelector('.vital-chip').style.transform = 'scaleX(1)';
    root.classList.remove('is-mid', 'is-low', 'hit');
  }
  el.numHuman.textContent = String(TARGET);
  el.numCpu.textContent = String(TARGET);
}

function paintVitals() {
  if (!game) return;
  for (const player of [HUMAN, CPU]) {
    const life = Math.max(0, lifeOf(player));
    const ratio = life / game.target;
    const root = vitalOf(player);
    root.querySelector('.vital-fill').style.transform = `scaleX(${ratio})`;
    root.querySelector('.vital-chip').style.transform = `scaleX(${ratio})`;
    root.classList.toggle('is-mid', ratio <= 0.6 && ratio > 0.3);
    root.classList.toggle('is-low', ratio <= 0.3);
    numOf(player).textContent = String(life);
  }
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
  fan(el.handCpu, FAN_CPU);
  drawHumanHand();
  dealSounds();
  paintVitals();
  lastEnvido = null;
  say(game.mano === HUMAN ? t('log.youAreMano') : t('log.rivalIsMano'));
  render();
  if (game.turn === CPU) queueCpu();
}

// Abanico: cada carta se inclina según lo lejos que esté del centro, y las
// de los costados suben para que el borde superior dibuje un arco. Hay que
// rehacerlo cada vez que cambia la cantidad de cartas, porque un abanico de
// dos no es el mismo que el de tres: si no, queda descentrado al ir jugando.
function fan(container, { angle, lift }) {
  const cards = [...container.children];
  const middle = (cards.length - 1) / 2;
  cards.forEach((c, i) => {
    const offset = i - middle;
    c.style.setProperty('--rot', `${offset * angle}deg`);
    c.style.setProperty('--lift', `${Math.abs(offset) * lift}px`);
    c.style.zIndex = String(i + 1);   // la de la derecha tapa a la anterior
  });
}

const FAN_HUMAN = { angle: 7, lift: 7 };
const FAN_CPU = { angle: 4, lift: 3 };   // más cerrado: es decoración

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
  fan(el.handHuman, FAN_HUMAN);
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
  if (!game || paused || busy || game.turn !== HUMAN || !game.isLegal(HUMAN, action)) return;
  busy = true;
  game.act(HUMAN, action);
  render();
  afterAction();
}

async function afterAction() {
  await sleep(260);
  await pauseGate();
  if (!game) return;                       // se abandonó la partida mientras tanto
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
  await pauseGate();
  if (!game) return;
  const action = chooseAction(game);
  if (action) game.act(CPU, action);
  render();
  await afterAction();
}

// ---- render -----------------------------------------------------------

function render() {
  if (!game) return;
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
  renderDeck(legal);
}

// El envido no cambia durante la ronda: se cuenta sobre las tres cartas
// repartidas, se hayan jugado o no. Sólo se reescribe cuando cambia de
// verdad, al repartir.
let lastEnvido = null;

function renderEnvido() {
  const points = game.envidoPointsOf(HUMAN);
  const live = !game.envidoDone && game.trick === 0;

  if (points !== lastEnvido) {
    el.envidoNum.textContent = points;
    lastEnvido = points;
  }
  el.envido.classList.toggle('spent', !live);
}

// Irse al mazo pide dos clics: el primero arma y pone el mazo en rojo, el
// segundo entrega la ronda. Un clic suelto en una esquina no debería
// costarte la mano.
let deckArmed = false;

function disarmDeck() {
  if (!deckArmed) return;
  deckArmed = false;
  paintDeck();
}

function paintDeck() {
  el.deck.classList.toggle('armed', deckArmed);
  el.deckLabel.textContent = deckArmed ? t('deck.confirm') : t('deck.fold');
  el.deck.setAttribute('aria-label', t('deck.fold'));
}

function renderDeck(legal) {
  const canFold = legal.some((a) => a.type === 'fold');
  el.deck.disabled = !canFold;
  if (!canFold) deckArmed = false;
  paintDeck();
}

el.deck.addEventListener('click', () => {
  audio.play('click');
  if (!deckArmed) { deckArmed = true; paintDeck(); return; }
  deckArmed = false;
  human({ type: 'fold' });
});
// Si te arrepentís, alcanza con correr el puntero.
el.deck.addEventListener('pointerleave', disarmDeck);

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

// De qué boca sale cada globo. El de abajo habla hacia arriba y el de
// arriba hacia abajo, para que la cola apunte siempre al que habla.
const mouth = (player) => (player === HUMAN
  ? { from: el.handHuman, dir: 'down' }
  : { from: el.handCpu, dir: 'up' });

const other = (player) => (player === HUMAN ? CPU : HUMAN);

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
      else {
        el.handCpu.lastElementChild?.remove();
        fan(el.handCpu, FAN_CPU);
      }
      fx.burstAt(node, { count: 12, hue: 200, power: 4 });
      audio.play('play');
      break;
    }
    case 'trick-end': {
      if (e.result === 'parda') { say(t('log.parda')); audio.play('reject', { volume: 0.6 }); break; }
      // Ganadora y perdedora marcadas a la vez: con una sola no se entiende
      // cuál de las dos cartas mandó.
      const slot = TRICK_SLOT[e.result];
      const loserSlot = TRICK_SLOT[other(e.result)];
      slot.firstElementChild?.classList.add('winner');
      loserSlot.firstElementChild?.classList.add('loser');
      crack(loserSlot.firstElementChild);
      fx.burstAt(slot, { count: 26, hue: 45, power: 6 });
      fx.kick(e.result === HUMAN ? 9 : 6);
      audio.play(e.result === HUMAN ? 'trickWin' : 'trickLose');
      say(e.result === HUMAN ? t('log.youWinTrick') : t('log.rivalWinsTrick'));
      break;
    }
    case 'call': {
      const label = callLabel(e.call);
      fx.bubble(`¡${label}!`, { ...mouth(e.player), tone: e.kind });
      fx.kick(e.kind === 'truco' ? 14 : 9);
      audio.play(e.kind === 'truco' ? 'truco' : 'envido');
      say(e.player === HUMAN ? t('log.youCall', label) : t('log.rivalCalls', label));
      break;
    }
    case 'fold':
      fx.bubble(t('bubble.fold'), { ...mouth(e.player), tone: 'bad' });
      audio.play('reject');
      say(e.player === HUMAN ? t('log.youFold') : t('log.rivalFolds'));
      break;
    case 'truco-accepted':
      say(t('log.accepted'));
      fx.bubble(t('action.accept'), { ...mouth(e.player), tone: 'good' });
      fx.kick(8);
      audio.play('accept');
      break;
    case 'truco-rejected':
      fx.bubble(t('action.reject'), { ...mouth(other(e.winner)), tone: 'bad' });
      audio.play('reject');
      break;
    case 'envido-showdown': {
      const mine = e.points[HUMAN];
      const theirs = e.points[CPU];

      // El canto del envido tiene un orden fijo en la mesa: el que acepta
      // dice "quiero", después canta el mano sus puntos, y recién entonces
      // responde el otro: lo supera si tiene más, o da las buenas si no.
      // Hacerlo de a uno es lo que lo vuelve un diálogo y no un resultado.
      const manoPlayer = game.mano;
      const responder = other(manoPlayer);
      const manoPoints = e.points[manoPlayer];
      const responderPoints = e.points[responder];

      fx.bubble(t('action.accept'), { ...mouth(e.player), tone: 'good', hold: 520 });
      audio.play('accept');

      setTimeout(() => {
        fx.bubble(String(manoPoints), { ...mouth(manoPlayer), tone: 'envido', hold: 1600 });
        audio.play('envido', { volume: 0.7 });
      }, 560);

      setTimeout(() => {
        // Empatados gana el mano, así que el otro da las buenas: sólo
        // supera quien tiene estrictamente más.
        const supera = responderPoints > manoPoints;
        fx.bubble(
          supera ? t('shout.envidoBetter', responderPoints) : t('shout.envidoGood'),
          { ...mouth(responder), tone: supera ? 'gold' : 'bad', hold: 1500 },
        );
        audio.play(e.winner === HUMAN ? 'trickWin' : 'trickLose');
      }, 1240);

      say(t('log.envidoScore', mine, theirs));
      break;
    }
    case 'envido-rejected':
      fx.bubble(t('action.reject'), { ...mouth(other(e.winner)), tone: 'bad' });
      audio.play('reject');
      say(t('log.envidoRejected', e.value, e.winner === HUMAN));
      break;
    case 'round-end':
      break;
    case 'score': {
      // Quien suma le saca vida al otro: el golpe se ve en la barra del
      // que recibe, no en la del que anota.
      const hurt = other(e.player);
      const node = numOf(hurt);
      const after = Math.max(0, game.target - e.scores[e.player]);
      const before = after + e.points;
      const mine = e.player === HUMAN;

      fx.pop(`−${e.points}`, { over: el.table, tone: mine ? 'good' : 'bad' });

      const root = vitalOf(hurt);
      root.classList.remove('hit');
      void root.offsetWidth;          // reinicia la sacudida
      root.classList.add('hit');
      setTimeout(() => root.classList.remove('hit'), 400);

      let step = 0;
      countUp(node, before, after, (value) => {
        fx.burstAt(node, { count: 14, hue: mine ? 50 : 340, power: 5 });
        fx.kick(7);
        audio.play('point', { volume: 0.8 + step * 0.06, spread: 0 });
        step++;
        // La barra acompaña al número, de a un punto por vez.
        const ratio = Math.max(0, value) / game.target;
        root.querySelector('.vital-fill').style.transform = `scaleX(${ratio})`;
        root.querySelector('.vital-chip').style.transform = `scaleX(${ratio})`;
        root.classList.toggle('is-mid', ratio <= 0.6 && ratio > 0.3);
        root.classList.toggle('is-low', ratio <= 0.3);
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
  setTimeout(async () => {
    await pauseGate();
    if (!game || game.winner !== null) return;
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
  paintOverlay();
  paintMenu();
  paintDeck();
  for (const c of [el.langsOverlay, el.langsMenu]) paintLangPicker(c);
  if (game) render();
}

onLocaleChange(paintAll);

// ---- menú de pausa y configuración ------------------------------------

// Con el menú abierto la partida se queda quieta. Si no, los temporizadores
// del rival siguen corriendo y al cerrar te encontrás con que cantó, tiró y
// te ganó la mano mientras mirabas el volumen.
let paused = false;
let waiters = [];

const pauseGate = () => (paused ? new Promise((r) => waiters.push(r)) : null);

function setPaused(value) {
  paused = value;
  if (!value) {
    const pending = waiters;
    waiters = [];
    for (const resume of pending) resume();
  }
}

function openMenu() {
  if (!el.overlay.hidden) return;   // ya hay un cartel propio en pantalla
  quitArmed = false;
  setPaused(true);
  paintMenu();
  el.menu.hidden = false;
  el.menuResume.focus();
}

function closeMenu() {
  el.menu.hidden = true;
  quitArmed = false;
  setPaused(false);
  render();
}

// "Abandonar" pide confirmación en el mismo botón: un clic lo arma, el
// segundo lo ejecuta. Perder una partida por un clic de más sería feo.
let quitArmed = false;

function paintMenu() {
  el.menuTitle.textContent = t('menu.title');
  el.labelSound.textContent = t('menu.sound');
  el.labelVolume.textContent = t('menu.volume');
  el.labelLanguage.textContent = t('menu.language');
  el.menuResume.textContent = t('menu.resume');
  el.menuQuit.hidden = !game;
  el.menuQuit.textContent = quitArmed ? t('menu.quitConfirm') : t('menu.quit');
  el.menuQuit.classList.toggle('armed', quitArmed);

  el.menuSound.textContent = audio.muted ? t('menu.off') : t('menu.on');
  el.menuSound.setAttribute('aria-pressed', String(!audio.muted));
  el.menuSound.classList.toggle('is-off', audio.muted);
  el.menuVolume.value = String(Math.round(audio.volume * 100));
  el.menuBtn.setAttribute('aria-label', t('menu.open'));
}

el.menuBtn.addEventListener('click', () => { audio.play('click'); openMenu(); });
el.menuResume.addEventListener('click', () => { audio.play('click'); closeMenu(); });

el.menuSound.addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  audio.play('click');          // suena recién si quedó encendido
  paintMenu();
});

el.menuVolume.addEventListener('input', () => {
  audio.setVolume(Number(el.menuVolume.value) / 100);
});
// El sonido de muestra va al soltar, no en cada pixel del arrastre.
el.menuVolume.addEventListener('change', () => audio.play('point'));

el.menuQuit.addEventListener('click', () => {
  audio.play('click');
  if (!quitArmed) { quitArmed = true; paintMenu(); return; }
  quitMatch();
});

// Salir de la partida: vuelve a la pantalla de inicio con la mesa limpia.
function quitMatch() {
  el.menu.hidden = true;
  quitArmed = false;
  setPaused(false);
  game = null;
  busy = false;
  lastEnvido = null;
  TRICK_SLOT.forEach((s) => (s.innerHTML = ''));
  el.handCpu.innerHTML = '';
  el.handHuman.innerHTML = '';
  el.actions.innerHTML = '';
  el.tricks.innerHTML = '';
  el.deck.disabled = true;
  deckArmed = false;
  resetVitals();
  say('');
  showOverlay('game.title', ['game.subtitle'], 'game.play', newGame);
}

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!el.menu.hidden) closeMenu();
  else if (el.overlay.hidden) openMenu();
});

el.deck.disabled = true;
for (const c of [el.langsOverlay, el.langsMenu]) buildLangPicker(c);
paintAll();

armAudio();
showOverlay('game.title', ['game.subtitle'], 'game.play', newGame);
