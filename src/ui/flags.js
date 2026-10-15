// Banderas de 16x12 en pixelart.
//
// No se usan emoji (🇦🇷): Windows no trae glyphs de bandera, así que Chrome y
// Edge en Windows muestran las letras "AR" en vez del dibujo. Como el juego
// es web y buena parte de los jugadores va a estar en Windows, las dibujamos.
// De paso quedan en el mismo estilo que el resto.

import { sprite } from './pixel.js';

const FLAG_PALETTE = {
  c: '#74acdf',   // celeste argentino
  w: '#ffffff',
  y: '#f6b40e',   // sol de mayo
  g: '#006847',   // verde mexicano
  r: '#ce1126',   // rojo mexicano / británico
  b: '#012169',   // azul británico
  n: '#7a5c2e',   // marrón del escudo
};

const FLAGS = {
  // Argentina: tres franjas horizontales con el sol al medio.
  'es-AR': [
    'cccccccccccccccc',
    'cccccccccccccccc',
    'cccccccccccccccc',
    'cccccccccccccccc',
    'wwwwwwwwwwwwwwww',
    'wwwwwwwyywwwwwww',
    'wwwwwwwyywwwwwww',
    'wwwwwwwwwwwwwwww',
    'cccccccccccccccc',
    'cccccccccccccccc',
    'cccccccccccccccc',
    'cccccccccccccccc',
  ],
  // México: tres franjas verticales con el escudo insinuado al medio.
  'es-LA': [
    'gggggwwwwwwrrrrr',
    'gggggwwwwwwrrrrr',
    'gggggwwwwwwrrrrr',
    'gggggwwwwwwrrrrr',
    'gggggwwwwwwrrrrr',
    'gggggwwnnwwrrrrr',
    'gggggwwnnwwrrrrr',
    'gggggwwwwwwrrrrr',
    'gggggwwwwwwrrrrr',
    'gggggwwwwwwrrrrr',
    'gggggwwwwwwrrrrr',
    'gggggwwwwwwrrrrr',
  ],
  // Reino Unido: cruz de San Jorge sobre las aspas.
  en: [
    'rwwbbwwrrwwbbwwr',
    'wrrwbwwrrwwbwrrw',
    'bwrrwwwrrwwwrrwb',
    'wwwwwwwrrwwwwwww',
    'wwwwwwwrrwwwwwww',
    'rrrrrrrrrrrrrrrr',
    'rrrrrrrrrrrrrrrr',
    'wwwwwwwrrwwwwwww',
    'wwwwwwwrrwwwwwww',
    'bwrrwwwrrwwwrrwb',
    'wrrwbwwrrwwbwrrw',
    'rwwbbwwrrwwbbwwr',
  ],
};

export function flagSprite(locale) {
  const rows = FLAGS[locale];
  if (!rows) return '';
  return sprite(`bandera-${locale}`, rows, 'flag', FLAG_PALETTE);
}
