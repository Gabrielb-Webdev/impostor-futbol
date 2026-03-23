// ============================================================
// gameState.js — Estado y lógica del juego del Impostor 412
// Todo en memoria RAM, sin base de datos
// ============================================================

const CATEGORIES = {
  'Ligas europeas': [
    'Champions League', 'Premier League', 'La Liga', 'Serie A',
    'Bundesliga', 'Ligue 1', 'Europa League', 'Eredivisie'
  ],
  'Jugadores históricos': [
    'Messi', 'Ronaldo', 'Zidane', 'Ronaldinho',
    'Maradona', 'Pelé', 'Cruyff', 'Beckham'
  ],
  'Selecciones': [
    'Argentina', 'Brasil', 'Francia', 'Alemania',
    'España', 'Italia', 'Inglaterra', 'Uruguay'
  ],
  'Mundiales': [
    'Qatar 2022', 'Rusia 2018', 'Brasil 2014', 'Sudáfrica 2010',
    'Alemania 2006', 'Corea-Japón 2002', 'Francia 1998', 'USA 1994'
  ]
};

/* ---------- Fases del juego ---------- */
const PHASES = {
  LOBBY: 'lobby',
  VOTE_CATEGORY: 'vote_category',
  ROLE_REVEAL: 'role_reveal',
  DEBATE: 'debate',
  VOTE_KICK: 'vote_kick',
  RESULT: 'result',
  GAME_OVER: 'game_over'
};

const CPU_NAMES = [
  'BotMessi', 'BotCR7', 'BotDiego', 'BotPelé', 'BotZidane',
  'BotRoni', 'BotBecks', 'BotCruyff', 'BotPuyol', 'BotRamos',
  'BotNeymar', 'BotMbappe', 'BotHiguaín', 'BotDiMa', 'BotAgüero'
];
let cpuCounter = 0;

/* ---------- Estado global ---------- */
let state = createFreshState();

function createFreshState() {
  return {
    phase: PHASES.LOBBY,
    players: {},            // { socketId: { id, name, alive, isImpostor, word, score, hasVotedCategory, hasVotedKick, voteTarget } }
    impostorCount: 1,
    round: 0,
    chosenCategory: null,
    chosenWord: null,
    categoryVotes: {},      // { categoryName: count }
    categoryOptions: [],    // string[] de 4 categorías
    kickVotes: {},          // { targetId: count }
    eliminatedThisRound: null,
    timer: null,
    timerSeconds: 0,
    timerRunning: false,
    roundHistory: [],
    customCategories: {},   // host puede agregar
    debateTime: 90,         // segundos para debate
    voteTime: 30            // segundos para votación
  };
}

/* ---------- Helpers ---------- */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getAllCategories() {
  return { ...CATEGORIES, ...state.customCategories };
}

function getAlivePlayers() {
  return Object.values(state.players).filter(p => p.alive);
}

function getPlayerList() {
  return Object.values(state.players).map(p => ({
    id: p.id,
    name: p.name,
    alive: p.alive,
    isBot: p.isBot || false,
    isImpostor: state.phase === PHASES.GAME_OVER || !p.alive ? p.isImpostor : undefined,
    score: p.score
  }));
}

function getPlayerListForOverlay() {
  return Object.values(state.players).map(p => ({
    id: p.id,
    name: p.name,
    alive: p.alive,
    isImpostor: p.isImpostor || false,
    word: p.word || null,
    score: p.score
  }));
}

/* ---------- Acciones ---------- */

function addPlayer(socketId, name) {
  if (state.phase !== PHASES.LOBBY) return { ok: false, error: 'El juego ya comenzó' };
  const trimmed = name.trim().substring(0, 20);
  if (!trimmed) return { ok: false, error: 'Nombre inválido' };
  const exists = Object.values(state.players).some(
    p => p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (exists) return { ok: false, error: 'Ese nombre ya está en uso' };

  state.players[socketId] = {
    id: socketId,
    name: trimmed,
    alive: true,
    isImpostor: false,
    isBot: false,
    word: null,
    score: 0,
    hasVotedCategory: false,
    hasVotedKick: false,
    voteTarget: null
  };
  return { ok: true };
}

function addBot() {
  if (state.phase !== PHASES.LOBBY) return { ok: false, error: 'El juego ya comenzó' };
  cpuCounter++;
  const usedNames = new Set(Object.values(state.players).map(p => p.name));
  let botName = CPU_NAMES.find(n => !usedNames.has(n)) || 'CPU_' + cpuCounter;
  const botId = 'bot_' + cpuCounter + '_' + Date.now();

  state.players[botId] = {
    id: botId,
    name: botName,
    alive: true,
    isImpostor: false,
    isBot: true,
    word: null,
    score: 0,
    hasVotedCategory: false,
    hasVotedKick: false,
    voteTarget: null
  };
  return { ok: true, name: botName };
}

function getBotPlayers() {
  return Object.values(state.players).filter(p => p.isBot);
}

function getAliveBots() {
  return Object.values(state.players).filter(p => p.isBot && p.alive);
}

function removePlayer(socketId) {
  delete state.players[socketId];
}

function setCategoryDirectly(categoryName) {
  const allCats = getAllCategories();
  if (!allCats[categoryName]) return false;
  state.chosenCategory = categoryName;
  return true;
}

function assignRoles() {
  state.round++;
  const allCats = getAllCategories();
  const words = allCats[state.chosenCategory] || [];
  state.chosenWord = words[Math.floor(Math.random() * words.length)];

  const alive = getAlivePlayers();
  const ids = shuffle(alive.map(p => p.id));
  const impostorIds = new Set(ids.slice(0, state.impostorCount));

  // Elegir una palabra falsa de otra categoría para el impostor
  const otherCats = Object.keys(allCats).filter(c => c !== state.chosenCategory);
  let impostorWord = 'IMPOSTOR';
  if (otherCats.length > 0) {
    const rndCat = otherCats[Math.floor(Math.random() * otherCats.length)];
    const rndWords = allCats[rndCat] || [];
    if (rndWords.length > 0) {
      impostorWord = rndWords[Math.floor(Math.random() * rndWords.length)];
    }
  }

  alive.forEach(p => {
    p.isImpostor = impostorIds.has(p.id);
    p.word = p.isImpostor ? impostorWord : state.chosenWord;
    p.hasVotedKick = false;
    p.voteTarget = null;
  });

  state.kickVotes = {};
  state.eliminatedThisRound = null;
  state.phase = PHASES.ROLE_REVEAL;
}

function startDebate() {
  state.phase = PHASES.DEBATE;
}

function startKickVote() {
  state.phase = PHASES.VOTE_KICK;
  state.kickVotes = {};
  const alive = getAlivePlayers();
  alive.forEach(p => {
    p.hasVotedKick = false;
    p.voteTarget = null;
  });
}

function voteKickPlayer(socketId, targetId) {
  const p = state.players[socketId];
  if (!p || !p.alive || p.hasVotedKick) return false;
  const target = state.players[targetId];
  if (!target || !target.alive) return false;
  if (socketId === targetId) return false;
  p.hasVotedKick = true;
  p.voteTarget = targetId;
  state.kickVotes[targetId] = (state.kickVotes[targetId] || 0) + 1;
  return true;
}

function allVotedKick() {
  return getAlivePlayers().every(p => p.hasVotedKick);
}

function resolveKick() {
  let maxVotes = 0;
  let targets = [];
  for (const [id, votes] of Object.entries(state.kickVotes)) {
    if (votes > maxVotes) { maxVotes = votes; targets = [id]; }
    else if (votes === maxVotes) targets.push(id);
  }
  const eliminatedId = targets[Math.floor(Math.random() * targets.length)];
  if (eliminatedId && state.players[eliminatedId]) {
    state.players[eliminatedId].alive = false;
    state.eliminatedThisRound = {
      id: eliminatedId,
      name: state.players[eliminatedId].name,
      wasImpostor: state.players[eliminatedId].isImpostor,
      votes: maxVotes
    };

    // Sumar puntos
    if (state.players[eliminatedId].isImpostor) {
      // Futbolistas ganan puntos por encontrarlo
      getAlivePlayers().forEach(p => {
        if (!p.isImpostor) p.score += 10;
      });
    } else {
      // Impostor gana puntos por engaño
      getAlivePlayers().forEach(p => {
        if (p.isImpostor) p.score += 15;
      });
    }
  }

  state.phase = PHASES.RESULT;

  // Guardar historial
  state.roundHistory.push({
    round: state.round,
    category: state.chosenCategory,
    word: state.chosenWord,
    eliminated: state.eliminatedThisRound
  });
}

function checkGameEnd() {
  const alive = getAlivePlayers();
  const impostorsAlive = alive.filter(p => p.isImpostor);
  const futbolistasAlive = alive.filter(p => !p.isImpostor);

  if (impostorsAlive.length === 0) {
    state.phase = PHASES.GAME_OVER;
    return { ended: true, winner: 'futbolistas', message: '¡Los futbolistas ganan! Todos los impostores fueron eliminados.' };
  }
  if (impostorsAlive.length >= futbolistasAlive.length) {
    state.phase = PHASES.GAME_OVER;
    return { ended: true, winner: 'impostors', message: '¡Los impostores ganan! Son mayoría.' };
  }
  return { ended: false };
}

function nextRound() {
  // Misma palabra y mismos roles — solo resetear votos para nueva ronda
  state.round++;
  state.kickVotes = {};
  state.eliminatedThisRound = null;
  const alive = getAlivePlayers();
  alive.forEach(p => {
    p.hasVotedKick = false;
    p.voteTarget = null;
  });
  // Ronda 2+ va directo a debate, sin role reveal
  state.phase = PHASES.DEBATE;
}

function resetGame() {
  const playersCopy = {};
  // Mantener jugadores pero resetear estado
  Object.entries(state.players).forEach(([id, p]) => {
    playersCopy[id] = {
      ...p,
      alive: true,
      isImpostor: false,
      word: null,
      score: 0,
      hasVotedCategory: false,
      hasVotedKick: false,
      voteTarget: null
    };
  });
  const customCats = { ...state.customCategories };
  const impCount = state.impostorCount;
  state = createFreshState();
  state.players = playersCopy;
  state.customCategories = customCats;
  state.impostorCount = impCount;
}

function fullReset() {
  state = createFreshState();
}

function setImpostorCount(n) {
  state.impostorCount = Math.max(1, Math.min(2, n));
}

function addCustomCategory(name, words) {
  if (!name || !words || words.length < 4) return false;
  state.customCategories[name] = words;
  return true;
}

function setDebateTime(seconds) {
  state.debateTime = Math.max(10, Math.min(300, seconds));
}

function setVoteTime(seconds) {
  state.voteTime = Math.max(10, Math.min(120, seconds));
}

function getState() {
  return state;
}

module.exports = {
  PHASES,
  getState,
  getPlayerList,
  getPlayerListForOverlay,
  getAlivePlayers,
  getAllCategories,
  addPlayer,
  removePlayer,
  setCategoryDirectly,
  assignRoles,
  startDebate,
  startKickVote,
  voteKickPlayer,
  allVotedKick,
  resolveKick,
  checkGameEnd,
  nextRound,
  resetGame,
  fullReset,
  setImpostorCount,
  addCustomCategory,
  setDebateTime,
  setVoteTime,
  addBot,
  getBotPlayers,
  getAliveBots
};
