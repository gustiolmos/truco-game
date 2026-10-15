// Cálculo de puntos de envido y valores de la cadena de cantos.

export function envidoPoints(hand) {
  let best = 0;
  for (let i = 0; i < hand.length; i++) {
    best = Math.max(best, hand[i].envido);
    for (let j = i + 1; j < hand.length; j++) {
      if (hand[i].suit === hand[j].suit) {
        best = Math.max(best, 20 + hand[i].envido + hand[j].envido);
      }
    }
  }
  return best;
}

export const ENVIDO_CALLS = {
  envido: { label: 'Envido', value: 2 },
  'real-envido': { label: 'Real envido', value: 3 },
  'falta-envido': { label: 'Falta envido', value: null },
};

// `chain` es la lista de cantos encadenados, en orden.
export function envidoValues(chain, scores, target) {
  const hasFalta = chain.some((c) => c === 'falta-envido');
  const reject = Math.max(1, chain.slice(0, -1)
    .reduce((sum, c) => sum + (ENVIDO_CALLS[c].value ?? 0), 0));

  if (hasFalta) {
    const leader = Math.max(scores[0], scores[1]);
    return { accept: Math.max(1, target - leader), reject };
  }
  const accept = chain.reduce((sum, c) => sum + ENVIDO_CALLS[c].value, 0);
  return { accept, reject };
}

// Qué se puede cantar encima de la cadena actual.
export function envidoRaises(chain) {
  if (chain.length === 0) return ['envido', 'real-envido', 'falta-envido'];
  if (chain.includes('falta-envido')) return [];
  const envidoCount = chain.filter((c) => c === 'envido').length;
  const out = [];
  if (envidoCount < 2 && !chain.includes('real-envido')) out.push('envido');
  if (!chain.includes('real-envido')) out.push('real-envido');
  out.push('falta-envido');
  return out;
}
