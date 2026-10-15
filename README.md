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
| `src/core/run.js` | corrida: antes, objetivos, dinero, semilla y guardado |
| `src/core/mods.js` | modificadores: lista cerrada de enganches y sus datos |
| `src/core/ai.js` | rival heurístico (fuerza de mano + ruido para mentir) |
| `src/ui/pixel.js` | renderer de sprites: grilla de caracteres → SVG pixelado |
| `src/ui/sprites.js` | palos (24x24) y figuras (32x44), dibujados a mano |
| `src/ui/card.js` | carta en DOM: marco, palos repartidos o figura, inclinación 3D |
| `src/ui/fx.js` | partículas, sacudida de pantalla, carteles de canto |
| `src/ui/audio.js` | bus de Web Audio: variantes por gesto, silencio persistente |
| `src/ui/flags.js` | banderas 16x12 en pixelart (los emoji de bandera no andan en Windows) |
| `src/modes.js` | lista de modos de juego, sin lógica |
| `src/i18n/` | textos por idioma y selección; el motor no tiene texto visible |

La configuración (sonido, volumen, efectos, reloj, idioma) y salir de la
partida viven en el menú de pausa, no sobre la mesa. Se abre con el botón
del HUD o con Escape.

**Efectos** apaga todo lo que se mueve: partículas, sacudida, vuelo de la
carta, flotación y transiciones. Arranca por lo que pida el sistema
(`prefers-reduced-motion`) y la elección del jugador lo pisa y se guarda. La
capa de efectos escribe `data-fx` en `<html>`, que es lo que corta las
animaciones de CSS; lo de canvas lo corta cada función antes de dibujar.

**Reloj por turno** le da diez segundos a cada decisión, para que la mesa
empuje en vez de esperar quieta. No es una regla del truco, es ritmo, así
que se puede apagar; y como cambiarlo a mitad de partida sería mover las
reglas con la mano puesta, se elige antes de empezar (se bloquea igual que
el largo) y también desde el menú de pausa cuando no hay partida en curso.
El último tercio quema: la barra pasa a rojo-dorado, el borde de toda la
pantalla se prende fuego (`--heat`, de 0 a 1) y cada segundo pega más fuerte
que el anterior. Si el tiempo se agota, juega la mesa por vos: no quiere si
hay un canto en el aire, o tira la carta más baja. El menú pausa el reloj
entero; al volver, el turno arranca de nuevo con los diez segundos
completos.

Los efectos se piensan también con el dedo: la sacudida baja a dos tercios
en pantalla angosta, porque ahí el mismo golpe se lee como temblor.

| `src/main.js` | pegamento: eventos → efectos, clics → acciones |

## Modos

Al entrar se elige modo antes que nada. Hay dos jugables: **Truco clásico**,
que es el juego de toda la vida y ya está cerrado, y **Modo libre**, que es
la corrida roguelike, o sea el juego en sí. Historia, Torneo y Online se
muestran apagados con su etiqueta, porque enseñar a dónde va el juego vale
más que esconderlo. La lista vive en `src/modes.js` y el test verifica que
ninguno quede sin traducir.

## Corrida

El bucle roguelike es el contenedor de todo lo que venga después: sin
corrida, los modificadores no tienen dónde existir ni cómo desbloquearse.

Una corrida son **ocho antes**. Cada ante es una partida corta de truco con
un objetivo de puntos y un techo de manos: el objetivo del ante es el
puntaje al que se juega, así que las barras de vida y el falta envido se
ajustan solos. Se pierde la corrida de dos maneras: porque el rival llega al
objetivo primero, o porque se acaban las manos sin haber llegado. Ganar el
ante paga fichas, con propina por cada mano que sobró.

Entre antes se pasa por la **tienda**, que todavía está vacía: es el hueco
donde después viven los modificadores. Las ranuras se muestran igual, porque
el hueco a la vista es lo que promete lo que falta.

El azar sale de una **semilla** de seis caracteres, con un generador por
ante. Dos corridas con la misma semilla reparten lo mismo, ante por ante:
sirve para testear y para competir por puntaje. La corrida en curso se
guarda en `localStorage`, así que se puede cerrar y seguir después; la mesa
no se guarda, de modo que un ante dejado a medias se vuelve a jugar entero
con el mismo reparto.

La curva (`ANTES` en `src/core/run.js`) es una tabla a mano, no una fórmula:
se afina ante por ante. El test verifica que cada ante sea alcanzable y que
el objetivo siempre suba.

## Modificadores

Cartas pasivas que rompen las reglas a tu favor: los jokers de Balatro,
traducidos al truco. Lo que importa no son los ocho que hay hoy sino el
contrato, porque es lo que decide cuántos se pueden escribir después.

El motor expone una **lista cerrada de enganches** (`src/core/mods.js`) y los
modificadores se cuelgan de ahí. El reglamento base no se toca: sin nada
equipado, cada enganche devuelve el valor tal cual y el motor hace lo mismo
que antes. Hay dos clases, y la diferencia es el límite de lo que un
modificador puede hacer:

| | |
| --- | --- |
| **Valor** `(valor, ctx) => valor` | `card-power`, `envido-count`, `envido-stake`, `truco-stake`, `round-stake` |
| **Efecto** `(api, ctx) => void` | `on-round-start`, `on-trick-won`, `on-accept`, `on-reject` |

Los de valor son puros: ajustan un número antes de que el motor lo use y no
pueden tocar la partida. Los de efecto reaccionan a algo que pasó y sí pueden
actuar, pero sólo por `api`, que es chica a propósito: anotar puntos y
cambiar una carta. Nada de meter mano en el estado.

Un modificador es **datos**: id, rareza, palo para el arte y sus enganches.
Agregar uno es una entrada en `MODS` más sus textos; no se toca el motor ni
la UI. Se aplican **en orden de ranura**, de la primera a la última: los de
valor encadenan el número que recibe el siguiente, así que el orden se puede
razonar mirando la franja.

`ctx.owner` dice de quién son. Hoy siempre es el jugador, pero el enganche lo
recibe explícito para que un rival con modificadores propios no obligue a
reescribir nada.

Cuando un modificador cambia algo, el motor emite `mod-fire` y la UI lo
muestra: la ficha pega un golpe y el nombre salta sobre la mesa. Sin eso no
se entiende qué hizo. Preguntar no es disparar: lo que la UI consulta en cada
repintado (cuánto paga la ronda, tu envido) va dentro de `game.peek()`, que
calcula igual pero no avisa.

La tienda ofrece tres, sorteados de la semilla y pesados por rareza, y te
llevás uno. Por ahora salen gratis: los precios llegan con la tienda de
verdad, y el dinero ya se acumula esperándolos.

Cada modificador está verificado contra el motor en `test/selfplay.mjs`, con
la mano puesta a mano: que la regla rota se aplique exactamente cuando
corresponde, que no le sirva al rival, y que sin modificadores el motor sea
el de siempre.

## Reglas implementadas

Jerarquía completa, tres manos con pardas, envido / real envido / falta envido
con cadena de recantos, truco / retruco / vale cuatro, puntos por "no quiero",
mano alternada, y partida a 15 o a 30 a elección.

Falta: flor, 2v2, multijugador.
