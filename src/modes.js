// Modos de juego. Son datos a propósito: agregar uno es una línea acá más
// sus textos en los idiomas, y el test verifica que no falte ninguno.
//
// `soon` marca los que todavía no existen: se muestran apagados y con su
// etiqueta, porque enseñar a dónde va el juego vale más que esconderlo.
// `size: 'big'` es la pieza grande del mosaico, que ocupa cuatro celdas a
// la izquierda; las demás van iguales en el bloque de la derecha.
// `suit` elige el palo que hace de arte.

export const MODES = [
  { id: 'story', size: 'big', suit: 'oro', soon: true },
  { id: 'free', suit: 'copa', soon: false },
  { id: 'tournament', suit: 'espada', soon: true },
  { id: 'online', suit: 'basto', soon: true },
  { id: 'classic', suit: 'espada', soon: false },
];
