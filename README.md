# Truco

Truco argentino 1v1 contra la máquina, en el navegador. Sin dependencias.

```
node serve.mjs      # http://localhost:5173
node test/selfplay.mjs
```

## Arquitectura

Los assets están en `assets/` con su licencia al lado: fuente Silkscreen (OFL)
y sonidos de Kenney (CC0). Todo local, para que el juego ande offline.

El motor no conoce el DOM. Recibe acciones, valida y emite eventos; la UI se
suscribe y los traduce en efectos. Eso permite testear reglas sin navegador y,
más adelante, correr el mismo motor en un servidor para multijugador.

| Archivo | Rol |
| --- | --- |
| `src/core/deck.js` | 40 cartas y jerarquía del truco |
| `src/core/envido.js` | puntos de envido y valores de la cadena de cantos |
| `src/core/game.js` | máquina de estados de la ronda, el puntaje y el mazo |
| `src/core/ai.js` | rival heurístico (fuerza de mano + ruido para mentir) |
| `src/ui/pixel.js` | renderer de sprites: grilla de caracteres → SVG pixelado |
| `src/ui/sprites.js` | palos (24x24) y figuras (32x44), dibujados a mano |
| `src/ui/card.js` | carta en DOM: marco, palos repartidos o figura, inclinación 3D |
| `src/ui/fx.js` | partículas, sacudida de pantalla, carteles de canto |
| `src/ui/audio.js` | bus de Web Audio: variantes por gesto, silencio persistente |
| `src/ui/flags.js` | banderas 16x12 en pixelart (los emoji de bandera no andan en Windows) |
| `src/modes.js` | lista de modos de juego, sin lógica |
| `src/i18n/` | textos por idioma y selección; el motor no tiene texto visible |

La configuración (sonido, volumen, idioma) y salir de la partida viven en el
menú de pausa, no sobre la mesa. Se abre con el botón del HUD o con Escape.

| `src/main.js` | pegamento: eventos → efectos, clics → acciones |

## Modos

Al entrar se elige modo antes que nada. Hoy sólo **Truco clásico** está
jugable; Historia, Modo libre, Torneo y Online se muestran apagados con su
etiqueta, porque enseñar a dónde va el juego vale más que esconderlo. La
lista vive en `src/modes.js` y el test verifica que ninguno quede sin
traducir.

## Reglas implementadas

Jerarquía completa, tres manos con pardas, envido / real envido / falta envido
con cadena de recantos, truco / retruco / vale cuatro, puntos por "no quiero",
mano alternada, y partida a 15 o a 30 a elección.

Falta: flor, 2v2, multijugador.
