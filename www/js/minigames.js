// 30 minijuegos en canvas (táctil + ratón + teclado). Lienzo lógico 400x640.
import { mulberry32, clamp } from './util.js';
import { mgById } from './mgmeta.js';
import { sfx } from './audio.js';

const W = 400, H = 640;

// ---------- utilidades de dibujo ----------
function bg(c, a, b) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, W, H); }
function text(c, s, x, y, size = 24, color = '#fff', align = 'center', stroke = true) {
  c.font = `900 ${size}px "Baloo 2", system-ui, sans-serif`; c.textAlign = align; c.textBaseline = 'middle';
  if (stroke) { c.lineWidth = Math.max(3, size / 7); c.strokeStyle = 'rgba(0,0,0,.55)'; c.strokeText(String(s), x, y); }
  c.fillStyle = color; c.fillText(String(s), x, y);
}
function emoji(c, e, x, y, size) { c.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, x, y + size * 0.05); }
function rr(c, x, y, w, h, r, fill, stroke) { c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.lineWidth = 3; c.strokeStyle = stroke; c.stroke(); } }
function circ(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
function button(c, b, label, color = '#3a7bd5', size = 26, pressed = false) {
  rr(c, b.x, b.y + (pressed ? 4 : 0), b.w, b.h, 18, 'rgba(0,0,0,.35)');
  rr(c, b.x, b.y - (pressed ? 0 : 4), b.w, b.h, 18, color, 'rgba(255,255,255,.5)');
  text(c, label, b.x + b.w / 2, b.y + b.h / 2 - (pressed ? 0 : 4), size);
}
const inside = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// ---------- definiciones ----------
const G = {};

G.tap = {
  dur: 8,
  init(S) { S.press = 0; },
  down(S, x, y) { if (dist(x, y, 200, 380) < 130) { S.score++; S.press = 0.07; S.pop(x, y - 30, '+1'); sfx('tap'); } },
  key(S, k) { if (k === ' ' || k === 'Enter') G.tap.down(S, 200, 380); },
  update(S, dt) { S.press = Math.max(0, S.press - dt); },
  draw(S, c) {
    bg(c, '#ffb347', '#ff5e62');
    text(c, S.score, 200, 180, 90);
    const r = S.press > 0 ? 108 : 118;
    circ(c, 200, 392, 122, '#6d0f0f'); circ(c, 200, 380 + (S.press > 0 ? 8 : 0), r, '#ff2d2d');
    circ(c, 170, 340 + (S.press > 0 ? 8 : 0), 30, 'rgba(255,255,255,.35)');
    text(c, '¡TOCA!', 200, 384 + (S.press > 0 ? 8 : 0), 44);
  },
};

G.reflex = {
  dur: 25,
  init(S) { S.round = 0; S.res = []; S.phase = 'wait'; S.go = 1.5 + S.rng() * 2.5; S.info = 'Espera el VERDE…'; },
  update(S) {
    if (S.phase === 'wait' && S.t >= S.go) { S.phase = 'go'; S.goT = performance.now(); S.goS = S.t; sfx('go'); }
    if (S.phase === 'go' && S.t - S.goS > 1.2) G.reflex.result(S, 1000, '¡Muy lento!');
    if (S.phase === 'res' && S.t >= S.resEnd) {
      if (S.round >= 3) S.done = true; else { S.phase = 'wait'; S.go = S.t + 1.2 + S.rng() * 2.6; S.info = 'Espera el VERDE…'; }
    }
    S.hud = `Ronda ${Math.min(3, S.round + 1)}/3`;
  },
  result(S, ms, msg) { S.res.push(ms); S.info = msg; S.phase = 'res'; S.resEnd = S.t + 1.3; S.round++; },
  down(S) {
    if (S.phase === 'wait') { G.reflex.result(S, 1000, '¡Te adelantaste! ✋'); sfx('bad'); }
    else if (S.phase === 'go') { const ms = Math.round(performance.now() - S.goT); G.reflex.result(S, ms, `${ms} ms`); sfx('tap'); }
  },
  key(S, k) { if (k === ' ' || k === 'Enter') G.reflex.down(S); },
  final(S) { const r = S.res.slice(); while (r.length < 3) r.push(1000); return r.reduce((a, m) => a + Math.max(0, 1000 - m), 0); },
  draw(S, c) {
    const col = S.phase === 'go' ? ['#2ee86b', '#0c9e3e'] : S.phase === 'wait' ? ['#ff5a5a', '#a30f2a'] : ['#555', '#222'];
    bg(c, col[0], col[1]);
    text(c, S.phase === 'go' ? '¡YA!' : S.phase === 'wait' ? 'Espera…' : '', 200, 260, 70);
    text(c, S.info, 200, 360, 30);
    S.res.forEach((m, i) => text(c, `R${i + 1}: ${m >= 1000 ? '—' : m + ' ms'}`, 200, 440 + i * 36, 22));
  },
};

G.simon = {
  dur: 45,
  init(S) { S.seq = [S.rng() * 4 | 0]; S.mode = 'show'; S.si = 0; S.st = 0.8; S.lit = -1; S.inp = 0; S.flash = -1; S.flashT = 0; },
  pads: [{ x: 30, y: 150, w: 165, h: 165, c: '#ff4d4d' }, { x: 205, y: 150, w: 165, h: 165, c: '#3ccf4e' }, { x: 30, y: 325, w: 165, h: 165, c: '#3a7bd5' }, { x: 205, y: 325, w: 165, h: 165, c: '#f2c11f' }],
  update(S, dt) {
    S.flashT -= dt; if (S.flashT <= 0) S.flash = -1;
    if (S.mode === 'show' && S.t >= S.st) {
      const sp = Math.max(0.22, 0.5 - S.seq.length * 0.025);
      if (S.lit >= 0) { S.lit = -1; S.si++; S.st = S.t + 0.14; }
      else if (S.si < S.seq.length) { S.lit = S.seq[S.si]; S.st = S.t + sp; sfx('note' + S.lit); }
      else { S.mode = 'input'; S.inp = 0; }
    }
    S.hud = `Nivel ${S.seq.length}`;
  },
  down(S, x, y) {
    if (S.mode !== 'input') return;
    const i = G.simon.pads.findIndex((p) => inside(p, x, y)); if (i < 0) return;
    S.flash = i; S.flashT = 0.18; sfx('note' + i);
    if (i === S.seq[S.inp]) {
      S.inp++;
      if (S.inp === S.seq.length) { S.score = S.seq.length; S.pop(200, 120, '¡Bien!'); S.seq.push(S.rng() * 4 | 0); S.mode = 'show'; S.si = 0; S.lit = -1; S.st = S.t + 0.8; }
    } else { sfx('bad'); S.info = '¡Fallaste!'; S.endSoon(0.8); }
  },
  draw(S, c) {
    bg(c, '#2b1055', '#7597de');
    G.simon.pads.forEach((p, i) => { const on = S.lit === i || S.flash === i; rr(c, p.x, p.y, p.w, p.h, 28, p.c); if (!on) rr(c, p.x, p.y, p.w, p.h, 28, 'rgba(0,0,0,.45)'); else rr(c, p.x - 4, p.y - 4, p.w + 8, p.h + 8, 30, null, '#fff'); });
    text(c, S.mode === 'show' ? '👀 Observa…' : S.info || '👆 ¡Repite!', 200, 560, 28);
  },
};

G.catch = {
  dur: 20,
  init(S) { S.bx = 200; S.objs = []; S.next = 0; },
  move(S, x) { S.bx = clamp(x, 40, 360); },
  down(S, x) { S.bx = clamp(x, 40, 360); },
  update(S, dt) {
    if (S.keys.ArrowLeft) S.bx = clamp(S.bx - 380 * dt, 40, 360);
    if (S.keys.ArrowRight) S.bx = clamp(S.bx + 380 * dt, 40, 360);
    if (S.t >= S.next) { S.next = S.t + Math.max(0.28, 0.55 - S.t * 0.012); S.objs.push({ x: 30 + S.rng() * 340, y: -20, v: 180 + S.rng() * 120 + S.t * 8, bomb: S.rng() < 0.25 }); }
    for (const o of S.objs) {
      o.y += o.v * dt;
      if (!o.hit && o.y > 545 && o.y < 600 && Math.abs(o.x - S.bx) < 48) {
        o.hit = true;
        if (o.bomb) { S.score = Math.max(0, S.score - 2); S.pop(o.x, 520, '−2', '#ff5050'); sfx('bad'); S.shake = 0.25; }
        else { S.score++; S.pop(o.x, 520, '+1'); sfx('coin'); }
      }
    }
    S.objs = S.objs.filter((o) => !o.hit && o.y < 680);
  },
  draw(S, c) {
    bg(c, '#0f2027', '#2c5364');
    for (const o of S.objs) emoji(c, o.bomb ? '💣' : '⭐', o.x, o.y, 38);
    emoji(c, '🧺', S.bx, 575, 70);
  },
};

G.dodge = {
  dur: 30,
  init(S) { S.px = 200; S.rocks = []; S.next = 0; S.lives = 3; S.inv = 0; },
  move(S, x) { S.px = clamp(x, 25, 375); }, down(S, x) { S.px = clamp(x, 25, 375); },
  update(S, dt) {
    if (S.keys.ArrowLeft) S.px = clamp(S.px - 360 * dt, 25, 375);
    if (S.keys.ArrowRight) S.px = clamp(S.px + 360 * dt, 25, 375);
    S.inv -= dt;
    if (S.t >= S.next) { S.next = S.t + Math.max(0.12, 0.5 - S.t * 0.014); S.rocks.push({ x: S.rng() * 400, y: -30, r: 14 + S.rng() * 20, v: 220 + S.rng() * 160 + S.t * 9 }); }
    for (const r of S.rocks) {
      r.y += r.v * dt;
      if (S.inv <= 0 && dist(r.x, r.y, S.px, 575) < r.r + 18) { S.lives--; S.inv = 1.2; r.y = 999; sfx('bad'); S.shake = 0.3; if (S.lives <= 0) S.done = true; }
    }
    S.rocks = S.rocks.filter((r) => r.y < 700);
    S.score = Math.floor(S.t * 10);
    S.hud = `${'❤️'.repeat(Math.max(0, S.lives))}  ${S.score}`;
  },
  draw(S, c) {
    bg(c, '#1a1a40', '#3d1e6d');
    for (const r of S.rocks) { circ(c, r.x, r.y, r.r, '#8b5a2b'); circ(c, r.x - r.r * 0.3, r.y - r.r * 0.3, r.r * 0.35, '#a87444'); c.fillStyle = 'rgba(255,140,0,.5)'; c.fillRect(r.x - r.r * 0.4, r.y - r.r * 2.2, r.r * 0.8, r.r * 1.6); }
    if (S.inv <= 0 || Math.floor(S.t * 10) % 2) emoji(c, S.me, S.px, 575, 42);
  },
};

G.math = {
  dur: 20,
  init(S) { G.math.newQ(S); },
  newQ(S) {
    const r = S.rng, op = r() < 0.4 ? '+' : r() < 0.65 ? '−' : '×';
    let a, b, ans;
    if (op === '+') { a = 5 + (r() * 45 | 0); b = 3 + (r() * 40 | 0); ans = a + b; }
    else if (op === '−') { a = 20 + (r() * 60 | 0); b = 2 + (r() * a * 0.8 | 0); ans = a - b; }
    else { a = 2 + (r() * 10 | 0); b = 2 + (r() * 9 | 0); ans = a * b; }
    const set = new Set([ans]);
    while (set.size < 4) { const d = ans + ((r() * 21 | 0) - 10); if (d >= 0 && d !== ans) set.add(d); }
    S.q = `${a} ${op} ${b}`; S.ans = ans; S.opts = [...set].sort(() => r() - 0.5);
  },
  btn: (i) => ({ x: 30 + (i % 2) * 180, y: 330 + Math.floor(i / 2) * 130, w: 160, h: 110 }),
  down(S, x, y) {
    for (let i = 0; i < 4; i++) if (inside(G.math.btn(i), x, y)) {
      if (S.opts[i] === S.ans) { S.score++; S.pop(200, 250, '+1'); sfx('coin'); } else { S.score = Math.max(0, S.score - 1); S.pop(200, 250, '−1', '#ff5050'); sfx('bad'); S.shake = 0.2; }
      G.math.newQ(S); return;
    }
  },
  draw(S, c) {
    bg(c, '#134e5e', '#71b280');
    rr(c, 30, 140, 340, 140, 24, 'rgba(255,255,255,.15)');
    text(c, S.q + ' = ?', 200, 210, 54);
    S.opts.forEach((o, i) => button(c, G.math.btn(i), o, ['#e0447c', '#3a7bd5', '#f2a71f', '#7b4ee0'][i], 40));
  },
};

G.timer = {
  dur: 15,
  init(S) { S.stopped = null; },
  down(S) { if (S.stopped === null && S.t > 0.2) { S.stopped = S.t; const d = Math.abs(S.t - 7); S.score = Math.max(0, Math.round(100 - d * 100)); sfx(d < 0.1 ? 'star' : 'tap'); S.endSoon(1.8); } },
  key(S, k) { if (k === ' ' || k === 'Enter') G.timer.down(S); },
  update(S) { S.hud = 'Objetivo: 7.00 s'; },
  draw(S, c) {
    bg(c, '#3e5151', '#decba4');
    circ(c, 200, 300, 140, '#fff'); circ(c, 200, 300, 128, '#222');
    const shown = S.stopped !== null ? S.stopped.toFixed(2) : S.t < 3 ? S.t.toFixed(2) : '??.??';
    text(c, shown, 200, 300, 56, S.stopped !== null ? '#ffd23f' : '#fff');
    const ang = ((S.stopped ?? S.t) / 7) * Math.PI * 2 - Math.PI / 2;
    if (S.t < 3 || S.stopped !== null) { c.strokeStyle = '#ff4d4d'; c.lineWidth = 6; c.beginPath(); c.moveTo(200, 300); c.lineTo(200 + Math.cos(ang) * 110, 300 + Math.sin(ang) * 110); c.stroke(); }
    if (S.stopped !== null) { text(c, `Diferencia: ${(S.stopped - 7 >= 0 ? '+' : '') + (S.stopped - 7).toFixed(2)} s`, 200, 500, 26); text(c, `${S.score} puntos`, 200, 550, 34, '#ffd23f'); }
    else text(c, 'Toca en 7.00 s', 200, 520, 30);
  },
};

G.balloons = {
  dur: 20,
  init(S) { S.bs = []; S.next = 0; },
  update(S, dt) {
    if (S.t >= S.next) { S.next = S.t + 0.32; const r = S.rng(); S.bs.push({ x: 40 + S.rng() * 320, y: 680, v: 110 + S.rng() * 90 + S.t * 5, k: r < 0.1 ? 'gold' : r < 0.26 ? 'bomb' : 'n', col: ['#ff4d6d', '#4dabff', '#7bff6b', '#c06bff', '#ff9f43'][S.rng() * 5 | 0], ph: S.rng() * 6 }); }
    for (const b of S.bs) { b.y -= b.v * dt; b.x += Math.sin(S.t * 2 + b.ph) * 0.6; }
    S.bs = S.bs.filter((b) => b.y > -60 && !b.dead);
  },
  down(S, x, y) {
    for (let i = S.bs.length - 1; i >= 0; i--) {
      const b = S.bs[i];
      if (dist(x, y, b.x, b.y) < 36) {
        b.dead = true;
        if (b.k === 'bomb') { S.score = Math.max(0, S.score - 3); S.pop(b.x, b.y, '−3', '#ff5050'); sfx('bad'); S.shake = 0.25; }
        else { const v = b.k === 'gold' ? 3 : 1; S.score += v; S.pop(b.x, b.y, '+' + v, b.k === 'gold' ? '#ffd23f' : '#fff'); sfx('pop'); }
        return;
      }
    }
  },
  draw(S, c) {
    bg(c, '#89f7fe', '#66a6ff');
    for (const b of S.bs) {
      c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(b.x, b.y + 32); c.lineTo(b.x + 4, b.y + 70); c.stroke();
      c.beginPath(); c.ellipse(b.x, b.y, 28, 34, 0, 0, Math.PI * 2); c.fillStyle = b.k === 'gold' ? '#ffd23f' : b.k === 'bomb' ? '#222' : b.col; c.fill();
      circ(c, b.x - 9, b.y - 12, 7, 'rgba(255,255,255,.5)');
      if (b.k === 'bomb') emoji(c, '💀', b.x, b.y, 24);
    }
  },
};

G.jump = {
  dur: 35,
  init(S) { S.y = 0; S.vy = 0; S.obs = []; S.next = 1; S.speed = 260; },
  down(S) { if (S.y <= 0.01) { S.vy = 640; sfx('jump'); } },
  key(S, k) { if (k === ' ' || k === 'ArrowUp' || k === 'Enter') G.jump.down(S); },
  update(S, dt) {
    S.speed = 260 + S.t * 9;
    S.vy -= 1700 * dt; S.y = Math.max(0, S.y + S.vy * dt); if (S.y === 0) S.vy = Math.max(0, S.vy);
    if (S.t >= S.next) { S.next = S.t + 0.9 + S.rng() * 0.9; const tall = S.rng() < 0.35; S.obs.push({ x: 440, w: tall ? 30 : 40, h: tall ? 70 : 40, e: tall ? '🌵' : '🪨' }); }
    for (const o of S.obs) {
      o.x -= S.speed * dt;
      if (!o.passed && o.x + o.w < 80) { o.passed = true; S.score++; sfx('coin'); }
      if (o.x < 98 && o.x + o.w > 62 && S.y < o.h - 6) { S.done = true; sfx('bad'); S.shake = 0.3; }
    }
    S.obs = S.obs.filter((o) => o.x > -60);
  },
  draw(S, c) {
    bg(c, '#ffecd2', '#fcb69f');
    c.fillStyle = '#7a5230'; c.fillRect(0, 520, W, 120); c.fillStyle = '#5fa04e'; c.fillRect(0, 512, W, 12);
    const off = (S.t * S.speed) % 80; c.fillStyle = 'rgba(0,0,0,.15)'; for (let x = -off; x < W; x += 80) c.fillRect(x, 560, 40, 6);
    for (const o of S.obs) emoji(c, o.e, o.x + o.w / 2, 512 - o.h / 2, o.h * 1.15);
    emoji(c, S.me, 80, 492 - S.y, 46);
  },
};

G.pairs = {
  dur: 40,
  init(S) {
    const em = ['🍎', '🍌', '🍇', '🍓', '🍒', '🥝', '🍍', '🥥'];
    const deck = [...em, ...em].map((e) => ({ e, open: false, done: false }));
    for (let i = deck.length - 1; i > 0; i--) { const j = S.rng() * (i + 1) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; }
    S.deck = deck; S.sel = []; S.lock = 0; S.found = 0;
  },
  cell: (i) => ({ x: 22 + (i % 4) * 92, y: 130 + Math.floor(i / 4) * 112, w: 82, h: 100 }),
  update(S, dt) {
    if (S.lock > 0) { S.lock -= dt; if (S.lock <= 0) { S.sel.forEach((i) => { S.deck[i].open = false; }); S.sel = []; } }
    S.hud = `Parejas ${S.found}/8`;
  },
  down(S, x, y) {
    if (S.lock > 0) return;
    for (let i = 0; i < 16; i++) {
      const d = S.deck[i];
      if (inside(G.pairs.cell(i), x, y) && !d.open && !d.done) {
        d.open = true; S.sel.push(i); sfx('tap');
        if (S.sel.length === 2) {
          const [a, b] = S.sel;
          if (S.deck[a].e === S.deck[b].e) { S.deck[a].done = S.deck[b].done = true; S.sel = []; S.found++; S.score = S.found * 10; sfx('coin'); if (S.found === 8) { S.score = 80 + Math.round((G.pairs.dur - S.t) * 2); S.endSoon(0.8); } }
          else S.lock = 0.65;
        }
        return;
      }
    }
  },
  draw(S, c) {
    bg(c, '#614385', '#516395');
    S.deck.forEach((d, i) => { const b = G.pairs.cell(i); if (d.open || d.done) { rr(c, b.x, b.y, b.w, b.h, 14, d.done ? '#b8f5c0' : '#fff'); emoji(c, d.e, b.x + b.w / 2, b.y + b.h / 2, 46); } else { rr(c, b.x, b.y, b.w, b.h, 14, '#ff9f43', '#fff'); text(c, '?', b.x + b.w / 2, b.y + b.h / 2, 40); } });
  },
};

// ---------- Equipos ----------
G.tug = {
  dur: 15,
  init(S) { S.cd = 0; S.rope = 0; },
  pos: (S) => Math.sin(S.t * (2.2 + S.t * 0.12)),
  update(S, dt) { S.cd -= dt; S.rope += (S.score * 4 - S.rope) * Math.min(1, dt * 5); },
  down(S) {
    if (S.cd > 0) return; S.cd = 0.18;
    const p = Math.abs(G.tug.pos(S));
    if (p < 0.18) { S.score += 3; S.pop(200, 300, '¡FUERTE! +3', '#7bff6b'); sfx('star'); }
    else if (p < 0.5) { S.score += 1; S.pop(200, 300, '+1', '#ffd23f'); sfx('tap'); }
    else { S.score = Math.max(0, S.score - 1); S.pop(200, 300, '−1', '#ff5050'); sfx('bad'); }
  },
  key(S, k) { if (k === ' ' || k === 'Enter') G.tug.down(S); },
  draw(S, c) {
    bg(c, '#56ab2f', '#a8e063');
    const x = 200 + Math.min(150, S.rope % 300 / 2) - 75;
    c.strokeStyle = '#8b5a2b'; c.lineWidth = 12; c.beginPath(); c.moveTo(0, 470); c.lineTo(W, 470); c.stroke();
    emoji(c, '🚩', x, 440, 40); emoji(c, S.me, 60, 450, 56);
    rr(c, 30, 170, 340, 60, 30, '#ff5050'); rr(c, 30 + 340 * 0.25, 170, 340 * 0.5, 60, 0, '#ffd23f'); rr(c, 200 - 340 * 0.09, 170, 340 * 0.18, 60, 0, '#3ccf4e');
    const mx = 200 + G.tug.pos(S) * 170; rr(c, mx - 6, 158, 12, 84, 6, '#fff', '#000');
    text(c, 'Toca en VERDE', 200, 280, 28); text(c, `Fuerza: ${S.score}`, 200, 560, 34);
  },
};

G.tower = {
  dur: 45,
  init(S) { S.stack = [{ x: 100, w: 200 }]; S.cur = { x: 0, w: 200, dir: 1 }; S.cam = 0; S.falling = []; },
  update(S, dt) {
    const sp = 170 + S.stack.length * 14;
    S.cur.x += S.cur.dir * sp * dt;
    if (S.cur.x + S.cur.w > W) { S.cur.x = W - S.cur.w; S.cur.dir = -1; } if (S.cur.x < 0) { S.cur.x = 0; S.cur.dir = 1; }
    const target = Math.max(0, (S.stack.length - 8) * 40); S.cam += (target - S.cam) * Math.min(1, dt * 4);
    S.falling.forEach((f) => { f.vy += 900 * dt; f.y += f.vy * dt; });
    S.hud = `Altura ${S.score}`;
  },
  down(S) {
    if (S.over) return;
    const top = S.stack[S.stack.length - 1];
    const l = Math.max(top.x, S.cur.x), r = Math.min(top.x + top.w, S.cur.x + S.cur.w);
    const yTop = 560 - S.stack.length * 40;
    if (r - l <= 2) { S.falling.push({ x: S.cur.x, w: S.cur.w, y: yTop, vy: 0 }); S.over = true; sfx('bad'); S.endSoon(1); return; }
    if (S.cur.x < l) S.falling.push({ x: S.cur.x, w: l - S.cur.x, y: yTop, vy: 0 });
    if (S.cur.x + S.cur.w > r) S.falling.push({ x: r, w: S.cur.x + S.cur.w - r, y: yTop, vy: 0 });
    const perfect = Math.abs(S.cur.x - top.x) < 5;
    const nb = perfect ? { x: top.x, w: top.w } : { x: l, w: r - l };
    S.stack.push(nb); S.score++; sfx(perfect ? 'star' : 'tap'); if (perfect) S.pop(200, yTop - 80 + S.cam, '¡PERFECTO!', '#ffd23f');
    S.cur = { x: S.cur.dir > 0 ? 0 : W - nb.w, w: nb.w, dir: S.cur.dir };
  },
  key(S, k) { if (k === ' ' || k === 'Enter') G.tower.down(S); },
  draw(S, c) {
    bg(c, '#83a4d4', '#b6fbff');
    c.save(); c.translate(0, S.cam);
    c.fillStyle = '#5a3d2b'; c.fillRect(0, 600, W, 400);
    S.stack.forEach((b, i) => rr(c, b.x, 560 - i * 40, b.w, 38, 6, `hsl(${(i * 23) % 360} 80% 60%)`, 'rgba(0,0,0,.3)'));
    if (!S.over) rr(c, S.cur.x, 560 - S.stack.length * 40, S.cur.w, 38, 6, `hsl(${(S.stack.length * 23) % 360} 80% 60%)`, '#fff');
    S.falling.forEach((f) => rr(c, f.x, f.y, f.w, 38, 6, 'rgba(120,120,120,.8)'));
    c.restore();
  },
};

G.row = {
  dur: 12,
  init(S) { S.last = null; S.L = { x: 20, y: 480, w: 170, h: 130 }; S.R = { x: 210, y: 480, w: 170, h: 130 }; S.pl = 0; S.pr = 0; },
  press(S, side) { if (side !== S.last) { S.score++; S.last = side; sfx('tap'); } else { S.shake = 0.08; } if (side === 'L') S.pl = 0.08; else S.pr = 0.08; },
  down(S, x, y) { if (inside(S.L, x, y)) G.row.press(S, 'L'); else if (inside(S.R, x, y)) G.row.press(S, 'R'); },
  key(S, k) { if (k === 'ArrowLeft' || k === 'a') G.row.press(S, 'L'); if (k === 'ArrowRight' || k === 'd') G.row.press(S, 'R'); },
  update(S, dt) { S.pl -= dt; S.pr -= dt; S.hud = `Paladas ${S.score}`; },
  draw(S, c) {
    bg(c, '#4facfe', '#00f2fe');
    const off = (S.score * 9) % 60; c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3;
    for (let y = -60 + off; y < 460; y += 60) { c.beginPath(); c.moveTo(40, y); c.quadraticCurveTo(80, y + 10, 120, y); c.stroke(); c.beginPath(); c.moveTo(270, y + 30); c.quadraticCurveTo(310, y + 40, 350, y + 30); c.stroke(); }
    emoji(c, '🛶', 200, 300, 110); emoji(c, S.me, 200, 270, 46);
    text(c, `${S.score * 2} m`, 200, 120, 46);
    button(c, S.L, '⬅ IZQ', S.last === 'L' ? '#777' : '#e0447c', 30, S.pl > 0);
    button(c, S.R, 'DER ➡', S.last === 'R' ? '#777' : '#3a7bd5', 30, S.pr > 0);
  },
};

G.moles = {
  dur: 20,
  init(S) { S.holes = Array.from({ length: 9 }, (_, i) => ({ x: 80 + (i % 3) * 120, y: 230 + Math.floor(i / 3) * 130, m: null, until: 0 })); S.next = 0.4; },
  update(S) {
    if (S.t >= S.next) {
      S.next = S.t + Math.max(0.28, 0.6 - S.t * 0.012);
      const free = S.holes.filter((h) => !h.m); if (free.length) { const h = free[S.rng() * free.length | 0]; const r = S.rng(); h.m = r < 0.1 ? 'gold' : r < 0.22 ? 'bomb' : 'mole'; h.until = S.t + 0.75 + S.rng() * 0.4; }
    }
    S.holes.forEach((h) => { if (h.m && S.t > h.until) h.m = null; });
  },
  down(S, x, y) {
    for (const h of S.holes) if (h.m && dist(x, y, h.x, h.y - 10) < 52) {
      if (h.m === 'bomb') { S.score = Math.max(0, S.score - 2); S.pop(h.x, h.y - 40, '−2', '#ff5050'); sfx('bad'); S.shake = 0.2; }
      else { const v = h.m === 'gold' ? 3 : 1; S.score += v; S.pop(h.x, h.y - 40, '+' + v); sfx('pop'); }
      h.m = null; return;
    }
  },
  draw(S, c) {
    bg(c, '#76b852', '#8dc26f');
    S.holes.forEach((h) => { c.beginPath(); c.ellipse(h.x, h.y + 20, 50, 20, 0, 0, Math.PI * 2); c.fillStyle = '#3d2614'; c.fill(); if (h.m) emoji(c, h.m === 'bomb' ? '💣' : h.m === 'gold' ? '🌟' : '🐹', h.x, h.y - 10, 60); });
  },
};

G.order = {
  dur: 25,
  init(S) { G.order.grid(S); },
  grid(S) { const a = Array.from({ length: 16 }, (_, i) => i + 1); for (let i = 15; i > 0; i--) { const j = S.rng() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } S.g = a; S.nextN = 1; S.freeze = 0; },
  cell: (i) => ({ x: 24 + (i % 4) * 90, y: 150 + Math.floor(i / 4) * 90, w: 82, h: 82 }),
  update(S, dt) { S.freeze -= dt; S.hud = `Siguiente: ${S.nextN}  ·  ${S.score}`; },
  down(S, x, y) {
    if (S.freeze > 0) return;
    for (let i = 0; i < 16; i++) if (inside(G.order.cell(i), x, y)) {
      if (S.g[i] === S.nextN) { S.nextN++; S.score++; sfx('tap'); if (S.nextN > 16) { S.pop(200, 120, '¡Completo!'); G.order.grid(S); } }
      else if (S.g[i] > S.nextN) { S.freeze = 0.5; S.shake = 0.2; sfx('bad'); }
      return;
    }
  },
  draw(S, c) {
    bg(c, '#ee9ca7', '#ffdde1');
    for (let i = 0; i < 16; i++) { const b = G.order.cell(i), done = S.g[i] < S.nextN; rr(c, b.x, b.y, b.w, b.h, 14, done ? 'rgba(0,0,0,.15)' : S.freeze > 0 ? '#999' : '#6a5acd'); if (!done) text(c, S.g[i], b.x + 41, b.y + 41, 36); }
  },
};

G.shoot = {
  dur: 20,
  init(S) { S.rows = [{ y: 180, r: 18, v: 230, pts: 3 }, { y: 300, r: 26, v: -160, pts: 2 }, { y: 420, r: 36, v: 110, pts: 1 }].map((row) => ({ ...row, ts: [0, 1, 2].map((k) => ({ x: (k * 400) / 3 + S.rng() * 60, alive: true })) })); },
  update(S, dt) { for (const row of S.rows) for (const t of row.ts) { t.x += row.v * dt * (1 + S.t / 30); if (t.x > 440) { t.x = -40; t.alive = true; } if (t.x < -40) { t.x = 440; t.alive = true; } } },
  down(S, x, y) {
    S.shots.push({ x, y, life: 0.2 });
    for (const row of S.rows) for (const t of row.ts) if (t.alive && dist(x, y, t.x, row.y) < row.r + 6) { t.alive = false; S.score += row.pts; S.pop(t.x, row.y - 30, '+' + row.pts); sfx('pop'); return; }
  },
  draw(S, c) {
    bg(c, '#3a1c71', '#d76d77');
    for (const row of S.rows) { c.fillStyle = '#5a3d2b'; c.fillRect(0, row.y + row.r + 6, W, 8); for (const t of row.ts) if (t.alive) { circ(c, t.x, row.y, row.r, '#fff'); circ(c, t.x, row.y, row.r * 0.7, '#e0393e'); circ(c, t.x, row.y, row.r * 0.4, '#fff'); circ(c, t.x, row.y, row.r * 0.15, '#e0393e'); } }
    text(c, '3 pts · 2 pts · 1 pt', 200, 530, 22);
  },
};

G.balance = {
  dur: 20,
  init(S) { S.bx = 0; S.v = 0; S.tilt = 0; S.wind = 0; S.wt = 0; S.fall = 0; S.acc = 0; },
  update(S, dt) {
    let input = 0;
    if (S.ptr.down) input = S.ptr.x < 200 ? -1 : 1;
    if (S.keys.ArrowLeft) input = -1; if (S.keys.ArrowRight) input = 1;
    S.tilt += (input * 0.5 - S.tilt) * Math.min(1, dt * 6);
    if (S.t > S.wt) { S.wt = S.t + 1 + S.rng() * 1.5; S.wind = (S.rng() - 0.5) * (1 + S.t / 12); }
    if (S.fall > 0) { S.fall -= dt; if (S.fall <= 0) { S.bx = 0; S.v = 0; } return; }
    S.v += (S.tilt * 2.2 + S.wind) * dt; S.v *= 0.995; S.bx += S.v * dt;
    if (Math.abs(S.bx) > 1) { S.fall = 1; sfx('bad'); S.shake = 0.3; }
    if (Math.abs(S.bx) < 0.25) { S.acc += dt * 10; S.score = Math.floor(S.acc); }
  },
  draw(S, c) {
    bg(c, '#c9d6ff', '#e2e2e2');
    c.save(); c.translate(200, 380); c.rotate(S.tilt * 0.4);
    rr(c, -170, -8, 340, 16, 8, '#8b5a2b'); rr(c, -42, -9, 84, 18, 4, '#3ccf4e');
    if (S.fall <= 0) circ(c, S.bx * 170, -28, 20, '#e0447c'); c.restore();
    c.fillStyle = '#555'; c.beginPath(); c.moveTo(200, 390); c.lineTo(170, 470); c.lineTo(230, 470); c.fill();
    text(c, S.wind > 0.05 ? '💨 ➡' : S.wind < -0.05 ? '⬅ 💨' : '', 200, 180, 40);
    rr(c, 10, 520, 185, 100, 16, S.ptr.down && S.ptr.x < 200 ? '#e0447c' : 'rgba(0,0,0,.25)'); text(c, '⬅', 102, 570, 44);
    rr(c, 205, 520, 185, 100, 16, S.ptr.down && S.ptr.x >= 200 ? '#3a7bd5' : 'rgba(0,0,0,.25)'); text(c, '➡', 297, 570, 44);
  },
};

G.coins = {
  dur: 20,
  init(S) { S.px = 200; S.py = 360; S.cs = []; S.hs = Array.from({ length: 3 }, () => ({ x: 50 + S.rng() * 300, y: 150 + S.rng() * 400, vx: (S.rng() - 0.5) * 240, vy: (S.rng() - 0.5) * 240 })); S.stun = 0; },
  update(S, dt) {
    while (S.cs.length < 6) S.cs.push({ x: 30 + S.rng() * 340, y: 120 + S.rng() * 480 });
    S.stun -= dt;
    let tx = null, ty = null;
    if (S.ptr.down) { tx = S.ptr.x; ty = S.ptr.y; }
    const k = S.keys; let kx = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), ky = (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0);
    if (S.stun <= 0) {
      if (tx !== null) { const d = dist(tx, ty, S.px, S.py); if (d > 4) { S.px += ((tx - S.px) / d) * 240 * dt; S.py += ((ty - S.py) / d) * 240 * dt; } }
      else if (kx || ky) { S.px += kx * 240 * dt; S.py += ky * 240 * dt; }
    }
    S.px = clamp(S.px, 20, 380); S.py = clamp(S.py, 110, 620);
    for (const h of S.hs) { h.x += h.vx * dt * (1 + S.t / 20); h.y += h.vy * dt * (1 + S.t / 20); if (h.x < 20 || h.x > 380) h.vx *= -1; if (h.y < 110 || h.y > 620) h.vy *= -1; if (S.stun <= 0 && dist(h.x, h.y, S.px, S.py) < 36) { S.score = Math.max(0, S.score - 3); S.stun = 1; S.pop(S.px, S.py - 30, '−3', '#ff5050'); sfx('bad'); S.shake = 0.25; } }
    S.cs = S.cs.filter((cn) => { if (dist(cn.x, cn.y, S.px, S.py) < 30) { S.score++; sfx('coin'); return false; } return true; });
  },
  draw(S, c) {
    bg(c, '#f7971e', '#ffd200');
    for (const cn of S.cs) emoji(c, '🪙', cn.x, cn.y, 30);
    for (const h of S.hs) emoji(c, '🦔', h.x, h.y, 42);
    c.globalAlpha = S.stun > 0 && Math.floor(S.t * 12) % 2 ? 0.4 : 1; emoji(c, S.me, S.px, S.py, 44); c.globalAlpha = 1;
  },
};

G.rhythm = {
  dur: 20,
  init(S) { S.notes = []; S.next = 1; S.flash = [0, 0, 0]; },
  update(S, dt) {
    if (S.t >= S.next && S.t < S.dur - 1.5) { S.next = S.t + 0.35 + S.rng() * 0.35; S.notes.push({ lane: S.rng() * 3 | 0, y: 60 }); }
    for (const n of S.notes) n.y += 320 * dt;
    S.notes = S.notes.filter((n) => !n.hit && n.y < 640);
    S.flash = S.flash.map((f) => f - dt);
  },
  hit(S, lane) {
    S.flash[lane] = 0.12;
    let best = null, bd = 999;
    for (const n of S.notes) if (n.lane === lane && !n.hit) { const d = Math.abs(n.y - 540); if (d < bd) { bd = d; best = n; } }
    if (best && bd < 55) { best.hit = true; const v = bd < 22 ? 2 : 1; S.score += v; S.pop(lane * 133 + 66, 500, v === 2 ? '¡PERFECTO!' : 'Bien', v === 2 ? '#ffd23f' : '#fff'); sfx('note' + lane); }
  },
  down(S, x) { G.rhythm.hit(S, clamp(Math.floor(x / 133.4), 0, 2)); },
  key(S, k) { const m = { ArrowLeft: 0, a: 0, ArrowDown: 1, s: 1, ArrowRight: 2, d: 2 }; if (k in m) G.rhythm.hit(S, m[k]); },
  draw(S, c) {
    bg(c, '#232526', '#414345');
    const cols = ['#ff4d6d', '#3ccf4e', '#4dabff'];
    for (let l = 0; l < 3; l++) { c.fillStyle = S.flash[l] > 0 ? cols[l] + '66' : 'rgba(255,255,255,.05)'; c.fillRect(l * 133.4 + 4, 60, 125, 580); }
    c.fillStyle = '#fff'; c.fillRect(0, 538, W, 4);
    for (const n of S.notes) { circ(c, n.lane * 133.4 + 66, n.y, 26, cols[n.lane]); circ(c, n.lane * 133.4 + 66, n.y, 12, '#fff'); }
    for (let l = 0; l < 3; l++) { c.beginPath(); c.arc(l * 133.4 + 66, 540, 30, 0, Math.PI * 2); c.strokeStyle = cols[l]; c.lineWidth = 4; c.stroke(); }
  },
};

G.sort = {
  dur: 20,
  init(S) { G.sort.next(S); },
  next(S) { S.item = { red: S.rng() < 0.5, e: ['🍎', '🍓', '🌶️', '🎈', '❤️'][S.rng() * 5 | 0], e2: ['🫐', '💎', '🐳', '🧊', '💙'][S.rng() * 5 | 0] }; S.it0 = S.t; S.limit = Math.max(0.7, 1.6 - S.t * 0.04); },
  choose(S, left) {
    const ok = left === S.item.red;
    if (ok) { S.score++; sfx('coin'); S.pop(left ? 90 : 310, 300, '+1'); } else { S.score = Math.max(0, S.score - 2); sfx('bad'); S.shake = 0.2; S.pop(left ? 90 : 310, 300, '−2', '#ff5050'); }
    G.sort.next(S);
  },
  update(S) { if (S.t - S.it0 > S.limit) { S.score = Math.max(0, S.score - 1); S.pop(200, 220, '¡Tarde! −1', '#ff5050'); G.sort.next(S); } },
  down(S, x) { G.sort.choose(S, x < 200); },
  key(S, k) { if (k === 'ArrowLeft') G.sort.choose(S, true); if (k === 'ArrowRight') G.sort.choose(S, false); },
  draw(S, c) {
    bg(c, '#bdc3c7', '#2c3e50');
    rr(c, 10, 440, 180, 180, 20, '#e0393e'); text(c, '🔴 ROJOS', 100, 530, 26);
    rr(c, 210, 440, 180, 180, 20, '#2f7fe0'); text(c, 'AZULES 🔵', 300, 530, 26);
    const p = (S.t - S.it0) / S.limit;
    rr(c, 100, 120, 200 * (1 - p), 12, 6, '#ffd23f');
    circ(c, 200, 280, 80, S.item.red ? '#e0393e' : '#2f7fe0');
    emoji(c, S.item.red ? S.item.e : S.item.e2, 200, 280, 80);
  },
};

// ---------- Uno contra todos ----------
G.siege = {
  dur: 15,
  init(S) { S.pts = []; S.next = 0.3; },
  update(S) {
    if (S.t >= S.next) { S.next = S.t + Math.max(0.25, 0.42 - S.t * 0.008); S.pts.push({ x: 50 + S.rng() * 300, y: 200 + S.rng() * 330, until: S.t + 1.05 }); }
    S.pts = S.pts.filter((p) => p.until > S.t && !p.dead);
  },
  down(S, x, y) { for (const p of S.pts) if (!p.dead && dist(x, y, p.x, p.y) < 34) { p.dead = true; S.score++; S.pop(p.x, p.y - 30, '+1'); sfx(S.role === 'solo' ? 'tap' : 'pop'); return; } },
  draw(S, c) {
    bg(c, '#355c7d', '#6c5b7b');
    c.fillStyle = '#9c8b7a'; c.fillRect(30, 170, 340, 400);
    for (let y = 170; y < 570; y += 40) for (let x = 30 + ((y / 40) % 2) * 30; x < 370; x += 60) { c.strokeStyle = '#6f6153'; c.lineWidth = 2; c.strokeRect(x, y, 60, 40); }
    for (let x = 30; x < 370; x += 56) c.fillRect(x, 140, 34, 34);
    for (const p of S.pts) { const life = (p.until - S.t) / 1.05; c.globalAlpha = 0.4 + life * 0.6; emoji(c, S.role === 'solo' ? '🧱' : '💥', p.x, p.y, 48); c.globalAlpha = 1; }
    text(c, S.role === 'solo' ? '🛡️ ¡Repara!' : '⚔️ ¡Ataca!', 200, 600, 28);
  },
};

G.maze = {
  dur: 30,
  init(S) { S.level = 0; G.maze.make(S); },
  make(S) {
    const cols = 7 + Math.min(3, S.level), rows = 9 + Math.min(3, S.level);
    const cells = Array.from({ length: cols * rows }, () => ({ w: [true, true, true, true], v: false })); // N E S O
    const stack = [0]; cells[0].v = true;
    const dirs = [[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]];
    while (stack.length) {
      const cur = stack[stack.length - 1], cx = cur % cols, cy = cur / cols | 0;
      const nb = dirs.map((d) => [cx + d[0], cy + d[1], d[2], d[3]]).filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows && !cells[y * cols + x].v);
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny, w1, w2] = nb[S.rng() * nb.length | 0], ni = ny * cols + nx;
      cells[cur].w[w1] = false; cells[ni].w[w2] = false; cells[ni].v = true; stack.push(ni);
    }
    S.mz = { cols, rows, cells }; S.mx = 0; S.my = 0;
    S.maxD = G.maze.bfs(S, 0, 0);
  },
  bfs(S, sx, sy) {
    const { cols, rows, cells } = S.mz, d = new Array(cols * rows).fill(-1), q = [sy * cols + sx]; d[q[0]] = 0;
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    while (q.length) { const u = q.shift(), x = u % cols, y = u / cols | 0; dirs.forEach(([dx, dy], k) => { if (!cells[u].w[k]) { const v = (y + dy) * cols + x + dx; if (d[v] < 0) { d[v] = d[u] + 1; q.push(v); } } }); }
    return d[cols * rows - 1];
  },
  step(S, k) {
    const { cols, cells } = S.mz, i = S.my * cols + S.mx;
    if (cells[i].w[k]) { S.shake = 0.06; return; }
    S.mx += [0, 1, 0, -1][k]; S.my += [-1, 0, 1, 0][k]; sfx('tap');
    if (S.mx === cols - 1 && S.my === S.mz.rows - 1) { S.level++; S.pop(200, 300, '¡Salida!', '#ffd23f'); sfx('star'); G.maze.make(S); }
  },
  btns: [{ x: 155, y: 500, w: 90, h: 62, k: 0 }, { x: 255, y: 540, w: 90, h: 62, k: 1 }, { x: 155, y: 572, w: 90, h: 62, k: 2 }, { x: 55, y: 540, w: 90, h: 62, k: 3 }],
  down(S, x, y) { S.sx0 = x; S.sy0 = y; const b = G.maze.btns.find((b) => inside(b, x, y)); if (b) { G.maze.step(S, b.k); S.sx0 = null; } },
  up(S, x, y) { if (S.sx0 == null) return; const dx = x - S.sx0, dy = y - S.sy0; if (Math.max(Math.abs(dx), Math.abs(dy)) > 25) G.maze.step(S, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0); S.sx0 = null; },
  key(S, k) { const m = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 }; if (k in m) G.maze.step(S, m[k]); },
  update(S) { const rem = G.maze.bfs(S, S.mx, S.my); S.score = S.level * 10 + Math.round(10 * (1 - rem / Math.max(1, S.maxD))); S.hud = `Laberintos: ${S.level}`; },
  draw(S, c) {
    bg(c, '#0f0c29', '#302b63');
    const { cols, rows, cells } = S.mz, cs = Math.min(360 / cols, 400 / rows), ox = (W - cs * cols) / 2, oy = 80;
    c.strokeStyle = '#7df9ff'; c.lineWidth = 3; c.beginPath();
    cells.forEach((cl, i) => { const x = ox + (i % cols) * cs, y = oy + (i / cols | 0) * cs; if (cl.w[0]) { c.moveTo(x, y); c.lineTo(x + cs, y); } if (cl.w[1]) { c.moveTo(x + cs, y); c.lineTo(x + cs, y + cs); } if (cl.w[2]) { c.moveTo(x, y + cs); c.lineTo(x + cs, y + cs); } if (cl.w[3]) { c.moveTo(x, y); c.lineTo(x, y + cs); } });
    c.stroke();
    emoji(c, '🚪', ox + (cols - 0.5) * cs, oy + (rows - 0.5) * cs, cs * 0.8);
    emoji(c, S.me, ox + (S.mx + 0.5) * cs, oy + (S.my + 0.5) * cs, cs * 0.8);
    G.maze.btns.forEach((b) => button(c, b, ['▲', '▶', '▼', '◀'][b.k], '#5b6ee1', 30));
  },
};

G.sniper = {
  dur: 20,
  init(S) { S.win = Array.from({ length: 9 }, (_, i) => ({ x: 75 + (i % 3) * 125, y: 190 + Math.floor(i / 3) * 135, who: null, until: 0 })); S.next = 0.4; },
  update(S) {
    if (S.t >= S.next) { S.next = S.t + 0.42; const free = S.win.filter((w) => !w.who); if (free.length) { const w = free[S.rng() * free.length | 0]; w.who = S.rng() < 0.7 ? 'bad' : 'good'; w.until = S.t + Math.max(0.6, 1.1 - S.t * 0.02); } }
    S.win.forEach((w) => { if (w.who && S.t > w.until) w.who = null; });
  },
  down(S, x, y) {
    S.shots.push({ x, y, life: 0.2 });
    for (const w of S.win) if (w.who && Math.abs(x - w.x) < 52 && Math.abs(y - w.y) < 58) {
      if (w.who === 'bad') { S.score++; S.pop(w.x, w.y - 50, '+1'); sfx('pop'); } else { S.score = Math.max(0, S.score - 2); S.pop(w.x, w.y - 50, '−2', '#ff5050'); sfx('bad'); S.shake = 0.2; }
      w.who = null; return;
    }
  },
  draw(S, c) {
    bg(c, '#f2994a', '#f2c94c');
    rr(c, 10, 110, 380, 440, 10, '#a0522d');
    S.win.forEach((w) => { rr(c, w.x - 52, w.y - 58, 104, 116, 8, '#2b1b0e'); if (w.who) emoji(c, w.who === 'bad' ? '🦹' : '🧑‍🌾', w.x, w.y, 70); c.fillStyle = '#d2a679'; c.fillRect(w.x - 56, w.y + 56, 112, 8); });
  },
};

G.lanes = {
  dur: 30,
  init(S) { S.lane = 1; S.cx = 200; S.obs = []; S.next = 0.6; S.fuel = 0; },
  lx: (l) => 80 + l * 120,
  change(S, d) { S.lane = clamp(S.lane + d, 0, 2); sfx('tap'); },
  down(S, x) { G.lanes.change(S, x < 200 ? -1 : 1); },
  key(S, k) { if (k === 'ArrowLeft') G.lanes.change(S, -1); if (k === 'ArrowRight') G.lanes.change(S, 1); },
  update(S, dt) {
    const sp = 300 + S.t * 12;
    S.cx += (G.lanes.lx(S.lane) - S.cx) * Math.min(1, dt * 14);
    if (S.t >= S.next) { S.next = S.t + Math.max(0.35, 0.8 - S.t * 0.015); const l = S.rng() * 3 | 0; S.obs.push({ l, y: -40, k: S.rng() < 0.25 ? 'fuel' : 'rock' }); }
    for (const o of S.obs) { o.y += sp * dt; if (!o.hit && Math.abs(o.y - 540) < 40 && Math.abs(G.lanes.lx(o.l) - S.cx) < 50) { o.hit = true; if (o.k === 'fuel') { S.fuel++; sfx('coin'); S.pop(S.cx, 500, '+5'); } else { S.done = true; sfx('bad'); S.shake = 0.3; } } }
    S.obs = S.obs.filter((o) => o.y < 700 && !(o.hit && o.k === 'fuel'));
    S.score = Math.floor(S.t * 10) + S.fuel * 5;
  },
  draw(S, c) {
    c.fillStyle = '#3b3b3b'; c.fillRect(0, 0, W, H); c.fillStyle = '#2e7d32'; c.fillRect(0, 0, 20, H); c.fillRect(380, 0, 20, H);
    const off = (S.t * (300 + S.t * 12)) % 80; c.fillStyle = '#fff';
    for (let y = -80 + off; y < H; y += 80) { c.fillRect(138, y, 6, 40); c.fillRect(258, y, 6, 40); }
    for (const o of S.obs) emoji(c, o.k === 'fuel' ? '⛽' : ['🚧', '🪨', '🛢️'][o.l], G.lanes.lx(o.l), o.y, 54);
    emoji(c, '🏎️', S.cx, 540, 64);
  },
};

G.bridge = {
  dur: 30,
  init(S) { S.done_ = 0; G.bridge.make(S); },
  make(S) { S.safe = Array.from({ length: 8 }, () => (S.rng() < 0.5 ? 0 : 1)); S.row = -1; S.show = S.t + 2.6; S.fallT = 0; S.best = 0; S.broken = {}; },
  step(S, side) {
    if (S.t < S.show || S.fallT > 0) return;
    const r = S.row + 1;
    if (S.safe[r] === side) { S.row = r; S.best = Math.max(S.best, r + 1); sfx('tap'); if (r === 7) { S.done_++; S.pop(200, 100, '¡Cruzaste!', '#ffd23f'); sfx('star'); G.bridge.make(S); } }
    else { S.broken[r + '-' + side] = true; S.fallT = 0.8; sfx('bad'); S.shake = 0.3; }
  },
  down(S, x) { G.bridge.step(S, x < 200 ? 0 : 1); },
  key(S, k) { if (k === 'ArrowLeft') G.bridge.step(S, 0); if (k === 'ArrowRight') G.bridge.step(S, 1); },
  update(S, dt) {
    if (S.fallT > 0) { S.fallT -= dt; if (S.fallT <= 0) { S.row = -1; S.show = S.t + 1.3; } }
    S.score = S.done_ * 10 + S.best;
    S.hud = `Cruces: ${S.done_} · fila ${S.row + 1}/8`;
  },
  draw(S, c) {
    bg(c, '#000428', '#004e92');
    const showing = S.t < S.show;
    for (let r = 0; r < 8; r++) for (let s = 0; s < 2; s++) {
      const x = 90 + s * 130, y = 530 - r * 54;
      if (S.broken[r + '-' + s]) continue;
      const hl = showing && S.safe[r] === s;
      rr(c, x, y, 90, 46, 6, hl ? 'rgba(124,255,107,.85)' : 'rgba(180,230,255,.45)', 'rgba(255,255,255,.7)');
    }
    rr(c, 90, 584, 220, 46, 8, '#8b5a2b'); rr(c, 90, 92, 220, 50, 8, '#3ccf4e');
    const py = S.row < 0 ? 604 : 553 - S.row * 54, px = S.row < 0 ? 200 : 135 + S.safe[S.row] * 130;
    emoji(c, S.fallT > 0 ? '😱' : S.me, px, py + (S.fallT > 0 ? (0.8 - S.fallT) * 200 : 0), 40);
    text(c, showing ? '👀 ¡Memoriza!' : '🏁 Toca IZQ / DER', 200, 117, 24);
  },
};

G.arrows = {
  dur: 20,
  init(S) { G.arrows.next(S); S.freeze = 0; },
  next(S) { S.dir = S.rng() * 4 | 0; S.red = S.rng() < 0.3; },
  btns: [{ x: 150, y: 400, w: 100, h: 80 }, { x: 260, y: 480, w: 100, h: 80 }, { x: 150, y: 560, w: 100, h: 70 }, { x: 40, y: 480, w: 100, h: 80 }],
  press(S, k) {
    if (S.freeze > 0) return;
    const want = S.red ? (S.dir + 2) % 4 : S.dir;
    if (k === want) { S.score++; sfx('tap'); } else { S.score = Math.max(0, S.score - 1); S.freeze = 0.4; S.shake = 0.2; sfx('bad'); }
    G.arrows.next(S);
  },
  down(S, x, y) { const i = G.arrows.btns.findIndex((b) => inside(b, x, y)); if (i >= 0) G.arrows.press(S, i); },
  key(S, k) { const m = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }; if (k in m) G.arrows.press(S, m[k]); },
  update(S, dt) { S.freeze -= dt; },
  draw(S, c) {
    bg(c, '#1d976c', '#93f9b9');
    circ(c, 200, 240, 120, S.red ? '#e0393e' : '#fff');
    c.save(); c.translate(200, 240); c.rotate(S.dir * Math.PI / 2);
    c.fillStyle = S.red ? '#fff' : '#1d976c'; c.beginPath(); c.moveTo(0, -80); c.lineTo(60, 0); c.lineTo(22, 0); c.lineTo(22, 70); c.lineTo(-22, 70); c.lineTo(-22, 0); c.lineTo(-60, 0); c.closePath(); c.fill(); c.restore();
    if (S.red) text(c, '¡AL REVÉS!', 200, 380, 24, '#ffd23f');
    G.arrows.btns.forEach((b, i) => button(c, b, ['▲', '▶', '▼', '◀'][i], S.freeze > 0 ? '#888' : '#5b6ee1', 34));
  },
};

G.fishing = {
  dur: 30,
  init(S) { S.bar = 300; S.bv = 0; S.fish = 300; S.ft = 300; S.prog = 0.3; S.caught = 0; S.retarget = 0; },
  update(S, dt) {
    const hold = S.ptr.down || S.keys[' '];
    S.bv += (hold ? -900 : 700) * dt; S.bv *= 0.97; S.bar += S.bv * dt;
    if (S.bar < 100) { S.bar = 100; S.bv = 0; } if (S.bar > 500) { S.bar = 500; S.bv = 0; }
    if (S.t > S.retarget) { S.retarget = S.t + 0.4 + S.rng() * 0.9; S.ft = 100 + S.rng() * 470; }
    const fs = 1.5 + S.caught * 0.6; S.fish += (S.ft - S.fish) * Math.min(1, dt * fs);
    const inBar = S.fish > S.bar && S.fish < S.bar + 120;
    S.prog += (inBar ? 0.32 : -0.2) * dt; S.prog = clamp(S.prog, 0, 1);
    if (S.prog >= 1) { S.caught++; S.prog = 0.3; S.pop(200, 100, '¡Pez atrapado! 🐟', '#ffd23f'); sfx('star'); }
    S.score = S.caught * 10 + Math.floor(S.prog * 9);
    S.hud = `Peces: ${S.caught}`;
  },
  draw(S, c) {
    bg(c, '#2193b0', '#6dd5ed');
    rr(c, 150, 90, 60, 540, 14, '#0b3d66');
    const inBar = S.fish > S.bar && S.fish < S.bar + 120;
    rr(c, 154, S.bar, 52, 120, 10, inBar ? 'rgba(124,255,107,.85)' : 'rgba(124,255,107,.45)');
    emoji(c, '🐟', 180, S.fish, 40);
    rr(c, 240, 90, 30, 540, 10, '#333'); rr(c, 244, 90 + 536 * (1 - S.prog), 22, 536 * S.prog, 8, '#ffd23f');
    emoji(c, '🎣', 320, 140, 60); emoji(c, S.me, 320, 210, 50);
    text(c, 'Mantén pulsado', 320, 400, 20);
  },
};

G.redlight = {
  dur: 25,
  init(S) { S.d = 0; S.light = 'green'; S.lt = S.t + 2; S.grace = 0; S.finished = false; },
  update(S, dt) {
    if (S.finished) return;
    if (S.t >= S.lt) {
      if (S.light === 'green') { S.light = 'yellow'; S.lt = S.t + 0.45; }
      else if (S.light === 'yellow') { S.light = 'red'; S.lt = S.t + 1 + S.rng() * 1.6; S.grace = 0.18; sfx('bad'); }
      else { S.light = 'green'; S.lt = S.t + 1 + S.rng() * 2.4; sfx('go'); }
    }
    S.grace -= dt;
    const hold = S.ptr.down || S.keys[' '];
    if (hold) {
      if (S.light === 'red' && S.grace <= 0) { S.d = Math.max(0, S.d - 30); S.pop(200, 300, '¡TE VI! −30', '#ff5050'); S.shake = 0.3; S.grace = 0.8; sfx('bad'); }
      else S.d += 11 * dt;
    }
    if (S.d >= 100) { S.finished = true; S.score = 100 + Math.round((S.dur - S.t) * 2); S.pop(200, 200, '¡META!', '#ffd23f'); sfx('star'); S.endSoon(1); return; }
    S.score = Math.floor(S.d);
  },
  draw(S, c) {
    bg(c, '#e6dada', '#274046');
    rr(c, 150, 90, 100, 230, 20, '#222');
    circ(c, 200, 130, 30, S.light === 'red' ? '#ff2d2d' : '#441'); circ(c, 200, 205, 30, S.light === 'yellow' ? '#ffd23f' : '#441'); circ(c, 200, 280, 30, S.light === 'green' ? '#2ee86b' : '#141');
    rr(c, 30, 400, 340, 30, 15, 'rgba(0,0,0,.3)'); rr(c, 30, 400, 340 * Math.min(1, S.d / 100), 30, 15, '#3ccf4e');
    emoji(c, '🏁', 370, 380, 36); emoji(c, S.me, 30 + 340 * Math.min(1, S.d / 100), 370, 40);
    text(c, (S.ptr.down || S.keys[' ']) ? '🏃 Avanzando…' : '✋ Quieto', 200, 520, 28);
  },
};

G.count = {
  dur: 45,
  init(S) { S.round = 0; S.total = 0; G.count.start(S); },
  start(S) {
    S.phase = 'watch'; S.animals = []; const n = 8 + (S.rng() * 9 | 0), g = 3 + (S.rng() * 6 | 0); S.sheep = n;
    const list = [...Array(n).fill('🐑'), ...Array(g).fill('🐐')];
    for (let i = list.length - 1; i > 0; i--) { const j = S.rng() * (i + 1) | 0; [list[i], list[j]] = [list[j], list[i]]; }
    list.forEach((e, i) => S.animals.push({ e, x: -40 - i * (40 + S.rng() * 50), y: 200 + S.rng() * 280, v: 240 + S.rng() * 120 }));
    S.opts = null;
  },
  update(S, dt) {
    if (S.phase === 'watch') {
      S.animals.forEach((a) => { a.x += a.v * dt; });
      if (S.animals.every((a) => a.x > 440)) {
        S.phase = 'ask'; const set = new Set([S.sheep]);
        while (set.size < 4) { const d = S.sheep + ((S.rng() * 7 | 0) - 3); if (d > 0) set.add(d); }
        S.opts = [...set].sort((a, b) => a - b);
      }
    }
    S.hud = `Ronda ${S.round + 1}/2`;
  },
  btn: (i) => ({ x: 30 + (i % 2) * 180, y: 300 + Math.floor(i / 2) * 120, w: 160, h: 100 }),
  down(S, x, y) {
    if (S.phase !== 'ask') return;
    for (let i = 0; i < 4; i++) if (inside(G.count.btn(i), x, y)) {
      const d = Math.abs(S.opts[i] - S.sheep), pts = d === 0 ? 100 : d === 1 ? 50 : 0;
      S.score += pts; S.pop(200, 220, `Eran ${S.sheep} 🐑 · +${pts}`, pts ? '#ffd23f' : '#ff5050'); sfx(pts ? 'star' : 'bad');
      S.round++; if (S.round >= 2) { S.phase = 'done'; S.endSoon(1.2); } else { S.phase = 'wait'; setTimeout(() => G.count.start(S), 1300); }
      return;
    }
  },
  draw(S, c) {
    bg(c, '#a8e063', '#56ab2f');
    if (S.phase === 'watch') { S.animals.forEach((a) => emoji(c, a.e, a.x, a.y, 46)); text(c, '¡Cuenta las ovejas 🐑!', 200, 130, 26); }
    if (S.phase === 'ask') { text(c, '¿Cuántas ovejas 🐑?', 200, 220, 32); S.opts.forEach((o, i) => button(c, G.count.btn(i), o, '#7b4ee0', 42)); }
  },
};

G.needle = {
  dur: 30,
  init(S) { S.tries = 0; S.a = 0; S.res = []; G.needle.target(S); S.pause = 0; },
  target(S) { S.tc = S.rng() * Math.PI * 2; S.hw = Math.max(0.12, 0.28 - S.tries * 0.03); S.sp = 2.6 + S.tries * 0.9; },
  update(S, dt) { if (S.pause > 0) { S.pause -= dt; if (S.pause <= 0) G.needle.target(S); return; } S.a = (S.a + S.sp * dt) % (Math.PI * 2); S.hud = `Intento ${Math.min(5, S.tries + 1)}/5`; },
  down(S) {
    if (S.pause > 0 || S.tries >= 5) return;
    let d = Math.abs(((S.a - S.tc + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const pts = d <= S.hw ? Math.round(100 - (d / S.hw) * 30) : Math.max(0, Math.round(60 - ((d - S.hw) * 180 / Math.PI) * 2));
    S.score += pts; S.res.push(pts); S.tries++; S.pop(200, 120, `+${pts}`, pts >= 70 ? '#ffd23f' : '#fff'); sfx(pts >= 70 ? 'star' : 'tap');
    if (S.tries >= 5) S.endSoon(1); else S.pause = 0.7;
  },
  key(S, k) { if (k === ' ' || k === 'Enter') G.needle.down(S); },
  draw(S, c) {
    bg(c, '#42275a', '#734b6d');
    circ(c, 200, 340, 160, '#fff'); circ(c, 200, 340, 150, '#2b2b45');
    c.beginPath(); c.moveTo(200, 340); c.arc(200, 340, 150, S.tc - S.hw, S.tc + S.hw); c.closePath(); c.fillStyle = '#ffd23f'; c.fill();
    c.strokeStyle = '#ff4d6d'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(200, 340); c.lineTo(200 + Math.cos(S.a) * 140, 340 + Math.sin(S.a) * 140); c.stroke();
    circ(c, 200, 340, 14, '#ff4d6d');
    text(c, S.res.join('  ·  '), 200, 560, 24);
  },
};

export const GAME_IDS = Object.keys(G);

// ---------- ejecutor ----------
export function playMinigame(root, id, opts = {}) {
  const def = G[id], meta = mgById(id);
  return new Promise((resolve) => {
    root.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.className = 'mg-canvas';
    root.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => {
      const sc = Math.min(root.clientWidth / W, root.clientHeight / H);
      canvas.style.width = W * sc + 'px'; canvas.style.height = H * sc + 'px';
      canvas.width = W * dpr; canvas.height = H * dpr;
    };
    fit(); window.addEventListener('resize', fit);
    const S = {
      W, H, t: 0, dur: def.dur, rng: mulberry32(opts.seed || 1), role: opts.role || null, me: opts.emoji || '🙂',
      score: 0, done: false, keys: {}, ptr: { x: 200, y: 320, down: false }, fx: [], shots: [], shake: 0, hud: null, info: '',
      pop(x, y, txt, color = '#fff') { S.fx.push({ x, y, txt, color, life: 0.8 }); },
      endSoon(sec) { if (S._end == null) S._end = S.t + sec; },
    };
    def.init?.(S);
    const toLocal = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
    const onDown = (e) => { e.preventDefault(); const [x, y] = toLocal(e); S.ptr = { x, y, down: true }; if (!S.done) def.down?.(S, x, y); };
    const onMove = (e) => { const [x, y] = toLocal(e); S.ptr.x = x; S.ptr.y = y; if (!S.done && (S.ptr.down || e.pointerType === 'mouse')) def.move?.(S, x, y); };
    const onUp = (e) => { const [x, y] = toLocal(e); S.ptr.down = false; if (!S.done) def.up?.(S, x, y); };
    const onKey = (e) => { if (e.repeat) return; S.keys[e.key] = true; if (!S.done) def.key?.(S, e.key); if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); };
    const onKeyUp = (e) => { S.keys[e.key] = false; };
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    let last = performance.now(), raf, finished = false;
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000) * (opts.timeScale || 1); last = now;
      if (!S.done) { S.t += dt; def.update?.(S, dt); if (S.t >= S.dur) S.done = true; if (S._end != null && S.t >= S._end) S.done = true; }
      S.shake = Math.max(0, S.shake - dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (S.shake > 0) ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
      def.draw(S, ctx);
      for (const s of S.shots) { s.life -= dt; ctx.globalAlpha = Math.max(0, s.life * 5); circ(ctx, s.x, s.y, 14, 'rgba(255,255,255,.8)'); ctx.globalAlpha = 1; }
      S.shots = S.shots.filter((s) => s.life > 0);
      for (const f of S.fx) { f.life -= dt; f.y -= 50 * dt; ctx.globalAlpha = Math.max(0, f.life / 0.8); text(ctx, f.txt, f.x, f.y, 26, f.color); ctx.globalAlpha = 1; }
      S.fx = S.fx.filter((f) => f.life > 0);
      // HUD
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rr(ctx, 8, 8, 384, 52, 16, 'rgba(0,0,0,.45)');
      const left = Math.max(0, Math.ceil(S.dur - S.t));
      text(ctx, `⏱ ${left}`, 60, 34, 26, left <= 3 ? '#ff6b6b' : '#fff');
      text(ctx, S.hud ?? `⭐ ${S.score}`, 250, 34, 24, '#ffd23f');
      if (S.done && !finished) {
        finished = true;
        const final = def.final ? def.final(S) : S.score;
        rr(ctx, 40, 250, 320, 140, 24, 'rgba(0,0,0,.75)');
        text(ctx, '¡TIEMPO!', 200, 290, 40, '#ffd23f'); text(ctx, `Puntuación: ${final}`, 200, 345, 28);
        setTimeout(() => { cleanup(); resolve(final); }, 1300);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    const cleanup = () => {
      cancelAnimationFrame(raf); window.removeEventListener('resize', fit);
      window.removeEventListener('pointerup', onUp); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp);
    };
    raf = requestAnimationFrame(frame);
    if (opts.abort) opts.abort.onabort = () => { if (!finished) { finished = true; cleanup(); resolve(def.final ? def.final(S) : S.score); } };
  });
}
