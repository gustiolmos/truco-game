// Baraja española de 40 cartas y jerarquía del Truco.

export const SUITS = ['espada', 'basto', 'oro', 'copa'];
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

// Jerarquía del Truco, de la más fuerte a la más débil.
// Las "piezas" únicas van primero; el resto se agrupa por número.
const ORDER = [
  ['1-espada'], ['1-basto'], ['7-espada'], ['7-oro'],
  ['3-espada', '3-basto', '3-oro', '3-copa'],
  ['2-espada', '2-basto', '2-oro', '2-copa'],
  ['1-oro', '1-copa'],
  ['12-espada', '12-basto', '12-oro', '12-copa'],
  ['11-espada', '11-basto', '11-oro', '11-copa'],
  ['10-espada', '10-basto', '10-oro', '10-copa'],
  ['7-basto', '7-copa'],
  ['6-espada', '6-basto', '6-oro', '6-copa'],
  ['5-espada', '5-basto', '5-oro', '5-copa'],
  ['4-espada', '4-basto', '4-oro', '4-copa'],
];

// power: 13 = la más alta (ancho de espada), 0 = la más baja (cuatro).
const POWER = new Map();
ORDER.forEach((group, i) => {
  const power = ORDER.length - 1 - i;
  group.forEach((id) => POWER.set(id, power));
});

export function makeCard(rank, suit) {
  const id = `${rank}-${suit}`;
  return {
    id,
    rank,
    suit,
    power: POWER.get(id),
    // Valor para el envido: las figuras no suman.
    envido: rank >= 10 ? 0 : rank,
  };
}

export function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push(makeCard(rank, suit));
  }
  return deck;
}

export function shuffle(deck, rng = Math.random) {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const CARD_NAME = (c) => `${c.rank} de ${c.suit}`;
