// ============================================================
// Overlay A — Marcador Deportivo
// ============================================================
(function () {
  const socket = io();
  socket.emit('overlay:join');

  const infoCategory = document.getElementById('info-category');
  const infoRound = document.getElementById('info-round');
  const overlayTimer = document.getElementById('overlay-timer');
  const timerLabel = document.getElementById('timer-label');
  const timerValue = document.getElementById('timer-value');
  const overlayPlayers = document.getElementById('overlay-players');
  const overlayAlert = document.getElementById('overlay-alert');
  const alertContent = document.getElementById('alert-content');
  const ballAnim = document.getElementById('ball-anim');
  const confettiCanvas = document.getElementById('confetti-canvas');
  const ctx = confettiCanvas.getContext('2d');

  confettiCanvas.width = 1920;
  confettiCanvas.height = 1080;

  let lastPhase = '';

  socket.on('overlay:state', (state) => {
    infoCategory.textContent = state.chosenCategory || 'ESPERANDO...';
    infoRound.textContent = state.round > 0 ? `RONDA ${state.round}` : 'LOBBY';

    if (state.phase === 'debate' || state.phase === 'vote_kick') {
      overlayTimer.classList.remove('hidden');
      timerLabel.textContent = state.phase === 'debate' ? 'DEBATE' : 'VOTACIÓN';
    } else {
      overlayTimer.classList.add('hidden');
    }

    renderPlayers(state.players, state.phase);

    if (lastPhase === 'result' && state.phase === 'role_reveal') triggerBall();
    lastPhase = state.phase;
  });

  socket.on('timer:update', (data) => {
    timerValue.textContent = data.seconds;
    timerValue.classList.toggle('warning', data.seconds <= 10);
  });

  function renderPlayers(players, phase) {
    overlayPlayers.innerHTML = '';
    if (!players) return;

    players.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'ps-card' + (p.alive ? '' : ' dead') + (p.isImpostor ? ' impostor' : '');
      card.style.animationDelay = (i * 0.06) + 's';

      let tagHtml = '';
      if (p.isImpostor) {
        tagHtml = '<span class="ps-tag tag-impostor">🕵️ IMPOSTOR</span>';
      } else if (!p.alive) {
        tagHtml = '<span class="ps-tag tag-dead">ELIMINADO</span>';
      } else {
        tagHtml = '<span class="ps-tag tag-alive">VIVO</span>';
      }

      const wordHtml = p.word && phase !== 'lobby' ? `<span class="ps-word">${escapeHtml(p.word)}</span>` : '';

      card.innerHTML = `
        <span class="ps-icon">${p.isImpostor ? '🕵️' : (p.alive ? '⚽' : '💀')}</span>
        <span class="ps-name">${escapeHtml(p.name)}</span>
        ${wordHtml}
        ${tagHtml}
      `;
      overlayPlayers.appendChild(card);
    });
  }

  socket.on('game:elimination', (data) => showAlert(data));

  function showAlert(data) {
    const verdictText = data.wasImpostor ? '¡ERA EL IMPOSTOR!' : 'ERA FUTBOLISTA...';
    const emoji = data.wasImpostor ? '🔴' : '🟢';
    alertContent.innerHTML = `
      <div class="alert-name">${emoji} ${escapeHtml(data.name)}</div>
      <div class="alert-verdict ${data.wasImpostor ? 'is-impostor' : 'is-futbolista'}">${verdictText}</div>
      <div class="alert-votes">${data.votes} voto(s)</div>
    `;
    overlayAlert.classList.remove('hidden');
    setTimeout(() => overlayAlert.classList.add('hidden'), 5000);
  }

  socket.on('game:over', (data) => {
    const title = data.winner === 'futbolistas' ? '¡GANAN LOS FUTBOLISTAS!' : '¡GANAN LOS IMPOSTORES!';
    alertContent.innerHTML = `
      <div class="gameover-overlay">
        <div class="gameover-title ${data.winner === 'futbolistas' ? 'win-futbolistas' : 'win-impostors'}">${title}</div>
        <div class="gameover-sub">${escapeHtml(data.message)}</div>
      </div>
    `;
    overlayAlert.classList.remove('hidden');
    triggerConfetti(data.winner === 'futbolistas' ? '#00e676' : '#e53935');
    setTimeout(() => overlayAlert.classList.add('hidden'), 10000);
  });

  function triggerBall() {
    ballAnim.classList.remove('hidden');
    ballAnim.style.animation = 'none';
    ballAnim.offsetHeight;
    ballAnim.style.animation = 'ballCross 2s ease-in-out forwards';
    setTimeout(() => ballAnim.classList.add('hidden'), 2200);
  }

  let confettiPieces = [];
  let confettiRunning = false;

  function triggerConfetti(mainColor) {
    confettiPieces = [];
    const colors = [mainColor, '#888', '#fff', mainColor, '#555'];
    for (let i = 0; i < 200; i++) {
      confettiPieces.push({
        x: Math.random() * 1920, y: Math.random() * -1080,
        w: Math.random() * 10 + 5, h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4, vy: Math.random() * 5 + 3,
        rot: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 10, opacity: 1
      });
    }
    if (!confettiRunning) { confettiRunning = true; animateConfetti(); }
    setTimeout(() => confettiPieces.forEach(p => p.opacity -= 0.02), 6000);
    setTimeout(() => { confettiRunning = false; ctx.clearRect(0, 0, 1920, 1080); }, 8000);
  }

  function animateConfetti() {
    if (!confettiRunning) return;
    ctx.clearRect(0, 0, 1920, 1080);
    confettiPieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rotSpeed;
      if (p.opacity > 0.01) p.opacity = Math.max(0, p.opacity - 0.001);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    confettiPieces = confettiPieces.filter(p => p.y < 1200 && p.opacity > 0.01);
    if (confettiPieces.length > 0 && confettiRunning) requestAnimationFrame(animateConfetti);
    else { confettiRunning = false; ctx.clearRect(0, 0, 1920, 1080); }
  }

  socket.on('game:reset', () => {
    overlayAlert.classList.add('hidden');
    overlayPlayers.innerHTML = '';
    infoCategory.textContent = 'ESPERANDO...';
    infoRound.textContent = 'LOBBY';
    overlayTimer.classList.add('hidden');
    ctx.clearRect(0, 0, 1920, 1080);
  });

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
