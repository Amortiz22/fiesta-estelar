// 10 tableros extensos generados de forma determinista + sus mecánicas únicas
import { mulberry32, hashStr, weighted, rnd, pick, shuffle } from './util.js';
import { SPACE_TYPES, ITEMS } from './data.js';

const TAU = Math.PI * 2;
const SPACING = 92;
const DEFAULT_W = { blue: 46, red: 14, lucky: 7, bad: 6, item: 9, event: 10, vs: 4 };

// ---------- Definiciones ----------
export const BOARD_DEFS = [
  {
    id: 'isla', name: 'Isla Coco', emoji: '🏝️', mains: 72,
    desc: 'Las mareas abren y cierran dos rutas secretas cada 3 turnos. Los delfines te llevan de paseo.',
    unique: 'Mareas: rutas que se abren y se cierran',
    theme: { bg1: '#5fd3f3', bg2: '#1c8fd1', ground: '#f6e3a1', path: '#fff7d6', deco: ['🌴', '🌴', '🐚', '🦀', '🌺', '🥥', '⛱️'] },
    shape: (t) => { const r = 1 + 0.22 * Math.sin(3 * t) + 0.08 * Math.cos(5 * t); return [r * Math.cos(t), r * Math.sin(t)]; },
    branches: [{ from: 0.08, to: 0.36, bend: 0.75, tag: 'tideA' }, { from: 0.55, to: 0.83, bend: 0.75, tag: 'tideB' }, { from: 0.40, to: 0.50, bend: -0.6, tag: 'beach' }],
    weights: { event: 9, lucky: 8 }, shops: [0.3, 0.7],
  },
  {
    id: 'volcan', name: 'Volcán Furioso', emoji: '🌋', mains: 74,
    desc: 'Cada 5 turnos el volcán erupciona: quien esté en la zona de lava pierde 10 monedas. Los géiseres provocan erupciones.',
    unique: 'Erupciones periódicas sobre la zona de lava',
    theme: { bg1: '#5a1a12', bg2: '#1d0805', ground: '#3b2a24', path: '#ffb070', deco: ['🔥', '🪨', '🌋', '💥', '🦴', '🪨'] },
    shape: (t) => { const r = 1 + 0.28 * Math.cos(2 * t) + 0.05 * Math.sin(7 * t); return [r * Math.cos(t) * 1.15, r * Math.sin(t)]; },
    branches: [{ from: 0.12, to: 0.38, bend: 0.8 }, { from: 0.62, to: 0.88, bend: 0.8 }],
    weights: { red: 18, bad: 8 }, shops: [0.5], zone: (x, y) => (y < -0.15 ? 'lava' : null),
  },
  {
    id: 'ciudad', name: 'Ciudad Neón', emoji: '🌃', mains: 80,
    desc: 'Dos bancos: al pasar depositas 5 monedas; si caes en uno te llevas todo lo ahorrado. Toma un taxi (10 monedas) directo a la estrella.',
    unique: 'Bancos y taxis hacia la estrella',
    theme: { bg1: '#1a0f3d', bg2: '#05030f', ground: '#2b2550', path: '#9cf6ff', deco: ['🏢', '🏬', '🌆', '🚕', '🏙️', '💡', '🎡'] },
    shape: (t) => { const c = Math.cos(t), s = Math.sin(t), n = 6; return [Math.sign(c) * Math.abs(c) ** (2 / n) * 1.3, Math.sign(s) * Math.abs(s) ** (2 / n)]; },
    branches: [{ from: 0.05, to: 0.45, bend: 0.98 }, { from: 0.30, to: 0.70, bend: 0.98 }, { from: 0.55, to: 0.95, bend: 0.98 }],
    weights: { event: 9 }, shops: [0.2, 0.6], banks: [0.4, 0.88],
  },
  {
    id: 'bosque', name: 'Bosque Encantado', emoji: '🌲', mains: 76,
    desc: 'Invoca al Espectro: por 5 monedas roba monedas a un rival, o por 35 roba una estrella. Hay portales mágicos.',
    unique: 'El Espectro ladrón y portales',
    theme: { bg1: '#1f4d2b', bg2: '#0b2414', ground: '#2f6b3a', path: '#e9f7c9', deco: ['🌲', '🌳', '🍄', '🦉', '🌿', '🍄', '🦋'] },
    shape: (t) => { const r = 1 + 0.18 * Math.sin(5 * t); return [r * Math.cos(t), r * Math.sin(t)]; },
    branches: [{ from: 0.15, to: 0.32, bend: -0.5 }, { from: 0.48, to: 0.78, bend: 0.85 }, { from: 0.82, to: 0.98, bend: -0.5 }],
    weights: { warp: 3, bad: 7 }, shops: [0.4],
  },
  {
    id: 'castillo', name: 'Castillo de Hielo', emoji: '🏰', mains: 78,
    desc: 'Los atajos tienen peajes del Gólem que suben de precio. Los toboganes de hielo te deslizan y te dan el bote de peajes.',
    unique: 'Peajes crecientes y toboganes',
    theme: { bg1: '#cfefff', bg2: '#7fb8e6', ground: '#eef9ff', path: '#7aa7c7', deco: ['❄️', '⛄', '🏔️', '🧊', '🌨️', '🏰'] },
    shape: (t) => { const c = Math.cos(t), s = Math.sin(t), n = 3.2; return [Math.sign(c) * Math.abs(c) ** (2 / n) * 1.2, Math.sign(s) * Math.abs(s) ** (2 / n)]; },
    branches: [{ from: 0.06, to: 0.30, bend: 0.85, gate: true }, { from: 0.40, to: 0.62, bend: 0.85, gate: true }, { from: 0.70, to: 0.95, bend: 0.85, gate: true }],
    weights: {}, shops: [0.35, 0.68],
  },
  {
    id: 'desierto', name: 'Pirámides del Sol', emoji: '🏜️', mains: 75,
    desc: 'La Ruleta de la Esfinge puede darte monedas, objetos… ¡o una estrella! También puede quitártela.',
    unique: 'Ruleta de la Esfinge (gana o pierde estrellas)',
    theme: { bg1: '#ffd27a', bg2: '#e39a3b', ground: '#f3c77b', path: '#fff1c9', deco: ['🌵', '🐪', '🏺', '🦂', '☀️', '🌵', '🗿'] },
    shape: (t) => { const m = 3, r = 1 / ((Math.abs(Math.cos(m * t / 4)) ** 2.5 + Math.abs(Math.sin(m * t / 4)) ** 2.5) ** (1 / 4)); return [r * Math.cos(t - Math.PI / 2) * 0.8, r * Math.sin(t - Math.PI / 2) * 0.8]; },
    branches: [{ from: 0.10, to: 0.25, bend: -0.6 }, { from: 0.42, to: 0.58, bend: -0.6 }, { from: 0.75, to: 0.92, bend: -0.6 }, { from: 0.30, to: 0.70, bend: 0.9 }],
    weights: { lucky: 8 }, shops: [0.5],
  },
  {
    id: 'espacio', name: 'Estación Órbita', emoji: '🚀', mains: 80,
    desc: 'En turnos impares hay baja gravedad (+2 a todos los dados). Los agujeros de gusano revuelven a todos los jugadores.',
    unique: 'Gravedad variable y agujeros de gusano',
    theme: { bg1: '#141a3a', bg2: '#02030a', ground: '#232a55', path: '#d8e1ff', deco: ['⭐', '🪐', '🌙', '☄️', '🛸', '✨', '🛰️'] },
    shape: (t) => { const d = 1 + Math.sin(t) ** 2; return [1.5 * Math.cos(t) / d, 1.6 * Math.sin(t) * Math.cos(t) / d]; },
    branches: [{ from: 0.10, to: 0.40, bend: -1.2 }, { from: 0.60, to: 0.90, bend: -1.2 }],
    weights: { warp: 4, event: 8 }, shops: [0.25, 0.75],
  },
  {
    id: 'fabrica', name: 'Fábrica de Juguetes', emoji: '🧸', mains: 76,
    desc: 'Cintas transportadoras te empujan 5 casillas adelante o atrás. La máquina juguetera regala objetos.',
    unique: 'Cintas transportadoras y máquina de objetos',
    theme: { bg1: '#ffb3c7', bg2: '#c86b98', ground: '#ffe0ea', path: '#fff', deco: ['🧸', '🪀', '🎈', '🚂', '🪁', '🎁', '⚙️'] },
    shape: (t) => { const r = 1 + 0.13 * Math.sin(8 * t); return [r * Math.cos(t) * 1.1, r * Math.sin(t)]; },
    branches: [{ from: 0.20, to: 0.45, bend: 0.85 }, { from: 0.70, to: 0.95, bend: 0.85 }, { from: 0.47, to: 0.55, bend: -0.7 }],
    weights: { item: 13, event: 11 }, shops: [0.3, 0.8],
  },
  {
    id: 'barco', name: 'Galeón Pirata', emoji: '🏴‍☠️', mains: 78,
    desc: 'Los cañones te disparan a cualquier parte del mapa. Cada 4 turnos el Kraken roba 10 monedas al más rico y se las da al último.',
    unique: 'Cañones y el Kraken',
    theme: { bg1: '#2b86c5', bg2: '#0b3d66', ground: '#8a5a33', path: '#f3d9a4', deco: ['⚓', '🦜', '🏴‍☠️', '💎', '🐙', '🪙', '🌊'] },
    shape: (t) => { const r = 1 + 0.08 * Math.sin(6 * t); return [r * Math.cos(t) * 1.7, r * Math.sin(t) * 0.9]; },
    branches: [{ from: 0.05, to: 0.45, bend: 0.95 }, { from: 0.55, to: 0.95, bend: 0.95 }],
    weights: { vs: 6 }, shops: [0.25, 0.75], banks: [0.5],
  },
  {
    id: 'templo', name: 'Templo Celestial', emoji: '☁️', mains: 82,
    desc: '¡Hay DOS estrellas a la vez! La Balanza Celestial reparte todas las monedas en partes iguales.',
    unique: 'Dos estrellas y la Balanza',
    theme: { bg1: '#fff4d6', bg2: '#b9c9ff', ground: '#ffffff', path: '#e4c46a', deco: ['☁️', '🕊️', '🌈', '🏛️', '✨', '🌤️'] },
    shape: (t) => { const r = 1 + 0.16 * Math.abs(Math.sin(4 * t)) - 0.05; return [r * Math.cos(t) * 1.2, r * Math.sin(t)]; },
    branches: [{ from: 0.10, to: 0.40, bend: 0.8 }, { from: 0.45, to: 0.55, bend: -0.6 }, { from: 0.60, to: 0.90, bend: 0.8 }],
    weights: { lucky: 9 }, shops: [0.33, 0.66], stars: 2,
  },
];

// ---------- Generador ----------
function resample(shape, n, aspect = 1) {
  const SAMPLES = 2000, pts = [];
  for (let i = 0; i <= SAMPLES; i++) pts.push(shape((i / SAMPLES) * TAU));
  const cum = [0];
  for (let i = 1; i <= SAMPLES; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[SAMPLES], out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * L;
    while (cum[j + 1] < target) j++;
    const f = (target - cum[j]) / (cum[j + 1] - cum[j] || 1);
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]);
  }
  return { pts: out, L };
}

function bezierPts(a, c, b, count) {
  const SAMP = 200, pts = [];
  for (let i = 0; i <= SAMP; i++) {
    const t = i / SAMP, u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  const cum = [0];
  for (let i = 1; i <= SAMP; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[SAMP], out = [];
  let j = 0;
  for (let k = 1; k <= count; k++) {
    const target = (k / (count + 1)) * L;
    while (cum[j + 1] < target) j++;
    const f = (target - cum[j]) / (cum[j + 1] - cum[j] || 1);
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]);
  }
  return { out, L };
}

const cache = {};
export function getBoard(id) {
  if (cache[id]) return cache[id];
  const def = BOARD_DEFS.find((b) => b.id === id) || BOARD_DEFS[0];
  const rng = mulberry32(hashStr(def.id));
  const n = def.mains;
  const { pts: unit, L } = resample(def.shape, n);
  const scale = (SPACING * n) / L;
  const spaces = [];
  const add = (x, y, extra) => { const s = { id: spaces.length, x: x * scale, y: y * scale, type: 'blue', next: [], ...extra }; spaces.push(s); return s; };
  const main = unit.map(([x, y], i) => add(x, y, { main: i, nx: x, ny: y }));
  main.forEach((s, i) => s.next.push(main[(i + 1) % n].id));

  // ramas
  const branchInfo = [];
  for (const br of def.branches || []) {
    const ia = Math.round(br.from * n) % n, ib = Math.round(br.to * n) % n;
    const A = unit[ia], B = unit[ib];
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const bend = br.bend ?? 0.7;
    const ctrl = [mid[0] + (0 - mid[0]) * bend, mid[1] + (0 - mid[1]) * bend];
    if (bend < 0) { ctrl[0] = mid[0] - mid[0] * bend * 0.9; ctrl[1] = mid[1] - mid[1] * bend * 0.9; }
    const est = bezierPts(A, ctrl, B, 1).L * scale;
    const count = Math.max(4, Math.round(est / SPACING) - 1);
    const { out } = bezierPts(A, ctrl, B, count);
    const list = out.map(([x, y]) => add(x, y, { branch: branchInfo.length, tag: br.tag || null, nx: x, ny: y }));
    main[ia].next.push(list[0].id);
    list.forEach((s, k) => s.next.push(k < list.length - 1 ? list[k + 1].id : main[ib].id));
    if (br.gate) list[0].type = 'gate';
    branchInfo.push({ from: main[ia].id, to: main[ib].id, ids: list.map((s) => s.id), tag: br.tag || null, gate: !!br.gate });
  }

  // tipos de casilla
  const W = { ...DEFAULT_W, ...(def.weights || {}) };
  const entries = Object.entries(W);
  for (const s of spaces) {
    if (s.type === 'gate') continue;
    s.type = weighted(rng, entries);
  }
  main[0].type = 'start';
  main[1].type = 'blue'; main[2].type = 'blue';
  const fixed = (fracs, type) => (fracs || []).forEach((f) => {
    let i = Math.round(f * n) % n;
    while (main[i].next.length > 1 || main[(i + n - 1) % n].next.length > 1 || i === 0) i = (i + 1) % n;
    main[i].type = type;
  });
  fixed(def.shops, 'shop');
  fixed(def.banks, 'bank');
  // portales en pares
  const warps = spaces.filter((s) => s.type === 'warp');
  if (warps.length % 2 === 1) warps.pop().type = 'blue';
  // en ramas de fábrica y casillas de evento: dirección de cinta
  spaces.forEach((s, i) => { if (s.type === 'event') s.dir = i % 2 === 0 ? 1 : -1; });
  // zona
  if (def.zone) spaces.forEach((s) => { s.zone = def.zone(s.nx, s.ny); });

  // límites del mundo
  const xs = spaces.map((s) => s.x), ys = spaces.map((s) => s.y);
  const bounds = { minX: Math.min(...xs) - 200, maxX: Math.max(...xs) + 200, minY: Math.min(...ys) - 200, maxY: Math.max(...ys) + 200 };

  // decoración determinista
  const deco = [];
  const theme = def.theme;
  for (let tries = 0; tries < n * 12 && deco.length < n * 1.6; tries++) {
    const x = bounds.minX + rng() * (bounds.maxX - bounds.minX);
    const y = bounds.minY + rng() * (bounds.maxY - bounds.minY);
    let ok = true;
    for (const s of spaces) if (Math.hypot(s.x - x, s.y - y) < 70) { ok = false; break; }
    if (ok) deco.push({ x, y, e: pick(rng, theme.deco), s: 26 + rng() * 26 });
  }

  const starCandidates = spaces.filter((s) => s.type === 'blue' && !(s.main !== undefined && s.main < 6)).map((s) => s.id);
  const board = { ...def, spaces, main: main.map((s) => s.id), start: main[0].id, branchInfo, bounds, deco, starCandidates, starCount: def.stars || 1 };
  cache[id] = board;
  return board;
}

export const isStep = (board, state, sid) => {
  const sp = board.spaces[sid];
  if (state && state.stars.includes(sid)) return false;
  return SPACE_TYPES[sp.type].step;
};

// ---------- Mecánicas únicas ----------
// Cada mecánica recibe g (instancia de Game) y p (índice de jugador)
export const MECHANICS = {
  isla: {
    init: (g) => { g.s.bs = { tide: 'A', tideIn: 3 }; },
    canEnter: (g, p, sp) => !(sp.tag === 'tideA' && g.s.bs.tide !== 'A') && !(sp.tag === 'tideB' && g.s.bs.tide !== 'B'),
    roundEnd: async (g) => {
      if (--g.s.bs.tideIn <= 0) { g.s.bs.tide = g.s.bs.tide === 'A' ? 'B' : 'A'; g.s.bs.tideIn = 3; g.banner('🌊 ¡La marea cambia! Se abre la ruta ' + g.s.bs.tide); }
    },
    event: async (g, p) => {
      g.s.bs.tide = g.s.bs.tide === 'A' ? 'B' : 'A'; g.s.bs.tideIn = 3;
      g.msg(`🐬 Un delfín lleva a ${g.pname(p)} 4 casillas adelante. La marea cambia (ruta ${g.s.bs.tide}).`, p);
      await g.slide(p, 4);
    },
    status: (g) => `🌊 Marea: ruta ${g.s.bs.tide} abierta (cambia en ${g.s.bs.tideIn})`,
  },
  volcan: {
    init: (g) => { g.s.bs = { eruptIn: 5 }; },
    erupt: async (g) => {
      g.banner('🌋 ¡ERUPCIÓN!');
      for (let i = 0; i < g.s.players.length; i++) {
        if (g.board.spaces[g.s.players[i].pos].zone === 'lava') { g.addCoins(i, -10); g.msg(`🔥 ${g.pname(i)} pierde 10 monedas por la lava.`, i); }
      }
      g.s.bs.eruptIn = 5; await g.wait(900);
    },
    roundEnd: async (g) => { if (--g.s.bs.eruptIn <= 0) await MECHANICS.volcan.erupt(g); },
    event: async (g, p) => {
      const safe = g.board.spaces.filter((s) => s.zone !== 'lava' && isStep(g.board, g.s, s.id)).map((s) => s.id);
      g.msg(`💨 ¡Un géiser lanza a ${g.pname(p)} a zona segura y despierta al volcán!`, p);
      await g.teleport(p, pick(g.rng, safe));
      g.addCoins(p, 5);
      await MECHANICS.volcan.erupt(g);
    },
    status: (g) => `🌋 Erupción en ${g.s.bs.eruptIn} turno(s). Zona de lava: parte superior.`,
  },
  ciudad: {
    init: (g) => { g.s.bs = {}; },
    event: async (g, p) => {
      const pl = g.s.players[p];
      if (pl.coins < 10) { g.msg('🚕 El taxi no se detiene: necesitas 10 monedas.', p); return; }
      const v = await g.ask(p, { tag: 'taxi', title: '🚕 Taxi de neón', text: '¿Pagar 10 monedas para ir cerca de la estrella?', options: [{ label: 'Sí, ¡vamos! (10🪙)', value: true }, { label: 'No, gracias', value: false }] });
      if (v) {
        g.addCoins(p, -10);
        const target = g.spaceBefore(g.nearestStar(pl.pos), 2);
        g.msg(`🚕 ${g.pname(p)} toma un taxi hacia la estrella.`, p);
        await g.teleport(p, target);
      }
    },
    status: () => '🏦 Bancos activos · 🚕 Taxis en casillas ❗',
  },
  bosque: {
    init: (g) => { g.s.bs = {}; },
    event: async (g, p) => {
      const pl = g.s.players[p];
      const opts = [{ label: 'Robar monedas (5🪙)', value: 'coins', disabled: pl.coins < 5 }, { label: 'Robar estrella (35🪙)', value: 'star', disabled: pl.coins < 35 }, { label: 'Nada', value: 'none' }];
      const v = await g.ask(p, { tag: 'specter', title: '👻 El Espectro', text: 'Jeje… ¿qué quieres que robe?', options: opts });
      if (v === 'none' || !v) return;
      const cands = g.s.players.map((_, i) => i).filter((i) => i !== p && (v === 'star' ? g.s.players[i].stars > 0 : g.s.players[i].coins > 0));
      if (!cands.length) { g.msg('👻 No hay a quién robarle…', p); return; }
      const t = await g.askTarget(p, cands, v === 'star' ? 'stars' : 'coins', '👻 ¿A quién le robamos?');
      g.addCoins(p, v === 'star' ? -35 : -5);
      if (g.blocked(t)) { g.msg(`🛡️ ¡El escudo de ${g.pname(t)} detuvo al Espectro!`, t); return; }
      if (v === 'star') { g.s.players[t].stars--; pl.stars++; g.msg(`👻⭐ ¡El Espectro robó una ESTRELLA de ${g.pname(t)} para ${g.pname(p)}!`, p); }
      else { const n = Math.min(g.s.players[t].coins, rnd(g.rng, 10, 20)); g.addCoins(t, -n); g.addCoins(p, n); g.msg(`👻 El Espectro robó ${n} monedas de ${g.pname(t)}.`, p); }
      await g.wait(800);
    },
    status: () => '👻 El Espectro aparece en casillas ❗',
  },
  castillo: {
    init: (g) => { g.s.bs = { toll: 10, pot: 0 }; },
    gate: async (g, p) => {
      const pl = g.s.players[p];
      if (pl.items.includes('llave')) { pl.items.splice(pl.items.indexOf('llave'), 1); g.msg(`🗝️ ${g.pname(p)} abre el peaje con la llave.`, p); return; }
      const toll = Math.min(g.s.bs.toll, pl.coins);
      g.addCoins(p, -toll); g.s.bs.pot += toll; g.s.bs.toll += 5;
      g.msg(`🗿 El Gólem cobra ${toll} monedas a ${g.pname(p)}. Próximo peaje: ${g.s.bs.toll}.`, p);
    },
    canEnter: (g, p, sp) => sp.type !== 'gate' || g.s.players[p].coins >= g.s.bs.toll || g.s.players[p].items.includes('llave'),
    event: async (g, p) => {
      const n = rnd(g.rng, 2, 6);
      g.msg(`🛷 ¡${g.pname(p)} se desliza ${n} casillas y recoge el bote del Gólem (${g.s.bs.pot}🪙)!`, p);
      g.addCoins(p, g.s.bs.pot); g.s.bs.pot = 0;
      await g.slide(p, n);
    },
    status: (g) => `🗿 Peaje: ${g.s.bs.toll}🪙 · Bote: ${g.s.bs.pot}🪙`,
  },
  desierto: {
    init: (g) => { g.s.bs = {}; },
    event: async (g, p) => {
      const pl = g.s.players[p];
      g.msg(`🗿 ${g.pname(p)} gira la Ruleta de la Esfinge…`, p);
      await g.wait(900);
      const r = weighted(g.rng, [['c20', 22], ['c-10', 22], ['item', 20], ['move', 14], ['swap', 9], ['star+', 6], ['star-', pl.stars ? 7 : 0]]);
      if (r === 'c20') { g.addCoins(p, 20); g.msg('🗿 ¡Tesoro! +20 monedas.', p); }
      else if (r === 'c-10') { if (!g.blocked(p)) { g.addCoins(p, -10); g.msg('🗿 Maldición: −10 monedas.', p); } }
      else if (r === 'item') { g.giveItem(p, g.randomItem()); }
      else if (r === 'move') { g.msg('🌪️ ¡Tormenta de arena! La estrella se muda.', p); g.relocateStar(); }
      else if (r === 'swap') { const lead = g.leaderIdx(p); if (lead !== p) { const a = pl.coins; pl.coins = g.s.players[lead].coins; g.s.players[lead].coins = a; g.msg(`🗿 ¡Intercambio de monedas con ${g.pname(lead)}!`, p); } else g.msg('🗿 La esfinge bosteza. Nada pasa.', p); }
      else if (r === 'star+') { pl.stars++; g.msg('🗿⭐ ¡LA ESFINGE TE REGALA UNA ESTRELLA!', p); g.banner(`⭐ ¡${g.pname(p)} gana una estrella!`); }
      else if (r === 'star-') { if (!g.blocked(p)) { pl.stars--; g.msg('🗿 La esfinge se lleva una de tus estrellas…', p); } }
      await g.wait(900);
    },
    status: () => '🗿 Ruleta de la Esfinge en casillas ❗',
  },
  espacio: {
    init: (g) => { g.s.bs = {}; },
    rollBonus: (g) => (g.s.turn % 2 === 1 ? 2 : 0),
    event: async (g, p) => {
      g.banner('🕳️ ¡Agujero de gusano! Todos cambian de lugar');
      const pos = shuffle(g.rng, g.s.players.map((pl) => pl.pos));
      g.s.players.forEach((pl, i) => { pl.pos = pos[i]; });
      g.emitState(); await g.wait(1200);
    },
    status: (g) => (g.s.turn % 2 === 1 ? '🪐 Baja gravedad: +2 a todos los dados' : '🌍 Gravedad normal (turno par)'),
  },
  fabrica: {
    init: (g) => { g.s.bs = {}; },
    event: async (g, p) => {
      const sp = g.board.spaces[g.s.players[p].pos];
      if (g.rng() < 0.35) { g.msg('🏭 ¡La máquina juguetera suelta un regalo!', p); g.giveItem(p, g.randomItem()); }
      if (sp.dir > 0) { g.msg(`➡️ La cinta lleva a ${g.pname(p)} 5 casillas adelante.`, p); await g.slide(p, 5); }
      else { g.msg(`⬅️ La cinta regresa a ${g.pname(p)} 5 casillas.`, p); await g.slideBack(p, 5); }
    },
    status: () => '⚙️ Cintas transportadoras en casillas ❗',
  },
  barco: {
    init: (g) => { g.s.bs = { krakenIn: 4 }; },
    roundEnd: async (g) => {
      if (--g.s.bs.krakenIn <= 0) {
        g.s.bs.krakenIn = 4;
        const order = g.s.players.map((_, i) => i).sort((a, b) => g.s.players[b].coins - g.s.players[a].coins);
        const rich = order[0], poor = order[order.length - 1];
        g.banner('🐙 ¡EL KRAKEN ATACA!');
        if (g.blocked(rich)) { g.msg(`🛡️ El escudo de ${g.pname(rich)} espanta al Kraken.`, rich); return; }
        const n = Math.min(10, g.s.players[rich].coins);
        g.addCoins(rich, -n); g.addCoins(poor, n);
        g.msg(`🐙 El Kraken roba ${n} monedas a ${g.pname(rich)} y se las da a ${g.pname(poor)}.`, rich);
        await g.wait(900);
      }
    },
    event: async (g, p) => {
      const all = g.board.spaces.filter((s) => isStep(g.board, g.s, s.id)).map((s) => s.id);
      g.msg(`💣 ¡BUM! Un cañón dispara a ${g.pname(p)} por los aires.`, p);
      await g.teleport(p, pick(g.rng, all));
    },
    status: (g) => `🐙 Kraken en ${g.s.bs.krakenIn} turno(s) · 💣 Cañones en ❗`,
  },
  templo: {
    init: (g) => { g.s.bs = {}; },
    event: async (g, p) => {
      const ps = g.s.players, total = ps.reduce((s, x) => s + x.coins, 0);
      const each = Math.floor(total / ps.length), rest = total - each * ps.length;
      ps.forEach((x) => { x.coins = each; });
      ps[p].coins += rest;
      g.banner('⚖️ ¡Balanza Celestial! Todos quedan con ' + each + ' monedas');
      g.emitState(); await g.wait(1200);
    },
    status: () => '⭐⭐ Dos estrellas activas · ⚖️ Balanza en ❗',
  },
};

export { ITEMS };
