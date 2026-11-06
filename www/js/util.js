// Utilidades compartidas (sin DOM: usable en Node para pruebas)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rnd = (rng, a, b) => a + Math.floor(rng() * (b - a + 1)); // entero [a,b]
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function weighted(rng, entries) { // [[valor, peso], ...]
  const total = entries.reduce((s, e) => s + e[1], 0);
  let r = rng() * total;
  for (const [v, w] of entries) { if ((r -= w) < 0) return v; }
  return entries[entries.length - 1][0];
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clone = (o) => JSON.parse(JSON.stringify(o));
export function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function roomCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 5; i++) s += L[Math.floor(Math.random() * L.length)];
  return s;
}
