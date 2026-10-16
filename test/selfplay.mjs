// Prueba de humo: miles de partidas con acciones legales al azar.
// Verifica que el motor siempre termina, nunca se queda sin turno válido
// y que los puntos cierran contra el objetivo.

import { TrucoGame } from '../src/core/game.js';
import { envidoPoints, envidoValues } from '../src/core/envido.js';
import { makeCard } from '../src/core/deck.js';
import { LOCALES, DEFAULT_LOCALE } from '../src/i18n/locales.js';
import fs from 'node:fs';
import { MODES } from '../src/modes.js';
import {
  MODS, HOOKS, VALUE_HOOKS, EFFECT_HOOKS, RARITIES, MOD_LIMIT, modById, equipped,
} from '../src/core/mods.js';
import {
  Run, ANTE_COUNT, anteConfig, makeSeed, normalizeSeed, isSeed, saveRun, loadRun, offerFor,
} from '../src/core/run.js';
import { SUITS, FIGURES } from '../src/ui/sprites.js';
import { PALETTE } from '../src/ui/pixel.js';

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

// --- partida a 30 ---
// El largo es configurable, así que todo lo que dependa del objetivo tiene
// que seguirlo. El falta envido es el caso delicado: se cuenta contra lo
// que le falta al líder para llegar, no contra un 15 fijo.
{
  for (const target of [15, 30]) {
    const fresh = envidoValues(['falta-envido'], [0, 0], target);
    if (fresh.accept !== target) {
      throw new Error(`falta envido desde 0-0 a ${target} debería valer ${target}, vale ${fresh.accept}`);
    }
    const late = envidoValues(['falta-envido'], [target - 2, 5], target);
    if (late.accept !== 2) {
      throw new Error(`falta envido con el líder a 2 del final debería valer 2, vale ${late.accept}`);
    }
  }

  let rounds = 0;
  for (let n = 0; n < 200; n++) {
    const g = new TrucoGame({ target: 30 });
    let guard = 0;
    while (g.winner === null && guard++ < 9000) {
      if (g.roundOver) { g.nextRound(); rounds++; continue; }
      const acts = g.legalActions(g.turn);
      if (!acts.length) break;
      g.act(g.turn, acts[Math.floor(rng() * acts.length)]);
    }
    if (g.winner === null) throw new Error('una partida a 30 no terminó');
    if (g.scores[g.winner] < 30) throw new Error(`ganó con menos de 30: ${g.scores}`);
  }
  console.log(`partida a 30: ok (200 partidas, ${(rounds / 200).toFixed(1)} rondas de media)`);
}

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

// --- corrida ---
// El bucle roguelike es el contenedor del juego: si un ante no cierra, o la
// semilla no reparte igual dos veces, o la corrida guardada vuelve rota, se
// cae todo lo que venga después encima.
{
  const anteGame = (run) => new TrucoGame({ target: run.goal, rng: run.rng() });

  // La semilla manda: dos corridas con el mismo código reparten lo mismo,
  // ante por ante. Es lo que permite testear y competir por puntaje.
  for (const ante of [1, 4, 8]) {
    const a = new Run({ seed: 'TRUCO7', ante });
    const b = new Run({ seed: 'TRUCO7', ante });
    const ids = (r) => anteGame(r).hands.map((h) => h.map((c) => c.id).join(',')).join('|');
    if (ids(a) !== ids(b)) throw new Error(`la misma semilla repartió distinto en el ante ${ante}`);
    const otra = new Run({ seed: 'TRUCO8', ante });
    if (ids(a) === ids(otra)) throw new Error('dos semillas distintas repartieron igual');
  }
  // Y cada ante reparte distinto dentro de la misma corrida: si no, los ocho
  // antes serían la misma mano ocho veces.
  {
    const seen = new Set();
    for (let ante = 1; ante <= ANTE_COUNT; ante++) {
      const r = new Run({ seed: 'MAZO42', ante });
      seen.add(anteGame(r).hands[0].map((c) => c.id).join(','));
    }
    if (seen.size !== ANTE_COUNT) throw new Error('hay antes de la misma corrida que reparten igual');
  }

  // Los ocho antes tienen que ser alcanzables: el techo de manos por el
  // máximo que rinde una mano (vale cuatro) no puede quedar por debajo del
  // objetivo, o el ante sería imposible por aritmética.
  for (let ante = 1; ante <= ANTE_COUNT; ante++) {
    const { goal, hands } = anteConfig(ante);
    if (hands * 4 < goal) throw new Error(`el ante ${ante} pide ${goal} en ${hands} manos: no da`);
    if (ante > 1 && goal <= anteConfig(ante - 1).goal) {
      throw new Error(`el ante ${ante} no sube el objetivo respecto del anterior`);
    }
  }

  // Un ante se cierra de tres maneras y las tres tienen que dejar la corrida
  // en una fase válida: a la tienda si se ganó, terminada si se perdió, y
  // ganada si era el último.
  {
    const won = new Run({ seed: 'ABCDEF' });
    const res = won.finishAnte({ scores: [won.goal, 1], handsPlayed: 3 });
    if (!res.won || won.phase !== 'shop') throw new Error('ganar el ante 1 debería mandar a la tienda');
    if (won.money !== 3 + 1 + (won.hands - 3)) throw new Error(`dinero del ante mal: ${won.money}`);
    won.leaveShop();
    if (won.ante !== 2 || won.phase !== 'ante') throw new Error('salir de la tienda no avanzó el ante');

    const byRival = new Run({ seed: 'ABCDEF' });
    const lost = byRival.finishAnte({ scores: [2, byRival.goal], handsPlayed: 4 });
    if (lost.won || lost.reason !== 'rival' || byRival.phase !== 'lost') {
      throw new Error('el rival llegando al objetivo tiene que terminar la corrida');
    }
    if (byRival.money !== 0) throw new Error('un ante perdido no paga');

    const byHands = new Run({ seed: 'ABCDEF' });
    const out = byHands.finishAnte({ scores: [byHands.goal - 1, 2], handsPlayed: byHands.hands });
    if (out.reason !== 'hands' || byHands.phase !== 'lost') {
      throw new Error('quedarse sin manos tiene que terminar la corrida');
    }

    const last = new Run({ seed: 'ABCDEF', ante: ANTE_COUNT });
    last.finishAnte({ scores: [last.goal, 0], handsPlayed: 2 });
    if (last.phase !== 'won') throw new Error('ganar el ante 8 tiene que ganar la corrida');
    if (!last.over) throw new Error('una corrida ganada tiene que estar terminada');
  }

  // Guardar y volver: la corrida en curso se persiste y vuelve igual; una
  // terminada no se guarda, y lo que vuelva roto o editado a mano se tira
  // antes de usarlo, porque una fase inválida cuelga la pantalla.
  {
    const store = new Map();
    const fake = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    };
    const run = new Run({ seed: 'SEMJLA', ante: 3, money: 12 });
    saveRun(run, fake);
    const back = loadRun(fake);
    if (!back || back.seed !== 'SEMJLA' || back.ante !== 3 || back.money !== 12) {
      throw new Error('la corrida guardada no volvió igual');
    }
    run.phase = 'lost';
    saveRun(run, fake);
    if (loadRun(fake)) throw new Error('una corrida terminada no debería quedar guardada');

    for (const bad of [
      { v: 1, seed: 'X', ante: 1, money: 0, mods: [], phase: 'ante', history: [] },
      { v: 1, seed: 'ABCDEF', ante: 99, money: 0, mods: [], phase: 'ante', history: [] },
      { v: 1, seed: 'ABCDEF', ante: 1, money: -5, mods: [], phase: 'ante', history: [] },
      { v: 1, seed: 'ABCDEF', ante: 1, money: 0, mods: [], phase: 'tienda', history: [] },
      { v: 2, seed: 'ABCDEF', ante: 1, money: 0, mods: [], phase: 'ante', history: [] },
    ]) {
      if (Run.fromJSON(bad)) throw new Error(`se aceptó una corrida inválida: ${JSON.stringify(bad)}`);
    }
    fake.setItem('truco.run', '{roto');
    if (loadRun(fake)) throw new Error('un guardado ilegible debería devolver null');
  }

  // Las semillas se dictan, así que se normalizan: minúsculas, y los
  // caracteres que se confunden (O/0, I/1) van a los que sí existen.
  if (normalizeSeed('ab cd ef') !== 'ABCDEF') throw new Error('la semilla no limpió los espacios');
  if (normalizeSeed('abcdefghij') !== 'ABCDEF') throw new Error('la semilla no se cortó en 6');
  if (normalizeSeed('o0i1ab') !== 'QQJJAB') throw new Error('la semilla no mapeó los confundibles');
  if (!isSeed('trucos')) throw new Error('"trucos" debería ser una semilla válida');
  if (isSeed('abc')) throw new Error('una semilla corta no debería valer');

  // Y por último, la corrida entera jugada a lo bruto: acciones legales al
  // azar, ante tras ante, con el límite de manos puesto como lo pone la UI.
  // Lo que se verifica es que siempre termine y que el estado cierre.
  let ganadas = 0;
  const vistas = { goal: 0, rival: 0, hands: 0 };
  for (let n = 0; n < 400; n++) {
    const runner = new Run({ seed: makeSeed(rng) });
    let guard = 0;
    while (!runner.over && guard++ < 100) {
      if (runner.phase === 'shop') { runner.leaveShop(); continue; }
      const g = anteGame(runner);
      let hands = 1;
      while (g.winner === null) {
        if (g.roundOver) {
          if (hands >= runner.hands) break;     // se acabaron las manos
          g.nextRound();
          hands++;
          continue;
        }
        const acts = g.legalActions(g.turn);
        if (!acts.length) throw new Error('un ante se quedó sin acciones legales');
        g.act(g.turn, acts[Math.floor(rng() * acts.length)]);
      }
      const res = runner.finishAnte({ scores: g.scores.slice(), handsPlayed: hands });
      vistas[res.reason]++;
      if (res.won !== (runner.phase === 'shop' || runner.phase === 'won')) {
        throw new Error('la fase no coincide con el resultado del ante');
      }
      if (hands > runner.hands) throw new Error(`se jugaron ${hands} manos con techo ${runner.hands}`);
    }
    if (!runner.over) throw new Error('una corrida no terminó');
    if (runner.phase === 'won') {
      ganadas++;
      if (runner.antesCleared !== ANTE_COUNT) throw new Error('corrida ganada con antes sin superar');
    }
    const s = runner.summary();
    if (s.cleared > ANTE_COUNT || s.money < 0) throw new Error(`resumen inconsistente: ${JSON.stringify(s)}`);
  }
  console.log(`corrida: ok (400 corridas al azar, ${ganadas} completas; `
    + `fin por objetivo ${vistas.goal}, por rival ${vistas.rival}, por manos ${vistas.hands})`);
}

// --- modificadores ---
// Cada modificador se verifica contra el motor, con la mano puesta a mano:
// el azar no sirve para esto, porque lo que hay que probar es que la regla
// rota se aplique exactamente cuando corresponde y a quién corresponde.
{
  // Partida con mano fija. El motor reparte al construirse, así que las
  // manos se reemplazan después: es lo único que estos tests fabrican.
  function rigged({ mine, theirs, mods = [], target = 30, stock = [] }) {
    const g = new TrucoGame({ target, mods });
    g.hands = [mine.slice(), theirs.slice()];
    g.stock = stock.slice();
    return g;
  }
  const fires = (g) => {
    const out = [];
    g.on((e) => { if (e.type === 'mod-fire') out.push(e.id); });
    return out;
  };
  // Las dos cartas sobre la mesa, con el turno que haga falta.
  function trick(g, mineId, theirsId) {
    g.turn = 0;
    g.act(0, { type: 'play', cardId: mineId });
    g.turn = 1;
    g.act(1, { type: 'play', cardId: theirsId });
  }

  // El contrato primero: los enganches son una lista cerrada y ningún
  // modificador puede colgarse de un nombre que el motor no llama. Si esto
  // falla, el modificador no se dispara nunca y nadie se entera.
  for (const mod of MODS) {
    if (!RARITIES.includes(mod.rarity)) throw new Error(`"${mod.id}" tiene rareza "${mod.rarity}"`);
    if (!Object.keys(mod.hooks).length) throw new Error(`"${mod.id}" no se cuelga de nada`);
    for (const hook of Object.keys(mod.hooks)) {
      if (!HOOKS.includes(hook)) throw new Error(`"${mod.id}" usa el enganche inexistente "${hook}"`);
      if (typeof mod.hooks[hook] !== 'function') throw new Error(`"${mod.id}" define "${hook}" sin función`);
    }
    // Arte y textos: un modificador sin nombre traducido muestra la clave
    // cruda en la franja, que está a la vista toda la mano.
    if (!SUITS[mod.suit]) throw new Error(`"${mod.id}" apunta al palo "${mod.suit}", que no existe`);
    for (const key of [`mod.${mod.id}`, `mod.${mod.id}Desc`]) {
      for (const [id, locale] of Object.entries(LOCALES)) {
        if (!locale.t[key]) throw new Error(`a "${id}" le falta "${key}"`);
      }
    }
  }
  for (const rarity of RARITIES) {
    for (const [id, locale] of Object.entries(LOCALES)) {
      if (!locale.t[`rarity.${rarity}`]) throw new Error(`a "${id}" le falta la rareza "${rarity}"`);
    }
  }
  // Y el motor tiene que llamarlos a todos: un enganche declarado que nadie
  // dispara es una promesa incumplida.
  {
    const src = fs.readFileSync(new URL('../src/core/game.js', import.meta.url), 'utf8');
    for (const hook of VALUE_HOOKS) {
      if (!src.includes(`'${hook}'`)) throw new Error(`el motor no usa el enganche de valor "${hook}"`);
    }
    for (const hook of EFFECT_HOOKS) {
      if (!src.includes(`'${hook}'`)) throw new Error(`el motor no dispara el efecto "${hook}"`);
    }
  }

  // Sin modificadores, el motor es el de siempre. Es la red de seguridad de
  // todo el sistema: el truco clásico pasa por el mismo código.
  {
    const g = rigged({ mine: hand('4-copa'), theirs: hand('5-oro') });
    const seen = fires(g);
    trick(g, '4-copa', '5-oro');
    if (g.trickResults[0] !== 1) throw new Error('sin modificadores el 4 de copa tiene que perder');
    if (seen.length) throw new Error('sin modificadores no debería dispararse nada');
  }

  // cuatro-de-copa: la carta más inútil del mazo le gana al ancho de espada,
  // y sólo cuando la juega su dueño.
  {
    const g = rigged({ mine: hand('4-copa'), theirs: hand('1-espada'), mods: ['cuatro-de-copa'] });
    const seen = fires(g);
    trick(g, '4-copa', '1-espada');
    if (g.trickResults[0] !== 0) throw new Error('el 4 de copa debería ganarle al ancho de espada');
    if (!seen.includes('cuatro-de-copa')) throw new Error('el 4 de copa no avisó que disparó');

    const rival = rigged({ mine: hand('5-oro'), theirs: hand('4-copa'), mods: ['cuatro-de-copa'] });
    trick(rival, '5-oro', '4-copa');
    if (rival.trickResults[0] !== 0) throw new Error('el modificador no es del rival y le valió igual');
  }

  // siete-bravo: los sietes falsos pasan a pesar como el de oro, que le gana
  // al tres pero no al 7 de espada.
  {
    const g = rigged({ mine: hand('7-copa'), theirs: hand('3-espada'), mods: ['siete-bravo'] });
    trick(g, '7-copa', '3-espada');
    if (g.trickResults[0] !== 0) throw new Error('el 7 de copa bravo debería ganarle al tres');

    const tope = rigged({ mine: hand('7-copa'), theirs: hand('7-espada'), mods: ['siete-bravo'] });
    trick(tope, '7-copa', '7-espada');
    if (tope.trickResults[0] !== 1) throw new Error('el 7 bravo no debería ganarle al 7 de espada');

    const otro = rigged({ mine: hand('6-copa'), theirs: hand('3-espada'), mods: ['siete-bravo'] });
    trick(otro, '6-copa', '3-espada');
    if (otro.trickResults[0] !== 1) throw new Error('el 7 bravo no debería tocar al resto de las cartas');
  }

  // envido-mas: sólo tu cuenta sube, y la del rival queda igual.
  {
    const base = rigged({ mine: hand('7-oro', '6-oro', '4-basto'), theirs: hand('5-copa', '4-copa', '12-oro') });
    const g = rigged({
      mine: hand('7-oro', '6-oro', '4-basto'),
      theirs: hand('5-copa', '4-copa', '12-oro'),
      mods: ['envido-mas'],
    });
    if (g.envidoPointsOf(0) !== base.envidoPointsOf(0) + 3) {
      throw new Error(`el envido propio debería subir 3: ${base.envidoPointsOf(0)} => ${g.envidoPointsOf(0)}`);
    }
    if (g.envidoPointsOf(1) !== base.envidoPointsOf(1)) {
      throw new Error('el envido del rival no debería moverse');
    }
    // Y preguntar no dispara: la UI lee el contador en cada repintado.
    const seen = fires(g);
    g.peek(() => g.envidoPointsOf(0));
    if (seen.length) throw new Error('un peek no debería contar como disparo');
    g.envidoPointsOf(0);
    if (!seen.includes('envido-mas')) throw new Error('contar el envido de verdad sí tiene que avisar');
  }

  // falta-doble: el falta envido querido a tu favor paga el doble, y el del
  // rival no.
  {
    const mine = rigged({
      mine: hand('7-oro', '6-oro', '4-basto'),   // 33
      theirs: hand('4-copa', '5-basto', '12-oro'),
      mods: ['falta-doble'],
      target: 15,
    });
    mine.turn = 0;
    mine.act(0, { type: 'envido', call: 'falta-envido' });
    mine.act(1, { type: 'accept' });
    if (mine.scores[0] !== 30) throw new Error(`falta doble a 15 debería pagar 30, pagó ${mine.scores[0]}`);

    const theirs = rigged({
      mine: hand('4-copa', '5-basto', '12-oro'),
      theirs: hand('7-oro', '6-oro', '4-basto'),
      mods: ['falta-doble'],
      target: 15,
    });
    theirs.turn = 0;
    theirs.act(0, { type: 'envido', call: 'falta-envido' });
    theirs.act(1, { type: 'accept' });
    if (theirs.scores[1] !== 15) throw new Error(`el falta del rival debería pagar 15, pagó ${theirs.scores[1]}`);

    // Y no toca al envido común, que no es falta.
    const comun = rigged({
      mine: hand('7-oro', '6-oro', '4-basto'),
      theirs: hand('4-copa', '5-basto', '12-oro'),
      mods: ['falta-doble'],
    });
    comun.turn = 0;
    comun.act(0, { type: 'envido', call: 'envido' });
    comun.act(1, { type: 'accept' });
    if (comun.scores[0] !== 2) throw new Error(`el envido común debería pagar 2, pagó ${comun.scores[0]}`);
  }

  // vale-cinco: el vale cuatro paga 5 cuando lo cobrás vos. El truco y el
  // retruco quedan como están, y al rival le sigue pagando 4.
  {
    const vale = (mods, winner) => {
      const g = rigged({ mine: hand('1-espada'), theirs: hand('4-copa'), mods });
      g.turn = 0;
      g.act(0, { type: 'truco' });
      g.act(1, { type: 'truco' });           // retruco
      g.act(0, { type: 'truco' });           // vale cuatro
      g.act(1, { type: 'accept' });
      return g.peek(() => g.roundValue(winner));
    };
    if (vale(['vale-cinco'], 0) !== 5) throw new Error('el vale cuatro propio debería pagar 5');
    if (vale(['vale-cinco'], 1) !== 4) throw new Error('el vale cuatro del rival debería seguir pagando 4');
    if (vale([], 0) !== 4) throw new Error('sin el modificador el vale cuatro paga 4');

    // Lo que se cobra de verdad al cerrar la ronda tiene que ser el mismo
    // número que muestra el cartel: si se desfasa, el jugador ve una cosa y
    // cobra otra.
    const g = rigged({
      mine: hand('1-espada', '3-espada'),
      theirs: hand('4-copa', '5-oro'),
      mods: ['vale-cinco'],
    });
    g.turn = 0;
    g.act(0, { type: 'truco' });
    g.act(1, { type: 'truco' });
    g.act(0, { type: 'truco' });
    g.act(1, { type: 'accept' });
    trick(g, '1-espada', '4-copa');
    trick(g, '3-espada', '5-oro');     // dos manos: la ronda se cierra y cobra
    if (g.scores[0] !== 5) throw new Error(`debería haber cobrado 5, cobró ${g.scores[0]}`);
  }

  // primera-sangre: la primera mano de la ronda paga 1 aparte, y la segunda
  // no. El punto es extra: se suma además de lo que valga la ronda.
  {
    const g = rigged({
      mine: hand('1-espada', '4-copa'),
      theirs: hand('5-oro', '3-basto'),
      mods: ['primera-sangre'],
    });
    const seen = fires(g);
    trick(g, '1-espada', '5-oro');
    if (g.scores[0] !== 1) throw new Error(`la primera mano debería pagar 1, pagó ${g.scores[0]}`);
    if (!seen.includes('primera-sangre')) throw new Error('primera sangre no avisó');
    trick(g, '4-copa', '3-basto');     // la pierde: no suma de nuevo
    const extra = g.scores[0] - 1;
    if (extra !== 0) throw new Error('primera sangre pagó fuera de la primera mano');

    const rival = rigged({
      mine: hand('4-copa'),
      theirs: hand('1-espada'),
      mods: ['primera-sangre'],
    });
    trick(rival, '4-copa', '1-espada');
    if (rival.scores[0] !== 0) throw new Error('primera sangre pagó una mano que perdió su dueño');
  }

  // usurero: cada "no quiero" del rival deja propina, y los tuyos no.
  {
    const g = rigged({ mine: hand('1-espada', '4-copa', '5-oro'), theirs: hand('3-basto', '6-copa', '7-copa'), mods: ['usurero'] });
    g.turn = 0;
    g.act(0, { type: 'truco' });
    g.act(1, { type: 'reject' });
    if (g.scores[0] !== 2) throw new Error(`truco no querido con usurero debería pagar 1+1, pagó ${g.scores[0]}`);

    const mio = rigged({ mine: hand('1-espada'), theirs: hand('3-basto'), mods: ['usurero'] });
    mio.turn = 1;
    mio.act(1, { type: 'truco' });
    mio.act(0, { type: 'reject' });
    if (mio.scores[1] !== 1) throw new Error('usurero pagó por un "no quiero" propio');
    if (mio.scores[0] !== 0) throw new Error('usurero te pagó por rechazar vos');
  }

  // mano-nueva: no querer un envido cambia tu peor carta por una del mazo.
  // Va sólo en el envido, porque no querer un truco termina la ronda.
  {
    const g = rigged({
      mine: hand('1-espada', '12-basto', '4-oro'),
      theirs: hand('7-oro', '6-oro', '5-copa'),
      mods: ['mano-nueva'],
      stock: hand('3-espada'),
    });
    const seen = fires(g);
    g.turn = 1;
    g.act(1, { type: 'envido', call: 'envido' });
    g.act(0, { type: 'reject' });
    const ids = g.hands[0].map((c) => c.id);
    if (ids.includes('4-oro')) throw new Error('debería haber cambiado la peor carta');
    if (!ids.includes('3-espada')) throw new Error('no entró la carta del mazo');
    if (!ids.includes('1-espada')) throw new Error('cambió una carta que no era la peor');
    if (!seen.includes('mano-nueva')) throw new Error('mano nueva no avisó');

    // Sin mazo del que robar, no pasa nada y nadie avisa de más.
    const seco = rigged({
      mine: hand('1-espada', '12-basto', '4-oro'),
      theirs: hand('7-oro', '6-oro', '5-copa'),
      mods: ['mano-nueva'],
      stock: [],
    });
    const nada = fires(seco);
    seco.turn = 1;
    seco.act(1, { type: 'envido', call: 'envido' });
    seco.act(0, { type: 'reject' });
    if (nada.includes('mano-nueva')) throw new Error('avisó un cambio que no pudo hacer');
  }

  // El orden importa y es el de las ranuras: dos modificadores sobre el
  // mismo número se encadenan de la primera a la última.
  {
    const dos = rigged({
      mine: hand('7-oro', '6-oro', '4-basto'),
      theirs: hand('4-copa', '5-basto', '12-oro'),
      mods: ['envido-mas', 'envido-mas'],
    });
    const base = rigged({ mine: hand('7-oro', '6-oro', '4-basto'), theirs: hand('4-copa', '5-basto', '12-oro') });
    if (dos.envidoPointsOf(0) !== base.envidoPointsOf(0) + 6) {
      throw new Error('dos modificadores sobre el mismo valor tienen que encadenarse');
    }
  }

  // Lo guardado puede nombrar un modificador que ya no existe: se cae solo,
  // sin tirar la partida.
  {
    const g = rigged({ mine: hand('4-copa'), theirs: hand('5-oro'), mods: ['no-existe', 'cuatro-de-copa'] });
    if (g.mods.length !== 1) throw new Error('un modificador inexistente debería caerse solo');
    if (equipped(['cuatro-de-copa', 'cuatro-de-copa', 'usurero', 'vale-cinco', 'envido-mas', 'siete-bravo']).length
        !== MOD_LIMIT) {
      throw new Error(`el tope de equipados debería ser ${MOD_LIMIT}`);
    }
  }

  // La tienda: la oferta sale de la semilla, no se repite dentro de la misma
  // tienda y no ofrece lo que ya llevás puesto.
  {
    for (const ante of [1, 3, 7]) {
      const a = offerFor('TRUCO7', ante);
      const b = offerFor('TRUCO7', ante);
      if (a.join() !== b.join()) throw new Error('la misma tienda ofreció distinto');
      if (new Set(a).size !== a.length) throw new Error('la tienda repitió un modificador');
      if (a.some((id) => !modById(id))) throw new Error('la tienda ofreció algo que no existe');
    }
    if (offerFor('TRUCO7', 1).join() === offerFor('TRUCO7', 2).join()) {
      throw new Error('dos tiendas de la misma corrida ofrecieron lo mismo');
    }
    const owned = ['cuatro-de-copa', 'usurero'];
    for (let ante = 1; ante <= ANTE_COUNT; ante++) {
      if (offerFor('MAZO42', ante, owned).some((id) => owned.includes(id))) {
        throw new Error('la tienda ofreció algo que ya estaba equipado');
      }
    }
    // Y equipar pasa por la corrida: sólo de la oferta, sólo en la tienda y
    // hasta el tope.
    const r = new Run({ seed: 'ABCDEF' });
    if (r.takeMod(r.offer()[0])) throw new Error('no se debería poder equipar fuera de la tienda');
    r.finishAnte({ scores: [r.goal, 0], handsPlayed: 2 });
    const pick = r.offer()[0];
    if (!r.takeMod(pick)) throw new Error('no se pudo equipar de la oferta');
    if (r.mods[0] !== pick) throw new Error('lo equipado no quedó en la ranura');
    if (r.takeMod('no-existe')) throw new Error('se equipó un modificador inexistente');
    const fuera = MODS.map((m) => m.id).find((id) => !r.offer().includes(id) && !r.mods.includes(id));
    if (r.takeMod(fuera)) throw new Error('se equipó algo que la tienda no ofrecía');
  }

  // Y por último, la corrida entera con modificadores encima, a lo bruto:
  // acciones legales al azar y modificadores equipados a cada tienda. Lo que
  // se verifica es que nada de esto cuelgue ni desacomode el puntaje.
  {
    let disparos = 0;
    for (let n = 0; n < 300; n++) {
      const r = new Run({ seed: makeSeed(rng) });
      let guard = 0;
      while (!r.over && guard++ < 100) {
        if (r.phase === 'shop') {
          const offer = r.offer();
          if (offer.length && !r.full) r.takeMod(offer[Math.floor(rng() * offer.length)]);
          r.leaveShop();
          continue;
        }
        const g = new TrucoGame({ target: r.goal, rng: r.rng(), mods: r.mods });
        g.on((e) => { if (e.type === 'mod-fire') disparos++; });
        let hands = 1;
        while (g.winner === null) {
          if (g.roundOver) {
            if (hands >= r.hands) break;
            g.nextRound();
            hands++;
            continue;
          }
          const acts = g.legalActions(g.turn);
          if (!acts.length) throw new Error('un ante con modificadores se quedó sin acciones legales');
          g.act(g.turn, acts[Math.floor(rng() * acts.length)]);
        }
        if (g.scores[0] < 0 || g.scores[1] < 0) throw new Error('puntaje negativo con modificadores');
        for (const player of [0, 1]) {
          if (g.hands[player].length + g.played[player].length !== 3) {
            throw new Error('un efecto dejó una mano con una cantidad de cartas imposible');
          }
        }
        r.finishAnte({ scores: g.scores.slice(), handsPlayed: hands });
      }
      if (!r.over) throw new Error('una corrida con modificadores no terminó');
      if (r.mods.length > MOD_LIMIT) throw new Error('se pasó del tope de equipados');
    }
    console.log(`modificadores: ok (${MODS.length} verificados uno por uno, `
      + `300 corridas equipando al azar, ${disparos} disparos)`);
  }
}

// --- sprites ---
// Las grillas se escriben a mano, carácter por carácter, y una fila a la que
// le falta un píxel deforma el dibujo sin avisar: la carta sale torcida y hay
// que descubrirlo mirándola. El renderer ya lo verifica, pero recién cuando
// alguien abre esa carta en el navegador. Mejor que falle acá.
{
  const medir = (nombre, grilla, ancho, alto) => {
    if (grilla.length !== alto) {
      throw new Error(`sprite "${nombre}": ${grilla.length} filas, se esperaban ${alto}`);
    }
    grilla.forEach((fila, i) => {
      if (fila.length !== ancho) {
        throw new Error(`sprite "${nombre}": fila ${i} mide ${fila.length}, se esperaba ${ancho}`);
      }
    });
  };

  for (const [nombre, grilla] of Object.entries(SUITS)) medir(`palo ${nombre}`, grilla, 24, 24);
  for (const [nombre, grilla] of Object.entries(FIGURES)) medir(`figura ${nombre}`, grilla, 32, 44);

  // Y que no haya caracteres sin color: un carácter que no está en la paleta
  // se dibuja con fill="undefined", que el navegador pinta de negro. Un
  // agujero negro en medio de una carta es difícil de atribuir a esto.
  const conocidos = new Set([...Object.keys(PALETTE), '.']);
  for (const [nombre, grilla] of [...Object.entries(SUITS), ...Object.entries(FIGURES)]) {
    for (const [i, fila] of grilla.entries()) {
      for (const ch of fila) {
        if (!conocidos.has(ch)) {
          throw new Error(`sprite "${nombre}", fila ${i}: el carácter "${ch}" no está en la paleta`);
        }
      }
    }
  }

  // Cada palo tiene que usar su color: si una grilla quedara sin los tonos
  // del palo, los cuatro palos se verían iguales y las cartas no se podrían
  // distinguir de un vistazo.
  for (const [nombre, grilla] of Object.entries(SUITS)) {
    const pintado = grilla.join('');
    if (!/[abc]/.test(pintado)) {
      throw new Error(`el palo "${nombre}" no usa ningún tono del palo`);
    }
  }

  const palos = Object.keys(SUITS).length;
  const figuras = Object.keys(FIGURES).length;
  console.log(`sprites: ok (${palos} palos 24x24, ${figuras} figuras 32x44, todos en paleta)`);
}

// --- modos ---
// Un modo sin traducción muestra la clave cruda en el panel de inicio, que
// es la primera pantalla que ve cualquiera. Mejor que falle acá.
{
  for (const mode of MODES) {
    for (const suffix of ['', 'Desc']) {
      const key = `modes.${mode.id}${suffix}`;
      for (const [id, locale] of Object.entries(LOCALES)) {
        if (!locale.t[key]) throw new Error(`a "${id}" le falta "${key}"`);
      }
    }
  }
  for (const mode of MODES) {
    if (!SUITS[mode.suit]) {
      throw new Error(`el modo "${mode.id}" apunta al palo "${mode.suit}", que no existe`);
    }
  }
  const playable = MODES.filter((m) => !m.soon).map((m) => m.id);
  if (!playable.includes('classic')) {
    throw new Error('el truco clásico tiene que quedar jugable');
  }
  console.log(`modos: ok (${MODES.length} listados, ${playable.length} jugable, todos con arte)`);
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
