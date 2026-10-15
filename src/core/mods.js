// Modificadores: cartas pasivas que rompen las reglas a tu favor. Son el
// equivalente de los jokers de Balatro, traducido al truco.
//
// Lo importante de este archivo no son los modificadores que hay hoy, sino
// el contrato: el motor expone una **lista cerrada de enganches** y los
// modificadores se cuelgan de ahí. El reglamento base no se toca nunca; si
// no hay modificadores equipados, el motor hace exactamente lo que hacía
// antes, porque cada enganche sin dueño devuelve el valor tal cual.
//
// Hay dos clases de enganche, y la diferencia importa:
//
//   VALOR   (value hooks)  (valor, ctx) => valor
//           Ajustan un número antes de que el motor lo use. Son puras: no
//           pueden tocar la partida. Si un modificador sólo cambia cuánto
//           paga algo o cuánto puede una carta, va acá.
//
//   EFECTO  (effect hooks) (api, ctx) => void
//           Reaccionan a algo que pasó y pueden actuar sobre la partida,
//           pero sólo a través de `api`, que es chica a propósito: cambiar
//           una carta y anotar puntos. Nada de meter mano en el estado.
//
// `ctx.owner` es de quién son los modificadores. Hoy siempre es el jugador
// humano, pero el enganche lo recibe explícito para que un rival con sus
// propios modificadores no pida reescribir nada.

export const VALUE_HOOKS = [
  // Cuánto puede una carta al resolver la mano.      ctx: { card, player, trick }
  'card-power',
  // Los puntos de envido de un jugador.              ctx: { player, cards }
  'envido-count',
  // Lo que paga el envido, querido o no.             ctx: { winner, chain, kind }
  'envido-stake',
  // Lo que paga un truco no querido.                 ctx: { winner, level }
  'truco-stake',
  // Lo que vale la ronda al cobrarse.                ctx: { winner, level }
  'round-stake',
];

export const EFFECT_HOOKS = [
  // Se repartió una mano nueva.                      ctx: { mano }
  'on-round-start',
  // Alguien se llevó una de las tres manos.          ctx: { player, trick }
  'on-trick-won',
  // Alguien dijo quiero.                             ctx: { player, kind }
  'on-accept',
  // Alguien dijo no quiero.                          ctx: { player, kind, winner }
  'on-reject',
];

export const HOOKS = [...VALUE_HOOKS, ...EFFECT_HOOKS];

export const RARITIES = ['common', 'rare', 'epic'];

// Cuántos se pueden llevar puestos. Cinco es lo que entra en la franja sin
// que las fichas se vuelvan ilegibles, y obliga a elegir.
export const MOD_LIMIT = 5;

// El 7 de oro es la referencia de "siete que manda": el siete bravo copia su
// fuerza en vez de inventar un número, así la jerarquía sigue cerrada.
const SEVEN_GOLD_POWER = 10;
// Por encima de todo el mazo. El ancho de espada es 13.
const UNBEATABLE = 99;

// Los modificadores son datos: un registro con su rareza, su palo para el
// arte y sus enganches. Agregar uno es una entrada acá más sus textos; no
// hay que tocar el motor ni la UI.
//
// Se aplican **en el orden en que están equipados**, de la primera ranura a
// la última: los de valor van encadenando el número que recibe el siguiente,
// y los de efecto corren uno detrás del otro. Es el orden que se ve en la
// franja, así que el jugador puede razonarlo.
export const MODS = [
  {
    id: 'envido-mas',
    rarity: 'common',
    suit: 'oro',
    hooks: {
      'envido-count': (value, ctx) => (ctx.player === ctx.owner ? value + 3 : value),
    },
  },
  {
    id: 'siete-bravo',
    rarity: 'common',
    suit: 'espada',
    hooks: {
      // Los sietes falsos (basto y copa) pasan a pesar como el de oro.
      'card-power': (value, ctx) => (
        ctx.player === ctx.owner && ctx.card.rank === 7
          && (ctx.card.suit === 'basto' || ctx.card.suit === 'copa')
          ? SEVEN_GOLD_POWER
          : value
      ),
    },
  },
  {
    id: 'primera-sangre',
    rarity: 'common',
    suit: 'basto',
    hooks: {
      // Ganar la primera de las tres manos ya paga, aunque la ronda se
      // pierda después.
      'on-trick-won': (api, ctx) => {
        if (ctx.trick === 0 && ctx.player === ctx.owner) api.score(ctx.owner, 1);
      },
    },
  },
  {
    id: 'usurero',
    rarity: 'rare',
    suit: 'oro',
    hooks: {
      // Cada "no quiero" del rival te deja una propina encima de lo que ya
      // paga el canto rechazado.
      'on-reject': (api, ctx) => {
        if (ctx.player !== ctx.owner && ctx.winner === ctx.owner) api.score(ctx.owner, 1);
      },
    },
  },
  {
    id: 'vale-cinco',
    rarity: 'rare',
    suit: 'espada',
    hooks: {
      // El vale cuatro, cuando lo cobrás vos, paga cinco.
      'round-stake': (value, ctx) => (ctx.level === 3 && ctx.winner === ctx.owner ? value + 1 : value),
    },
  },
  {
    id: 'mano-nueva',
    rarity: 'rare',
    suit: 'copa',
    hooks: {
      // No querer un envido deja de ser sólo perder un punto: cambiás tu
      // peor carta por una del resto del mazo. Va sólo en el envido porque
      // no querer un truco termina la ronda ahí mismo, y cambiar una carta
      // que ya no se va a jugar no sería un modificador, sería un adorno.
      'on-reject': (api, ctx) => {
        if (ctx.player === ctx.owner && ctx.kind === 'envido') api.swapWorst(ctx.owner);
      },
    },
  },
  {
    id: 'falta-doble',
    rarity: 'epic',
    suit: 'oro',
    hooks: {
      // El falta envido querido, a tu favor, vale el doble. Es el que puede
      // cerrar un ante de un canto.
      'envido-stake': (value, ctx) => (
        ctx.kind === 'accept' && ctx.winner === ctx.owner && ctx.chain.includes('falta-envido')
          ? value * 2
          : value
      ),
    },
  },
  {
    id: 'cuatro-de-copa',
    rarity: 'epic',
    suit: 'copa',
    hooks: {
      // La carta más inútil del mazo le gana a cualquiera. Es el chiste de
      // todo el sistema: una regla rota con nombre y apellido.
      'card-power': (value, ctx) => (
        ctx.player === ctx.owner && ctx.card.id === '4-copa' ? UNBEATABLE : value
      ),
    },
  },
];

const BY_ID = new Map(MODS.map((m) => [m.id, m]));

export const modById = (id) => BY_ID.get(id) ?? null;

// De lista de ids a lista de modificadores, sin huecos: lo guardado puede
// nombrar un modificador que ya no existe (una partida vieja, otra versión)
// y eso no puede tirar la corrida.
export const equipped = (ids = []) => ids.map(modById).filter(Boolean).slice(0, MOD_LIMIT);

// Por rareza, para que la oferta pueda pesar lo común más que lo épico.
export const byRarity = (rarity) => MODS.filter((m) => m.rarity === rarity);
