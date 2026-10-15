// Modos de juego. Son datos a propósito: agregar uno es una línea acá más
// sus textos en los idiomas, y el test verifica que no falte ninguno.
//
// `soon` marca los que todavía no existen: se muestran apagados y con su
// etiqueta, porque enseñar a dónde va el juego vale más que esconderlo.
// `size` manda en la grilla: 'big' y 'wide' ocupan el ancho entero.

export const MODES = [
  { id: 'story', size: 'big', soon: true },
  { id: 'free', soon: true },
  { id: 'tournament', soon: true },
  { id: 'online', soon: true },
  { id: 'classic', size: 'wide', soon: false },
];
