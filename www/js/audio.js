// Efectos de sonido sintetizados (sin archivos)
let ac = null, muted = false;
export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }
function ctx() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
function tone(freq, dur, type = 'square', vol = 0.08, slide = 0, delay = 0) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
const NOTES = [523, 659, 784, 1047];
export function sfx(name) {
  if (muted || typeof window === 'undefined') return;
  switch (name) {
    case 'tap': tone(660, 0.06, 'square', 0.05); break;
    case 'pop': tone(900, 0.08, 'triangle', 0.08, -500); break;
    case 'coin': tone(988, 0.06, 'square', 0.05); tone(1319, 0.12, 'square', 0.05, 0, 0.06); break;
    case 'bad': tone(220, 0.25, 'sawtooth', 0.06, -120); break;
    case 'go': tone(784, 0.1, 'square', 0.06); tone(1047, 0.15, 'square', 0.06, 0, 0.1); break;
    case 'jump': tone(400, 0.15, 'square', 0.05, 400); break;
    case 'star': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12, 'triangle', 0.07, 0, i * 0.07)); break;
    case 'dice': tone(300 + Math.random() * 300, 0.04, 'square', 0.04); break;
    case 'step': tone(500, 0.04, 'triangle', 0.05); break;
    case 'turn': tone(587, 0.1, 'triangle', 0.06); tone(880, 0.14, 'triangle', 0.06, 0, 0.1); break;
    case 'win': [523, 523, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.06, 0, i * 0.15)); break;
    default: if (name.startsWith('note')) tone(NOTES[+name.slice(4)] || 600, 0.2, 'triangle', 0.09);
  }
}
