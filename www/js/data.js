// Datos del juego: personajes, objetos, casillas
export const CHARACTERS = [
  { id: 'zorro', name: 'Rufo', emoji: '🦊', color: '#ff7a1a' },
  { id: 'rana', name: 'Pepa', emoji: '🐸', color: '#3ccf4e' },
  { id: 'panda', name: 'Tito', emoji: '🐼', color: '#8a8f99' },
  { id: 'pulpo', name: 'Ola', emoji: '🐙', color: '#e0447c' },
  { id: 'leon', name: 'Max', emoji: '🦁', color: '#f2b61f' },
  { id: 'pinguino', name: 'Nico', emoji: '🐧', color: '#2f7fe0' },
  { id: 'conejo', name: 'Lila', emoji: '🐰', color: '#b06ce6' },
  { id: 'dragon', name: 'Draco', emoji: '🐲', color: '#11a39a' },
  { id: 'gato', name: 'Mishi', emoji: '🐱', color: '#e05a3a' },
  { id: 'robot', name: 'Bit', emoji: '🤖', color: '#5b6ee1' },
];
export const charById = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

// Objetos. price = precio en tienda, w = peso en casillas de objeto
export const ITEMS = {
  dado2:   { name: 'Dado Doble',        icon: '🎲', price: 6,  w: 10, desc: 'Tira dos dados (2–20).' },
  dado3:   { name: 'Dado Triple',       icon: '🎰', price: 12, w: 5,  desc: 'Tira tres dados (3–30).' },
  dadoM:   { name: 'Dado Mágico',       icon: '🔮', price: 9,  w: 7,  desc: 'Eliges el número exacto (1–10).' },
  dadoC:   { name: 'Dado Codicioso',    icon: '💰', price: 5,  w: 9,  desc: 'Tira normal y ganas tantas monedas como el resultado.' },
  dadoL:   { name: 'Dado Tortuga',      icon: '🐢', price: 3,  w: 6,  desc: 'Tira 1–3. Ideal para caer donde quieres.' },
  portal:  { name: 'Portal de Cambio',  icon: '🌀', price: 10, w: 5,  desc: 'Intercambias lugar con un rival al azar.' },
  ladron:  { name: 'Guante Ladrón',     icon: '🧤', price: 12, w: 6,  desc: 'Robas 5–15 monedas al rival que elijas.' },
  silbato: { name: 'Silbato Estelar',   icon: '📯', price: 14, w: 4,  desc: 'La estrella se muda a otro lugar.' },
  escudo:  { name: 'Escudo',            icon: '🛡️', price: 6,  w: 6,  desc: 'Pasivo: bloquea el siguiente robo, trampa o desgracia.' },
  trampa:  { name: 'Trampa de Monedas', icon: '🪤', price: 8,  w: 6,  desc: 'La colocas aquí: quien caiga te paga 10 monedas.' },
  llave:   { name: 'Llave Maestra',     icon: '🗝️', price: 5,  w: 6,  desc: 'Pasivo: abre portones y peajes gratis.' },
  iman:    { name: 'Imán de Monedas',   icon: '🧲', price: 7,  w: 6,  desc: 'Este turno, cada rival que adelantes te da 3 monedas.' },
  brujula: { name: 'Brújula Estelar',   icon: '🧭', price: 28, w: 1,  desc: 'Te teletransporta junto a la estrella.' },
};
export const ITEM_IDS = Object.keys(ITEMS);
export const MAX_ITEMS = 3;

// Tipos de casilla. step:false = no consume paso (se activa al pasar)
export const SPACE_TYPES = {
  start:  { name: 'Salida',     color: '#ffffff', icon: '🏁', step: false },
  blue:   { name: 'Azul',       color: '#2f7fe0', icon: '+3', step: true },
  red:    { name: 'Roja',       color: '#e0393e', icon: '−3', step: true },
  lucky:  { name: 'Suerte',     color: '#30c46b', icon: '🍀', step: true },
  bad:    { name: 'Desgracia',  color: '#5a2d82', icon: '💀', step: true },
  item:   { name: 'Objeto',     color: '#f2b61f', icon: '🎁', step: true },
  event:  { name: 'Evento',     color: '#11b5a4', icon: '❗', step: true },
  vs:     { name: 'Duelo',      color: '#ff5e00', icon: '⚔️', step: true },
  warp:   { name: 'Teletransporte', color: '#c03bd6', icon: '🌀', step: true },
  shop:   { name: 'Tienda',     color: '#ffb3d1', icon: '🛒', step: false },
  bank:   { name: 'Banco',      color: '#ffe066', icon: '🏦', step: true },
  gate:   { name: 'Peaje',      color: '#9aa3ad', icon: '🚧', step: false },
};

export const STAR_PRICE = 20;
export const MODE_NAMES = { ffa: 'Todos contra todos', team: 'Por equipos', solo: 'Uno contra todos', duel: 'Duelo' };
