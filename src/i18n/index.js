// Idioma del juego.
//
// `t(clave, ...args)` devuelve el texto. Si la clave apunta a una función, se
// la llama con los argumentos: así las frases con números ("3 puntos en
// juego") se arman en cada idioma con su propia gramática, en vez de pegar
// pedazos de texto, que es lo que rompe las traducciones.

import { LOCALES, DEFAULT_LOCALE } from './locales.js';

const STORAGE_KEY = 'truco.locale';

// Si el jugador nunca eligió, se arranca por lo que dice el navegador: un
// mexicano no debería tener que cambiar el idioma a mano para no leer voseo.
function detect() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LOCALES[saved]) return saved;
  } catch { /* modo privado */ }

  for (const tag of navigator.languages ?? [navigator.language ?? '']) {
    const low = tag.toLowerCase();
    if (low.startsWith('en')) return 'en';
    if (low === 'es-ar') return 'es-AR';
    if (low.startsWith('es')) return 'es-LA';
  }
  return DEFAULT_LOCALE;
}

let current = detect();
const listeners = new Set();

export const locales = () => Object.entries(LOCALES).map(([id, l]) => ({ id, name: l.name }));
export const getLocale = () => current;

export function setLocale(id) {
  if (!LOCALES[id] || id === current) return;
  current = id;
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* modo privado */ }
  document.documentElement.lang = LOCALES[id].html;
  for (const fn of listeners) fn(id);
}

export function onLocaleChange(fn) { listeners.add(fn); }

export function t(key, ...args) {
  const table = LOCALES[current].t;
  // Si a un idioma le falta una clave, se cae al idioma por defecto antes que
  // mostrar la clave cruda en pantalla.
  const value = table[key] ?? LOCALES[DEFAULT_LOCALE].t[key];
  if (value === undefined) return key;
  return typeof value === 'function' ? value(...args) : value;
}

// Nombre traducido de un canto, a partir de su clave en el motor.
export const callLabel = (key) => t(`calls.${key}`);

document.documentElement.lang = LOCALES[current].html;
