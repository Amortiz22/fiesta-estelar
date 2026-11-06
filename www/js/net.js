// Multijugador P2P con PeerJS (WebRTC). El anfitrión es autoritativo.
// Funciona igual en la app Android y en el navegador: pueden jugar juntos.
const PREFIX = 'fiesta-estelar-v1-';
export const PROTOCOL = 1;

function peerOptions() {
  const ice = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
  // TURN opcional configurable (ver README) para redes móviles estrictas
  try {
    const t = JSON.parse(localStorage.getItem('fe_turn') || 'null');
    if (t && t.urls) ice.push(t);
  } catch {}
  const opts = { debug: 0, config: { iceServers: ice } };
  // Servidor PeerJS propio opcional (por defecto se usa el público 0.peerjs.com)
  try { const srv = JSON.parse(localStorage.getItem('fe_peerserver') || 'null'); if (srv && srv.host) Object.assign(opts, srv); } catch {}
  return opts;
}

export class HostNet {
  constructor(code, h) {
    this.code = code; this.h = h; this.conns = new Map(); this.pending = new Map(); this.reqId = 1;
    this.peer = new window.Peer(PREFIX + code, peerOptions());
    this.peer.on('open', () => h.onReady?.());
    this.peer.on('error', (e) => h.onError?.(e));
    this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch {} });
    this.peer.on('connection', (conn) => {
      conn.on('open', () => { this.conns.set(conn.peer, conn); });
      conn.on('data', (msg) => this.onData(conn.peer, msg));
      conn.on('close', () => this.drop(conn.peer));
      conn.on('error', () => this.drop(conn.peer));
    });
  }
  drop(id) {
    if (!this.conns.has(id)) return;
    this.conns.delete(id);
    for (const [rid, p] of this.pending) if (p.peer === id) { this.pending.delete(rid); p.reject(new Error('gone')); }
    this.h.onLeave?.(id);
  }
  onData(id, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'answer') {
      const p = this.pending.get(msg.id);
      if (p && p.peer === id) { this.pending.delete(msg.id); clearTimeout(p.timer); p.resolve(msg.v); }
      return;
    }
    this.h.onMessage?.(id, msg);
  }
  send(id, msg) { const c = this.conns.get(id); if (c && c.open) try { c.send(msg); } catch {} }
  broadcast(msg) { for (const id of this.conns.keys()) this.send(id, msg); }
  request(id, t, payload, timeoutMs) {
    return new Promise((resolve, reject) => {
      const rid = this.reqId++;
      const timer = setTimeout(() => { this.pending.delete(rid); reject(new Error('timeout')); }, timeoutMs);
      this.pending.set(rid, { peer: id, resolve, reject, timer });
      this.send(id, { t, id: rid, ...payload });
    });
  }
  cancelFor(id) { this.send(id, { t: 'cancel' }); }
  close() { try { this.broadcast({ t: 'closed' }); } catch {} setTimeout(() => { try { this.peer.destroy(); } catch {} }, 300); }
}

export class ClientNet {
  constructor(code, h) {
    this.h = h; this.code = code;
    this.peer = new window.Peer(undefined, peerOptions());
    this.peer.on('error', (e) => h.onError?.(e));
    this.peer.on('open', () => {
      this.conn = this.peer.connect(PREFIX + code, { reliable: true });
      this.conn.on('open', () => h.onOpen?.());
      this.conn.on('data', (msg) => h.onMessage?.(msg));
      this.conn.on('close', () => h.onClose?.());
      this.conn.on('error', () => h.onClose?.());
    });
  }
  get id() { return this.peer?.id; }
  send(msg) { if (this.conn && this.conn.open) try { this.conn.send(msg); } catch {} }
  close() { try { this.conn?.close(); this.peer?.destroy(); } catch {} }
}
