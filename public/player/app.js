// ============================================================
// Player App — Impostor 412
// ============================================================
(function () {
  const socket = io();

  let myId = null;
  let myName = '';
  let myRole = null;
  let hasVotedKick = false;

  // DOM refs
  const screens = document.querySelectorAll('.screen');
  const inputName = document.getElementById('input-name');
  const btnJoin = document.getElementById('btn-join');
  const joinError = document.getElementById('join-error');
  const lobbyName = document.getElementById('lobby-player-name');
  const lobbyCount = document.getElementById('lobby-count');
  const roleSuspense = document.getElementById('role-suspense');
  const roleReveal = document.getElementById('role-reveal');
  const roleCard = document.getElementById('role-card');
  const roleCategory = document.getElementById('role-category');
  const roleTitle = document.getElementById('role-title');
  const roleWord = document.getElementById('role-word');
  const debateTimer = document.getElementById('debate-timer');
  const debateWordReminder = document.getElementById('debate-word-reminder');
  const kickTimer = document.getElementById('kick-timer');
  const kickPlayers = document.getElementById('kick-players');
  const kickStatus = document.getElementById('kick-status');
  const resultContent = document.getElementById('result-content');
  const gameoverContent = document.getElementById('gameover-content');

  function showScreen(id) {
    screens.forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + id);
    if (el) {
      el.classList.add('active');
      // Re-trigger animation
      el.style.animation = 'none';
      el.offsetHeight; // reflow
      el.style.animation = '';
    }
  }

  // ----- JOIN -----
  btnJoin.addEventListener('click', () => {
    const name = inputName.value.trim();
    if (!name) {
      joinError.textContent = 'Escribí tu nombre';
      return;
    }
    joinError.textContent = '';
    socket.emit('player:join', name);
  });

  inputName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnJoin.click();
  });

  socket.on('player:joined', (data) => {
    myId = data.id;
    myName = data.name;
    lobbyName.textContent = myName;
    showScreen('lobby');
  });

  socket.on('player:error', (msg) => {
    joinError.textContent = msg;
  });

  // ----- GAME STATE -----
  socket.on('game:state', (state) => {
    const playerCount = state.players ? state.players.length : 0;
    lobbyCount.textContent = playerCount;

    if (!myId) return;

    switch (state.phase) {
      case 'lobby':
        if (document.getElementById('screen-lobby').classList.contains('active') ||
            document.getElementById('screen-join').classList.contains('active')) {
          // Stay on current screen
        }
        break;

      case 'role_reveal':
        // Handled by player:role event
        break;

      case 'debate':
        hasVotedKick = false;
        if (isEliminated(state.players)) {
          showSpectator(state, 'DEBATE');
        } else {
          showScreen('debate');
          if (myRole) {
            if (myRole.isImpostor) {
              debateWordReminder.innerHTML = '🕵️ <strong style="color:var(--red)">SOS EL IMPOSTOR</strong> — Disimulá y descubrí la palabra';
            } else {
              debateWordReminder.innerHTML = 'Tu palabra: <strong>' + escapeHtml(myRole.word) + '</strong>';
            }
          }
        }
        break;

      case 'vote_kick':
        if (isEliminated(state.players)) {
          showSpectator(state, 'VOTACIÓN');
        } else if (!hasVotedKick) {
          showScreen('vote-kick');
          renderKickButtons(state.players);
          kickStatus.textContent = '';
        }
        break;

      case 'result':
        showScreen('result');
        renderResult(state.eliminatedThisRound);
        break;

      case 'game_over':
        // Handled by game:over event
        break;
    }
  });

  // ----- ROLE -----
  socket.on('player:role', (role) => {
    myRole = role;
    hasVotedKick = false;
    showScreen('role');
    roleSuspense.classList.remove('hidden');
    roleReveal.classList.add('hidden');

    setTimeout(() => {
      roleSuspense.classList.add('hidden');
      roleReveal.classList.remove('hidden');

      roleCategory.textContent = role.category;

      if (role.isImpostor) {
        roleCard.className = 'role-card impostor';
        roleTitle.textContent = '🕵️ SOS EL IMPOSTOR';
        roleWord.textContent = 'Descubrí la palabra secreta';
        // Vibrar si está disponible
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      } else {
        roleCard.className = 'role-card';
        roleTitle.textContent = 'TU PALABRA';
        roleWord.textContent = role.word;
      }
    }, 3000);
  });

  // ----- TIMER -----
  socket.on('timer:update', (data) => {
    debateTimer.textContent = data.seconds;
    kickTimer.textContent = data.seconds;

    // Warning visual cuando quedan 10 seg
    const circles = document.querySelectorAll('.timer-circle');
    circles.forEach(c => {
      if (data.seconds <= 10) c.classList.add('warning');
      else c.classList.remove('warning');
    });
  });

  // ----- SPECTATOR (eliminado) -----
  function isEliminated(players) {
    if (!players || !myId) return false;
    const me = players.find(p => p.id === myId);
    return me && !me.alive;
  }

  function showSpectator(state, phaseLabel) {
    showScreen('spectator');
    document.getElementById('spectator-phase').textContent = '📡 ' + phaseLabel;
    document.getElementById('spectator-round').textContent = 'Ronda ' + (state.round || 1);
  }

  // ----- KICK VOTE -----
  function renderKickButtons(players) {
    kickPlayers.innerHTML = '';
    if (!players) return;
    players.filter(p => p.alive && p.id !== myId).forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'kick-btn';
      btn.innerHTML = '<span class="player-icon">👤</span>' + escapeHtml(p.name);
      btn.addEventListener('click', () => {
        socket.emit('player:voteKick', p.id);
        hasVotedKick = true;
        document.querySelectorAll('.kick-btn, .skip-vote-btn').forEach(b => {
          b.disabled = true;
          b.classList.remove('voted');
        });
        btn.classList.add('voted');
        kickStatus.textContent = 'Voto registrado ✓';
      });
      kickPlayers.appendChild(btn);
    });

    // Botón saltar votación
    const skipBtn = document.createElement('button');
    skipBtn.className = 'kick-btn skip-vote-btn';
    skipBtn.innerHTML = '<span class="player-icon">⏭️</span>Saltar votación';
    skipBtn.addEventListener('click', () => {
      socket.emit('player:voteKick', null);
      hasVotedKick = true;
      document.querySelectorAll('.kick-btn, .skip-vote-btn').forEach(b => {
        b.disabled = true;
        b.classList.remove('voted');
      });
      skipBtn.classList.add('voted');
      kickStatus.textContent = 'Votación saltada ✓';
    });
    kickPlayers.appendChild(skipBtn);
  }

  // ----- RESULT -----
  function renderResult(eliminated) {
    if (!eliminated) {
      resultContent.innerHTML = '<div class="result-card"><p>Sin eliminaciones esta ronda</p></div>';
      return;
    }
    const verdictClass = eliminated.wasImpostor ? 'impostor' : 'civil';
    const verdictText = eliminated.wasImpostor ? '¡ERA EL IMPOSTOR! 🎯' : 'ERA FUTBOLISTA... 😰';
    const emoji = eliminated.wasImpostor ? '🔴' : '🟢';

    resultContent.innerHTML = `
      <div class="result-card">
        <div class="result-name">${emoji} ${escapeHtml(eliminated.name)}</div>
        <div class="result-votes">${eliminated.votes} voto(s)</div>
        <div class="result-verdict ${verdictClass}">${verdictText}</div>
      </div>
      <p style="color:var(--gray); font-size:14px;">Esperando al host para continuar...</p>
    `;
  }

  // ----- GAME OVER -----
  socket.on('game:over', (data) => {
    showScreen('gameover');
    const titleClass = data.winner === 'futbolistas' ? 'win' : 'lose';
    gameoverContent.innerHTML = `
      <div class="gameover-title ${titleClass}">${escapeHtml(data.message)}</div>
      <p style="color:var(--gray); margin-bottom: 16px;">Esperando reinicio...</p>
    `;
  });

  // ----- ELIMINATION DRAMATIC -----
  socket.on('game:elimination', (data) => {
    // Additional dramatic effect handled by screen transition
  });

  // ----- GAME RESET -----
  socket.on('game:reset', () => {
    myId = null;
    myName = '';
    myRole = null;
    hasVotedKick = false;
    inputName.value = '';
    showScreen('join');
  });

  // ----- UTILS -----
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
