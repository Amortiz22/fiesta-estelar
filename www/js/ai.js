// Decisiones de los bots. Devuelve el índice de opción elegido.
import { STAR_PRICE } from './data.js';

export function botChoose(g, p, req) {
  const pl = g.s.players[p];
  const lvl = pl.level ?? 1;
  const opts = req.options;
  const enabled = opts.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const idxOf = (pred) => { const i = opts.findIndex((o, k) => !o.disabled && pred(o, k)); return i; };
  const sloppy = lvl === 0 ? 0.35 : lvl === 1 ? 0.12 : 0.02;
  const randomPick = () => enabled[Math.floor(g.rng() * enabled.length)];
  const dStar = g.distToStar(pl.pos);
  const others = g.s.players.map((_, i) => i).filter((i) => i !== p);

  switch (req.tag) {
    case 'roll': return 0;
    case 'item': {
      const has = (id) => idxOf((o) => o.item === id);
      const pass = opts.length - 1;
      if (g.rng() < sloppy) return pass;
      const canBuy = pl.coins >= STAR_PRICE - 5;
      if (has('brujula') >= 0 && pl.coins >= STAR_PRICE && dStar > 6) return has('brujula');
      if (has('dadoM') >= 0 && dStar >= 1 && dStar <= 10 && canBuy) return has('dadoM');
      if (has('dado3') >= 0 && dStar > 14 && canBuy) return has('dado3');
      if (has('dado2') >= 0 && dStar > 8 && canBuy) return has('dado2');
      if (has('ladron') >= 0 && others.some((i) => g.s.players[i].coins >= 15)) return has('ladron');
      if (has('silbato') >= 0 && dStar > 20 && others.some((i) => g.distToStar(g.s.players[i].pos) < 8)) return has('silbato');
      if (has('portal') >= 0 && others.some((i) => g.distToStar(g.s.players[i].pos) + 8 < dStar)) return has('portal');
      if (has('dadoC') >= 0) return has('dadoC');
      if (has('iman') >= 0 && g.rng() < 0.5) return has('iman');
      if (has('trampa') >= 0 && g.rng() < 0.4) return has('trampa');
      if (pl.items.length >= 3) { const any = idxOf((o) => o.item && o.item !== 'brujula'); if (any >= 0) return any; }
      return pass;
    }
    case 'magic': {
      const want = Math.max(1, Math.min(10, dStar + 1));
      return want - 1;
    }
    case 'fork': {
      if (g.rng() < sloppy) return randomPick();
      let best = enabled[0], bd = Infinity;
      for (const i of enabled) { const d = opts[i].dist + (opts[i].label.includes('peaje') ? 3 : 0); if (d < bd) { bd = d; best = i; } }
      return best;
    }
    case 'star': return 0;
    case 'shop': {
      const reserve = dStar < 15 ? STAR_PRICE : 8;
      const prefs = ['dadoM', 'dado3', 'brujula', 'dado2', 'escudo', 'ladron', 'dadoC', 'llave', 'iman', 'trampa', 'portal', 'silbato', 'dadoL'];
      if (g.rng() < sloppy) return opts.length - 1;
      for (const id of prefs) {
        const i = idxOf((o) => o.value === id);
        if (i >= 0) {
          const price = +opts[i].label.match(/(\d+)🪙/)[1];
          if (pl.coins - price >= reserve || (id === 'brujula' && pl.coins >= price)) return i;
        }
      }
      return opts.length - 1;
    }
    case 'target': {
      // al más rico (en monedas o estrellas) o al líder
      let best = enabled[0], bv = -1;
      for (const i of enabled) {
        const t = g.s.players[opts[i].value];
        const v = req.kind === 'stars' ? t.stars * 100 + t.coins : req.kind === 'duel' ? t.coins + t.stars * 10 : t.coins;
        if (v > bv) { bv = v; best = i; }
      }
      return g.rng() < sloppy ? randomPick() : best;
    }
    case 'wager': {
      const i = idxOf((o) => o.value === 10);
      return i >= 0 ? i : 0;
    }
    case 'taxi': return dStar > 12 ? 0 : 1;
    case 'specter': {
      const st = idxOf((o) => o.value === 'star');
      if (st >= 0 && others.some((i) => g.s.players[i].stars > 0)) return st;
      const c = idxOf((o) => o.value === 'coins');
      if (c >= 0 && others.some((i) => g.s.players[i].coins >= 12)) return c;
      return opts.length - 1;
    }
    default: return enabled[0] ?? 0;
  }
}
