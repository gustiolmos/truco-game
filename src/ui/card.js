// Render de carta española en DOM: marco, número con su palo en las esquinas,
// y adentro los palos repartidos (1 al 7) o la figura ilustrada (10, 11, 12).

import { sprite } from './pixel.js';
import { SUITS, FIGURES, PIP_LAYOUT } from './sprites.js';
import { t } from '../i18n/index.js';

// Tres tonos por palo. El sprite usa los tres, así la misma grilla sirve para
// los cuatro palos y cada uno conserva su sombreado.
// Los cuatro palos, templados para la luz de candil de la pulpería: la
// espada es acero, el basto es leña verde, el oro es la moneda y la copa el
// punzó. Siguen siendo tres tonos por palo, porque el sprite usa los tres y
// así la misma grilla sirve para los cuatro.
export const SUIT_COLORS = {
  espada: ['#4a8bd4', '#204d8c', '#a9cdf0'],
  basto: ['#5f9e3d', '#2f5f22', '#a8d583'],
  oro: ['#ffbe2e', '#b87611', '#ffe3a0'],
  copa: ['#d9384b', '#8b1527', '#f0a0a8'],
};

export function renderCard(card, { faceDown = false } = {}) {
  const el = document.createElement('div');
  el.className = `card${faceDown ? ' is-down' : ''}`;
  el.dataset.cardId = card?.id ?? '';
  // Cada carta flota con su propio compás: si todas respiraran al mismo
  // tiempo parecería un solo bloque moviéndose, no cartas sueltas.
  el.style.setProperty('--float-delay', `${-Math.random() * 3200}ms`);
  el.style.setProperty('--float-span', `${2600 + Math.random() * 1400}ms`);
  if (faceDown) {
    el.innerHTML = '<div class="card-float"><div class="card-inner card-back"></div></div>';
    return el;
  }

  const [main, dark, light] = SUIT_COLORS[card.suit];
  el.style.setProperty('--suit', main);
  el.style.setProperty('--suit-dark', dark);
  el.style.setProperty('--suit-light', light);

  // Con uno, dos o tres palos sobra lugar: se dibujan más grandes en vez de
  // dejar la carta vacía.
  if (card.rank <= 3) el.dataset.few = String(card.rank);

  const mini = sprite(`palo-${card.suit}`, SUITS[card.suit], 'mini');
  const art = FIGURES[card.rank]
    ? sprite(`figura-${card.rank}-${card.suit}`, FIGURES[card.rank], 'art')
    : pips(card);

  // `.card-float` existe sólo para la flotación: el abanico mueve a `.card`
  // y el parallax mueve a `.card-inner`, así que un tercer movimiento
  // necesita su propia capa o se pisan entre ellos.
  el.innerHTML = `
    <div class="card-float">
      <div class="card-inner">
        <div class="card-face">
          <div class="corner tl"><b>${card.rank}</b>${mini}</div>
          <div class="corner br"><b>${card.rank}</b>${mini}</div>
          <div class="art-frame">${art}</div>
          <div class="card-name">${t('card.name', card.rank, t(`suit.${card.suit}`))}</div>
        </div>
        <div class="card-glare"></div>
      </div>
    </div>`;
  attachTilt(el);
  return el;
}

function pips(card) {
  const one = sprite(`palo-${card.suit}`, SUITS[card.suit], 'pip');
  return (PIP_LAYOUT[card.rank] ?? [[50, 50]])
    .map(([x, y]) => `<div class="pip-slot" style="left:${x}%;top:${y}%">${one}</div>`)
    .join('');
}

// Parallax: la carta se inclina hacia el puntero. El brillo es una banda de
// borde duro y se mueve a saltos, no un reflejo suave, para no romper el pixel.
function attachTilt(el) {
  const inner = el.querySelector('.card-inner');
  const glare = el.querySelector('.card-glare');
  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    inner.style.transform = `rotateY(${x * 20}deg) rotateX(${-y * 20}deg) translateZ(12px)`;
    glare.style.setProperty('--gx', `${Math.round((x + 0.5) * 8) * 12.5}%`);
    glare.style.opacity = '1';
  };
  const reset = () => {
    inner.style.transform = '';
    glare.style.opacity = '0';
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', reset);
}

// Grietas sobre la carta que perdió la mano. Son trazos sueltos que se
// dibujan solos: marcan el quiebre sin romper la carta ni taparla, que es
// lo que pasaría con una animación de pedazos cayendo.
const CRACK = [
  'M50 0 L44 38 L59 64 L41 96 L54 126 L47 155',   // el quiebre principal
  'M44 38 L14 50',
  'M59 64 L92 52',
  'M41 96 L10 114',
  'M54 126 L88 140',
];

export function crack(cardEl) {
  if (!cardEl || cardEl.querySelector('.crack')) return;
  const face = cardEl.querySelector('.card-face') ?? cardEl;
  const paths = CRACK.map((d, i) => `
    <path class="crack-dark" d="${d}" style="--delay:${i * 55}ms"/>
    <path class="crack-light" d="${d}" style="--delay:${i * 55}ms"/>`).join('');
  face.insertAdjacentHTML('beforeend',
    `<svg class="crack" viewBox="0 0 100 155" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`);
}
