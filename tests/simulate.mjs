import { Game } from '../www/js/engine.js';
import { BOARD_DEFS, getBoard } from '../www/js/boards.js';
import { botChoose } from '../www/js/ai.js';
import { botScore } from '../www/js/mgmeta.js';
import { CHARACTERS } from '../www/js/data.js';
import { mulberry32 } from '../www/js/util.js';

const runs = +(process.argv[2] || 3);
let totalStars = 0, games = 0;
const modes = {};
for (const def of BOARD_DEFS) {
  const b = getBoard(def.id);
  const types = {}; b.spaces.forEach(s => types[s.type] = (types[s.type]||0)+1);
  console.log(`\n${def.name}: ${b.spaces.length} casillas, ramas=${b.branchInfo.length}`, JSON.stringify(types));
  for (let r = 0; r < runs; r++) {
    const rng = mulberry32(r * 977 + def.id.length);
    const io = {
      emit(e) { if (e.type === 'mgResult' && e.spec.mode !== 'duel') modes[e.spec.mode] = (modes[e.spec.mode]||0)+1; },
      async ask(p, req, g) { const i = botChoose(g, p, req); if (req.options[i]?.disabled) throw new Error('bot chose disabled '+req.tag); return i; },
      async minigame(spec, g) { return spec.participants.map(p => botScore(spec.gameId, g.s.players[p].level, rng)); },
      sleep: async () => {},
    };
    const g = new Game({ boardId: def.id, turns: 20, rng, players: CHARACTERS.slice(0, 6).map((c, i) => ({ charId: c.id, kind: 'bot', level: i % 3 })) }, io);
    const res = await g.run();
    const st = g.s.players.map(p => `${p.emoji}${p.stars}⭐${p.coins}`).join(' ');
    totalStars += g.s.players.reduce((s,p)=>s+p.stars,0); games++;
    console.log('  ', st);
  }
}
console.log('\nPromedio estrellas totales/partida:', (totalStars/games).toFixed(1), 'modos:', modes);
