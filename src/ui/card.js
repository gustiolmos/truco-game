// Render de carta española en DOM + inclinación 3D con el puntero.

const SUIT_COLOR = {
  espada: '#4aa8ff',
  basto: '#2fd37a',
  oro: '#ffc23d',
  copa: '#ff5d7a',
};

const SUIT_PATH = {
  // Trazos simples, legibles a tamaño chico.
  espada: 'M50 8 L58 44 L50 92 L42 44 Z M28 44 H72',
  basto: 'M50 92 V30 M50 44 L28 20 M50 44 L72 20 M50 62 L32 44 M50 62 L68 44',
  oro: 'M50 10 L82 50 L50 90 L18 50 Z M50 28 L68 50 L50 72 L32 50 Z',
  copa: 'M26 18 H74 L68 48 Q50 64 32 48 Z M50 60 V78 M32 86 H68',
};

const FIGURE = { 10: 'S', 11: 'C', 12: 'R' }; // sota, caballo, rey

export function renderCard(card, { faceDown = false } = {}) {
  const el = document.createElement('div');
  el.className = `card${faceDown ? ' is-down' : ''}`;
  el.dataset.cardId = card?.id ?? '';
  if (faceDown) {
    el.innerHTML = '<div class="card-inner card-back"><span></span></div>';
    return el;
  }
  const color = SUIT_COLOR[card.suit];
  el.style.setProperty('--suit', color);
  el.innerHTML = `
    <div class="card-inner">
      <div class="card-glare"></div>
      <div class="corner tl">${card.rank}</div>
      <div class="corner br">${card.rank}</div>
      <svg class="pip" viewBox="0 0 100 100" aria-hidden="true">
        <path d="${SUIT_PATH[card.suit]}" />
      </svg>
      ${FIGURE[card.rank] ? `<div class="figure">${FIGURE[card.rank]}</div>` : ''}
      <div class="card-name">${card.rank} de ${card.suit}</div>
    </div>`;
  attachTilt(el);
  return el;
}

// Parallax: la carta se inclina hacia el puntero. Es lo que la hace sentir 3D.
function attachTilt(el) {
  const inner = el.querySelector('.card-inner');
  const glare = el.querySelector('.card-glare');
  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    inner.style.transform = `rotateY(${x * 26}deg) rotateX(${-y * 26}deg) translateZ(18px)`;
    glare.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
    glare.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
    glare.style.opacity = '1';
  };
  const reset = () => {
    inner.style.transform = '';
    glare.style.opacity = '0';
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', reset);
}
