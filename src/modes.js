// Modos de juego. Son datos a propósito: agregar uno es una línea acá más
// sus textos en los idiomas, y el test verifica que no falte ninguno.
//
// `soon` marca los que todavía no existen: se muestran apagados y con su
// etiqueta, porque enseñar a dónde va el juego vale más que esconderlo.
// `size` manda en el mosaico: 'big' ocupa cuatro celdas, 'tall' dos en
// vertical, 'wide' la fila entera. `suit` elige el palo que hace de arte.

export const MODES = [
  { id: 'story', size: 'big', suit: 'oro', soon: true },
  { id: 'free', suit: 'copa', soon: true },
  { id: 'tournament', suit: 'espada', soon: true },
  { id: 'online', size: 'tall', suit: 'basto', soon: true },
  { id: 'classic', size: 'wide', suit: 'espada', soon: false },
];
