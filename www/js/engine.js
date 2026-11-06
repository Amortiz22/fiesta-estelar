// Motor del juego (autoritativo, corre en el anfitrión). Sin DOM.
import { getBoard, MECHANICS, isStep } from './boards.js';
import { ITEMS, ITEM_IDS, MAX_ITEMS, SPACE_TYPES, STAR_PRICE, charById } from './data.js';
import { MG_META, pickMinigame } from './mgmeta.js';
import { clone, rnd, pick, weighted, shuffle } from './util.js';

export class Game {
  constructor(cfg, io) {
    this.io = io;
    this.cfg = cfg;
    this.rng = cfg.rng || Math.random;
    this.board = getBoard(cfg.boardId);
    this.mech = MECHANICS[this.board.id] || {};
    this.prev = this.board.spaces.map(() => []);
    this.board.spaces.forEach((s) => s.next.forEach((n) => this.prev[n].push(s.id)));
    this.distCache = {};
    this.s = {
      boardId: this.board.id, turn: 1, maxTurns: cfg.turns || 15, players: cfg.players.map((p) => {
        const ch = charById(p.charId);
        return { name: p.name || ch.name, charId: ch.id, emoji: ch.emoji, color: ch.color, kind: p.kind, level: p.level ?? 1, peer: p.peer || null,
          coins: 10, stars: 0, pos: this.board.start, items: [], last: null, magnet: false, connected: true,
          stats: { mg: 0, maxCoins: 10, happen: 0, blue: 0, red: 0, moved: 0 } };
      }),
      stars: [], traps: {}, bank: 0, bs: {}, current: -1, order: [], lastFive: false, fork: null, phase: 'intro', mgRecent: [], status: '',
    };
  }

  // ---------- utilidades de comunicación ----------
  emitState() { this.s.status = this.mech.status ? this.mech.status(this) : ''; this.io.emit({ type: 'state', state: clone(this.s) }); }
  msg(text, p = null) { this.io.emit({ type: 'msg', text, p }); }
  banner(text) { this.io.emit({ type: 'banner', text }); }
  wait(ms) { return this.io.sleep(ms); }
  pname(p) { return this.s.players[p].name; }
  async ask(p, req) {
    req.p = p;
    const idx = await this.io.ask(p, req, this);
    const opt = req.options[idx];
    if (!opt || opt.disabled) { const first = req.options.findIndex((o) => !o.disabled); return req.options[Math.max(0, first)].value; }
    return opt.value;
  }
  async askTarget(p, cands, kind, title) {
    if (cands.length === 1) return cands[0];
    const options = cands.map((i) => { const x = this.s.players[i]; return { label: `${x.emoji} ${x.name} · ${x.coins}🪙 ${x.stars}⭐`, value: i }; });
    return this.ask(p, { tag: 'target', kind, title, text: 'Elige un rival', options });
  }

  // ---------- estado ----------
  addCoins(p, n) {
    const pl = this.s.players[p];
    const before = pl.coins;
    pl.coins = Math.max(0, pl.coins + n);
    pl.stats.maxCoins = Math.max(pl.stats.maxCoins, pl.coins);
    this.io.emit({ type: 'coins', p, n: pl.coins - before });
    return pl.coins - before;
  }
  giveItem(p, id) {
    const pl = this.s.players[p];
    if (pl.items.length >= MAX_ITEMS) { this.msg(`🎒 ${pl.name} tiene la mochila llena y no puede tomar ${ITEMS[id].icon}.`, p); return false; }
    pl.items.push(id);
    this.msg(`${ITEMS[id].icon} ${pl.name} obtiene: ${ITEMS[id].name}`, p);
    return true;
  }
  randomItem() { return weighted(this.rng, ITEM_IDS.map((id) => [id, ITEMS[id].w])); }
  blocked(p) {
    const pl = this.s.players[p], i = pl.items.indexOf('escudo');
    if (i < 0) return false;
    pl.items.splice(i, 1);
    this.msg(`🛡️ ¡El escudo de ${pl.name} lo protege!`, p);
    return true;
  }
  ranking() {
    return this.s.players.map((_, i) => i).sort((a, b) => {
      const A = this.s.players[a], B = this.s.players[b];
      return B.stars - A.stars || B.coins - A.coins;
    });
  }
  leaderIdx() { return this.ranking()[0]; }
  placeOf(p) { const r = this.ranking(); return r.indexOf(p) + 1; }

  // ---------- grafo ----------
  distFrom(a) {
    if (this.distCache[a]) return this.distCache[a];
    const sp = this.board.spaces, d = sp.map(() => Infinity), dq = [a];
    d[a] = 0;
    while (dq.length) {
      const u = dq.shift();
      for (const v of sp[u].next) {
        const w = SPACE_TYPES[sp[v].type].step ? 1 : 0;
        if (d[u] + w < d[v]) { d[v] = d[u] + w; w ? dq.push(v) : dq.unshift(v); }
      }
    }
    return (this.distCache[a] = d);
  }
  dist(a, b) { return this.distFrom(a)[b]; }
  nearestStar(pos) { let best = this.s.stars[0], bd = Infinity; for (const st of this.s.stars) { const d = this.dist(pos, st); if (d < bd) { bd = d; best = st; } } return best; }
  distToStar(pos) { return Math.min(...this.s.stars.map((st) => this.dist(pos, st))); }
  spaceBefore(sid, k) {
    let cur = sid, n = 0, guard = 0;
    while (n < k && guard++ < 50) { cur = this.prev[cur][0]; if (isStep(this.board, this.s, cur)) n++; }
    return cur;
  }
  canEnter(p, sid) { const sp = this.board.spaces[sid]; return this.mech.canEnter ? this.mech.canEnter(this, p, sp) : true; }

  relocateStar(which = null) {
    const idx = which ?? Math.floor(this.rng() * this.s.stars.length);
    const old = this.s.stars[idx];
    const occupied = new Set(this.s.players.map((p) => p.pos));
    let cands = this.board.starCandidates.filter((id) => id !== old && !this.s.stars.includes(id) && !occupied.has(id) && !this.s.traps[id]);
    // lejos de la estrella anterior
    if (old != null) { const far = cands.filter((id) => this.dist(old, id) > 12); if (far.length) cands = far; }
    this.s.stars[idx] = pick(this.rng, cands);
    this.distCache = {};
    this.emitState();
  }

  async teleport(p, sid) { this.s.players[p].pos = sid; this.emitState(); await this.wait(700); }
  async slide(p, n) {
    const pl = this.s.players[p];
    let c = 0, guard = 0;
    while (c < n && guard++ < 60) {
      const nx = this.board.spaces[pl.pos].next.filter((id) => this.board.spaces[id].type !== 'gate');
      pl.pos = nx[0] ?? this.board.spaces[pl.pos].next[0];
      if (isStep(this.board, this.s, pl.pos)) c++;
      this.emitState(); await this.wait(140);
    }
  }
  async slideBack(p, n) {
    const pl = this.s.players[p];
    let c = 0, guard = 0;
    while (c < n && guard++ < 60) {
      pl.pos = this.prev[pl.pos][0];
      if (isStep(this.board, this.s, pl.pos)) c++;
      this.emitState(); await this.wait(140);
    }
  }

  // ---------- partida ----------
  async run() {
    this.mech.init?.(this);
    for (let i = 0; i < this.board.starCount; i++) { this.s.stars.push(null); this.relocateStar(i); }
    this.s.phase = 'order';
    this.emitState();
    this.banner(`${this.board.emoji} ${this.board.name}`);
    await this.wait(1600);
    // orden de turnos
    const rolls = this.s.players.map(() => rnd(this.rng, 1, 10) + this.rng() * 0.1);
    this.s.order = this.s.players.map((_, i) => i).sort((a, b) => rolls[b] - rolls[a]);
    this.msg('📋 Orden de turnos: ' + this.s.order.map((i) => this.s.players[i].emoji + ' ' + Math.floor(rolls[i])).join('  ·  '));
    this.s.phase = 'board';
    this.emitState();
    await this.wait(1500);

    while (this.s.turn <= this.s.maxTurns) {
      if (this.s.maxTurns >= 10 && this.s.turn === this.s.maxTurns - 4) await this.lastFive();
      this.io.emit({ type: 'round', turn: this.s.turn, max: this.s.maxTurns });
      for (const p of this.s.order) {
        await this.playerTurn(p);
      }
      this.s.current = -1;
      await this.mech.roundEnd?.(this);
      await this.minigamePhase();
      this.s.turn++;
      this.emitState();
    }
    return this.finale();
  }

  async lastFive() {
    this.s.lastFive = true;
    this.banner('🔥 ¡ÚLTIMOS 5 TURNOS! Casillas azules y rojas valen el doble');
    await this.wait(1500);
    const r = this.ranking(), last = r[r.length - 1];
    this.addCoins(last, 15);
    this.msg(`🎁 Ayuda para el último lugar: ${this.pname(last)} recibe 15 monedas.`, last);
    this.giveItem(last, this.randomItem());
    this.emitState();
    await this.wait(1200);
  }

  async playerTurn(p) {
    const pl = this.s.players[p];
    this.s.current = p;
    this.s.phase = 'board';
    pl.magnet = false;
    this.emitState();
    this.io.emit({ type: 'turn', p });
    await this.wait(500);

    // fase de objetos
    let dice = 'normal';
    if (pl.items.length) {
      const options = pl.items.map((id, i) => ({ label: `${ITEMS[id].icon} ${ITEMS[id].name}`, value: i, disabled: id === 'escudo' || id === 'llave' || (id === 'trampa' && !isStep(this.board, this.s, pl.pos)), item: id }));
      options.push({ label: '🎲 No usar, tirar dado', value: -1 });
      const v = await this.ask(p, { tag: 'item', title: `Turno de ${pl.name}`, text: '¿Usar un objeto?', options });
      if (v >= 0) dice = await this.useItem(p, v);
    }

    // tirada
    const bonus = this.mech.rollBonus ? this.mech.rollBonus(this, p) : 0;
    const diceLabel = { normal: 'Dado (1–10)', dado2: 'Dado Doble', dado3: 'Dado Triple', dadoM: 'Dado Mágico', dadoC: 'Dado Codicioso', dadoL: 'Dado Tortuga' }[dice];
    await this.ask(p, { tag: 'roll', title: `Turno ${this.s.turn}/${this.s.maxTurns} · ${pl.name}`, text: diceLabel + (bonus ? ` (+${bonus} bonus)` : ''), options: [{ label: '🎲 ¡TIRAR!', value: 0 }], dice });
    let values;
    if (dice === 'dadoM') {
      const n = await this.ask(p, { tag: 'magic', title: '🔮 Dado Mágico', text: '¿Cuántas casillas quieres avanzar?', options: Array.from({ length: 10 }, (_, i) => ({ label: String(i + 1), value: i + 1 })) });
      values = [n];
    } else if (dice === 'dado2') values = [rnd(this.rng, 1, 10), rnd(this.rng, 1, 10)];
    else if (dice === 'dado3') values = [rnd(this.rng, 1, 10), rnd(this.rng, 1, 10), rnd(this.rng, 1, 10)];
    else if (dice === 'dadoL') values = [rnd(this.rng, 1, 3)];
    else values = [rnd(this.rng, 1, 10)];
    const total = values.reduce((a, b) => a + b, 0) + bonus;
    this.io.emit({ type: 'dice', p, values, bonus, total });
    await this.wait(1100);
    if (dice === 'dadoC') { this.addCoins(p, total); this.msg(`💰 ${pl.name} gana ${total} monedas con el Dado Codicioso.`, p); }

    await this.move(p, total);
    await this.land(p);
    pl.magnet = false;
    this.emitState();
    await this.wait(500);
  }

  async useItem(p, idx) {
    const pl = this.s.players[p];
    const id = pl.items[idx];
    pl.items.splice(idx, 1);
    this.msg(`${ITEMS[id].icon} ${pl.name} usa ${ITEMS[id].name}.`, p);
    this.emitState();
    await this.wait(600);
    const others = this.s.players.map((_, i) => i).filter((i) => i !== p);
    switch (id) {
      case 'dado2': case 'dado3': case 'dadoM': case 'dadoC': case 'dadoL': return id;
      case 'portal': {
        const t = pick(this.rng, others);
        const a = pl.pos; pl.pos = this.s.players[t].pos; this.s.players[t].pos = a;
        this.msg(`🌀 ¡${pl.name} intercambia lugar con ${this.pname(t)}!`, p);
        this.emitState(); await this.wait(900); break;
      }
      case 'ladron': {
        const cands = others.filter((i) => this.s.players[i].coins > 0);
        if (!cands.length) { this.msg('🧤 Nadie tiene monedas…', p); break; }
        const t = await this.askTarget(p, cands, 'coins', '🧤 ¿A quién robar?');
        if (this.blocked(t)) break;
        const n = Math.min(this.s.players[t].coins, rnd(this.rng, 5, 15));
        this.addCoins(t, -n); this.addCoins(p, n);
        this.msg(`🧤 ${pl.name} roba ${n} monedas a ${this.pname(t)}.`, p);
        await this.wait(700); break;
      }
      case 'silbato': this.msg('📯 ¡La estrella se muda!', p); this.relocateStar(); await this.wait(800); break;
      case 'trampa': this.s.traps[pl.pos] = p; this.msg(`🪤 ${pl.name} coloca una trampa aquí.`, p); break;
      case 'iman': pl.magnet = true; break;
      case 'brujula': {
        const target = this.spaceBefore(this.nearestStar(pl.pos), 1);
        this.msg(`🧭 ${pl.name} aparece junto a la estrella.`, p);
        await this.teleport(p, target); break;
      }
    }
    this.emitState();
    return 'normal';
  }

  async move(p, steps) {
    const pl = this.s.players[p];
    let remaining = steps;
    const magnetDone = new Set();
    this.s.phase = 'move';
    let guard = 0;
    while (remaining > 0 && guard++ < 200) {
      const cur = this.board.spaces[pl.pos];
      let options = cur.next.filter((id) => this.canEnter(p, id));
      if (!options.length) options = [cur.next[0]];
      let nxt = options[0];
      if (options.length > 1) nxt = await this.askFork(p, options, remaining);
      pl.pos = nxt;
      pl.stats.moved++;
      this.s.remaining = remaining;
      this.emitState();
      await this.wait(230);
      const sp = this.board.spaces[nxt];
      if (pl.magnet) {
        this.s.players.forEach((o, i) => {
          if (i !== p && o.pos === nxt && !magnetDone.has(i) && o.coins > 0) {
            magnetDone.add(i); const n = Math.min(3, o.coins); this.addCoins(i, -n); this.addCoins(p, n);
            this.msg(`🧲 ${pl.name} atrae ${n} monedas de ${o.name}.`, p);
          }
        });
      }
      if (this.s.stars.includes(nxt)) await this.starOffer(p, nxt);
      else if (sp.type === 'shop') await this.shop(p);
      else if (sp.type === 'gate') await this.mech.gate?.(this, p);
      else if (sp.type === 'bank' && remaining > 1 && pl.coins > 0) {
        const n = Math.min(5, pl.coins); this.addCoins(p, -n); this.s.bank += n;
        this.msg(`🏦 ${pl.name} deposita ${n} monedas en el banco (total ${this.s.bank}).`, p);
      }
      if (isStep(this.board, this.s, nxt)) remaining--;
    }
    this.s.remaining = 0;
  }

  async askFork(p, options, remaining) {
    const labels = 'ABCD';
    this.s.fork = { p, options };
    this.emitState();
    const opts = options.map((id, i) => {
      const sp = this.board.spaces[id];
      const d = this.distToStar(id);
      let extra = '';
      if (sp.type === 'gate') extra = ` · 🚧 peaje ${this.s.bs.toll ?? 0}🪙`;
      if (sp.tag === 'tideA' || sp.tag === 'tideB') extra = ' · 🌊 ruta de marea';
      return { label: `${labels[i]} · ⭐ a ${d + 1} casillas${extra}`, value: id, dist: d };
    });
    const v = await this.ask(p, { tag: 'fork', title: '🔀 Bifurcación', text: `Te quedan ${remaining} pasos. ¿Por dónde?`, options: opts });
    this.s.fork = null;
    return v;
  }

  async starOffer(p, sid) {
    const pl = this.s.players[p];
    if (pl.coins < STAR_PRICE) { this.msg(`⭐ ${pl.name} pasa por la estrella pero le faltan monedas (${pl.coins}/${STAR_PRICE}).`, p); await this.wait(700); return; }
    const maxN = Math.min(3, Math.floor(pl.coins / STAR_PRICE));
    const options = [];
    for (let k = maxN; k >= 1; k--) options.push({ label: `⭐×${k} (${k * STAR_PRICE}🪙)`, value: k });
    options.push({ label: 'No comprar', value: 0 });
    const n = await this.ask(p, { tag: 'star', title: '⭐ ¡La Estrella!', text: `Cada estrella cuesta ${STAR_PRICE} monedas. En tableros tan grandes puedes comprar hasta 3.`, options });
    if (!n) return;
    this.addCoins(p, -STAR_PRICE * n);
    pl.stars += n;
    this.banner(n > 1 ? `⭐ ¡${pl.name} consigue ${n} ESTRELLAS!` : `⭐ ¡${pl.name} consigue una ESTRELLA!`);
    this.io.emit({ type: 'sfx', name: 'star' });
    await this.wait(1500);
    this.relocateStar(this.s.stars.indexOf(sid));
  }

  async shop(p) {
    const pl = this.s.players[p];
    if (pl.coins < 3) return;
    const stock = shuffle(this.rng, ITEM_IDS.filter((id) => id !== 'brujula' || this.rng() < 0.5)).slice(0, 5);
    const full = pl.items.length >= MAX_ITEMS;
    const options = stock.map((id) => ({ label: `${ITEMS[id].icon} ${ITEMS[id].name} · ${ITEMS[id].price}🪙`, value: id, disabled: full || pl.coins < ITEMS[id].price, desc: ITEMS[id].desc }));
    options.push({ label: '👋 Salir de la tienda', value: null });
    const v = await this.ask(p, { tag: 'shop', title: '🛒 Tienda', text: full ? 'Tu mochila está llena (máx. 3).' : `Tienes ${pl.coins}🪙. ¿Qué quieres comprar?`, options });
    if (!v) return;
    this.addCoins(p, -ITEMS[v].price);
    pl.items.push(v);
    this.msg(`🛒 ${pl.name} compra ${ITEMS[v].icon} ${ITEMS[v].name}.`, p);
    this.emitState();
    await this.wait(500);
  }

  async land(p) {
    const pl = this.s.players[p];
    const sp = this.board.spaces[pl.pos];
    const mult = this.s.lastFive ? 2 : 1;
    this.s.phase = 'land';
    this.io.emit({ type: 'land', p, space: sp.type });
    switch (sp.type) {
      case 'blue': pl.last = 'blue'; pl.stats.blue++; this.addCoins(p, 3 * mult); this.msg(`🔵 ${pl.name} +${3 * mult} monedas`, p); break;
      case 'red': pl.last = 'red'; pl.stats.red++; this.addCoins(p, -3 * mult); this.msg(`🔴 ${pl.name} −${3 * mult} monedas`, p); break;
      case 'lucky': pl.last = 'green'; pl.stats.happen++; await this.lucky(p); break;
      case 'bad': pl.last = 'green'; pl.stats.happen++; await this.bad(p); break;
      case 'item': pl.last = 'green'; this.giveItem(p, this.randomItem()); break;
      case 'event': pl.last = 'green'; pl.stats.happen++; if (this.mech.event) await this.mech.event(this, p); break;
      case 'vs': pl.last = 'green'; pl.stats.happen++; await this.duel(p); break;
      case 'warp': {
        pl.last = 'green';
        const others = this.board.spaces.filter((s) => s.type === 'warp' && s.id !== sp.id).map((s) => s.id);
        if (others.length) { this.msg(`🌀 ${pl.name} entra en un portal…`, p); await this.teleport(p, pick(this.rng, others)); }
        break;
      }
      case 'bank': pl.last = 'green'; if (this.s.bank > 0) { this.addCoins(p, this.s.bank); this.banner(`🏦 ¡${pl.name} se lleva el banco: ${this.s.bank} monedas!`); this.s.bank = 0; await this.wait(1000); } break;
      default: pl.last = pl.last || 'blue';
    }
    // trampas
    const owner = this.s.traps[pl.pos];
    if (owner !== undefined && owner !== p) {
      delete this.s.traps[pl.pos];
      if (!this.blocked(p)) { const n = Math.min(10, pl.coins); this.addCoins(p, -n); this.addCoins(owner, n); this.msg(`🪤 ¡${pl.name} cae en la trampa de ${this.pname(owner)}! Paga ${n} monedas.`, p); }
    }
    this.emitState();
    await this.wait(700);
  }

  async lucky(p) {
    const pl = this.s.players[p];
    const r = weighted(this.rng, [['coins', 30], ['item', 22], ['rain', 15], ['forward', 15], ['gifts', 18]]);
    if (r === 'coins') { this.addCoins(p, 10); this.msg(`🍀 ¡Suerte! ${pl.name} encuentra 10 monedas.`, p); }
    else if (r === 'item') { this.msg('🍀 ¡Un regalo misterioso!', p); this.giveItem(p, this.randomItem()); }
    else if (r === 'rain') { const n = rnd(this.rng, 5, 15); this.addCoins(p, n); this.msg(`🌧️🪙 ¡Lluvia de monedas! +${n}`, p); }
    else if (r === 'forward') { this.msg(`🍀 ¡Viento a favor! ${pl.name} avanza 5 casillas.`, p); await this.slide(p, 5); }
    else { let t = 0; this.s.players.forEach((o, i) => { if (i !== p && o.coins > 0) { const n = Math.min(2, o.coins); this.addCoins(i, -n); t += n; } }); this.addCoins(p, t); this.msg(`🎉 ¡Todos le regalan monedas a ${pl.name}! +${t}`, p); }
    await this.wait(900);
  }

  async bad(p) {
    const pl = this.s.players[p];
    const r = weighted(this.rng, [['lose', 30], ['share', 20], ['back', 20], ['item', 12], ['robin', 18]]);
    if (r === 'item' && !pl.items.length) return this.bad(p);
    if (r === 'back') { this.msg(`💀 ¡Un remolino arrastra a ${pl.name} 5 casillas atrás!`, p); await this.slideBack(p, 5); return; }
    if (this.blocked(p)) return;
    if (r === 'lose') { const n = this.addCoins(p, -10); this.msg(`💀 ${pl.name} pierde ${-n} monedas.`, p); }
    else if (r === 'share') { let t = 0; this.s.players.forEach((o, i) => { if (i !== p && pl.coins > 0) { const n = Math.min(3, pl.coins); this.addCoins(p, -n); this.addCoins(i, n); t += n; } }); this.msg(`💀 ${pl.name} tiene que invitar: reparte ${t} monedas.`, p); }
    else if (r === 'item') { const it = pl.items.splice(Math.floor(this.rng() * pl.items.length), 1)[0]; this.msg(`💀 A ${pl.name} se le cae ${ITEMS[it].icon} ${ITEMS[it].name}.`, p); }
    else { const r2 = this.ranking(), last = r2[r2.length - 1]; if (last === p) { this.msg('💀 La desgracia te tiene lástima. Nada pasa.', p); } else { const n = Math.min(10, pl.coins); this.addCoins(p, -n); this.addCoins(last, n); this.msg(`💀 ${pl.name} dona ${n} monedas a ${this.pname(last)} (último lugar).`, p); } }
    await this.wait(900);
  }

  async duel(p) {
    const pl = this.s.players[p];
    const others = this.s.players.map((_, i) => i).filter((i) => i !== p);
    this.banner(`⚔️ ¡DUELO! ${pl.name} reta a alguien`);
    await this.wait(900);
    const t = await this.askTarget(p, others, 'duel', '⚔️ ¿A quién retas?');
    const wopts = [5, 10, 20].map((w) => ({ label: `${w} monedas`, value: w, disabled: pl.coins < w }));
    wopts.unshift({ label: 'Amistoso (0)', value: 0 });
    const wager = await this.ask(p, { tag: 'wager', title: '⚔️ Apuesta', text: `Duelo contra ${this.pname(t)}`, options: wopts });
    const a = Math.min(wager, pl.coins), b = Math.min(wager, this.s.players[t].coins);
    this.addCoins(p, -a); this.addCoins(t, -b);
    const pot = a + b;
    const gameId = pickMinigame('ffa', this.s.mgRecent, this.rng);
    const spec = { gameId, mode: 'duel', participants: [p, t], roles: {}, seed: Math.floor(this.rng() * 1e9) };
    const res = await this.runMinigame(spec);
    const [sa, sb] = res;
    let txt;
    if (sa === sb) { this.addCoins(p, a); this.addCoins(t, b); txt = 'Empate: se devuelven las apuestas.'; }
    else { const w = sa > sb ? p : t; this.addCoins(w, pot); this.s.players[w].stats.mg += pot; txt = `¡${this.pname(w)} gana el duelo y se lleva ${pot} monedas!`; }
    this.io.emit({ type: 'mgResult', spec, scores: res, rewards: [], text: txt });
    this.emitState();
    await this.wait(2500);
  }

  async runMinigame(spec) {
    this.s.phase = 'minigame';
    this.s.mgRecent.push(spec.gameId);
    if (this.s.mgRecent.length > 14) this.s.mgRecent.shift();
    this.emitState();
    const scores = await this.io.minigame(spec, this);
    this.s.phase = 'board';
    return scores.map((x) => (typeof x === 'number' && isFinite(x) ? x : 0));
  }

  async minigamePhase() {
    const ps = this.s.players, n = ps.length;
    const colors = ps.map((pl) => (pl.last === 'blue' || pl.last === 'red' ? pl.last : this.rng() < 0.5 ? 'blue' : 'red'));
    const blues = colors.map((c, i) => (c === 'blue' ? i : -1)).filter((i) => i >= 0);
    const reds = colors.map((c, i) => (c === 'red' ? i : -1)).filter((i) => i >= 0);
    let mode = 'ffa';
    if (n >= 3 && (blues.length === 1 || reds.length === 1)) mode = 'solo';
    else if (n >= 4 && blues.length >= 2 && reds.length >= 2) mode = this.rng() < 0.6 ? 'team' : 'ffa';
    const gameId = pickMinigame(mode, this.s.mgRecent, this.rng);
    const roles = {};
    let teams = null;
    if (mode === 'solo') { const solo = blues.length === 1 ? blues[0] : reds[0]; ps.forEach((_, i) => { roles[i] = i === solo ? 'solo' : 'group'; }); }
    if (mode === 'team') { teams = { blue: blues, red: reds }; blues.forEach((i) => { roles[i] = 'blue'; }); reds.forEach((i) => { roles[i] = 'red'; }); }
    const spec = { gameId, mode, participants: ps.map((_, i) => i), roles, teams, seed: Math.floor(this.rng() * 1e9) };
    this.io.emit({ type: 'mgIntro', spec, colors });
    await this.wait(400);
    const scores = await this.runMinigame(spec);
    const rewards = ps.map(() => 0);
    let text = '';
    if (mode === 'ffa') {
      const order = spec.participants.map((p, k) => ({ p, s: scores[k] })).sort((a, b) => b.s - a.s);
      const prize = [10, 5, 2, 0, 0, 0];
      let rank = 0;
      order.forEach((o, k) => { if (k > 0 && o.s < order[k - 1].s) rank = k; rewards[o.p] = prize[rank] || 0; });
      text = `🏆 ¡Gana ${order.filter((o) => o.s === order[0].s).map((o) => this.pname(o.p)).join(' y ')}!`;
    } else if (mode === 'team') {
      const avg = (arr) => arr.reduce((s, i) => s + scores[i], 0) / arr.length;
      const b = avg(teams.blue), r = avg(teams.red);
      if (b === r) { ps.forEach((_, i) => { rewards[i] = 3; }); text = '🤝 ¡Empate entre equipos!'; }
      else { const win = b > r ? teams.blue : teams.red; win.forEach((i) => { rewards[i] = 10; }); text = `🏆 ¡Gana el equipo ${b > r ? 'AZUL 🔵' : 'ROJO 🔴'}!`; }
    } else {
      const solo = +Object.keys(roles).find((k) => roles[k] === 'solo');
      const group = spec.participants.filter((i) => i !== solo);
      const g = group.reduce((s, i) => s + scores[i], 0) / group.length;
      if (scores[solo] > g) { rewards[solo] = 15; text = `🏆 ¡${this.pname(solo)} vence a todos!`; }
      else if (scores[solo] < g) { group.forEach((i) => { rewards[i] = 6; }); text = '🏆 ¡El grupo derrota al solitario!'; }
      else text = '🤝 Empate';
    }
    rewards.forEach((r, i) => { if (r) { this.addCoins(i, r); ps[i].stats.mg += r; } });
    this.io.emit({ type: 'mgResult', spec, scores, rewards, text });
    this.emitState();
    await this.wait(3200);
  }

  async finale() {
    this.s.phase = 'finale';
    this.s.current = -1;
    this.banner('🎊 ¡Fin de la partida! Estrellas de bonificación…');
    await this.wait(1800);
    const bonus = [];
    if (this.cfg.bonus !== false) {
      const cats = [
        { key: 'mg', name: 'Estrella Minijuego', icon: '🎮', desc: 'más monedas ganadas en minijuegos' },
        { key: 'maxCoins', name: 'Estrella Rica', icon: '💰', desc: 'más monedas acumuladas a la vez' },
        { key: 'happen', name: 'Estrella Sorpresa', icon: '❗', desc: 'más casillas de evento/suerte' },
      ];
      for (const c of cats) {
        const max = Math.max(...this.s.players.map((p) => p.stats[c.key]));
        if (max <= 0) continue;
        const winners = this.s.players.map((p, i) => (p.stats[c.key] === max ? i : -1)).filter((i) => i >= 0);
        winners.forEach((i) => this.s.players[i].stars++);
        bonus.push({ ...c, winners, value: max });
        this.banner(`${c.icon} ${c.name}: ${winners.map((i) => this.pname(i)).join(', ')} (${c.desc})`);
        this.emitState();
        await this.wait(2200);
      }
    }
    const ranking = this.ranking();
    this.s.phase = 'end';
    this.emitState();
    this.io.emit({ type: 'end', ranking, bonus, players: clone(this.s.players) });
    return { ranking, bonus };
  }
}
