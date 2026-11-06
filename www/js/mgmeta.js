// Metadatos de los 30 minijuegos (sin DOM). bot = puntuación media [fácil, normal, difícil]
export const MG_META = [
  // ---- Todos contra todos ----
  { id: 'tap', mode: 'ffa', icon: '👆', name: 'Machacabotones', desc: '¡Toca el botón gigante tantas veces como puedas!', controls: 'Toca rápido', bot: [38, 52, 64] },
  { id: 'reflex', mode: 'ffa', icon: '⚡', name: 'Reflejo Relámpago', desc: 'Cuando la pantalla se ponga VERDE, toca lo más rápido posible. 3 rondas. ¡No te adelantes!', controls: 'Toca al ver verde', bot: [1650, 1950, 2200] },
  { id: 'simon', mode: 'ffa', icon: '🎵', name: 'Memoria de Colores', desc: 'Repite la secuencia de colores. Cada ronda es más larga.', controls: 'Toca los colores en orden', bot: [4, 6, 8] },
  { id: 'catch', mode: 'ffa', icon: '🧺', name: 'Atrapa Estrellas', desc: 'Mueve la canasta para atrapar estrellas ⭐ (+1). ¡Evita las bombas 💣 (−2)!', controls: 'Arrastra a izquierda/derecha', bot: [14, 20, 26] },
  { id: 'dodge', mode: 'ffa', icon: '☄️', name: 'Esquiva Meteoritos', desc: 'Sobrevive a la lluvia de meteoritos. Tienes 3 vidas.', controls: 'Arrastra para moverte', bot: [110, 170, 230] },
  { id: 'math', mode: 'ffa', icon: '🧮', name: 'Cálculo Veloz', desc: 'Resuelve las operaciones. Correcta +1, incorrecta −1.', controls: 'Toca la respuesta', bot: [6, 9, 12] },
  { id: 'timer', mode: 'ffa', icon: '⏱️', name: 'Detén el Reloj', desc: 'Detén el cronómetro exactamente en 7.00 s. ¡El reloj se esconde a los 3 s!', controls: 'Toca para detener', bot: [55, 72, 85] },
  { id: 'balloons', mode: 'ffa', icon: '🎈', name: 'Revienta Globos', desc: 'Revienta globos: normal +1, dorado +3. ¡Los negros 💣 restan 3!', controls: 'Toca los globos', bot: [18, 27, 36] },
  { id: 'jump', mode: 'ffa', icon: '🦘', name: 'Salto Imparable', desc: 'Corre y salta los obstáculos. Un choque y se acabó.', controls: 'Toca para saltar', bot: [7, 11, 16] },
  { id: 'pairs', mode: 'ffa', icon: '🃏', name: 'Parejas Locas', desc: 'Encuentra todas las parejas de cartas lo más rápido posible.', controls: 'Toca dos cartas', bot: [45, 70, 95] },
  // ---- Por equipos ----
  { id: 'tug', mode: 'team', icon: '🪢', name: 'Tira y Afloja', desc: 'Toca cuando el marcador esté en VERDE para un tirón fuerte (+3). Amarillo +1, rojo −1.', controls: 'Toca en el momento justo', bot: [22, 32, 42] },
  { id: 'tower', mode: 'team', icon: '🏗️', name: 'Torre Altísima', desc: 'Suelta cada bloque justo encima del anterior. Lo que sobresale se cae.', controls: 'Toca para soltar', bot: [8, 12, 17] },
  { id: 'row', mode: 'team', icon: '🚣', name: 'Carrera de Remos', desc: 'Alterna IZQUIERDA y DERECHA para remar. Repetir el mismo lado no cuenta.', controls: 'Alterna botones', bot: [50, 66, 82] },
  { id: 'moles', mode: 'team', icon: '🐹', name: 'Golpea Topos', desc: 'Golpea los topos que salen (+1). El topo dorado vale +3. ¡No golpees las bombas!', controls: 'Toca los topos', bot: [16, 23, 30] },
  { id: 'order', mode: 'team', icon: '🔢', name: 'Números en Orden', desc: 'Toca los números del 1 al 16 en orden. Al terminar sale otra cuadrícula.', controls: 'Toca en orden', bot: [20, 30, 40] },
  { id: 'shoot', mode: 'team', icon: '🎯', name: 'Tiro al Blanco', desc: 'Dispara a las dianas que pasan. Las pequeñas valen más.', controls: 'Toca las dianas', bot: [18, 26, 34] },
  { id: 'balance', mode: 'team', icon: '⚖️', name: 'Equilibrista', desc: 'Mantén la pelota en el centro de la tabla. El viento sopla. Puntos por cada instante en la zona verde.', controls: 'Mantén izquierda/derecha', bot: [90, 130, 165] },
  { id: 'coins', mode: 'team', icon: '🪙', name: 'Cosecha de Monedas', desc: 'Recoge monedas por la arena. Los erizos te quitan 3.', controls: 'Toca/arrastra hacia dónde ir', bot: [12, 18, 24] },
  { id: 'rhythm', mode: 'team', icon: '🥁', name: 'Ritmo Tropical', desc: 'Toca el carril cuando la nota llegue a la línea. Perfecto +2, bien +1.', controls: 'Toca los 3 carriles', bot: [20, 32, 44] },
  { id: 'sort', mode: 'team', icon: '📦', name: 'Clasificador', desc: 'Manda los objetos ROJOS a la izquierda y los AZULES a la derecha. Error −2.', controls: 'Toca izquierda/derecha', bot: [15, 22, 30] },
  // ---- Uno contra todos ----
  { id: 'siege', mode: 'solo', icon: '🏰', name: 'Asedio al Castillo', desc: 'Toca los puntos que aparecen en la muralla antes de que desaparezcan.', soloText: 'Eres el DEFENSOR: repara las grietas.', groupText: 'Son los ATACANTES: golpeen los puntos débiles.', controls: 'Toca los puntos', bot: [18, 26, 34] },
  { id: 'maze', mode: 'solo', icon: '🌀', name: 'Laberinto Veloz', desc: 'Sal de tantos laberintos como puedas.', soloText: 'Eres el FUGITIVO: ¡escapa!', groupText: 'Son los PERSEGUIDORES: ¡atraviesen el laberinto antes!', controls: 'Flechas en pantalla o deslizar', bot: [14, 24, 34] },
  { id: 'sniper', mode: 'solo', icon: '🔭', name: 'Ojo de Halcón', desc: 'Toca a los bandidos 🦹 antes de que se escondan. ¡No toques a los aldeanos 🧑‍🌾 (−2)!', soloText: 'Eres el SHERIFF solitario.', groupText: 'Son la PATRULLA.', controls: 'Toca rápido', bot: [13, 19, 25] },
  { id: 'lanes', mode: 'solo', icon: '🏎️', name: 'Carril Veloz', desc: 'Cambia de carril para esquivar obstáculos y recoge combustible ⛽.', soloText: 'Eres el piloto FUGITIVO.', groupText: 'Son la caravana PERSEGUIDORA.', controls: 'Toca izquierda/derecha', bot: [120, 180, 240] },
  { id: 'bridge', mode: 'solo', icon: '🌉', name: 'Puente de Cristal', desc: 'Memoriza el camino seguro y crúzalo. Si pisas cristal falso caes y lo ves de nuevo.', soloText: 'Eres el EXPLORADOR.', groupText: 'Son los RIVALES del explorador.', controls: 'Toca izquierda/derecha', bot: [5, 8, 11] },
  { id: 'arrows', mode: 'solo', icon: '⬆️', name: 'Flechas Locas', desc: 'Toca la dirección de la flecha. Si es ROJA, ¡toca la dirección contraria!', soloText: 'Eres el DIRECTOR de orquesta.', groupText: 'Son la orquesta.', controls: '4 botones', bot: [15, 22, 30] },
  { id: 'fishing', mode: 'solo', icon: '🎣', name: 'Gran Pesca', desc: 'Mantén pulsado para subir la barra y mantén el pez dentro de ella hasta llenar el medidor.', soloText: 'Eres el PESCADOR legendario.', groupText: 'Son la flota pesquera.', controls: 'Mantén pulsado', bot: [28, 40, 54] },
  { id: 'redlight', mode: 'solo', icon: '🚦', name: 'Luz Verde, Luz Roja', desc: 'Mantén pulsado para avanzar con luz VERDE. Si te mueves con luz ROJA, vuelves atrás.', soloText: 'Eres el CORREDOR solitario.', groupText: 'Son la manada de corredores.', controls: 'Mantén y suelta', bot: [80, 104, 120] },
  { id: 'count', mode: 'solo', icon: '🐑', name: 'Cuenta Ovejas', desc: 'Cuenta cuántas ovejas 🐑 cruzan (¡no cuentes las cabras 🐐!). 2 rondas.', soloText: 'Eres el PASTOR.', groupText: 'Son los granjeros vecinos.', controls: 'Elige el número', bot: [80, 120, 160] },
  { id: 'needle', mode: 'solo', icon: '🎯', name: 'Aguja de Precisión', desc: 'Detén la aguja giratoria dentro de la zona dorada. 5 intentos, cada vez más rápida.', soloText: 'Eres el RELOJERO maestro.', groupText: 'Son los aprendices.', controls: 'Toca para detener', bot: [260, 340, 410] },
];
export const mgById = (id) => MG_META.find((m) => m.id === id);

export function pickMinigame(mode, recent = [], rng = Math.random) {
  const pool = MG_META.filter((m) => m.mode === mode);
  let fresh = pool.filter((m) => !recent.includes(m.id));
  if (!fresh.length) fresh = pool;
  return fresh[Math.floor(rng() * fresh.length)].id;
}

export function botScore(id, level = 1, rng = Math.random) {
  const m = mgById(id);
  const mean = m.bot[Math.max(0, Math.min(2, level))];
  return Math.max(0, Math.round(mean * (0.75 + rng() * 0.5)));
}
