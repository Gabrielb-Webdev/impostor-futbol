// ============================================================
// socketHandler.js — Manejo de eventos Socket.io
// ============================================================

const game = require('./gameState');
const { PHASES } = game;

let timerInterval = null;

function clearGameTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer(io, seconds, onComplete) {
  clearGameTimer();
  const st = game.getState();
  st.timerSeconds = seconds;
  st.timerRunning = true;
  io.emit('timer:update', { seconds: st.timerSeconds });

  timerInterval = setInterval(() => {
    st.timerSeconds--;
    io.emit('timer:update', { seconds: st.timerSeconds });
    if (st.timerSeconds <= 0) {
      clearGameTimer();
      st.timerRunning = false;
      if (onComplete) onComplete();
    }
  }, 1000);
}

function broadcastState(io) {
  const st = game.getState();
  io.emit('game:state', {
    phase: st.phase,
    players: game.getPlayerList(),
    round: st.round,
    chosenCategory: st.chosenCategory,
    categoryOptions: st.categoryOptions,
    categoryVotes: st.categoryVotes,
    eliminatedThisRound: st.eliminatedThisRound,
    timerSeconds: st.timerSeconds,
    impostorCount: st.impostorCount,
    debateTime: st.debateTime,
    voteTime: st.voteTime
  });
}

function broadcastOverlay(io) {
  const st = game.getState();
  io.to('overlay').emit('overlay:state', {
    phase: st.phase,
    players: game.getPlayerListForOverlay(),
    round: st.round,
    chosenCategory: st.chosenCategory,
    eliminatedThisRound: st.eliminatedThisRound,
    timerSeconds: st.timerSeconds
  });
}

function broadcastAll(io) {
  broadcastState(io);
  broadcastOverlay(io);
}

module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log(`[Conectado] ${socket.id}`);

    // ----- Unirse a sala de overlay -----
    socket.on('overlay:join', () => {
      socket.join('overlay');
      broadcastOverlay(io);
    });

    // ----- Unirse a sala de host -----
    socket.on('host:join', () => {
      socket.join('host');
      broadcastAll(io);
      // Enviar categorías personalizadas
      io.to('host').emit('host:categories', game.getAllCategories());
      io.to('host').emit('host:history', game.getState().roundHistory);
    });

    // ----- Jugador se une -----
    socket.on('player:join', (name) => {
      const result = game.addPlayer(socket.id, name);
      if (result.ok) {
        socket.emit('player:joined', { id: socket.id, name: name.trim().substring(0, 20) });
        broadcastAll(io);
      } else {
        socket.emit('player:error', result.error);
      }
    });

    // ----- HOST: Iniciar juego (admin elige categoría) -----
    socket.on('host:startGame', (category) => {
      const st = game.getState();
      const playerCount = Object.keys(st.players).length;
      if (playerCount < 3) {
        socket.emit('host:error', 'Se necesitan al menos 3 jugadores');
        return;
      }
      if (!category) {
        socket.emit('host:error', 'Seleccioná una categoría');
        return;
      }
      const ok = game.setCategoryDirectly(category);
      if (!ok) {
        socket.emit('host:error', 'Categoría inválida');
        return;
      }
      game.assignRoles();
      broadcastAll(io);
      sendRolesToPlayers(io);
      // Después del role reveal (5s), ir a debate
      setTimeout(() => {
        game.startDebate();
        broadcastAll(io);
        startTimer(io, game.getState().debateTime, () => {
          game.startKickVote();
          broadcastAll(io);
          setTimeout(() => { botsVoteKick(); broadcastAll(io); if (game.allVotedKick()) { clearGameTimer(); autoResolveKick(io); } }, 1500);
          startTimer(io, game.getState().voteTime, () => { autoResolveKick(io); });
        });
      }, 5000);
    });

    // ----- HOST: Forzar avanzar fase -----
    socket.on('host:nextPhase', () => {
      const st = game.getState();
      clearGameTimer();

      switch (st.phase) {
        case PHASES.ROLE_REVEAL:
          game.startDebate();
          broadcastAll(io);
          startTimer(io, st.debateTime, () => {
            game.startKickVote();
            broadcastAll(io);
            setTimeout(() => { botsVoteKick(); broadcastAll(io); if (game.allVotedKick()) { clearGameTimer(); autoResolveKick(io); } }, 1500);
            startTimer(io, st.voteTime, () => { autoResolveKick(io); });
          });
          break;

        case PHASES.DEBATE:
          game.startKickVote();
          broadcastAll(io);
          setTimeout(() => { botsVoteKick(); broadcastAll(io); if (game.allVotedKick()) { clearGameTimer(); autoResolveKick(io); } }, 1500);
          startTimer(io, st.voteTime, () => { autoResolveKick(io); });
          break;

        case PHASES.VOTE_KICK:
          autoResolveKick(io);
          break;

        case PHASES.RESULT:
          const endCheck = game.checkGameEnd();
          if (endCheck.ended) {
            broadcastAll(io);
            io.emit('game:over', endCheck);
          } else {
            game.nextRound();
            broadcastAll(io);
            // Ronda 2+: va directo a debate, sin role reveal
            startTimer(io, st.debateTime, () => {
              game.startKickVote();
              broadcastAll(io);
              setTimeout(() => { botsVoteKick(); broadcastAll(io); if (game.allVotedKick()) { clearGameTimer(); autoResolveKick(io); } }, 1500);
              startTimer(io, st.voteTime, () => { autoResolveKick(io); });
            });
          }
          break;

        case PHASES.GAME_OVER:
          game.resetGame();
          broadcastAll(io);
          io.to('host').emit('host:history', game.getState().roundHistory);
          break;
      }
    });

    // ----- Jugador vota expulsión -----
    socket.on('player:voteKick', (targetId) => {
      const voted = game.voteKickPlayer(socket.id, targetId);
      if (voted) {
        broadcastAll(io);
        if (game.allVotedKick()) {
          clearGameTimer();
          autoResolveKick(io);
        }
      }
    });

    // ----- HOST: Remover CPU -----
    socket.on('host:removeCpu', () => {
      const bots = game.getBotPlayers();
      if (bots.length > 0) {
        const lastBot = bots[bots.length - 1];
        game.removePlayer(lastBot.id);
        broadcastAll(io);
      }
    });

    // ----- HOST: Agregar CPU / Bot -----
    socket.on('host:addCpu', () => {
      const result = game.addBot();
      if (result.ok) {
        broadcastAll(io);
        socket.emit('host:cpuAdded', result.name);
      } else {
        socket.emit('host:error', result.error);
      }
    });

    // ----- HOST: Configurar impostores -----
    socket.on('host:setImpostors', (count) => {
      game.setImpostorCount(count);
      broadcastAll(io);
    });

    // ----- HOST: Agregar categoría personalizada -----
    socket.on('host:addCategory', ({ name, words }) => {
      const ok = game.addCustomCategory(name, words);
      if (ok) {
        io.to('host').emit('host:categories', game.getAllCategories());
        socket.emit('host:categoryAdded', name);
      } else {
        socket.emit('host:error', 'Categoría inválida (necesita nombre y al menos 4 palabras)');
      }
    });

    // ----- HOST: Configurar tiempos -----
    socket.on('host:setDebateTime', (seconds) => {
      game.setDebateTime(seconds);
      broadcastAll(io);
    });

    socket.on('host:setVoteTime', (seconds) => {
      game.setVoteTime(seconds);
      broadcastAll(io);
    });

    // ----- HOST: Reset completo -----
    socket.on('host:fullReset', () => {
      clearGameTimer();
      game.fullReset();
      broadcastAll(io);
      io.emit('game:reset');
    });

    // ----- Desconexión -----
    socket.on('disconnect', () => {
      console.log(`[Desconectado] ${socket.id}`);
      const st = game.getState();
      if (st.players[socket.id]) {
        if (st.phase === PHASES.LOBBY) {
          game.removePlayer(socket.id);
        } else {
          // Durante el juego, marcar como muerto
          st.players[socket.id].alive = false;
        }
        broadcastAll(io);
      }
    });
  });
};

/* ----- Helpers internos ----- */

function sendRolesToPlayers(io) {
  const st = game.getState();
  Object.values(st.players).forEach(p => {
    if (!p.isBot) {
      io.to(p.id).emit('player:role', {
        isImpostor: p.isImpostor,
        word: p.word,
        category: st.chosenCategory
      });
    }
  });
}

function botsVoteKick() {
  const aliveBots = game.getAliveBots();
  const alive = game.getAlivePlayers();
  aliveBots.forEach(bot => {
    if (!bot.hasVotedKick) {
      // Elegir un jugador vivo al azar (que no sea el propio bot)
      const targets = alive.filter(p => p.id !== bot.id);
      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        game.voteKickPlayer(bot.id, target.id);
      }
    }
  });
}

function autoResolveKick(io) {
  game.resolveKick();
  broadcastAll(io);
  io.to('host').emit('host:history', game.getState().roundHistory);

  // Enviar evento de eliminación dramático
  const st = game.getState();
  if (st.eliminatedThisRound) {
    io.emit('game:elimination', st.eliminatedThisRound);
  }

  // Verificar fin de juego después de 5 seg
  setTimeout(() => {
    const endCheck = game.checkGameEnd();
    if (endCheck.ended) {
      broadcastAll(io);
      io.emit('game:over', endCheck);
    }
  }, 5000);
}
