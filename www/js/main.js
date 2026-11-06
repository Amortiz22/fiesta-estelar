// Controlador principal: menús, sesiones (local / anfitrión / invitado), HUD y overlays
import { CHARACTERS, charById, ITEMS, SPACE_TYPES, MODE_NAMES, STAR_PRICE } from './data.js';
import { BOARD_DEFS, getBoard } from './boards.js';
import { Game } from './engine.js';
import { botChoose } from './ai.js';
import { MG_META, mgById, botScore } from './mgmeta.js';
import { playMinigame } from './minigames.js';
import { BoardView } from './render.js';
import { HostNet, ClientNet, PROTOCOL } from './net.js';
import { sfx, setMuted, isMuted } from './audio.js';
import { sleep, roomCode } from './util.js';

const app = document.getElementById('app');
// URL pública de la versión web (GitHub Pages). Se usa en las invitaciones enviadas desde la app Android.
const WEB_URL = window.FIESTA_WEB_URL || '';
const store = {
  get(k, d) { try { const v = localStorage.getItem('fe_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fe_' + k, JSON.stringify(v)); } catch {} },
};
const prefs = Object.assign({ name: '', charId: 'zorro', boardId: 'isla', turns: 15, players: 6, level: 1, bonus: true, speed: 1 }, store.get('prefs', {}));
const savePrefs = () => store.set('prefs', prefs);
setMuted(store.get('muted', false));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const on = (root, sel, ev, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));
let session = null;

// ================= Pantallas de menú =================
function titleScreen() {
  session?.dispose?.(); session = null;
  app.innerHTML = `
  <div class="screen title">
    <div class="stars-bg"></div>
    <div class="logo"><span>⭐</span> Fiesta <b>Estelar</b> <span>⭐</span></div>
    <div class="sub">¡Tableros, objetos y 30 minijuegos para hasta 6 amigos!</div>
    <div class="parade">${CHARACTERS.slice(0, 6).map((c, i) => `<span style="animation-delay:${i * 0.15}s">${c.emoji}</span>`).join('')}</div>
    <div class="menu">
      <button class="btn big gold" data-a="solo">🎮 Un jugador</button>
      <button class="btn big pink" data-a="host">👑 Crear sala</button>
      <button class="btn big blue" data-a="join">🔗 Unirse a sala</button>
      <div class="row">
        <button class="btn" data-a="practice">🕹️ Minijuegos</button>
        <button class="btn" data-a="help">📖 Cómo jugar</button>
      </div>
      <button class="btn small" data-a="sound">${isMuted() ? '🔇 Sonido apagado' : '🔊 Sonido encendido'}</button>
    </div>
    <div class="foot">v1.0 · Personajes y tableros originales · Hecho con ❤️</div>
  </div>`;
  on(app, '[data-a]', 'click', (e) => {
    const a = e.currentTarget.dataset.a; sfx('tap');
    if (a === 'solo') profileScreen('solo');
    if (a === 'host') profileScreen('host');
    if (a === 'join') profileScreen('join');
    if (a === 'practice') practiceScreen();
    if (a === 'help') helpModal();
    if (a === 'sound') { setMuted(!isMuted()); store.set('muted', isMuted()); titleScreen(); }
  });
}

function charPicker(selected, taken = []) {
  return `<div class="chars">${CHARACTERS.map((c) => `<button class="char ${c.id === selected ? 'sel' : ''}" data-char="${c.id}" ${taken.includes(c.id) ? 'disabled' : ''} style="--c:${c.color}"><span>${c.emoji}</span><small>${c.name}</small></button>`).join('')}</div>`;
}
function boardPicker(selected) {
  return `<div class="boards">${BOARD_DEFS.map((b) => `<button class="boardcard ${b.id === selected ? 'sel' : ''}" data-board="${b.id}" style="--b1:${b.theme.bg1};--b2:${b.theme.bg2}"><span class="be">${b.emoji}</span><b>${b.name}</b><small>${b.unique}</small></button>`).join('')}</div>
  <div class="boarddesc" id="bdesc">${esc(BOARD_DEFS.find((b) => b.id === selected).desc)}</div>`;
}
function bindBoardPicker(root, cb) {
  on(root, '[data-board]', 'click', (e) => {
    const id = e.currentTarget.dataset.board; sfx('tap');
    root.querySelectorAll('[data-board]').forEach((x) => x.classList.toggle('sel', x.dataset.board === id));
    $('#bdesc', root).textContent = BOARD_DEFS.find((b) => b.id === id).desc;
    cb(id);
  });
}

function profileScreen(mode) {
  const code0 = new URLSearchParams(location.search).get('sala') || '';
  app.innerHTML = `
  <div class="screen setup">
    <header><button class="btn small" id="back">⬅</button><h2>${mode === 'solo' ? '🎮 Un jugador' : mode === 'host' ? '👑 Crear sala' : '🔗 Unirse a sala'}</h2></header>
    <div class="scroll">
      <label>Tu nombre</label>
      <input id="name" maxlength="12" placeholder="Escribe tu nombre" value="${esc(prefs.name)}">
      <label>Elige personaje</label>
      ${charPicker(prefs.charId)}
      ${mode === 'solo' ? `
        <label>Tablero</label>${boardPicker(prefs.boardId)}
        <div class="grid2">
          <div><label>Turnos</label><select id="turns">${[10, 15, 20, 25, 30].map((t) => `<option ${t === prefs.turns ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label>Jugadores</label><select id="players">${[2, 3, 4, 5, 6].map((t) => `<option ${t === prefs.players ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label>Dificultad bots</label><select id="level">${['Fácil', 'Normal', 'Difícil'].map((t, i) => `<option value="${i}" ${i === prefs.level ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label>Velocidad</label><select id="speed">${[[1, 'Normal'], [1.6, 'Rápida'], [2.4, 'Turbo']].map(([v, t]) => `<option value="${v}" ${v === prefs.speed ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label>Estrellas extra</label><select id="bonus"><option value="1" ${prefs.bonus ? 'selected' : ''}>Sí</option><option value="0" ${!prefs.bonus ? 'selected' : ''}>No</option></select></div>
        </div>` : ''}
      ${mode === 'join' ? `<label>Código de sala</label><input id="code" maxlength="5" placeholder="ABCDE" value="${esc(code0)}" style="text-transform:uppercase;letter-spacing:6px;text-align:center;font-size:28px">` : ''}
      <div id="err" class="err"></div>
    </div>
    <footer><button class="btn big gold" id="go">${mode === 'solo' ? '¡A jugar! ▶' : mode === 'host' ? 'Crear sala ▶' : 'Entrar ▶'}</button></footer>
  </div>`;
  $('#back').onclick = titleScreen;
  on(app, '[data-char]', 'click', (e) => { prefs.charId = e.currentTarget.dataset.char; app.querySelectorAll('[data-char]').forEach((x) => x.classList.toggle('sel', x.dataset.char === prefs.charId)); sfx('tap'); });
  if (mode === 'solo') bindBoardPicker(app, (id) => { prefs.boardId = id; });
  $('#go').onclick = () => {
    prefs.name = $('#name').value.trim().slice(0, 12) || charById(prefs.charId).name;
    if (mode === 'solo') { prefs.turns = +$('#turns').value; prefs.players = +$('#players').value; prefs.level = +$('#level').value; prefs.bonus = $('#bonus').value === '1'; prefs.speed = +$('#speed').value; }
    savePrefs(); sfx('go');
    if (mode === 'solo') startSolo();
    if (mode === 'host') startHost();
    if (mode === 'join') {
      const code = $('#code').value.trim().toUpperCase();
      if (code.length !== 5) { $('#err').textContent = 'El código tiene 5 letras.'; return; }
      startClient(code);
    }
  };
}

function helpModal() {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="card help">
    <h2>📖 Cómo jugar</h2>
    <p><b>Objetivo:</b> tener más ⭐ estrellas al final. En caso de empate, gana quien tenga más 🪙 monedas.</p>
    <p><b>Turno:</b> usa un objeto si quieres, tira el dado (1–10) y avanza. Al pasar junto a la ⭐ puedes comprarla por ${STAR_PRICE} monedas (hasta 3 a la vez en tableros tan grandes).</p>
    <h3>Casillas</h3>
    <ul class="legend">${Object.entries(SPACE_TYPES).map(([k, t]) => `<li><span class="dot" style="background:${t.color}">${t.icon}</span>${t.name}${t.step ? '' : ' <small>(se activa al pasar, no gasta paso)</small>'}</li>`).join('')}</ul>
    <h3>Objetos</h3>
    <ul class="legend">${Object.values(ITEMS).map((it) => `<li><span class="dot">${it.icon}</span><b>${it.name}</b> — ${it.desc}</li>`).join('')}</ul>
    <h3>Minijuegos</h3>
    <p>Después de cada ronda se juega un minijuego según el color donde cayó cada quien (azul o rojo; verdes al azar):</p>
    <ul><li><b>Todos contra todos:</b> 1º +10, 2º +5, 3º +2.</li><li><b>Por equipos</b> (azules vs rojos): el equipo ganador +10 cada uno.</li><li><b>Uno contra todos:</b> si el solitario gana +15; si gana el grupo, +6 cada uno.</li><li><b>Duelos ⚔️:</b> apuestas monedas contra un rival.</li></ul>
    <p><b>Últimos 5 turnos:</b> casillas azules/rojas valen el doble y el último lugar recibe ayuda.</p>
    <p><b>Estrellas extra al final:</b> 🎮 Minijuego, 💰 Rica y ❗ Sorpresa.</p>
    <p><b>Multijugador:</b> el anfitrión crea una sala y comparte el código de 5 letras. Los amigos con la app (o desde el navegador) entran con ese código. Las plazas libres se llenan con bots.</p>
    <button class="btn gold" id="close">Entendido</button></div>`;
  document.body.appendChild(m);
  $('#close', m).onclick = () => m.remove();
}

function practiceScreen() {
  const groups = ['ffa', 'team', 'solo'];
  app.innerHTML = `<div class="screen setup">
    <header><button class="btn small" id="back">⬅</button><h2>🕹️ Práctica de minijuegos</h2></header>
    <div class="scroll">${groups.map((g) => `<h3 class="mghead">${MODE_NAMES[g]}</h3><div class="mglist">${MG_META.filter((m) => m.mode === g).map((m) => `<button class="mgcard" data-mg="${m.id}"><span>${m.icon}</span><b>${m.name}</b></button>`).join('')}</div>`).join('')}</div>
  </div>`;
  $('#back').onclick = titleScreen;
  on(app, '[data-mg]', 'click', async (e) => {
    const id = e.currentTarget.dataset.mg, meta = mgById(id);
    const ov = document.createElement('div'); ov.className = 'mg'; document.body.appendChild(ov);
    const role = meta.mode === 'solo' ? 'solo' : null;
    await mgIntro(ov, meta, { mine: true, role, modeLabel: 'Práctica · ' + MODE_NAMES[meta.mode], lineup: '' });
    const score = await playMinigame(mgStage(ov), id, { seed: (Math.random() * 1e9) | 0, role, emoji: charById(prefs.charId).emoji });
    ov.innerHTML = `<div class="card result"><h2>${meta.icon} ${meta.name}</h2><div class="bigscore">${score}</div>
      <p>Referencia de bots: Fácil ~${meta.bot[0]} · Normal ~${meta.bot[1]} · Difícil ~${meta.bot[2]}</p>
      <div class="row"><button class="btn gold" id="again">Otra vez</button><button class="btn" id="ok">Volver</button></div></div>`;
    $('#ok', ov).onclick = () => ov.remove();
    $('#again', ov).onclick = () => { ov.remove(); e.target.closest('[data-mg]').click(); };
  });
}

// ================= Overlays de minijuego =================
function mgStage(ov) { ov.innerHTML = '<div class="mgstage"></div>'; return $('.mgstage', ov); }
function mgIntro(ov, meta, { mine, role, modeLabel, lineup, autoStart = 12 }) {
  return new Promise((resolve) => {
    const roleText = role === 'solo' ? meta.soloText : role === 'group' ? meta.groupText : '';
    ov.innerHTML = `<div class="card intro">
      <div class="mode">${modeLabel}</div>
      <div class="mgicon">${meta.icon}</div><h2>${meta.name}</h2>
      ${lineup}
      ${roleText ? `<div class="role">${roleText}</div>` : ''}
      <p>${meta.desc}</p><p class="ctrl">🎮 ${meta.controls}</p>
      ${mine ? `<button class="btn big gold" id="ready">¡Listo! <span id="cd"></span></button>` : '<p class="wait">👀 Estás mirando este minijuego…</p>'}
    </div>`;
    if (!mine) return resolve();
    let left = autoStart, done = false;
    const go = async () => {
      if (done) return; done = true; clearInterval(iv);
      for (const n of ['3', '2', '1', '¡YA!']) { ov.innerHTML = `<div class="countdown">${n}</div>`; sfx(n === '¡YA!' ? 'go' : 'tap'); await sleep(550); }
      resolve();
    };
    const iv = setInterval(() => { left--; const cd = $('#cd', ov); if (cd) cd.textContent = `(${left})`; if (left <= 0) go(); }, 1000);
    $('#ready', ov).onclick = go;
  });
}

// ================= Interfaz de partida =================
class GameUI {
  constructor(myIdx, onLeave) {
    this.my = myIdx; this.onLeave = onLeave; this.state = null; this.board = null;
    this.onMyScore = null; this.promptResolve = null; this.mgRunning = false;
    app.innerHTML = `<div class="screen game">
      <canvas id="board"></canvas>
      <div id="hud" class="hud"></div>
      <div class="topbar"><span id="turninfo"></span><span class="tbtns"><button id="b-view" title="Vista">🗺️</button><button id="b-me" title="Mi ficha">🎯</button><button id="b-info" title="Tablero">📖</button><button id="b-menu" title="Menú">☰</button></span></div>
      <div id="status" class="status"></div>
      <div id="ticker" class="ticker"></div>
      <div id="prompt" class="prompt hidden"></div>
      <div id="dice" class="dice hidden"></div>
      <div id="banner" class="banner hidden"></div>
    </div>`;
    this.view = new BoardView($('#board'));
    $('#b-view').onclick = () => this.view.toggleOverview();
    $('#b-me').onclick = () => this.view.focusPlayer(this.my);
    $('#b-info').onclick = () => this.boardInfo();
    $('#b-menu').onclick = () => this.menu();
  }
  dispose() { this.disposed = true; this.mgOv?.remove(); document.querySelectorAll('.modal,.mg').forEach((m) => m.remove()); }

  handle(e) {
    if (this.disposed) return;
    switch (e.type) {
      case 'state': this.setState(e.state); break;
      case 'msg': this.tick(e.text); break;
      case 'banner': this.showBanner(e.text); break;
      case 'turn': sfx('turn'); if (e.p === this.my) this.showBanner('🎲 ¡Tu turno!'); this.view.focusIdx = e.p; break;
      case 'round': this.showBanner(`Turno ${e.turn} de ${e.max}`); break;
      case 'dice': this.showDice(e); break;
      case 'asking': this.showWaiting(e); break;
      case 'coins': this.flashChip(e.p, e.n); break;
      case 'land': sfx('step'); break;
      case 'sfx': sfx(e.name); break;
      case 'mgIntro': this.showBanner(`🎮 Minijuego: ${MODE_NAMES[e.spec.mode]}`); break;
      case 'mgStart': this.startMinigame(e.spec); break;
      case 'mgResult': this.showResults(e); break;
      case 'end': this.showEnd(e); break;
    }
  }
  setState(s) {
    if (!this.board || this.board.id !== s.boardId) { this.board = getBoard(s.boardId); this.view.setBoard(this.board); }
    this.state = s; this.view.setState(s);
    const rank = s.players.map((_, i) => i).sort((a, b) => s.players[b].stars - s.players[a].stars || s.players[b].coins - s.players[a].coins);
    $('#hud').innerHTML = s.players.map((p, i) => `<div class="chip ${i === s.current ? 'cur' : ''} ${i === this.my ? 'me' : ''}" data-p="${i}" style="--c:${p.color}">
      <div class="av">${p.emoji}</div><div class="inf"><div class="nm"><i>${rank.indexOf(i) + 1}º</i> ${esc(p.name)}${p.kind === 'bot' ? ' 🤖' : ''}${!p.connected ? ' 📴' : ''}</div>
      <div class="st"><span>⭐${p.stars}</span><span>🪙${p.coins}</span></div><div class="it">${p.items.map((id) => ITEMS[id].icon).join('') || '&nbsp;'}</div></div></div>`).join('');
    on($('#hud'), '.chip', 'click', (e) => this.view.focusPlayer(+e.currentTarget.dataset.p));
    $('#turninfo').innerHTML = `${this.board.emoji} Turno <b>${Math.min(s.turn, s.maxTurns)}/${s.maxTurns}</b>${s.lastFive ? ' 🔥' : ''}${s.remaining ? ` · 👣 ${s.remaining}` : ''}`;
    $('#status').textContent = s.status || '';
  }
  flashChip(p, n) {
    const el = document.querySelector(`.chip[data-p="${p}"]`); if (!el || !n) return;
    const f = document.createElement('div'); f.className = 'coinfx ' + (n > 0 ? 'up' : 'down'); f.textContent = (n > 0 ? '+' : '') + n + '🪙';
    el.appendChild(f); setTimeout(() => f.remove(), 1200);
    if (n > 0 && p === this.my) sfx('coin');
  }
  tick(text) {
    const t = $('#ticker'); if (!t) return;
    const d = document.createElement('div'); d.textContent = text; t.appendChild(d);
    while (t.children.length > 4) t.firstChild.remove();
    setTimeout(() => d.classList.add('old'), 6000);
  }
  showBanner(text) {
    const b = $('#banner'); if (!b) return;
    b.textContent = text; b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this.bt); this.bt = setTimeout(() => b.classList.add('hidden'), 2000);
  }
  showDice(e) {
    const d = $('#dice'); const p = this.state?.players[e.p];
    d.classList.remove('hidden');
    let n = 0;
    const iv = setInterval(() => { d.innerHTML = `<div class="dies">${e.values.map(() => `<div class="die rolling">${1 + Math.floor(Math.random() * 10)}</div>`).join('')}</div>`; sfx('dice'); if (++n > 8) { clearInterval(iv); final(); } }, 60);
    const final = () => {
      d.innerHTML = `<div class="dies">${e.values.map((v) => `<div class="die">${v}</div>`).join('')}</div><div class="total">${p ? p.emoji : ''} ¡${e.total}!${e.bonus ? ` <small>(+${e.bonus} gravedad)</small>` : ''}</div>`;
      setTimeout(() => d.classList.add('hidden'), 900);
    };
  }
  showWaiting(e) {
    if (e.p === this.my || !this.state) return;
    const p = this.state.players[e.p];
    const what = { item: 'decide si usar un objeto', roll: 'va a tirar el dado', fork: 'elige camino', shop: 'está en la tienda', star: 'decide sobre la estrella', target: 'elige un rival', wager: 'decide la apuesta', magic: 'elige su número', taxi: 'decide si tomar el taxi', specter: 'habla con el Espectro' }[e.tag] || 'está decidiendo';
    const el = $('#prompt'); el.className = 'prompt waiting'; el.innerHTML = `<div class="px">⏳ ${p.emoji} <b>${esc(p.name)}</b> ${what}…</div>`;
    clearTimeout(this.wt); this.wt = setTimeout(() => { if (el.classList.contains('waiting')) el.classList.add('hidden'); }, 2500);
  }
  prompt(req) {
    return new Promise((resolve) => {
      this.promptResolve = resolve;
      const el = $('#prompt'); el.className = 'prompt mine';
      const opts = req.options;
      let body;
      if (req.tag === 'roll') body = `<button class="btn big gold dicebtn" data-i="0"><span class="die spin">🎲</span> ¡TIRAR DADO!</button>`;
      else if (req.tag === 'magic') body = `<div class="numgrid">${opts.map((o, i) => `<button class="btn" data-i="${i}">${o.label}</button>`).join('')}</div>`;
      else body = `<div class="opts">${opts.map((o, i) => `<button class="btn opt" data-i="${i}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}${o.desc ? `<small>${esc(o.desc)}</small>` : ''}${o.item ? `<small>${esc(ITEMS[o.item].desc)}</small>` : ''}</button>`).join('')}</div>`;
      el.innerHTML = `<div class="pt">${esc(req.title || '')}</div>${req.text ? `<div class="px">${esc(req.text)}</div>` : ''}${body}`;
      if (req.tag === 'fork' || req.tag === 'roll') this.view.focusPlayer(this.my);
      on(el, '[data-i]', 'click', (ev) => {
        const i = +ev.currentTarget.dataset.i; if (opts[i]?.disabled) return;
        sfx('tap'); el.className = 'prompt hidden'; this.promptResolve = null; resolve(i);
      });
    });
  }
  cancelPrompt() { const el = $('#prompt'); if (el) el.className = 'prompt hidden'; this.promptResolve = null; }

  async startMinigame(spec) {
    const meta = mgById(spec.gameId), s = this.state;
    const mine = spec.participants.includes(this.my);
    const P = (i) => `<span class="pp" style="--c:${s.players[i].color}">${s.players[i].emoji}</span>`;
    let lineup = '';
    if (spec.mode === 'team') lineup = `<div class="lineup"><div class="tb">🔵 ${spec.teams.blue.map(P).join('')}</div><b>VS</b><div class="tr">🔴 ${spec.teams.red.map(P).join('')}</div></div>`;
    else if (spec.mode === 'solo') { const solo = +Object.keys(spec.roles).find((k) => spec.roles[k] === 'solo'); lineup = `<div class="lineup"><div class="tb">${P(solo)}</div><b>VS</b><div class="tr">${spec.participants.filter((i) => i !== solo).map(P).join('')}</div></div>`; }
    else lineup = `<div class="lineup">${spec.participants.map(P).join(spec.mode === 'duel' ? '<b>⚔️</b>' : '')}</div>`;
    this.mgOv?.remove();
    const ov = document.createElement('div'); ov.className = 'mg'; document.body.appendChild(ov); this.mgOv = ov;
    const role = spec.mode === 'solo' ? spec.roles[this.my] : null;
    await mgIntro(ov, meta, { mine, role, modeLabel: MODE_NAMES[spec.mode], lineup });
    if (!mine) return;
    const score = await playMinigame(mgStage(ov), spec.gameId, { seed: spec.seed, role, emoji: s.players[this.my].emoji });
    if (this.mgOv === ov) ov.innerHTML = `<div class="card intro"><h2>${meta.icon} ${meta.name}</h2><div class="bigscore">${score}</div><p class="wait">⏳ Esperando a los demás…</p></div>`;
    this.onMyScore?.(spec, score);
  }
  showResults(e) {
    const s = this.state, meta = mgById(e.spec.gameId);
    const rows = e.spec.participants.map((p, k) => ({ p, sc: e.scores[k], r: e.rewards[p] || 0 })).sort((a, b) => b.sc - a.sc);
    const team = (p) => (e.spec.mode === 'team' ? (e.spec.roles[p] === 'blue' ? '🔵' : '🔴') : e.spec.mode === 'solo' ? (e.spec.roles[p] === 'solo' ? '🦸' : '👥') : '');
    if (!this.mgOv) { this.mgOv = document.createElement('div'); this.mgOv.className = 'mg'; document.body.appendChild(this.mgOv); }
    const ov = this.mgOv;
    ov.innerHTML = `<div class="card result"><div class="mode">${MODE_NAMES[e.spec.mode]}</div><h2>${meta.icon} ${meta.name}</h2>
      <div class="restext">${esc(e.text)}</div>
      <table class="restable">${rows.map((r, i) => `<tr class="${r.p === this.my ? 'me' : ''}"><td>${i + 1}º</td><td>${team(r.p)} ${s.players[r.p].emoji} ${esc(s.players[r.p].name)}</td><td>${r.sc}</td><td class="rw">${r.r ? '+' + r.r + '🪙' : ''}</td></tr>`).join('')}</table></div>`;
    sfx((e.rewards[this.my] || 0) > 0 ? 'win' : 'tap');
    clearTimeout(this.rt); this.rt = setTimeout(() => { if (this.mgOv === ov) { ov.remove(); this.mgOv = null; } }, 3000);
  }
  showEnd(e) {
    this.mgOv?.remove(); this.mgOv = null;
    const ps = e.players, r = e.ranking;
    const ov = document.createElement('div'); ov.className = 'mg end'; document.body.appendChild(ov);
    const podium = r.slice(0, 3).map((i, k) => `<div class="pod p${k + 1}"><div class="pe">${ps[i].emoji}</div><div class="pn">${esc(ps[i].name)}</div><div class="pb">${k + 1}º</div></div>`);
    ov.innerHTML = `<div class="card result final">
      <h2>🏆 ¡${esc(ps[r[0]].name)} gana la Fiesta Estelar!</h2>
      <div class="podium">${[podium[1] || '', podium[0], podium[2] || ''].join('')}</div>
      <table class="restable">${r.map((i, k) => `<tr class="${i === this.my ? 'me' : ''}"><td>${k + 1}º</td><td>${ps[i].emoji} ${esc(ps[i].name)}</td><td>⭐${ps[i].stars}</td><td>🪙${ps[i].coins}</td></tr>`).join('')}</table>
      ${e.bonus.length ? `<div class="bonus">${e.bonus.map((b) => `<div>${b.icon} <b>${b.name}</b>: ${b.winners.map((i) => ps[i].emoji + ' ' + esc(ps[i].name)).join(', ')}</div>`).join('')}</div>` : ''}
      <button class="btn big gold" id="menu">Volver al menú</button></div>`;
    sfx('win');
    $('#menu', ov).onclick = () => { ov.remove(); this.onLeave(); };
  }
  boardInfo() {
    const b = this.board, s = this.state; if (!b) return;
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="card help"><h2>${b.emoji} ${b.name}</h2><p>${esc(b.desc)}</p><p><b>${esc(s?.status || '')}</b></p><p>${b.spaces.length} casillas · ${b.branchInfo.length} rutas alternativas · ${b.starCount} estrella(s)</p>
      <ul class="legend">${Object.entries(SPACE_TYPES).filter(([k]) => b.spaces.some((x) => x.type === k)).map(([k, t]) => `<li><span class="dot" style="background:${t.color}">${t.icon}</span>${t.name}</li>`).join('')}</ul>
      <button class="btn gold" id="close">Cerrar</button></div>`;
    document.body.appendChild(m); $('#close', m).onclick = () => m.remove();
  }
  menu() {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="card"><h2>☰ Menú</h2>
      <button class="btn" id="snd">${isMuted() ? '🔇 Activar sonido' : '🔊 Silenciar'}</button>
      <button class="btn" id="help">📖 Cómo jugar</button>
      <button class="btn pink" id="quit">🚪 Abandonar partida</button>
      <button class="btn gold" id="close">Continuar</button></div>`;
    document.body.appendChild(m);
    $('#close', m).onclick = () => m.remove();
    $('#help', m).onclick = () => { m.remove(); helpModal(); };
    $('#snd', m).onclick = () => { setMuted(!isMuted()); store.set('muted', isMuted()); m.remove(); };
    $('#quit', m).onclick = () => { if (confirm('¿Seguro que quieres salir de la partida?')) { m.remove(); this.onLeave(); } };
  }
}

// ================= Sesiones =================
const never = () => new Promise(() => {});
function haltGame(game) { game.io = { emit() {}, sleep: never, ask: never, minigame: never }; }
function makeHostIO(ui, getNet) {
  const scoreWaiters = new Map();
  const speed = () => prefs.speed || 1;
  const io = {
    emit(e) { ui.handle(e); getNet()?.broadcast({ t: 'evt', e }); },
    sleep: (ms) => sleep(ms / speed()),
    async ask(p, req, g) {
      const pl = g.s.players[p];
      io.emit({ type: 'asking', p, tag: req.tag });
      if (pl.kind === 'local') return ui.prompt(req);
      if (pl.kind === 'remote' && pl.connected && getNet()) {
        try { return await getNet().request(pl.peer, 'ask', { req }, 90000); } catch { getNet()?.cancelFor(pl.peer); }
      }
      await sleep((req.tag === 'roll' ? 450 : 700) / speed());
      return botChoose(g, p, req);
    },
    async minigame(spec, g) {
      spec.key = Math.random().toString(36).slice(2);
      let humans = 0;
      const tasks = spec.participants.map((p) => {
        const pl = g.s.players[p];
        if (pl.kind === 'local') { humans++; return new Promise((res) => { ui.onMyScore = (sp, sc) => { if (sp.key === spec.key) res(sc); }; }); }
        if (pl.kind === 'remote' && pl.connected) {
          humans++;
          return new Promise((res) => {
            const k = pl.peer + ':' + spec.key;
            const timer = setTimeout(() => { scoreWaiters.delete(k); res(0); }, (mgById(spec.gameId) ? 120 : 60) * 1000);
            scoreWaiters.set(k, { res: (v) => { clearTimeout(timer); res(v); }, peer: pl.peer });
          });
        }
        return Promise.resolve(botScore(spec.gameId, pl.level, Math.random));
      });
      io.emit({ type: 'mgStart', spec });
      if (!humans) await sleep(3500);
      return Promise.all(tasks);
    },
    onScore(peer, key, v) { const w = scoreWaiters.get(peer + ':' + key); if (w) { scoreWaiters.delete(peer + ':' + key); w.res(+v || 0); } },
    onPeerGone(peer) { for (const [k, w] of scoreWaiters) if (w.peer === peer) { scoreWaiters.delete(k); w.res(0); } },
  };
  return io;
}

function startSolo() {
  const others = CHARACTERS.filter((c) => c.id !== prefs.charId).sort(() => Math.random() - 0.5);
  const players = [{ name: prefs.name, charId: prefs.charId, kind: 'local' }];
  for (let i = 1; i < prefs.players; i++) players.push({ charId: others[i - 1].id, kind: 'bot', level: prefs.level });
  const ui = new GameUI(0, titleScreen);
  const io = makeHostIO(ui, () => null);
  const game = new Game({ boardId: prefs.boardId, turns: prefs.turns, bonus: prefs.bonus, players }, io);
  session = { dispose: () => { haltGame(game); ui.dispose(); } };
  game.run().catch((e) => { console.error(e); alert('Error: ' + e.message); });
}

// ---------- Anfitrión ----------
function startHost() {
  const code = roomCode();
  const lobby = {
    code, boardId: prefs.boardId, turns: prefs.turns, level: prefs.level, bonus: prefs.bonus, started: false,
    slots: [{ name: prefs.name, charId: prefs.charId, kind: 'local' }],
  };
  let net, game, ui, io;
  const broadcastLobby = () => net.broadcast({ t: 'lobby', lobby: publicLobby() });
  const publicLobby = () => ({ code, boardId: lobby.boardId, turns: lobby.turns, slots: lobby.slots.map((s) => ({ name: s.name, charId: s.charId, kind: s.kind, level: s.level })) });
  const freeChar = (want) => { const taken = lobby.slots.map((s) => s.charId); return taken.includes(want) ? CHARACTERS.find((c) => !taken.includes(c.id)).id : want; };

  const render = () => {
    if (lobby.started) return;
    const url = location.origin + location.pathname + '?sala=' + code;
    app.innerHTML = `<div class="screen setup lobby">
      <header><button class="btn small" id="back">⬅</button><h2>👑 Tu sala</h2></header>
      <div class="scroll">
        <div class="codebox"><small>Código de sala</small><div class="code">${code}</div><div id="netst" class="netst">${net?.ready ? '🟢 Sala abierta: comparte el código' : '🟡 Conectando con el servidor…'}</div>
          <button class="btn small" id="share">📤 Compartir</button></div>
        <label>Jugadores (${lobby.slots.length}/6)</label>
        <div class="slots">${lobby.slots.map((s, i) => { const c = charById(s.charId); return `<div class="slot" style="--c:${c.color}"><span class="av">${c.emoji}</span><b>${esc(s.name || c.name)}</b><small>${s.kind === 'local' ? 'Tú (anfitrión)' : s.kind === 'remote' ? '🌐 Amigo' : '🤖 Bot ' + ['fácil', 'normal', 'difícil'][s.level ?? 1]}</small>${i > 0 ? `<button class="x" data-rm="${i}">✕</button>` : ''}</div>`; }).join('')}
          ${lobby.slots.length < 6 ? '<button class="slot add" id="addbot">➕ Añadir bot</button>' : ''}</div>
        <label>Tablero</label>${boardPicker(lobby.boardId)}
        <div class="grid2">
          <div><label>Turnos</label><select id="turns">${[10, 15, 20, 25, 30].map((t) => `<option ${t === lobby.turns ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label>Dificultad bots</label><select id="level">${['Fácil', 'Normal', 'Difícil'].map((t, i) => `<option value="${i}" ${i === lobby.level ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label>Velocidad</label><select id="speed">${[[1, 'Normal'], [1.6, 'Rápida'], [2.4, 'Turbo']].map(([v, t]) => `<option value="${v}" ${v === prefs.speed ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label>Estrellas extra</label><select id="bonus"><option value="1" ${lobby.bonus ? 'selected' : ''}>Sí</option><option value="0" ${!lobby.bonus ? 'selected' : ''}>No</option></select></div>
        </div>
        <p class="hint">Tus amigos abren la app (o la página) → “Unirse a sala” → escriben <b>${code}</b>.</p>
      </div>
      <footer><button class="btn big gold" id="start" ${lobby.slots.length < 2 ? 'disabled' : ''}>¡Empezar partida! ▶</button></footer>
    </div>`;
    $('#back').onclick = () => { net.close(); titleScreen(); };
    $('#share').onclick = async () => {
      const web = location.hostname === 'localhost' ? WEB_URL : url;
      const txt = `¡Únete a mi Fiesta Estelar! Abre la app → “Unirse a sala” → código: ${code}` + (web ? `\nO juega desde el navegador: ${web}${web.includes('?') ? '' : (web === url ? '' : '?sala=' + code)}` : '');
      try { if (navigator.share) { await navigator.share({ title: 'Fiesta Estelar', text: txt }); return; } await navigator.clipboard.writeText(txt); alert('¡Invitación copiada!'); } catch { prompt('Copia la invitación:', txt); }
    };
    bindBoardPicker(app, (id) => { lobby.boardId = id; broadcastLobby(); });
    $('#turns').onchange = (e) => { lobby.turns = +e.target.value; broadcastLobby(); };
    $('#speed').onchange = (e) => { prefs.speed = +e.target.value; savePrefs(); };
    $('#bonus').onchange = (e) => { lobby.bonus = e.target.value === '1'; };
    $('#level').onchange = (e) => { lobby.level = +e.target.value; lobby.slots.forEach((s) => { if (s.kind === 'bot') s.level = lobby.level; }); render(); broadcastLobby(); };
    const ab = $('#addbot'); if (ab) ab.onclick = () => { lobby.slots.push({ charId: freeChar(CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id), kind: 'bot', level: lobby.level }); lobby.slots[lobby.slots.length - 1].name = charById(lobby.slots[lobby.slots.length - 1].charId).name; render(); broadcastLobby(); };
    on(app, '[data-rm]', 'click', (e) => { const i = +e.currentTarget.dataset.rm, s = lobby.slots[i]; if (s.kind === 'remote') net.send(s.peer, { t: 'kicked' }); lobby.slots.splice(i, 1); render(); broadcastLobby(); });
    $('#start').onclick = startGame;
  };

  net = new HostNet(code, {
    onReady() { net.ready = true; const el = $('#netst'); if (el) el.textContent = '🟢 Sala abierta: comparte el código'; },
    onError(e) {
      const el = $('#netst');
      if (e.type === 'unavailable-id') { net.close(); startHost(); return; }
      if (el) el.textContent = '🔴 Error de red: ' + (e.type || e.message) + '. Revisa tu conexión a internet.';
    },
    onMessage(peer, msg) {
      if (msg.t === 'hello') {
        if (lobby.started) return net.send(peer, { t: 'full', reason: 'La partida ya empezó.' });
        if (msg.ver !== PROTOCOL) return net.send(peer, { t: 'full', reason: 'Versión distinta del juego. Actualicen la app.' });
        const existing = lobby.slots.find((s) => s.peer === peer);
        if (!existing) {
          if (lobby.slots.length >= 6) { const bi = lobby.slots.findIndex((s) => s.kind === 'bot'); if (bi < 0) return net.send(peer, { t: 'full', reason: 'La sala está llena (6/6).' }); lobby.slots.splice(bi, 1); }
          lobby.slots.push({ name: String(msg.name || '').slice(0, 12), charId: freeChar(msg.charId), kind: 'remote', peer });
        }
        net.send(peer, { t: 'welcome' }); render(); broadcastLobby(); sfx('coin');
      }
      if (msg.t === 'score') io?.onScore(peer, msg.key, msg.v);
    },
    onLeave(peer) {
      if (!lobby.started) { lobby.slots = lobby.slots.filter((s) => s.peer !== peer); render(); broadcastLobby(); return; }
      if (game) {
        const i = game.s.players.findIndex((p) => p.peer === peer);
        if (i >= 0) { game.s.players[i].connected = false; game.s.players[i].kind = 'bot'; game.msg(`📴 ${game.s.players[i].name} se desconectó. Un bot toma su lugar.`); game.emitState(); }
        io.onPeerGone(peer);
      }
    },
  });

  function startGame() {
    if (lobby.slots.length < 2) return;
    lobby.started = true; prefs.boardId = lobby.boardId; prefs.turns = lobby.turns; prefs.level = lobby.level; savePrefs();
    lobby.slots.forEach((s, i) => { if (s.kind === 'remote') net.send(s.peer, { t: 'start', you: i }); });
    ui = new GameUI(0, () => { net.close(); titleScreen(); });
    io = makeHostIO(ui, () => net);
    game = new Game({ boardId: lobby.boardId, turns: lobby.turns, bonus: lobby.bonus, players: lobby.slots.map((s) => ({ ...s, level: s.level ?? lobby.level })) }, io);
    session = { dispose: () => { haltGame(game); net.close(); ui.dispose(); } };
    game.run().catch((e) => { console.error(e); alert('Error: ' + e.message); });
  }
  session = { dispose: () => net.close() };
  render();
}

// ---------- Invitado ----------
function startClient(code) {
  let ui = null, lobbyData = null, joined = false;
  app.innerHTML = `<div class="screen setup"><header><button class="btn small" id="back">⬅</button><h2>🔗 Sala ${code}</h2></header><div class="scroll center"><div class="spinner">⭐</div><p id="st">Conectando…</p></div></div>`;
  $('#back').onclick = () => { net.close(); titleScreen(); };
  const setSt = (t) => { const el = $('#st'); if (el) el.textContent = t; };
  const renderLobby = () => {
    if (ui) return;
    const L = lobbyData, b = BOARD_DEFS.find((x) => x.id === L.boardId);
    app.innerHTML = `<div class="screen setup lobby"><header><button class="btn small" id="back">⬅</button><h2>🔗 Sala ${code}</h2></header>
      <div class="scroll">
        <div class="codebox"><small>Esperando a que el anfitrión empiece…</small><div class="spinner">⭐</div></div>
        <label>Jugadores (${L.slots.length}/6)</label>
        <div class="slots">${L.slots.map((s) => { const c = charById(s.charId); return `<div class="slot" style="--c:${c.color}"><span class="av">${c.emoji}</span><b>${esc(s.name || c.name)}</b><small>${s.kind === 'local' ? '👑 Anfitrión' : s.kind === 'remote' ? '🌐 Jugador' : '🤖 Bot'}</small></div>`; }).join('')}</div>
        <label>Tablero</label><div class="boardcard sel big" style="--b1:${b.theme.bg1};--b2:${b.theme.bg2}"><span class="be">${b.emoji}</span><b>${b.name}</b><small>${b.desc}</small></div>
        <p class="hint">${L.turns} turnos</p>
      </div></div>`;
    $('#back').onclick = () => { net.close(); titleScreen(); };
  };
  const net = new ClientNet(code, {
    onOpen() { setSt('Conectado. Entrando…'); net.send({ t: 'hello', name: prefs.name, charId: prefs.charId, ver: PROTOCOL }); },
    onError(e) {
      if (e.type === 'peer-unavailable') setSt('❌ No existe una sala con ese código (o el anfitrión la cerró).');
      else if (!ui) setSt('❌ Error de red: ' + (e.type || e.message));
    },
    onClose() { if (ui) { ui.tick('📴 Conexión perdida con el anfitrión.'); alert('Se perdió la conexión con el anfitrión.'); ui.dispose(); titleScreen(); } else if (joined) { alert('La sala se cerró.'); titleScreen(); } },
    onMessage(msg) {
      switch (msg.t) {
        case 'welcome': joined = true; break;
        case 'lobby': lobbyData = msg.lobby; renderLobby(); break;
        case 'full': setSt('❌ ' + msg.reason); net.close(); break;
        case 'kicked': alert('El anfitrión te quitó de la sala.'); net.close(); titleScreen(); break;
        case 'closed': if (!ui) { alert('El anfitrión cerró la sala.'); net.close(); titleScreen(); } break;
        case 'start':
          ui = new GameUI(msg.you, () => { net.close(); titleScreen(); });
          ui.onMyScore = (spec, score) => net.send({ t: 'score', key: spec.key, v: score });
          session = { dispose: () => { net.close(); ui.dispose(); } };
          break;
        case 'evt': ui?.handle(msg.e); break;
        case 'ask': ui?.prompt(msg.req).then((i) => net.send({ t: 'answer', id: msg.id, v: i })); break;
        case 'cancel': ui?.cancelPrompt(); break;
      }
    },
  });
  session = { dispose: () => net.close() };
}

// ================= Inicio =================
if (new URLSearchParams(location.search).get('sala')) profileScreen('join'); else titleScreen();
if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('contextmenu', (e) => e.preventDefault());
