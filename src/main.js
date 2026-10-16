// Pegamento entre el motor y la pantalla. El motor nunca toca el DOM;
// acá sólo traducimos eventos a efectos y clics a acciones.

import { TrucoGame, TRUCO_CHAIN, HUMAN, CPU } from './core/game.js';
import { chooseAction } from './core/ai.js';
import { ENVIDO_CALLS } from './core/envido.js';
import { renderCard, crack, SUIT_COLORS } from './ui/card.js';
import { sprite } from './ui/pixel.js';
import { SUITS } from './ui/sprites.js';
import { Fx, countUp, prefersReduced, setReducedEffects, systemPrefersReduced } from './ui/fx.js';
import { audio, armAudio } from './ui/audio.js';
import { t, callLabel, locales, getLocale, setLocale, onLocaleChange } from './i18n/index.js';
import { flagSprite } from './ui/flags.js';
import { MODES } from './modes.js';
import {
  Run, ANTE_COUNT, normalizeSeed, isSeed, loadRun, saveRun, clearRun,
} from './core/run.js';
import { MOD_LIMIT, modById } from './core/mods.js';

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
  vitalHuman: $('vital-human'), vitalCpu: $('vital-cpu'), vitals: $('vitals'),
  targetMenu: $('target-menu'), targetOverlay: $('target-overlay'),
  labelPoints: $('label-points'),
  screenTitle: $('screen-title'), screenModes: $('screen-modes'), screenLength: $('screen-length'),
  modes: $('modes'), modesTitle: $('modes-title'), modesBack: $('modes-back'),
  lengthTitle: $('length-title'),
  lengthStart: $('length-start'), lengthBack: $('length-back'),
  modsHud: $('mods-hud'), heat: $('heat'),
  turnTimer: $('turn-timer'), turnTimerFill: $('turn-timer-fill'),
  turnTimerNum: $('turn-timer-num'),
  menuTimer: $('menu-timer'), labelTimer: $('label-timer'),
  lengthTimer: $('length-timer'), labelTimerLength: $('label-timer-length'),
  runTimer: $('run-timer'), labelTimerRun: $('label-timer-run'),
  runHud: $('run-hud'), runAnte: $('run-ante'), runGoal: $('run-goal'),
  runHands: $('run-hands'), runMoney: $('run-money'),
  screenRun: $('screen-run'), screenShop: $('screen-shop'), screenRunover: $('screen-runover'),
  runTitle: $('run-title'), runText: $('run-text'),
  runStatGoal: $('run-stat-goal'), runStatHands: $('run-stat-hands'),
  runStatMoney: $('run-stat-money'),
  runLabelGoal: $('run-label-goal'), runLabelHands: $('run-label-hands'),
  runLabelMoney: $('run-label-money'),
  runLabelMods: $('run-label-mods'), runMods: $('run-mods'), runLabelSeed: $('run-label-seed'), runSeedInput: $('run-seed-input'),
  runStart: $('run-start'), runRestart: $('run-restart'), runBack: $('run-back'),
  shopTitle: $('shop-title'), shopText: $('shop-text'), shopSlots: $('shop-slots'),
  shopNext: $('shop-next'),
  runoverTitle: $('runover-title'), runoverText: $('runover-text'),
  runSummary: $('run-summary'),
  runoverAgain: $('runover-again'), runoverBack: $('runover-back'),
  langsOverlay: $('langs-overlay'), langsMenu: $('langs-menu'),
  menuBtn: $('menu-btn'), menu: $('menu'), menuTitle: $('menu-title'),
  menuSound: $('menu-sound'), menuVolume: $('menu-volume'),
  menuEffects: $('menu-effects'), labelEffects: $('label-effects'),
  menuResume: $('menu-resume'), menuQuit: $('menu-quit'),
  labelSound: $('label-sound'), labelVolume: $('label-volume'),
  labelLanguage: $('label-language'),
  overlay: $('overlay'),
  screenGameover: $('screen-gameover'), gameoverTitle: $('gameover-title'),
  gameoverText: $('gameover-text'), gameoverBtn: $('gameover-btn'),
  gameoverQuit: $('gameover-quit'),
  homeTitle: $('home-title'), homeTagline: $('home-tagline'),
  homeContinue: $('home-continue'), homeNew: $('home-new'),
  homeSettings: $('home-settings'), homeShare: $('home-share'),
  socialInstagram: $('social-instagram'), socialFacebook: $('social-facebook'),
  socialGithub: $('social-github'),
  homeDemo: $('home-demo'), demoShout: $('demo-shout'),
  demoHandCpu: $('demo-hand-cpu'), demoHandHuman: $('demo-hand-human'),
  demoSlotCpu: $('demo-slot-cpu'), demoSlotHuman: $('demo-slot-human'),
};

const fx = new Fx(el.fx, el.stage);

// ---- efectos ----------------------------------------------------------

// Se pueden apagar desde el menú. Arranca por lo que diga el sistema, y la
// elección del jugador pisa eso y se guarda: quien baja los efectos no los
// quiere de nuevo al día siguiente.
const FX_KEY = 'truco.fx';

function readEffects() {
  try {
    const saved = localStorage.getItem(FX_KEY);
    if (saved === 'on') return true;
    if (saved === 'off') return false;
  } catch { /* modo privado */ }
  return !systemPrefersReduced;
}

let effectsOn = readEffects();
setReducedEffects(!effectsOn);

function setEffects(value) {
  effectsOn = value;
  setReducedEffects(!value);
  try { localStorage.setItem(FX_KEY, value ? 'on' : 'off'); } catch { /* modo privado */ }
  paintMenu();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let game;
let busy = false;

const TRICK_SLOT = [el.slotHuman, el.slotCpu];

// Largo de la partida. A 15 es la corta; a 30 es la larga de toda la vida,
// la que se juega con buenas y malas.
const TARGETS = [15, 30];
const TARGET_KEY = 'truco.target';

function readTarget() {
  try {
    const saved = Number(localStorage.getItem(TARGET_KEY));
    if (TARGETS.includes(saved)) return saved;
  } catch { /* modo privado */ }
  return 15;
}

let target = readTarget();

function setTarget(value) {
  if (!TARGETS.includes(value) || value === target) return;
  target = value;
  try { localStorage.setItem(TARGET_KEY, String(value)); } catch { /* modo privado */ }
  resetVitals();
  paintTargetPickers();
}

// Truco clásico: una partida suelta al largo elegido, sin corrida de por
// medio. Queda como estaba.
function newGame() {
  inAnte = false;
  game = new TrucoGame({ target });
  game.on(onEvent);
  hideOverlay();
  paintRunHud();
  paintModsHud();
  paintVitals();
  paintTargetPickers();
  startRoundUI();
}

// ---- corrida ----------------------------------------------------------

// El modo libre es el juego en sí: una corrida de ocho antes. El truco
// clásico sigue entrando por su propia puerta y no sabe nada de todo esto;
// lo único que comparten es el motor y el aspecto.
//
// `inAnte` distingue una partida de ante de una partida clásica: las dos
// usan el mismo TrucoGame y el mismo render, pero sólo la del ante cuenta
// manos, cierra con la corrida y pinta la franja de arriba.
let run = null;
let inAnte = false;
let handsPlayed = 0;
// Si la corrida se retomó de lo guardado, la antesala lo dice en vez de
// volver a explicar el ante como si fuera nuevo.
let resumedRun = false;

// Entrar al modo: si hay una corrida guardada se sigue, y si no se arma una
// nueva. Una corrida terminada no se "sigue": se tira y se empieza otra.
function openRun() {
  const saved = loadRun();
  run = saved && !saved.over ? saved : new Run();
  resumedRun = Boolean(saved && !saved.over);
  saveRun(run);
  showScreen(run.phase === 'shop' ? 'shop' : 'run');
}

function freshRun(seed) {
  clearRun();
  run = new Run(seed ? { seed } : {});
  resumedRun = false;
  saveRun(run);
  showScreen('run');
}

// El ante es una partida corta de truco: el objetivo del ante es el puntaje
// al que se juega, así que las barras de vida y el falta envido se ajustan
// solos. El azar sale de la semilla, no de Math.random: el mismo código de
// semilla reparte las mismas cartas.
function startAnte() {
  inAnte = true;
  handsPlayed = 0;
  // Los modificadores equipados entran al motor acá: de ahí en adelante el
  // reglamento del ante es el base más lo que rompan ellos.
  game = new TrucoGame({ target: run.goal, rng: run.rng(), mods: run.mods });
  game.on(onEvent);
  hideOverlay();
  paintVitals();
  paintTargetPickers();
  paintRunHud();
  buildModsHud();
  startRoundUI();
}

// Cierra el ante con lo que quedó en la mesa y manda a la tienda o al
// resumen. Se llama desde los dos finales posibles: alguien llegó al
// objetivo, o se agotaron las manos.
function endAnte() {
  if (!inAnte || !run) return;
  inAnte = false;
  const result = run.finishAnte({ scores: game.scores.slice(), handsPlayed });
  saveRun(run);               // guardar acá es lo que permite cerrar y seguir
  clearTable();
  game = null;
  busy = false;
  paintRunHud();
  paintModsHud();
  // Quedarse sin manos no dispara el 'game-over' del motor, así que el
  // golpe de audio de esa derrota lo damos nosotros.
  if (result && !result.won && result.reason === 'hands') audio.play('gameLose');
  if (run.over) showRunOver();
  else showScreen('shop');
}

// Franja de la corrida en el HUD: en qué ante estás, qué se pide, cuántas
// manos quedan y con cuánto contás. Es el contexto que la mesa no da.
function paintRunHud() {
  const show = Boolean(run) && inAnte;
  el.runHud.hidden = !show;
  if (!show) return;
  el.runAnte.textContent = t('hud.ante', run.ante, ANTE_COUNT);
  el.runGoal.textContent = t('hud.goal', run.goal);
  el.runHands.textContent = t('hud.hands', Math.min(handsPlayed, run.hands), run.hands);
  el.runMoney.textContent = t('hud.money', run.money);
}

// El final de una corrida no puede sonar igual que el final de un ante: es
// lo que se perdió entero. Ganarla se festeja con fuegos; perderla baja de
// tono y se apaga.
function showRunOver() {
  const won = run.phase === 'won';
  audio.play(won ? 'gameWin' : 'gameLose', { volume: 1, rate: won ? 1 : 0.88 });
  if (won) {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        fx.burst(Math.random() * innerWidth, innerHeight * 0.65,
          { count: 40, hue: Math.random() * 360, power: 12 });
        audio.play('point', { volume: 0.7 });
      }, i * 170);
    }
  } else {
    fx.kick(18);
    setTimeout(() => audio.play('reject', { volume: 0.7, rate: 0.75 }), 420);
  }
  showScreen('runover');
}

// ---- modificadores ----------------------------------------------------

// El arte de un modificador es el palo que le toca, chico y recortado: el
// mismo lenguaje que las fichas de modo, en otro tamaño.
function modSuit(suit) {
  const [main, dark, light] = SUIT_COLORS[suit];
  return `<span class="mod-suit" style="--suit:${main};--suit-dark:${dark};--suit-light:${light}">${
    sprite(`palo-${suit}`, SUITS[suit], 'art-suit')}</span>`;
}

// Franja de equipados, a la vista durante toda la mano. Las ranuras libres
// se muestran igual: saber que te queda lugar es parte de la decisión en la
// tienda siguiente.
function buildModsHud() {
  el.modsHud.innerHTML = '';
  if (!run) return;
  for (let i = 0; i < MOD_LIMIT; i++) {
    const mod = modById(run.mods[i]);
    const chip = document.createElement('span');
    chip.className = mod ? `mod-chip rarity-${mod.rarity}` : 'mod-chip is-empty';
    if (mod) {
      chip.dataset.mod = mod.id;
      chip.innerHTML = `${modSuit(mod.suit)}<span class="mod-chip-name"></span>`;
    }
    el.modsHud.appendChild(chip);
  }
  paintModsHud();
}

function paintModsHud() {
  el.modsHud.hidden = !(run && inAnte);
  if (!run) return;
  for (const chip of el.modsHud.children) {
    const mod = modById(chip.dataset.mod);
    if (!mod) continue;
    chip.querySelector('.mod-chip-name').textContent = t(`mod.${mod.id}`);
    chip.title = `${t(`mod.${mod.id}`)} — ${t(`mod.${mod.id}Desc`)}`;
  }
}

// Un modificador que actúa sin que se vea no se entiende: cuando dispara,
// su ficha pega un golpe y el nombre salta sobre la mesa. El motor avisa en
// el momento exacto, así que acá sólo hay que mostrarlo.
function flashMod(id) {
  const mod = modById(id);
  if (!mod) return;
  const chip = el.modsHud.querySelector(`[data-mod="${id}"]`);
  if (chip) {
    chip.classList.remove('fired');
    void chip.offsetWidth;            // reinicia la animación
    chip.classList.add('fired');
    setTimeout(() => chip.classList.remove('fired'), 620);
    fx.burstAt(chip, { count: 14, hue: 45, power: 5 });
  }
  fx.pop(t(`mod.${id}`), { over: el.table, tone: 'good' });
  fx.kick(8);
  audio.play('point', { volume: 0.9 });
}

function paintRunScreens() {
  if (!run) return;
  el.runTitle.textContent = t('run.title', run.ante, ANTE_COUNT);
  el.runText.textContent = resumedRun && run.ante > 1
    ? t('run.resumed', run.ante)
    : t('run.text', run.goal, run.hands);
  el.runStatGoal.textContent = String(run.goal);
  el.runStatHands.textContent = String(run.hands);
  el.runStatMoney.textContent = String(run.money);
  el.runLabelGoal.textContent = t('run.labelGoal');
  el.runLabelHands.textContent = t('run.labelHands');
  el.runLabelMoney.textContent = t('run.labelMoney');
  el.runLabelMods.textContent = t('run.mods');
  paintRunMods();

  // La semilla se escribe sólo antes de la primera mano de la corrida:
  // cambiarla a mitad de camino sería rebobinar el azar ya usado.
  const fresh = run.ante === 1 && run.history.length === 0;
  el.runLabelSeed.textContent = fresh ? t('run.seed') : t('run.seedLocked');
  el.runSeedInput.disabled = !fresh;
  if (document.activeElement !== el.runSeedInput) el.runSeedInput.value = run.seed;
  el.runStart.textContent = t('run.start');
  el.runRestart.textContent = t('run.restart');
  el.runRestart.hidden = fresh;        // una corrida sin jugar ya es nueva
  el.runBack.textContent = t('common.back');

  el.shopTitle.textContent = t('shop.title');
  el.shopText.textContent = run.full
    ? `${t('shop.full')} ${t('shop.money', run.money)}`
    : `${t('shop.pick')}. ${t('shop.money', run.money)}`;
  el.shopNext.textContent = run.full ? t('shop.next') : t('shop.skip');

  const s = run.summary();
  el.runoverTitle.textContent = t(s.won ? 'runover.win' : 'runover.lose');
  el.runoverText.textContent = s.won
    ? t('runover.reasonWin')
    : t(s.last?.reason === 'rival' ? 'runover.reasonRival' : 'runover.reasonHands');
  el.runSummary.innerHTML = '';
  for (const line of [
    t('runover.cleared', s.cleared, s.antes),
    t('runover.moneyLeft', s.money),
    t('runover.seed', s.seed),
  ]) {
    const li = document.createElement('li');
    li.textContent = line;
    el.runSummary.appendChild(li);
  }
  el.runoverAgain.textContent = t('runover.again');
  el.runoverBack.textContent = t('common.back');
}

// Las ranuras de la antesala: lo equipado con su arte, y lo libre como
// hueco punteado. Que el hueco se vea es lo que promete lo que falta.
function paintRunMods() {
  el.runMods.innerHTML = '';
  for (let i = 0; i < MOD_LIMIT; i++) {
    const mod = modById(run.mods[i]);
    const slot = document.createElement('span');
    slot.className = mod ? `run-mod is-filled rarity-${mod.rarity}` : 'run-mod';
    if (mod) {
      slot.innerHTML = `${modSuit(mod.suit)}<span class="run-mod-name"></span>`;
      slot.querySelector('.run-mod-name').textContent = t(`mod.${mod.id}`);
      slot.title = `${t(`mod.${mod.id}`)} — ${t(`mod.${mod.id}Desc`)}`;
    } else {
      slot.textContent = t('run.modEmpty');
    }
    el.runMods.appendChild(slot);
  }
}

// La oferta de la tienda: tres fichas con nombre, rareza y qué rompen. El
// texto completo va en la ficha y no en un globo, porque la decisión se toma
// leyendo las tres juntas.
function buildShopOffer() {
  el.shopSlots.innerHTML = '';
  if (!run) return;
  for (const id of run.offer()) {
    const mod = modById(id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `shop-slot rarity-${mod.rarity}`;
    card.dataset.mod = id;
    const accent = SUIT_COLORS[mod.suit][0];
    card.style.setProperty('--accent', accent);
    card.style.setProperty('--accent-soft', softColor(accent, 0.26));
    card.innerHTML = `
      ${modSuit(mod.suit)}
      <span class="shop-rarity"></span>
      <span class="shop-name"></span>
      <span class="shop-desc"></span>`;
    card.querySelector('.shop-rarity').textContent = t(`rarity.${mod.rarity}`);
    card.querySelector('.shop-name').textContent = t(`mod.${id}`);
    card.querySelector('.shop-desc').textContent = t(`mod.${id}Desc`);
    card.disabled = run.full;
    if (!run.full) {
      card.addEventListener('click', () => takeMod(id));
      card.addEventListener('pointerenter', () => audio.play('hover'));
    }
    el.shopSlots.appendChild(card);
  }
}

// Llevarse uno cierra la tienda: es uno por tienda, así que elegir es
// elegir. Lo que no te llevaste queda en la semilla, no se pierde al azar.
function takeMod(id) {
  audio.play('accept');
  run.takeMod(id);
  run.leaveShop();
  saveRun(run);
  resumedRun = false;
  showScreen('run');
}

el.runStart.addEventListener('click', () => { audio.play('click'); startAnte(); });
el.runRestart.addEventListener('click', () => { audio.play('click'); freshRun(); });
el.runBack.addEventListener('click', () => { audio.play('click'); showScreen('modes'); });
el.shopNext.addEventListener('click', () => {
  audio.play('click');
  run.leaveShop();
  saveRun(run);
  resumedRun = false;
  showScreen('run');
});
el.runoverAgain.addEventListener('click', () => { audio.play('click'); freshRun(); });
el.runoverBack.addEventListener('click', () => {
  audio.play('click');
  clearRun();
  run = null;
  showScreen('modes');
});

// Escribir una semilla arranca otra corrida con ese código: es la forma de
// repetir una mano que salió rara o de competir por el mismo reparto.
el.runSeedInput.addEventListener('input', () => {
  const clean = normalizeSeed(el.runSeedInput.value);
  el.runSeedInput.value = clean;
  if (isSeed(clean) && clean !== run.seed) {
    run = new Run({ seed: clean });
    saveRun(run);
    paintRunScreens();
  }
});
// Si quedó a medias, se vuelve a lo que de verdad tiene la corrida.
el.runSeedInput.addEventListener('blur', () => { el.runSeedInput.value = run?.seed ?? ''; });

// ---- barras de vida ---------------------------------------------------

// No se muestra cuántos puntos hiciste sino cuánta vida te queda: los
// puntos del otro son el daño. Tu vida es lo que le falta al rival para
// llegar al objetivo.
const lifeOf = (player) => game.target - game.scores[other(player)];

const vitalOf = (player) => (player === HUMAN ? el.vitalHuman : el.vitalCpu);
const numOf = (player) => (player === HUMAN ? el.numHuman : el.numCpu);

// Las muescas son una por punto, así que dependen del largo. El atributo
// aparte es para la raya de la mitad: depender de cómo el navegador
// serializa el estilo en línea sería frágil.
function setVitalsTarget(value) {
  el.vitals.style.setProperty('--target', String(value));
  el.vitals.dataset.target = String(value);
}

// Barras llenas, sin partida en curso.
function resetVitals() {
  for (const root of [el.vitalHuman, el.vitalCpu]) {
    root.querySelector('.vital-fill').style.transform = 'scaleX(1)';
    root.querySelector('.vital-chip').style.transform = 'scaleX(1)';
    root.classList.remove('is-mid', 'is-low', 'hit');
  }
  el.numHuman.textContent = String(target);
  el.numCpu.textContent = String(target);
  setVitalsTarget(target);
}

function paintVitals() {
  if (!game) return;
  setVitalsTarget(game.target);
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
  if (inAnte) { handsPlayed++; paintRunHud(); }
  TRICK_SLOT.forEach((s) => (s.innerHTML = ''));
  el.handCpu.innerHTML = '';
  el.handHuman.innerHTML = '';
  game.hands[CPU].forEach((_, i) => {
    const c = renderCard(null, { faceDown: true });
    // El movimiento de entrada lo pone el reparto, no el CSS: la carta no
    // aparece en la mano, llega volando desde el mazo.
    c.classList.add('flown');
    el.handCpu.appendChild(c);
  });
  fan(el.handCpu, FAN_CPU);
  drawHumanHand();
  dealFromDeck();
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
    // Vale lo mismo al rehacer la mano después de cada carta jugada: las
    // que quedan ya estaban ahí, no se reparten de nuevo.
    c.classList.add('flown');
    c.addEventListener('click', () => human({ type: 'play', cardId: card.id }));
    c.addEventListener('pointerenter', () => {
      if (!c.classList.contains('disabled')) audio.play('hover');
    });
    el.handHuman.appendChild(c);
  });
  fan(el.handHuman, FAN_HUMAN);
}

// Repartir es el mismo gesto que tirar una carta, así que es el mismo
// vuelo: cada carta sale del mazo de la esquina y aterriza en su lugar del
// abanico. Van de a una y alternadas, como se reparte de verdad —una para
// vos, una para el rival— y cada una con su sonido en el momento en que
// sale, no todos juntos al principio.
const DEAL_GAP = 95;

function dealFromDeck() {
  // Sin el barajado de fondo: dura más que el reparto entero y se superpone
  // con las seis tomas de carta. Alcanza con el golpe de cada carta al
  // salir del mazo, que además está sincronizado con el vuelo.
  fx.kick(6);

  const pile = el.deck.querySelector('.deck-pile');
  const from = pile?.getBoundingClientRect();

  // Orden de reparto: alternando, empezando por el que es mano.
  const hands = [[...el.handHuman.children], [...el.handCpu.children]];
  const order = [];
  for (let i = 0; i < 3; i++) {
    for (const player of [game.mano, other(game.mano)]) {
      const node = hands[player][i];
      if (node) order.push(node);
    }
  }

  order.forEach((node, i) => {
    const delay = i * DEAL_GAP;
    setTimeout(() => audio.play('deal'), delay);
    // Termina en su posición del abanico, que el abanico ya dejó escrita en
    // la carta: el vuelo tiene que aterrizar ahí y no en la posición neutra.
    const rot = parseFloat(node.style.getPropertyValue('--rot')) || 0;
    const lift = parseFloat(node.style.getPropertyValue('--lift')) || 0;
    flyInto(node, from, {
      spin: (Math.random() - 0.5) * 24,     // sale torcida, como salen del mazo
      delay,
      rest: `rotate(${rot}deg) translateY(${lift}px)`,
      anticipate: false,
    });
  });
}

// ---- reloj del turno --------------------------------------------------

// Cada decisión tuya tiene diez segundos. No es una regla del truco: es
// ritmo. Sin reloj, una mano puede quedarse quieta todo lo que el jugador
// quiera, y lo que queremos es que la mesa empuje.
//
// Se puede apagar, y se elige antes de empezar: a mitad de partida sería
// cambiar las reglas con la mano puesta. Por eso se bloquea igual que el
// largo de la partida.
const TURN_TIME = 10000;
// Desde acá empieza a quemar: el último tercio es el que aprieta.
const BURN_FROM = 4000;
const TIMER_KEY = 'truco.timer';

function readTimer() {
  try {
    const saved = localStorage.getItem(TIMER_KEY);
    if (saved === 'on') return true;
    if (saved === 'off') return false;
  } catch { /* modo privado */ }
  return true;
}

let timerOn = readTimer();
let deadline = 0;        // cuándo se vence el turno, en tiempo de rAF
let timerRaf = 0;
let lastTick = -1;       // último segundo que ya sonó
let lastEmber = 0;

// El mismo interruptor en tres lugares: el menú de pausa y las dos
// pantallas previas, la del largo del clásico y la antesala del ante. Donde
// sea que estés por empezar, la decisión está ahí.
const TIMER_TOGGLES = () => [
  { btn: el.menuTimer, label: el.labelTimer },
  { btn: el.lengthTimer, label: el.labelTimerLength },
  { btn: el.runTimer, label: el.labelTimerRun },
];

function paintTimerToggles() {
  // Con una partida en curso no se cambia: sería mover las reglas con la
  // mano puesta, igual que el largo.
  const locked = Boolean(game);
  for (const { btn, label } of TIMER_TOGGLES()) {
    if (!btn) continue;
    label.textContent = locked ? t('timer.locked') : t('timer.label');
    btn.textContent = timerOn ? t('menu.on') : t('menu.off');
    btn.setAttribute('aria-pressed', String(timerOn));
    btn.classList.toggle('is-off', !timerOn);
    btn.disabled = locked;
  }
}

function setTimerEnabled(value) {
  if (value === timerOn) return;
  timerOn = value;
  try { localStorage.setItem(TIMER_KEY, value ? 'on' : 'off'); } catch { /* modo privado */ }
  if (!value) stopTimer();
  paintTimerToggles();
  syncTimer();
}

// El reloj corre sólo cuando la mesa te está esperando de verdad: tu turno,
// sin animación en curso, sin menú abierto y sin cartel encima.
const timerRunning = () => Boolean(
  timerOn && game && !busy && !paused && el.overlay.hidden && el.menu.hidden
  && game.turn === HUMAN && !game.roundOver && game.winner === null,
);

function syncTimer() {
  if (!timerRunning()) return stopTimer();
  if (deadline) return;                    // ya está corriendo este turno
  deadline = performance.now() + TURN_TIME;
  lastTick = -1;
  el.turnTimer.hidden = false;
  timerRaf = requestAnimationFrame(tickTimer);
}

function stopTimer() {
  if (timerRaf) cancelAnimationFrame(timerRaf);
  timerRaf = 0;
  deadline = 0;
  el.turnTimer.hidden = true;
  el.turnTimer.classList.remove('is-low');
  setHeat(0);
}

// El calor es un solo número de 0 a 1: lo usan el borde de la pantalla, el
// color de la barra y las brasas. Que sea uno solo es lo que hace que todo
// suba junto en vez de cada efecto por su cuenta.
function setHeat(value) {
  document.documentElement.style.setProperty('--heat', String(value));
}

function tickTimer(now) {
  if (!deadline) return;
  if (!timerRunning()) return stopTimer();

  const left = Math.max(0, deadline - now);
  const ratio = left / TURN_TIME;
  const heat = left > BURN_FROM ? 0 : 1 - left / BURN_FROM;

  el.turnTimerFill.style.transform = `scaleX(${ratio})`;
  // La llama va en la punta de lo que queda de vela, no en un lugar fijo.
  el.turnTimer.style.setProperty('--burn', String(ratio));
  el.turnTimerNum.textContent = (left / 1000).toFixed(1);
  el.turnTimer.classList.toggle('is-low', heat > 0);
  setHeat(heat);

  // Brasas saliendo de la barra, cada vez más seguido. El fuego no es
  // decoración: es el aviso de que se te viene encima.
  if (heat > 0 && !prefersReduced() && now - lastEmber > 150 - heat * 110) {
    lastEmber = now;
    const r = el.turnTimer.getBoundingClientRect();
    fx.burst(r.left + r.width * ratio * Math.random(), r.top + r.height / 2, {
      count: 2 + Math.round(heat * 4),
      hue: 20 + Math.random() * 25,
      power: 2 + heat * 3,
      gravity: -0.08,                      // las brasas suben
    });
  }

  // Un tic por segundo en el tramo caliente, cada vez más agudo.
  const secs = Math.ceil(left / 1000);
  if (heat > 0 && secs !== lastTick) {
    lastTick = secs;
    audio.play('click', { volume: 0.5 + heat * 0.4, rate: 1.1 + (4 - secs) * 0.12 });
    fx.kick(3 + heat * 5);
  }

  if (left <= 0) { stopTimer(); return timeUp(); }
  timerRaf = requestAnimationFrame(tickTimer);
}

// Se acabó el tiempo. La mesa juega por vos, y juega a lo seguro: si hay un
// canto en el aire, no quiere; si no, tira la carta más baja. Perder la
// mano por no decidir es castigo suficiente sin inventarle otro.
function timeUp() {
  if (!game || game.turn !== HUMAN) return;
  const legal = game.legalActions(HUMAN);
  if (!legal.length) return;
  let action = legal.find((a) => a.type === 'reject');
  if (!action) {
    const plays = legal.filter((a) => a.type === 'play');
    const power = (id) => game.hands[HUMAN].find((c) => c.id === id)?.power ?? 99;
    action = plays.sort((a, b) => power(a.cardId) - power(b.cardId))[0] ?? legal[0];
  }
  fx.bubble(t('bubble.timeout'), { ...mouth(HUMAN), tone: 'bad' });
  fx.kick(18);
  audio.play('reject');
  say(t('log.timeout'));
  human(action);
}

// ---- entrada del jugador ---------------------------------------------

function human(action) {
  if (!game || paused || busy || game.turn !== HUMAN || !game.isLegal(HUMAN, action)) return;
  busy = true;
  fx.kick(5);            // ninguna acción pasa sin que la mesa lo acuse
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

  // Lo que pagaría la ronda desde tu lado: hay modificadores que cambian el
  // número sólo a tu favor, y el cartel tiene que decir lo que vas a cobrar.
  // Va en `peek` porque mirar el cartel no es disparar nada.
  const v = game.peek(() => game.roundValue(HUMAN));
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
  // El reloj arranca y se corta solo, siguiendo al estado: render() se
  // llama después de cada cambio, así que es el único lugar que necesita
  // saber de él.
  syncTimer();
}

// El envido no cambia durante la ronda: se cuenta sobre las tres cartas
// repartidas, se hayan jugado o no. Sólo se reescribe cuando cambia de
// verdad, al repartir.
let lastEnvido = null;

function renderEnvido() {
  const points = game.peek(() => game.envidoPointsOf(HUMAN));
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

  // Aceptar primero, después lo que se puede subir, y negar siempre
  // último. Que "no quiero" quede siempre en el mismo extremo hace que se
  // apriete sin leer; si se corriera según cuántos recantos haya, habría
  // que buscarlo cada vez.
  if (game.pending) add(t('action.accept'), 'good', { type: 'accept' });

  for (const a of legal) {
    if (a.type === 'truco') {
      add(callLabel(TRUCO_CHAIN[game.trucoLevel].key), 'hot', a);
    } else if (a.type === 'envido') {
      add(callLabel(a.call), '', a);
    }
  }

  if (game.pending) add(t('action.reject'), 'bad', { type: 'reject' });
}

// La carta no aparece en la mesa: llega. Se la pone en su lugar final y se
// la dibuja arrancando desde donde estaba en la mano, así el navegador
// anima la diferencia. Es rápido —poco más de dos décimas— pero con
// recorrido: lo que no se puede es que parezca que se teletransportó.
//
// El tramo final se pasa un poco y vuelve: ese rebote mínimo es lo que hace
// que la carta se sienta apoyada contra la mesa y no posada.
const FLIGHT = 280;

function flyInto(node, from, { spin = 0, delay = 0, rest = '', anticipate = true, quiet = false } = {}) {
  if (!from || prefersReduced()) return;
  const to = node.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = from.width / to.width || 1;
  // Dónde termina. Una carta jugada queda derecha sobre la mesa, pero una
  // repartida tiene que aterrizar en su lugar del abanico: si el vuelo
  // terminara en la posición neutra, al soltarla pegaría un salto hasta su
  // inclinación.
  const settle = rest || 'translate(0px, 0px) rotate(0deg)';
  node.classList.add('flying', 'flown');
  // Chispas en el punto de salida, no sólo en el de llegada: marcan de
  // dónde vino y el ojo sigue el recorrido en vez de buscar la carta.
  // La muestra de la portada vuela callada: el golpe de pantalla y las
  // chispas viven en la capa de la mesa, que ahí está tapada.
  if (!quiet) {
    setTimeout(() => fx.burst(from.left + from.width / 2, from.top + from.height / 2,
      { count: anticipate ? 8 : 5, hue: 200, power: 3 }), delay);
  }
  // Anticipación, viaje, impacto y rebote. La carta primero tira para atrás
  // —se hunde un poco en la mano y se agranda, como quien la levanta para
  // tirarla—, después sale, llega pasada de tamaño y se asienta. Son cuatro
  // tiempos en menos de un tercio de segundo, pero sin el primero el golpe
  // no tiene de dónde venir.
  const frames = [
    { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(${scale})`, offset: 0, easing: 'ease-out' },
    { transform: `translate(${dx * 0.06}px, ${dy * 0.05}px) rotate(${spin * 0.06}deg) scale(1.1)`, offset: 0.72, easing: 'ease-out' },
    { transform: `${settle} scale(0.97)`, offset: 0.86 },
    { transform: `${settle} scale(1)`, offset: 1 },
  ];
  // La anticipación es de quien tira: la carta junta fuerza antes de salir.
  // Repartiendo no va, porque la que empuja es la mano que da, no la carta.
  if (anticipate) {
    frames.splice(1, 0, {
      transform: `translate(${dx * 1.1}px, ${dy * 1.12}px) rotate(${spin * 1.3}deg) scale(${scale * 1.08})`,
      offset: 0.16,
      easing: 'cubic-bezier(0.3, 0, 0.2, 1)',
    });
  }
  // `backwards` deja la carta quieta en el mazo mientras espera su turno:
  // sin eso, las seis aparecerían repartidas y recién después saldrían.
  const flight = node.animate(frames, {
    duration: FLIGHT,
    delay,
    fill: 'backwards',
    easing: 'cubic-bezier(0.22, 0.85, 0.3, 1)',
  });
  // El impacto va cuando llega, no cuando sale: el golpe de pantalla tiene
  // que coincidir con la carta tocando la mesa.
  if (!quiet) {
    setTimeout(() => {
      fx.kick(anticipate ? 9 : 4);
      fx.burstAt(node, { count: anticipate ? 10 : 6, hue: 45, power: anticipate ? 4 : 3 });
    }, delay + FLIGHT * 0.72);
  }
  flight.finished.then(() => node.classList.remove('flying')).catch(() => {});
}

function say(text) { el.log.textContent = text; }

// De qué boca sale cada globo. El de abajo habla hacia arriba y el de
// arriba hacia abajo, para que la cola apunte siempre al que habla.
const mouth = (player) => (player === HUMAN
  ? { from: el.handHuman, dir: 'down' }
  : { from: el.handCpu, dir: 'up' });

const other = (player) => (player === HUMAN ? CPU : HUMAN);

// Cuánto pesa cada canto, para escalar el cartel, la sacudida y el grito.
// Es el escalón dentro de su cadena, no los puntos: lo que sube es la
// apuesta, y eso se siente igual en el truco que en el envido.
const CALL_WEIGHT = {
  truco: 1, retruco: 2, 'vale-cuatro': 3,
  envido: 1, 'real-envido': 2, 'falta-envido': 3,
};

// ---- eventos del motor -> efectos -------------------------------------

function onEvent(e) {
  switch (e.type) {
    case 'card-played': {
      const slot = TRICK_SLOT[e.player];
      // De dónde sale la carta, medido ANTES de sacarla de la mano: es lo
      // que convierte el cambio de lugar en un viaje.
      const source = e.player === HUMAN
        ? el.handHuman.querySelector(`[data-card-id="${e.card.id}"]`)
        : el.handCpu.lastElementChild;
      const from = source?.getBoundingClientRect();
      const spin = Number(getComputedStyle(source ?? el.stage)
        .getPropertyValue('--rot').replace('deg', '')) || 0;

      const node = renderCard(e.card);
      node.classList.add('played');
      slot.innerHTML = '';
      slot.appendChild(node);
      if (e.player === HUMAN) drawHumanHand();
      else {
        el.handCpu.lastElementChild?.remove();
        fan(el.handCpu, FAN_CPU);
      }
      // El vuelo se encarga de las chispas de salida y del golpe de
      // llegada; acá sólo queda el envión de soltarla.
      flyInto(node, from, { spin });
      fx.kick(4);
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
      fx.kick(e.result === HUMAN ? 14 : 10);
      audio.play(e.result === HUMAN ? 'trickWin' : 'trickLose');
      say(e.result === HUMAN ? t('log.youWinTrick') : t('log.rivalWinsTrick'));
      break;
    }
    case 'call': {
      const label = callLabel(e.call);
      // Cada escalón del canto pega más que el anterior: el cartel entra más
      // grande, la pantalla salta más y el grito sale más grave. Un vale
      // cuatro vale el doble que un truco y tiene que sonar al doble.
      const step = CALL_WEIGHT[e.call] ?? 1;
      const loud = e.kind === 'truco';
      fx.bubble(`¡${label}!`, {
        ...mouth(e.player),
        tone: e.kind,
        scale: 1 + step * (loud ? 0.2 : 0.14),
        hold: 1500 + step * 180,
      });
      fx.kick((loud ? 10 : 7) + step * 5);
      if (step >= 3) fx.burstAt(mouth(e.player).from, { count: 22, hue: loud ? 350 : 200, power: 7 });
      audio.play(loud ? 'truco' : 'envido', { rate: 1.1 - step * 0.07 });
      say(e.player === HUMAN ? t('log.youCall', label) : t('log.rivalCalls', label));
      break;
    }
    case 'mod-fire':
      flashMod(e.id);
      break;
    case 'card-swapped':
      // La mano cambió fuera de turno: hay que volver a dibujarla, o el
      // jugador clickea una carta que ya no tiene.
      if (e.player === HUMAN) drawHumanHand();
      fx.kick(9);
      audio.play('deal');
      break;
    case 'fold':
      fx.bubble(t('bubble.fold'), { ...mouth(e.player), tone: 'bad' });
      fx.kick(12);
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
      fx.kick(10);
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
      fx.kick(8);
      audio.play('accept');

      setTimeout(() => {
        fx.bubble(String(manoPoints), { ...mouth(manoPlayer), tone: 'envido', hold: 1600 });
        fx.kick(10);
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
      fx.kick(10);
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

      // El número crece con lo que se llevó: un vale cuatro tiene que
      // ocupar la mesa, un punto suelto no.
      fx.pop(`−${e.points}`, {
        over: el.table,
        tone: mine ? 'good' : 'bad',
        scale: 1 + Math.min(e.points, 6) * 0.14,
      });

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
      // En una corrida el fin de partida es el fin del ante: lo que sigue
      // es la tienda o el resumen, no una revancha.
      if (inAnte) { setTimeout(endAnte, 900); break; }
      setTimeout(() => showGameOver(
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
    // Límite de manos del ante: si ya se jugaron todas y el objetivo no se
    // alcanzó, el ante se pierde acá, sin repartir otra vez.
    if (inAnte && handsPlayed >= run.hands) return endAnte();
    game.nextRound();
    startRoundUI();
  }, 1100);
}

// El cartel de fin de partida se queda con las claves, no con el texto ya
// resuelto: si el jugador cambia de idioma con el cartel abierto, tiene que
// repintarse solo.
let gameoverKeys = null;

function showGameOver(title, text, btn, onClick) {
  gameoverKeys = { title, text, btn };
  paintGameOver();
  el.gameoverBtn.onclick = () => { audio.play('click'); onClick(); };
  showScreen('gameover');
  if (title === 'game.win') {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => fx.burst(Math.random() * innerWidth, innerHeight * 0.6,
        { count: 40, hue: Math.random() * 360, power: 12 }), i * 180);
    }
  }
}

// Una clave suelta, o una clave con argumentos: ['hud.pot', 3].
const resolve = (k) => (Array.isArray(k) ? t(...k) : t(k));

function paintGameOver() {
  // El de salir no depende del resultado: está siempre y dice lo mismo.
  el.gameoverQuit.textContent = t('game.exit');
  if (!gameoverKeys) return;
  el.gameoverTitle.textContent = resolve(gameoverKeys.title);
  el.gameoverText.textContent = resolve(gameoverKeys.text);
  el.gameoverBtn.textContent = resolve(gameoverKeys.btn);
}

// Terminada la partida, la revancha no puede ser la única puerta: quien no
// quiere otra vuelve a la portada. Es el mismo camino que abandonar, sólo
// que acá no hay nada que abandonar.
el.gameoverQuit.addEventListener('click', () => { audio.play('click'); quitMatch(); });

// ---- portada ----------------------------------------------------------

// La portada es la cara del juego: el título a la izquierda con los accesos
// debajo, y a la derecha una partida que se juega sola para que se vea de
// qué se trata antes de apretar nada.

// Continuar sólo tiene sentido si hay una corrida guardada a medio jugar.
// Se consulta cada vez que se vuelve a la portada, porque entre una visita
// y otra pudo terminarse o abandonarse.
function paintHome() {
  el.homeTitle.textContent = t('home.title');
  const saved = loadRun();
  el.homeContinue.hidden = !saved;
  el.homeContinue.textContent = t('home.continue');
  el.homeNew.textContent = t('home.new');
  el.homeSettings.textContent = t('home.settings');
  el.homeShare.textContent = t('home.share');
  // Instagram y Facebook todavía no tienen a dónde apuntar: se muestran
  // apagados con su etiqueta, igual que los modos que faltan.
  for (const btn of [el.socialInstagram, el.socialFacebook]) {
    btn.title = `${btn.textContent === 'IG' ? 'Instagram' : 'Facebook'} · ${t('modes.soon')}`;
  }
  el.socialGithub.title = 'GitHub';
}

el.homeNew.addEventListener('click', () => { audio.play('click'); showScreen('modes'); });
el.homeContinue.addEventListener('click', () => { audio.play('click'); openRun(); });
// La configuración es el mismo menú de pausa. Se abre a la fuerza porque la
// portada ya es un cartel, y el guardia que impide apilar carteles es para
// la partida, no para acá.
el.homeSettings.addEventListener('click', () => { audio.play('click'); openMenu(true); });

for (const btn of [el.socialInstagram, el.socialFacebook]) {
  btn.addEventListener('click', () => audio.play('reject', { volume: 0.4 }));
}

// Compartir: la bandeja nativa si el navegador la tiene (es lo que sirve en
// el teléfono), y si no, el link al portapapeles. Que el botón avise que
// copió es lo único que convierte un clic mudo en una acción.
el.homeShare.addEventListener('click', async () => {
  audio.play('click');
  const url = location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: t('home.title'), text: t('home.shareText'), url });
      return;
    }
  } catch { return; }      // canceló la bandeja nativa: no hay nada que avisar
  try {
    await navigator.clipboard.writeText(url);
    flashShared();
  } catch { /* sin portapapeles no se puede hacer más nada */ }
});

function flashShared() {
  el.homeShare.textContent = t('home.shared');
  el.homeShare.disabled = true;
  fx.burstAt(el.homeShare, { count: 18, hue: 45, power: 5 });
  setTimeout(() => {
    el.homeShare.disabled = false;
    el.homeShare.textContent = t('home.share');
  }, 1600);
}

// ---- la partida de muestra --------------------------------------------

// Una partida que se juega sola al lado del título. No es una animación de
// cartas apareciendo: es el motor de verdad jugando, con sus tiempos. Las
// cartas se reparten, se tiran una por una, se canta y la mano se resuelve
// antes de levantar. Si fuera más rápido se vería como un parpadeo, y lo
// que tiene que leerse es que ahí adentro hay alguien jugando.
//
// No usa la IA del juego: esa está escrita para el asiento del rival y acá
// juegan los dos lados. Alcanza con elegir cualquier acción legal —lo mismo
// que hace el test de humo— esquivando irse al mazo y el "no quiero", que
// son las dos formas de que una mano se corte antes de mostrarse.
const DEMO_TARGET = 9;

// Los tiempos de la muestra. Cada beat es una pausa que en una mesa de
// verdad existe: pensar, cantar y mirar quién se llevó la mano.
const DEMO_BEAT = {
  deal: 1200,
  think: 850,
  call: 1050,
  trick: 1100,
  round: 1400,
};

let demoGame = null;
let demoRunning = false;
let demoGen = 0;            // cada arranque invalida el bucle anterior
let demoShoutTimer = 0;

function demoAction(g) {
  const actions = g.legalActions(g.turn);
  if (!actions.length) return null;
  const lively = actions.filter((a) => a.type !== 'fold' && a.type !== 'reject');
  const pool = lively.length ? lively : actions;
  return pool[Math.floor(Math.random() * pool.length)];
}

function startDemo() {
  // Con los efectos apagados no hay muestra: lo que se pidió apagar es
  // justamente esto, cosas moviéndose solas en pantalla.
  if (demoRunning || prefersReduced()) return;
  demoRunning = true;
  demoPlay(++demoGen);
}

function stopDemo() {
  demoRunning = false;
  demoGen++;                // el bucle en curso se corta en su próxima espera
  demoGame = null;
  clearTimeout(demoShoutTimer);
  el.demoShout.hidden = true;
  for (const node of [el.demoHandCpu, el.demoHandHuman, el.demoSlotCpu, el.demoSlotHuman]) {
    node.innerHTML = '';
  }
}

// Espera que avisa si la muestra se apagó mientras tanto. Todo el bucle se
// corta mirando esto: sin eso, salir de la portada dejaría una partida
// fantasma repartiendo sobre una pantalla que ya no está.
const demoWait = (gen, ms) => new Promise((resolve) => {
  setTimeout(() => resolve(gen === demoGen), ms);
});

async function demoPlay(gen) {
  while (gen === demoGen) {
    demoGame = new TrucoGame({ target: DEMO_TARGET });
    demoDeal();
    if (!await demoWait(gen, DEMO_BEAT.deal)) return;

    while (gen === demoGen && demoGame.winner === null) {
      if (demoGame.roundOver) {
        if (!await demoWait(gen, DEMO_BEAT.round)) return;
        if (demoGame.winner !== null) break;
        demoGame.nextRound();
        demoDeal();
        if (!await demoWait(gen, DEMO_BEAT.deal)) return;
        continue;
      }

      const player = demoGame.turn;
      const action = demoAction(demoGame);
      if (!action) break;

      const tricksBefore = demoGame.trickResults.length;
      demoGame.act(player, action);
      demoShowAction(player, action);

      if (!await demoWait(gen, action.type === 'play' ? DEMO_BEAT.think : DEMO_BEAT.call)) return;

      // Si con esa carta se cerró la mano, se marca quién la ganó y recién
      // después se levanta. Levantar en el momento es lo que hace que no se
      // entienda qué pasó.
      if (demoGame.trickResults.length > tricksBefore) {
        demoMarkTrick();
        if (!await demoWait(gen, DEMO_BEAT.trick)) return;
        demoClearSlots();
      }
    }

    if (!await demoWait(gen, DEMO_BEAT.round)) return;
  }
}

// El punto del que salen las cartas al repartir: el centro de la muestra,
// que es donde está la mesa.
function demoOrigin() {
  const box = el.homeDemo.getBoundingClientRect();
  const w = parseFloat(getComputedStyle(el.homeDemo).getPropertyValue('--card-w')) || 60;
  return {
    left: box.left + box.width / 2 - w / 2,
    top: box.top + box.height / 2 - w * 0.78,
    width: w,
    height: w * 1.55,
  };
}

function demoDeal() {
  demoClearSlots();
  for (const [player, host, fanning] of [
    [CPU, el.demoHandCpu, FAN_CPU],
    [HUMAN, el.demoHandHuman, FAN_HUMAN],
  ]) {
    host.innerHTML = '';
    for (const card of demoGame.hands[player]) host.appendChild(renderCard(card));
    fan(host, fanning);
  }

  // Alternando una y una, como reparte cualquiera.
  const origin = demoOrigin();
  const order = [];
  for (let i = 0; i < 3; i++) {
    for (const host of [el.demoHandHuman, el.demoHandCpu]) {
      if (host.children[i]) order.push(host.children[i]);
    }
  }
  order.forEach((node, i) => demoFly(node, origin, { delay: i * 95, anticipate: false }));
}

// El vuelo de la muestra es el mismo del juego, pero callado: sin golpe de
// pantalla ni chispas, que viven en la capa de la mesa y acá quedarían
// detrás del panel de la portada.
function demoFly(node, from, opts = {}) {
  const rot = parseFloat(node.style.getPropertyValue('--rot')) || 0;
  const lift = parseFloat(node.style.getPropertyValue('--lift')) || 0;
  flyInto(node, from, {
    spin: (Math.random() - 0.5) * 22,
    rest: rot || lift ? `rotate(${rot}deg) translateY(${lift}px)` : '',
    quiet: true,
    ...opts,
  });
}

function demoShowAction(player, action) {
  if (action.type === 'play') return demoPlayCard(player);
  if (action.type === 'accept') return demoShout(player, t('action.accept'), 'good');
  if (action.type === 'reject') return demoShout(player, t('action.reject'), 'bad');
  if (action.type === 'truco') {
    return demoShout(player, callLabel(TRUCO_CHAIN[demoGame.trucoLevel - 1].key), 'truco');
  }
  return demoShout(player, callLabel(action.call), 'envido');
}

// La carta se mueve de la mano a la mesa: se saca el nodo de la mano, se
// pone el suyo en la ranura y se lo hace llegar volando desde donde estaba.
// Es el mismo gesto que en la mesa de verdad.
function demoPlayCard(player) {
  const host = player === CPU ? el.demoHandCpu : el.demoHandHuman;
  const slot = player === CPU ? el.demoSlotCpu : el.demoSlotHuman;
  const card = demoGame.played[player].at(-1);
  if (!card) return;

  const node = host.querySelector(`[data-card-id="${card.id}"]`);
  const from = node?.getBoundingClientRect();
  const spin = parseFloat(node?.style.getPropertyValue('--rot') ?? '') || 0;
  node?.remove();
  fan(host, player === CPU ? FAN_CPU : FAN_HUMAN);

  slot.innerHTML = '';
  const played = renderCard(card);
  played.classList.add('played');
  slot.appendChild(played);
  if (from) demoFly(played, from, { spin });
}

function demoMarkTrick() {
  const result = demoGame.trickResults.at(-1);
  if (result === 'parda') return;
  const won = result === CPU ? el.demoSlotCpu : el.demoSlotHuman;
  const lost = result === CPU ? el.demoSlotHuman : el.demoSlotCpu;
  won.firstElementChild?.classList.add('winner');
  lost.firstElementChild?.classList.add('loser');
}

function demoClearSlots() {
  el.demoSlotCpu.innerHTML = '';
  el.demoSlotHuman.innerHTML = '';
}

// El canto, saliendo del lado del que habla. Es la versión chica del globo
// de la mesa: el de allá se cuelga del escenario del juego, que acá está
// tapado por el panel de la portada.
function demoShout(player, text, tone) {
  const node = el.demoShout;
  node.className = `demo-shout tone-${tone} ${player === CPU ? 'is-cpu' : 'is-human'}`;
  node.textContent = `¡${text}!`;
  node.hidden = false;
  node.style.animation = 'none';
  void node.offsetWidth;            // reinicia la entrada
  node.style.animation = '';
  clearTimeout(demoShoutTimer);
  demoShoutTimer = setTimeout(() => { node.hidden = true; }, 1300);
}

// ---- pantallas del cartel ---------------------------------------------

// El cartel que tapa la mesa tiene varias caras: la portada, el fin de
// partida del clásico, la elección de modo, la del largo, y las tres de la
// corrida: antesala del ante, tienda y resumen final. Una sola a la vez.
const SCREENS = {
  title: () => el.screenTitle,
  gameover: () => el.screenGameover,
  modes: () => el.screenModes,
  length: () => el.screenLength,
  run: () => el.screenRun,
  shop: () => el.screenShop,
  runover: () => el.screenRunover,
};

let screen = 'title';

function showScreen(name) {
  screen = name;
  for (const [key, get] of Object.entries(SCREENS)) get().hidden = key !== name;
  el.overlay.classList.remove('is-closing');
  el.overlay.hidden = false;
  // Cada cara entra con su propia animación, incluso cambiando de una a
  // otra dentro del mismo cartel: hay que reiniciarla a mano, porque la
  // clase ya está puesta desde la cara anterior.
  const card = SCREENS[name]();
  card.classList.remove('screen-in');
  void card.offsetWidth;
  card.classList.add('screen-in');
  // La portada no es un cartel encima de la mesa: es su propio panel, a
  // pantalla completa y con fondo opaco.
  el.overlay.classList.toggle('is-home', name === 'title');
  // Y la partida de muestra vive sólo ahí: afuera no hay motivo para que
  // siga jugando sola en segundo plano.
  if (name === 'title') startDemo();
  else stopDemo();
  paintScreens();
}

// Irse del cartel a la mesa con un fundido. La partida de atrás ya está
// andando mientras el velo se va, así que el cambio se ve como una cámara
// que pasa de la pantalla a la mesa y no como un corte.
function hideOverlay() {
  if (prefersReduced()) { el.overlay.hidden = true; return; }
  el.overlay.classList.add('is-closing');
  setTimeout(() => {
    el.overlay.hidden = true;
    el.overlay.classList.remove('is-closing');
  }, 220);
}

// Qué hace cada modo jugable. Los de 'soon' no necesitan entrada.
const MODE_PICK = {
  classic: () => showScreen('length'),
  free: () => openRun(),
};

// Cada ficha lleva su palo de fondo como arte. No hay ilustraciones, pero
// los palos en pixelart ya son el lenguaje visual del juego, así que a
// tamaño grande y recortados funcionan como una.
// Un color con transparencia, a partir del hexadecimal del palo. Se hace
// acá y no con color-mix en el CSS porque si color-mix no se entiende, se
// cae la declaración entera del degradado y la ficha queda sin arte.
function softColor(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function modeArt(suit) {
  const [main, dark, light] = SUIT_COLORS[suit];
  return `<span class="mode-art" style="--suit:${main};--suit-dark:${dark};--suit-light:${light}">${
    sprite(`palo-${suit}`, SUITS[suit], 'art-suit')}</span>`;
}

function buildModes() {
  el.modes.innerHTML = '';
  for (const mode of MODES) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `mode mode-${mode.size ?? 'small'}${mode.soon ? ' is-soon' : ''}`;
    card.dataset.mode = mode.id;
    const accent = SUIT_COLORS[mode.suit][0];
    card.style.setProperty('--accent', accent);
    card.style.setProperty('--accent-soft', softColor(accent, 0.26));
    card.innerHTML = `
      ${modeArt(mode.suit)}
      <span class="mode-body">
        <span class="mode-name"></span>
        <span class="mode-desc"></span>
      </span>
      <span class="mode-soon"></span>`;
    if (mode.soon) {
      card.disabled = true;
    } else {
      card.addEventListener('click', () => { audio.play('click'); MODE_PICK[mode.id](); });
      card.addEventListener('pointerenter', () => audio.play('hover'));
    }
    el.modes.appendChild(card);
  }
}

function paintScreens() {
  el.modesTitle.textContent = t('modes.title');
  el.modesBack.textContent = t('common.back');
  for (const card of el.modes.children) {
    const id = card.dataset.mode;
    card.querySelector('.mode-name').textContent = t(`modes.${id}`);
    card.querySelector('.mode-desc').textContent = t(`modes.${id}Desc`);
    const soon = card.querySelector('.mode-soon');
    soon.textContent = card.classList.contains('is-soon') ? t('modes.soon') : '';
  }
  el.lengthTitle.textContent = t('length.title');
  el.lengthStart.textContent = t('length.start');
  el.lengthBack.textContent = t('common.back');
  paintRunScreens();
  // La oferta sale de la semilla y del ante, y lleva su texto adentro: se
  // arma al entrar a la tienda y se rearma si cambia el idioma.
  if (screen === 'shop') buildShopOffer();
}

el.modesBack.addEventListener('click', () => { audio.play('click'); showScreen('title'); });
el.lengthBack.addEventListener('click', () => { audio.play('click'); showScreen('modes'); });
el.lengthStart.addEventListener('click', () => { audio.play('click'); newGame(); });

// ---- largo de la partida ----------------------------------------------

// El mismo selector en dos presentaciones: fichas grandes cuando elegir el
// largo es la tarea de la pantalla, y un control compacto cuando es una
// opción más dentro del menú.
function buildTargetPicker(container) {
  const cards = container.dataset.variant === 'cards';
  container.innerHTML = '';
  for (const value of TARGETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.value = String(value);
    if (cards) {
      b.className = 'length-opt';
      b.innerHTML = '<span class="length-num"></span>'
        + '<span class="length-name"></span>'
        + '<span class="length-desc"></span>';
    }
    b.addEventListener('click', () => { audio.play('click'); setTarget(value); });
    if (cards) b.addEventListener('pointerenter', () => audio.play('hover'));
    container.appendChild(b);
  }
}

function paintTargetPickers() {
  paintTimerToggles();
  // Con una partida en curso no se puede cambiar: hacerlo a mitad de
  // camino movería la meta y las barras de vida ya empezadas.
  const locked = Boolean(game);
  el.labelPoints.textContent = locked ? t('menu.pointsLocked') : t('menu.points');
  for (const container of [el.targetMenu, el.targetOverlay]) {
    container.setAttribute('aria-label', t('menu.points'));
    container.setAttribute('aria-disabled', String(locked));
    const cards = container.dataset.variant === 'cards';
    for (const [i, value] of TARGETS.entries()) {
      const b = container.children[i];
      if (!b) continue;
      b.classList.toggle('is-on', value === target);
      b.setAttribute('aria-pressed', String(value === target));
      if (cards) {
        b.querySelector('.length-num').textContent = String(value);
        b.querySelector('.length-name').textContent = t(`length.${value}`);
        b.querySelector('.length-desc').textContent = t(`length.${value}Desc`);
      } else {
        b.textContent = String(value);
      }
    }
  }
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
  paintHome();
  paintGameOver();
  paintScreens();
  paintRunHud();
  paintModsHud();
  paintMenu();
  paintDeck();
  paintTargetPickers();   // también repinta los interruptores del reloj
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
  // Con el menú abierto el reloj se corta entero: al volver, el turno
  // empieza de nuevo con los diez segundos completos. Lo contrario sería
  // castigar al que abrió la configuración.
  if (value) stopTimer();
  if (!value) {
    const pending = waiters;
    waiters = [];
    for (const resume of pending) resume();
  }
}

// `force` es para la configuración de la portada: ahí el cartel de atrás es
// la portada misma, y el menú se abre encima a propósito. El guardia sigue
// valiendo para todo lo demás, que es donde apilar carteles confunde.
function openMenu(force = false) {
  if (!el.overlay.hidden && !force) return;   // ya hay un cartel propio en pantalla
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
  el.labelEffects.textContent = t('menu.effects');
  el.menuEffects.textContent = effectsOn ? t('menu.on') : t('menu.off');
  el.menuEffects.setAttribute('aria-pressed', String(effectsOn));
  el.menuEffects.classList.toggle('is-off', !effectsOn);
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

for (const { btn } of TIMER_TOGGLES()) {
  btn?.addEventListener('click', () => {
    audio.play('click');
    setTimerEnabled(!timerOn);
  });
}

el.menuEffects.addEventListener('click', () => {
  audio.play('click');
  setEffects(!effectsOn);
  // Una muestra de lo que se acaba de elegir, en el momento: si lo
  // encendiste, la pantalla pega un golpe; si lo apagaste, no pasa nada, que
  // es justamente lo que pediste.
  fx.kick(12);
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

// Dejar la mesa como antes de repartir. Lo usan abandonar y el cierre de
// cada ante: en los dos casos lo que había en la mesa ya no significa nada.
function clearTable() {
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
}

// Salir de la partida: vuelve a la pantalla de inicio con la mesa limpia.
// Si era un ante, la corrida queda guardada donde estaba: el ante se vuelve
// a jugar entero, con el mismo reparto, cuando el jugador vuelva.
function quitMatch() {
  el.menu.hidden = true;
  quitArmed = false;
  setPaused(false);
  game = null;
  busy = false;
  inAnte = false;
  clearTable();
  paintRunHud();
  paintModsHud();
  paintTargetPickers();   // sin partida vuelve a poder elegirse el largo
  paintHome();            // puede haber cambiado si hay corrida guardada
  showScreen('title');
}

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!el.menu.hidden) closeMenu();
  else if (el.overlay.hidden) openMenu();
});

el.deck.disabled = true;
buildModes();
for (const c of [el.targetMenu, el.targetOverlay]) buildTargetPicker(c);
for (const c of [el.langsOverlay, el.langsMenu]) buildLangPicker(c);
resetVitals();
paintAll();

armAudio();
showScreen('title');
