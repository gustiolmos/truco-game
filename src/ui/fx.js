// Capa de efectos: partículas en canvas, sacudida de pantalla y carteles de canto.

// Los efectos se pueden apagar: por accesibilidad, porque en un equipo
// flojo cuestan, y porque un juego que se vende tiene que poder bajarle el
// volumen a lo que parpadea. El sistema decide el arranque; el jugador
// manda por encima desde el menú.
const systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let reduced = systemReduced;

export const prefersReduced = () => reduced;
export const systemPrefersReduced = systemReduced;

// Pasarle `null` devuelve la decisión al sistema. El atributo en <html> es
// lo que apaga las animaciones de CSS; el resto lo miran las funciones de
// acá antes de dibujar nada.
export function setReducedEffects(value) {
  reduced = value === null ? systemReduced : Boolean(value);
  document.documentElement.dataset.fx = reduced ? 'off' : 'on';
}
setReducedEffects(null);

// Tamaño del píxel lógico: tiene que coincidir con --px del CSS.
const PX = 4;
const snap = (v) => Math.round(v / PX) * PX;

export class Fx {
  constructor(canvas, stage) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stage = stage;
    this.particles = [];
    this.shake = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame(this.tick);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  //  negativa son brasas: suben en vez de caer. Es lo único que
  // distingue una chispa de un fuego que trepa.
  burst(x, y, { count = 36, hue = 45, power = 7, gravity = 0.22 } = {}) {
    if (reduced) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.3 + Math.random()) * power;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 2,
        life: 1,
        decay: 0.012 + Math.random() * 0.02,
        size: PX * (1 + Math.floor(Math.random() * 2)),
        hue: hue + (Math.random() - 0.5) * 40,
        gravity,
      });
    }
  }

  burstAt(el, opts) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top + r.height / 2, opts);
  }

  // En pantalla chica la misma sacudida se siente el doble: la pantalla
  // es más chica, el pulgar la sostiene y el movimiento se lee como un
  // temblor y no como un golpe. Se baja ahí, no en todos lados.
  kick(amount = 10) {
    if (reduced) return;
    const scale = window.innerWidth < 560 ? 0.68 : 1;
    this.shake = Math.max(this.shake, amount * scale);
  }

  // "+3" saltando sobre la mesa. La posición se saltea al azar dentro del
  // área que se le pase: dos puntos seguidos en el mismo pixel se leerían
  // como un solo número parpadeando.
  // `scale` hace que un +4 entre más grande que un +1: el número no sólo
  // dice cuánto sumaste, también lo ocupa.
  pop(text, { over = null, tone = 'good', scale = 1 } = {}) {
    const host = this.stage;
    const base = host.getBoundingClientRect();
    const area = (over ?? host).getBoundingClientRect();
    const jitter = (size, amount) => (Math.random() - 0.5) * size * amount;

    const node = document.createElement('div');
    node.className = `pop pop-${tone}`;
    node.textContent = text;
    node.style.fontSize = `calc(clamp(1.9rem, 4.6vw, 3.2rem) * ${scale})`;
    node.style.left = `${area.left - base.left + area.width / 2 + jitter(area.width, 0.42)}px`;
    node.style.top = `${area.top - base.top + area.height / 2 + jitter(area.height, 0.34)}px`;
    host.appendChild(node);
    setTimeout(() => node.remove(), 1100);
  }

  // Globo de diálogo saliendo de un jugador. `dir` dice hacia dónde apunta
  // la cola: 'down' para el de abajo (habla hacia arriba), 'up' para el de
  // arriba. Cada boca tiene un solo globo: si llega otro, reemplaza al
  // anterior en vez de encimarse.
  // `scale` es cuánto grita: un vale cuatro tiene que entrar más grande que
  // un truco, porque lo que está en juego es el doble.
  bubble(text, { from, dir = 'down', tone = 'truco', hold = 1500, scale = 1 } = {}) {
    if (!from) return;
    const key = dir;
    this.bubbles ??= new Map();
    this.bubbles.get(key)?.remove();

    const base = this.stage.getBoundingClientRect();
    const r = from.getBoundingClientRect();

    const node = document.createElement('div');
    node.className = `bubble bubble-${tone} bubble-${dir}`;
    node.textContent = text;
    node.style.left = `${r.left - base.left + r.width / 2}px`;
    node.style.top = dir === 'down'
      ? `${r.top - base.top - 14}px`        // habla el de abajo: globo arriba suyo
      : `${r.bottom - base.top + 14}px`;    // habla el de arriba: globo debajo
    node.style.setProperty('--hold', `${hold}ms`);
    node.style.setProperty('--bubble-scale', String(scale));

    this.stage.appendChild(node);
    this.bubbles.set(key, node);
    const timer = setTimeout(() => {
      node.remove();
      if (this.bubbles.get(key) === node) this.bubbles.delete(key);
    }, hold);
    node.addEventListener('remove', () => clearTimeout(timer));
    return node;
  }

  tick = () => {
    const { ctx } = this;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += p.gravity ?? 0.22;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      // Las partículas también son pixelart: cuadrados enteros, clavados a la
      // grilla y con cuatro niveles de alfa. Un degradado continuo acá rompe
      // el look igual que un borde redondeado.
      ctx.globalAlpha = Math.ceil(Math.max(0, p.life) * 4) / 4;
      ctx.fillStyle = `hsl(${Math.round(p.hue / 15) * 15} 90% ${p.life > 0.5 ? 68 : 52}%)`;
      ctx.fillRect(snap(p.x), snap(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    if (this.shake > 0.3) {
      this.shake *= 0.86;
      const dx = (Math.random() - 0.5) * this.shake;
      const dy = (Math.random() - 0.5) * this.shake;
      this.stage.style.transform = `translate(${dx}px, ${dy}px)`;
    } else if (this.shake) {
      this.shake = 0;
      this.stage.style.transform = '';
    }
    requestAnimationFrame(this.tick);
  };
}

// Contador que sube de a uno, con latido.
export function countUp(el, from, to, onStep) {
  if (reduced || from === to) { el.textContent = to; return; }
  let v = from;
  const step = () => {
    v += Math.sign(to - v);
    el.textContent = v;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
    onStep?.(v);
    if (v !== to) setTimeout(step, 110);
  };
  step();
}
