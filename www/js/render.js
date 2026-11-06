// Renderizado del tablero en canvas con cámara, paneo y zoom
import { SPACE_TYPES } from './data.js';

export class BoardView {
  constructor(canvas) {
    this.cv = canvas; this.c = canvas.getContext('2d');
    this.board = null; this.state = null;
    this.cam = { x: 0, y: 0, z: 0.8 }; this.target = { x: 0, y: 0, z: 0.8 };
    this.tokens = []; this.follow = true; this.freeUntil = 0; this.overview = false;
    this.t = 0;
    this.bindInput();
    const loop = (now) => { this.t = now / 1000; this.frame(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  setBoard(b) { this.board = b; this.tokens = []; }
  setState(s) { this.state = s; }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1), r = this.cv.getBoundingClientRect();
    if (this.cv.width !== Math.round(r.width * dpr) || this.cv.height !== Math.round(r.height * dpr)) { this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr); }
    this.dpr = dpr; this.vw = r.width; this.vh = r.height;
  }
  fitZoom() { const b = this.board.bounds; return Math.min(this.vw / (b.maxX - b.minX), this.vh / (b.maxY - b.minY)); }
  toggleOverview() { this.overview = !this.overview; if (!this.overview) { this.follow = true; this.freeUntil = 0; } }
  bindInput() {
    const pts = new Map(); let pinch0 = null;
    this.cv.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.cv.setPointerCapture(e.pointerId); });
    this.cv.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = pts.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1 && Math.hypot(dx, dy) > 0.5) { this.overview = false; this.freeUntil = performance.now() + 5000; this.target.x -= dx / this.cam.z; this.target.y -= dy / this.cam.z; this.cam.x = this.target.x; this.cam.y = this.target.y; }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0) { this.zoomBy(d / pinch0); } pinch0 = d; this.freeUntil = performance.now() + 5000;
      }
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null; };
    this.cv.addEventListener('pointerup', up); this.cv.addEventListener('pointercancel', up);
    this.cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomBy(e.deltaY < 0 ? 1.12 : 0.89); this.freeUntil = performance.now() + 5000; }, { passive: false });
  }
  zoomBy(f) { this.overview = false; this.target.z = Math.max(0.15, Math.min(1.8, this.target.z * f)); this.cam.z = this.target.z; }
  focusPlayer(i) { this.follow = true; this.freeUntil = 0; this.overview = false; this.focusIdx = i; }

  frame() {
    if (!this.board || !this.state) return;
    this.resize();
    const { c, board: b, state: s } = this;
    // tokens
    s.players.forEach((p, i) => {
      const sp = b.spaces[p.pos];
      const same = s.players.map((q, k) => (q.pos === p.pos ? k : -1)).filter((k) => k >= 0);
      const k = same.indexOf(i), n = same.length;
      const ox = n > 1 ? Math.cos((k / n) * Math.PI * 2) * 24 : 0, oy = n > 1 ? Math.sin((k / n) * Math.PI * 2) * 18 : 0;
      const tx = sp.x + ox, ty = sp.y + oy - 22;
      const tk = this.tokens[i] || (this.tokens[i] = { x: tx, y: ty });
      const d = Math.hypot(tx - tk.x, ty - tk.y);
      if (d > 900) { tk.x = tx; tk.y = ty; } else { tk.x += (tx - tk.x) * 0.22; tk.y += (ty - tk.y) * 0.22; }
      tk.hop = d > 3 ? Math.abs(Math.sin(this.t * 14)) * 14 : 0;
    });
    // cámara
    if (this.overview) {
      const bb = b.bounds; this.target = { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2, z: this.fitZoom() };
    } else if (performance.now() > this.freeUntil) {
      const fi = s.current >= 0 ? s.current : this.focusIdx ?? 0, tk = this.tokens[fi];
      if (tk) { this.target.x = tk.x; this.target.y = tk.y + 40; }
      if (this.target.z < 0.45) this.target.z = 0.8;
    }
    const k = 0.12; this.cam.x += (this.target.x - this.cam.x) * k; this.cam.y += (this.target.y - this.cam.y) * k; this.cam.z += (this.target.z - this.cam.z) * k;

    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, this.vh); g.addColorStop(0, b.theme.bg1); g.addColorStop(1, b.theme.bg2);
    c.fillStyle = g; c.fillRect(0, 0, this.vw, this.vh);
    c.translate(this.vw / 2, this.vh / 2); c.scale(this.cam.z, this.cam.z); c.translate(-this.cam.x, -this.cam.y);

    const closed = (sp) => (b.id === 'isla' && ((sp.tag === 'tideA' && s.bs.tide !== 'A') || (sp.tag === 'tideB' && s.bs.tide !== 'B')));
    // terreno
    c.lineCap = 'round'; c.lineJoin = 'round';
    const edges = (fn) => { for (const sp of b.spaces) for (const n of sp.next) fn(sp, b.spaces[n]); };
    c.strokeStyle = b.theme.ground; c.lineWidth = 150; c.globalAlpha = 0.9;
    c.beginPath(); edges((a, z) => { c.moveTo(a.x, a.y); c.lineTo(z.x, z.y); }); c.stroke(); c.globalAlpha = 1;
    // decoración
    for (const d of b.deco) { c.font = `${d.s}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d.e, d.x, d.y); }
    // camino
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 30; c.beginPath(); edges((a, z) => { c.moveTo(a.x, a.y + 4); c.lineTo(z.x, z.y + 4); }); c.stroke();
    edges((a, z) => { c.globalAlpha = closed(a) || closed(z) ? 0.25 : 1; c.strokeStyle = b.theme.path; c.lineWidth = 24; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(z.x, z.y); c.stroke(); });
    c.globalAlpha = 1;
    // flechas de dirección
    c.fillStyle = 'rgba(0,0,0,.35)';
    for (const sp of b.spaces) for (const n of sp.next) { const z = b.spaces[n], mx = (sp.x + z.x) / 2, my = (sp.y + z.y) / 2, a = Math.atan2(z.y - sp.y, z.x - sp.x); c.save(); c.translate(mx, my); c.rotate(a); c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -6); c.lineTo(-5, 6); c.fill(); c.restore(); }
    // casillas
    for (const sp of b.spaces) {
      const st = SPACE_TYPES[sp.type], isStar = s.stars.includes(sp.id);
      c.globalAlpha = closed(sp) ? 0.35 : 1;
      if (sp.zone === 'lava') { c.fillStyle = 'rgba(255,60,0,.25)'; c.beginPath(); c.arc(sp.x, sp.y, 46, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(sp.x, sp.y + 5, st.step ? 28 : 34, 0, 7); c.fill();
      c.fillStyle = st.color; c.beginPath(); c.arc(sp.x, sp.y, st.step ? 28 : 34, 0, 7); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'middle';
      if (sp.type === 'blue' || sp.type === 'red') { c.font = '900 20px system-ui'; c.fillStyle = '#fff'; c.fillText(st.icon, sp.x, sp.y + 1); }
      else if (sp.type === 'event' && b.id === 'fabrica') { c.font = '24px sans-serif'; c.fillText(sp.dir > 0 ? '⏩' : '⏪', sp.x, sp.y + 2); }
      else { c.font = `${st.step ? 26 : 32}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`; c.fillText(st.icon, sp.x, sp.y + 2); }
      if (s.traps && s.traps[sp.id] !== undefined) { c.font = '22px sans-serif'; c.fillText('🪤', sp.x + 22, sp.y - 22); }
      if (isStar) {
        const pulse = 1 + Math.sin(this.t * 4) * 0.08;
        c.fillStyle = 'rgba(255,215,0,.35)'; c.beginPath(); c.arc(sp.x, sp.y, 60 * pulse, 0, 7); c.fill();
        c.font = `${64 * pulse}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`; c.fillText('⭐', sp.x, sp.y - 6);
      }
      c.globalAlpha = 1;
    }
    // bifurcación
    if (s.fork) {
      s.fork.options.forEach((id, i) => {
        const sp = b.spaces[id], r = 40 + Math.sin(this.t * 6) * 6;
        c.strokeStyle = '#ffd23f'; c.lineWidth = 8; c.beginPath(); c.arc(sp.x, sp.y, r, 0, 7); c.stroke();
        c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(sp.x, sp.y - 62, 24, 0, 7); c.fill();
        c.fillStyle = '#000'; c.font = '900 28px system-ui'; c.fillText('ABCD'[i], sp.x, sp.y - 61);
      });
    }
    // fichas
    const order = s.players.map((_, i) => i).sort((a, z) => (a === s.current) - (z === s.current));
    for (const i of order) {
      const p = s.players[i], tk = this.tokens[i]; if (!tk) continue;
      const y = tk.y - (tk.hop || 0), cur = i === s.current;
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(tk.x, tk.y + 26, 20, 7, 0, 0, 7); c.fill();
      if (cur) { c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.arc(tk.x, y, 30 + Math.sin(this.t * 6) * 3, 0, 7); c.stroke(); }
      c.fillStyle = p.color; c.beginPath(); c.arc(tk.x, y, 25, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
      c.font = '32px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif'; c.fillText(p.emoji, tk.x, y + 2);
      if (!p.connected) { c.font = '18px sans-serif'; c.fillText('📴', tk.x + 20, y - 22); }
    }
  }
}
