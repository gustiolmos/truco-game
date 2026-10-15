// Capa de efectos: partículas en canvas, sacudida de pantalla y carteles de canto.
// Todo se apaga solo con prefers-reduced-motion.

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  burst(x, y, { count = 36, hue = 45, power = 7 } = {}) {
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
        size: 2 + Math.random() * 4,
        hue: hue + (Math.random() - 0.5) * 40,
      });
    }
  }

  burstAt(el, opts) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top + r.height / 2, opts);
  }

  kick(amount = 10) {
    if (reduced) return;
    this.shake = Math.max(this.shake, amount);
  }

  // Cartel de canto que entra golpeando.
  shout(text, { tone = 'truco' } = {}) {
    const el = document.createElement('div');
    el.className = `shout shout-${tone}`;
    el.textContent = text;
    this.stage.appendChild(el);
    this.kick(tone === 'truco' ? 16 : 10);
    setTimeout(() => el.remove(), 1400);
  }

  tick = () => {
    const { ctx } = this;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += 0.22;          // gravedad
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = `hsl(${p.hue} 95% ${55 + p.life * 20}%)`;
      ctx.fillRect(p.x, p.y, p.size, p.size * 1.6);
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
