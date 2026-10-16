// Renderer de sprites pixelart.
//
// Un sprite es una grilla de caracteres; cada carácter es un color de la
// paleta. Dibujarlos así (y no con trazos vectoriales) es lo que hace que se
// lean como pixelart de verdad: cada píxel cae en la grilla y el sombreado es
// elección nuestra, no un degradado del navegador.

// Paleta común. Los tres tonos del palo salen de variables CSS, así la misma
// forma sirve para los cuatro palos sin duplicar el sprite.
export const PALETTE = {
  k: '#140f22',             // contorno
  a: 'var(--suit)',         // palo, tono medio
  b: 'var(--suit-dark)',    // palo, sombra
  c: 'var(--suit-light)',   // palo, luz
  g: '#f2b233',             // oro
  d: '#99621a',             // oro en sombra
  s: '#e8b48a',             // piel
  t: '#bd8158',             // piel en sombra
  w: '#f4ead6',             // crema (barbas, telas claras)
  m: '#b9b2c9',             // acero claro
  n: '#6f6888',             // acero en sombra
  r: '#e8465f',             // rojo (penachos, piedras)
  h: '#2f2219',             // pelo, chambergo, cuero curtido
  o: '#8a5a2b',             // cuero claro, madera
};

// Un <rect> por píxel infla el DOM al cuádruple de lo necesario, así que
// junto las corridas horizontales del mismo color en un solo rect.
function toRects(rows, palette) {
  const out = [];
  rows.forEach((row, y) => {
    let run = 0;
    let char = null;
    const flush = (x) => {
      if (run && char && char !== '.') {
        out.push(
          `<rect x="${x - run}" y="${y}" width="${run}" height="1" fill="${palette[char]}"/>`,
        );
      }
      run = 0;
    };
    for (let x = 0; x <= row.length; x++) {
      const ch = row[x];
      if (ch !== char) { flush(x); char = ch; }
      run++;
    }
  });
  return out.join('');
}

const CACHE = new Map();

// Las grillas se escriben a mano, así que una fila corta pasa desapercibida y
// deforma el dibujo. Mejor que explote acá que descubrirlo mirando la carta.
function assertRect(name, rows) {
  const w = rows[0].length;
  const bad = rows.findIndex((r) => r.length !== w);
  if (bad !== -1) {
    throw new Error(`sprite "${name}": fila ${bad} mide ${rows[bad].length}, se esperaba ${w}`);
  }
  return w;
}

// `palette` se puede cambiar (las banderas usan la suya); el caché va por
// nombre, así que cada combinación de grilla y paleta necesita nombre propio.
export function sprite(name, rows, className = '', palette = PALETTE) {
  if (!CACHE.has(name)) {
    const w = assertRect(name, rows);
    CACHE.set(name, { body: toRects(rows, palette), w, h: rows.length });
  }
  const { body, w, h } = CACHE.get(name);
  return `<svg class="sprite ${className}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${body}</svg>`;
}
