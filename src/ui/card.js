// Render de carta española en DOM: marco, número con su palo en las esquinas,
// y adentro los palos repartidos (1 al 7) o la figura ilustrada (10, 11, 12).

import { sprite } from './pixel.js';
import { SUITS, FIGURES, PIP_LAYOUT } from './sprites.js';
import { t } from '../i18n/index.js';

// Tres tonos por palo. El sprite usa los tres, así la misma grilla sirve para
// los cuatro palos y cada uno conserva su sombreado.
export const SUIT_COLORS = {
  espada: ['#3aa0ff', '#1a5fc4', '#a8d8ff'],
  basto: ['#35d35f', '#13873a', '#9bf0ae'],
  oro: ['#ffc233', '#c47f0e', '#ffe79a'],
  copa: ['#ff3b5c', '#b01432', '#ff9fae'],
};

export function renderCard(card, { faceDown = false } = {}) {
  const el = document.createElement('div');
  el.className = `card${faceDown ? ' is-down' : ''}`;
  el.dataset.cardId = card?.id ?? '';
  if (faceDown) {
    el.innerHTML = '<div class="card-inner card-back"></div>';
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

  el.innerHTML = `
    <div class="card-inner">
      <div class="card-face">
        <div class="corner tl"><b>${card.rank}</b>${mini}</div>
        <div class="corner br"><b>${card.rank}</b>${mini}</div>
        <div class="art-frame">${art}</div>
        <div class="card-name">${t('card.name', card.rank, t(`suit.${card.suit}`))}</div>
      </div>
      <div class="card-glare"></div>
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
