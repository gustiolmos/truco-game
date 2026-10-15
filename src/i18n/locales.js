// Textos del juego.
//
// Dos notas sobre criterio de traducción:
//
// 1. Los nombres de los cantos (Truco, Retruco, Envido, Falta envido) NO se
//    traducen en ningún idioma: son los nombres propios del juego, como
//    "blackjack" o "gambito". Un inglés que juega al truco los aprende así.
//    Lo que sí cambia es todo lo que los rodea.
//
// 2. La diferencia entre es-AR y es-LA es sobre todo el voseo ("sos" / "eres",
//    "vos" / "tú"). Es poca letra, pero es la que delata de dónde es el juego,
//    y es justamente la que molesta cuando no es la tuya.

export const LOCALES = {
  'es-AR': {
    name: 'Argentino',
    html: 'es-AR',
    t: {
      'game.title': 'Truco',
      'game.subtitle': 'Primero a 15 puntos. Envido y truco incluidos.',
      'game.play': 'Jugar',
      'game.rematch': 'Revancha',
      'game.win': '¡Ganaste!',
      'game.lose': 'Perdiste',
      'game.score': (a, b) => `${a} a ${b}`,

      'hud.rival': 'Rival',
      'hud.you': 'Vos',
      'hud.envido': 'Envido',
      'hud.sound': 'Sonido',
      'hud.muted': 'Mudo',
      'hud.envidoTip': 'Tus puntos de envido, ya sumados',
      'hud.pot': (n) => `${n} ${n === 1 ? 'punto' : 'puntos'} en juego`,

      'action.accept': 'Quiero',
      'action.reject': 'No quiero',

      'log.youAreMano': 'Sos mano.',
      'log.rivalIsMano': 'Es mano el rival.',
      'log.parda': 'Parda.',
      'log.youWinTrick': 'Ganaste la mano.',
      'log.rivalWinsTrick': 'Se la lleva el rival.',
      'log.youCall': (call) => `Cantaste ${call}.`,
      'log.rivalCalls': (call) => `El rival canta ${call}.`,
      'log.accepted': 'Quiero. Sube la apuesta.',
      'log.envidoScore': (mine, theirs) => `Vos ${mine} · Rival ${theirs}`,
      'log.envidoRejected': (value, youWin) =>
        `No quiero el envido: ${value} para ${youWin ? 'vos' : 'el rival'}.`,

      'shout.reject': 'No quiero',
      'shout.envidoBetter': (points) => `${points} son mejores`,
      'shout.envidoGood': 'Son buenas',

      'calls.truco': 'Truco',
      'calls.retruco': 'Retruco',
      'calls.vale-cuatro': 'Vale cuatro',
      'calls.envido': 'Envido',
      'calls.real-envido': 'Real envido',
      'calls.falta-envido': 'Falta envido',

      'suit.espada': 'espada',
      'suit.basto': 'basto',
      'suit.oro': 'oro',
      'suit.copa': 'copa',
      'card.name': (rank, suit) => `${rank} de ${suit}`,

      'menu.open': 'Menú',
      'menu.title': 'Menú',
      'menu.resume': 'Seguir jugando',
      'menu.quit': 'Abandonar partida',
      'menu.quitConfirm': '¿Seguro? Se pierde la partida',
      'menu.sound': 'Sonido',
      'menu.volume': 'Volumen',
      'menu.language': 'Idioma',
      'menu.on': 'Encendido',
      'menu.off': 'Apagado',
      'lang.label': 'Idioma',
    },
  },

  'es-LA': {
    name: 'Latino',
    html: 'es-419',
    t: {
      'game.title': 'Truco',
      'game.subtitle': 'El primero en llegar a 15 puntos. Con envido y truco.',
      'game.play': 'Jugar',
      'game.rematch': 'Revancha',
      'game.win': '¡Ganaste!',
      'game.lose': 'Perdiste',
      'game.score': (a, b) => `${a} a ${b}`,

      'hud.rival': 'Rival',
      'hud.you': 'Tú',
      'hud.envido': 'Envido',
      'hud.sound': 'Sonido',
      'hud.muted': 'Silencio',
      'hud.envidoTip': 'Tus puntos de envido, ya sumados',
      'hud.pot': (n) => `${n} ${n === 1 ? 'punto' : 'puntos'} en juego`,

      'action.accept': 'Quiero',
      'action.reject': 'No quiero',

      'log.youAreMano': 'Eres mano.',
      'log.rivalIsMano': 'El rival es mano.',
      'log.parda': 'Empate.',
      'log.youWinTrick': 'Ganaste la mano.',
      'log.rivalWinsTrick': 'El rival gana la mano.',
      'log.youCall': (call) => `Cantaste ${call}.`,
      'log.rivalCalls': (call) => `El rival canta ${call}.`,
      'log.accepted': 'Quiero. Sube la apuesta.',
      'log.envidoScore': (mine, theirs) => `Tú ${mine} · Rival ${theirs}`,
      'log.envidoRejected': (value, youWin) =>
        `No quiero el envido: ${value} para ${youWin ? 'ti' : 'el rival'}.`,

      'shout.reject': 'No quiero',
      'shout.envidoBetter': (points) => `${points} son mejores`,
      'shout.envidoGood': 'Son buenas',

      'calls.truco': 'Truco',
      'calls.retruco': 'Retruco',
      'calls.vale-cuatro': 'Vale cuatro',
      'calls.envido': 'Envido',
      'calls.real-envido': 'Real envido',
      'calls.falta-envido': 'Falta envido',

      'suit.espada': 'espada',
      'suit.basto': 'basto',
      'suit.oro': 'oro',
      'suit.copa': 'copa',
      'card.name': (rank, suit) => `${rank} de ${suit}`,

      'menu.open': 'Menú',
      'menu.title': 'Menú',
      'menu.resume': 'Seguir jugando',
      'menu.quit': 'Abandonar partida',
      'menu.quitConfirm': '¿Seguro? Se pierde la partida',
      'menu.sound': 'Sonido',
      'menu.volume': 'Volumen',
      'menu.language': 'Idioma',
      'menu.on': 'Encendido',
      'menu.off': 'Apagado',
      'lang.label': 'Idioma',
    },
  },

  en: {
    name: 'English',
    html: 'en',
    t: {
      'game.title': 'Truco',
      'game.subtitle': 'First to 15 points. Envido and truco included.',
      'game.play': 'Play',
      'game.rematch': 'Rematch',
      'game.win': 'You win!',
      'game.lose': 'You lose',
      'game.score': (a, b) => `${a} to ${b}`,

      'hud.rival': 'Rival',
      'hud.you': 'You',
      'hud.envido': 'Envido',
      'hud.sound': 'Sound',
      'hud.muted': 'Muted',
      'hud.envidoTip': 'Your envido points, already added up',
      'hud.pot': (n) => `${n} ${n === 1 ? 'point' : 'points'} at stake`,

      // "Quiero" / "No quiero" son la apuesta aceptada o rechazada; en inglés
      // no hay nombre propio equivalente, así que acá sí se traduce.
      'action.accept': 'Accept',
      'action.reject': 'Decline',

      'log.youAreMano': 'You lead this hand.',
      'log.rivalIsMano': 'Your rival leads this hand.',
      'log.parda': 'Tied trick.',
      'log.youWinTrick': 'You win the trick.',
      'log.rivalWinsTrick': 'Your rival takes the trick.',
      'log.youCall': (call) => `You called ${call}.`,
      'log.rivalCalls': (call) => `Your rival calls ${call}.`,
      'log.accepted': 'Accepted. The stakes go up.',
      'log.envidoScore': (mine, theirs) => `You ${mine} · Rival ${theirs}`,
      'log.envidoRejected': (value, youWin) =>
        `Envido declined: ${value} ${youWin ? 'to you' : 'to your rival'}.`,

      'shout.reject': 'Declined',
      'shout.envidoBetter': (points) => `${points} is better`,
      'shout.envidoGood': 'Yours are good',

      'calls.truco': 'Truco',
      'calls.retruco': 'Retruco',
      'calls.vale-cuatro': 'Vale Cuatro',
      'calls.envido': 'Envido',
      'calls.real-envido': 'Real Envido',
      'calls.falta-envido': 'Falta Envido',

      'suit.espada': 'swords',
      'suit.basto': 'clubs',
      'suit.oro': 'coins',
      'suit.copa': 'cups',
      'card.name': (rank, suit) => `${rank} of ${suit}`,

      'menu.open': 'Menu',
      'menu.title': 'Menu',
      'menu.resume': 'Keep playing',
      'menu.quit': 'Quit match',
      'menu.quitConfirm': 'Sure? The match is lost',
      'menu.sound': 'Sound',
      'menu.volume': 'Volume',
      'menu.language': 'Language',
      'menu.on': 'On',
      'menu.off': 'Off',
      'lang.label': 'Language',
    },
  },
};

export const DEFAULT_LOCALE = 'es-AR';
