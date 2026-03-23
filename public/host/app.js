// ============================================================
// Host Panel App — Impostor 412
// ============================================================
(function () {
  const socket = io();
  socket.emit('host:join');

  // DOM refs
  const phaseBadge = document.getElementById('phase-badge');
  const playerCount = document.getElementById('player-count');
  const playersList = document.getElementById('players-list');
  const historyList = document.getElementById('history-list');
  const categoriesList = document.getElementById('categories-list');
  const btnStart = document.getElementById('btn-start');
  const btnNext = document.getElementById('btn-next');
  const btnReset = document.getElementById('btn-reset');
  const impostorCount = document.getElementById('impostor-count');
  const debateTime = document.getElementById('debate-time');
  const voteTime = document.getElementById('vote-time');
  const customCatName = document.getElementById('custom-cat-name');
  const customCatWords = document.getElementById('custom-cat-words');
  const btnAddCat = document.getElementById('btn-add-cat');
  const catFeedback = document.getElementById('cat-feedback');
  const qrImage = document.getElementById('qr-image');
  const qrUrl = document.getElementById('qr-url');
  const categorySelect = document.getElementById('category-select');
  const startSection = document.getElementById('start-section');
  const categoryPreview = document.getElementById('category-preview');
  const previewTitle = document.getElementById('preview-title');
  const previewWords = document.getElementById('preview-words');

  let allCategoriesData = {}; // cache de categorías para preview

  const PHASE_LABELS = {
    lobby: 'LOBBY',
    role_reveal: 'REVELANDO ROLES',
    debate: 'DEBATE',
    vote_kick: 'VOTACIÓN',
    result: 'RESULTADO',
    game_over: 'FIN DEL JUEGO'
  };

  // ----- Load QR -----
  fetch('/api/qr')
    .then(r => r.json())
    .then(data => {
      qrImage.src = data.qr;
      qrUrl.textContent = data.url;
    })
    .catch(() => {
      qrUrl.textContent = 'Error cargando QR';
    });

  // ----- GAME STATE -----
  socket.on('game:state', (state) => {
    phaseBadge.textContent = PHASE_LABELS[state.phase] || state.phase;
    const players = state.players || [];
    playerCount.textContent = players.length;
    renderPlayers(players, state.phase);

    // Update config display
    impostorCount.value = state.impostorCount || 1;
    debateTime.value = state.debateTime || 90;
    voteTime.value = state.voteTime || 30;

    // Toggle button visibility
    startSection.style.display = state.phase === 'lobby' ? 'block' : 'none';
    btnNext.style.display = state.phase !== 'lobby' ? 'block' : 'none';

    // Update next button label
    switch (state.phase) {
      case 'role_reveal': btnNext.textContent = '⏩ IR A DEBATE'; break;
      case 'debate': btnNext.textContent = '⏩ IR A VOTACIÓN'; break;
      case 'vote_kick': btnNext.textContent = '⏩ FORZAR RESULTADO'; break;
      case 'result': btnNext.textContent = '⏩ SIGUIENTE RONDA'; break;
      case 'game_over': btnNext.textContent = '🔄 NUEVA PARTIDA'; break;
      default: btnNext.textContent = '⏩ SIGUIENTE FASE';
    }
  });

  function renderPlayers(players, phase) {
    playersList.innerHTML = '';
    players.forEach(p => {
      const isGameOver = phase === 'game_over';
      const showImpostor = (!p.alive || isGameOver) && p.isImpostor;
      const row = document.createElement('div');
      row.className = 'player-row' + (p.alive ? '' : ' dead');

      let statusHtml = '';
      if (showImpostor) {
        statusHtml = '<span class="player-status status-impostor">🕵️ IMPOSTOR</span>';
      } else if (p.alive) {
        statusHtml = '<span class="player-status status-alive">VIVO</span>';
      } else {
        statusHtml = '<span class="player-status status-dead">ELIMINADO</span>';
      }

      const botTag = p.isBot ? '<span style="font-size:11px;color:var(--blue);margin-left:4px;">🤖 CPU</span>' : '';

      row.innerHTML = `
        <div class="player-info">
          <div class="player-icon ${p.alive ? 'alive-icon' : 'dead-icon'}">${p.isBot ? '🤖' : (p.alive ? '⚽' : '💀')}</div>
          <span class="player-name">${escapeHtml(p.name)}${botTag}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:var(--green-neon);font-size:13px;">${p.score || 0} pts</span>
          ${statusHtml}
        </div>
      `;
      playersList.appendChild(row);
    });
  }

  // ----- CATEGORIES -----
  socket.on('host:categories', (cats) => {
    categoriesList.innerHTML = '';
    allCategoriesData = cats;
    // Actualizar dropdown de categorías
    categorySelect.innerHTML = '<option value="">-- Seleccionar categoría --</option>';
    // Opción aleatorio
    const randOpt = document.createElement('option');
    randOpt.value = '__random__';
    randOpt.textContent = '🎲 ALEATORIO';
    categorySelect.appendChild(randOpt);
    for (const [name, words] of Object.entries(cats)) {
      // Dropdown
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `${name} (${words.length} palabras)`;
      categorySelect.appendChild(opt);
      // Lista visual
      const item = document.createElement('div');
      item.className = 'cat-item';
      item.innerHTML = `
        <div class="cat-name">${escapeHtml(name)}</div>
        <div class="cat-words">${words.map(w => escapeHtml(w)).join(', ')}</div>
      `;
      categoriesList.appendChild(item);
    }
  });

  // ----- HISTORY -----
  socket.on('host:history', (history) => {
    historyList.innerHTML = '';
    history.forEach(h => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const elim = h.eliminated
        ? `${escapeHtml(h.eliminated.name)} eliminado (${h.eliminated.wasImpostor ? '🎯 era impostor' : '😰 era futbolista'})`
        : 'Sin eliminaciones';
      item.innerHTML = `
        <div class="round-title">Ronda ${h.round} — ${escapeHtml(h.category)}</div>
        <div class="round-detail">Palabra: ${escapeHtml(h.word)} | ${elim}</div>
      `;
      historyList.appendChild(item);
    });
  });

  // ----- BUTTONS -----
  btnStart.addEventListener('click', () => {
    const selectedCat = categorySelect.value;
    if (!selectedCat) {
      showToast('Seleccioná una categoría primero', true);
      return;
    }
    socket.emit('host:startGame', selectedCat);
  });

  // Preview de palabras al seleccionar categoría
  categorySelect.addEventListener('change', () => {
    const val = categorySelect.value;
    if (!val || val === '__random__') {
      categoryPreview.style.display = 'none';
      return;
    }
    const words = allCategoriesData[val];
    if (words) {
      previewTitle.textContent = `📋 ${val}`;
      previewWords.innerHTML = words.map(w =>
        `<span class="preview-word-tag">${escapeHtml(w)}</span>`
      ).join('');
      categoryPreview.style.display = 'block';
    } else {
      categoryPreview.style.display = 'none';
    }
  });

  btnNext.addEventListener('click', () => {
    socket.emit('host:nextPhase');
  });

  btnReset.addEventListener('click', () => {
    if (confirm('¿Reiniciar todo? Se perderán todos los datos.')) {
      socket.emit('host:fullReset');
    }
  });

  // ----- CONFIG -----
  impostorCount.addEventListener('change', () => {
    socket.emit('host:setImpostors', parseInt(impostorCount.value));
  });

  debateTime.addEventListener('change', () => {
    socket.emit('host:setDebateTime', parseInt(debateTime.value));
  });

  voteTime.addEventListener('change', () => {
    socket.emit('host:setVoteTime', parseInt(voteTime.value));
  });

  // ----- CPU BOTS -----
  const btnAddCpu = document.getElementById('btn-add-cpu');
  const btnRemoveCpu = document.getElementById('btn-remove-cpu');
  const cpuFeedback = document.getElementById('cpu-feedback');

  btnAddCpu.addEventListener('click', () => {
    socket.emit('host:addCpu');
  });

  btnRemoveCpu.addEventListener('click', () => {
    socket.emit('host:removeCpu');
  });

  socket.on('host:cpuAdded', (name) => {
    cpuFeedback.textContent = `✓ ${name} agregado`;
    cpuFeedback.style.color = 'var(--green-neon)';
    setTimeout(() => { cpuFeedback.textContent = ''; }, 3000);
  });

  // ----- CUSTOM CATEGORY -----
  btnAddCat.addEventListener('click', () => {
    const name = customCatName.value.trim();
    const words = customCatWords.value.split(',').map(w => w.trim()).filter(Boolean);
    if (!name || words.length < 4) {
      catFeedback.textContent = 'Necesitás un nombre y al menos 4 palabras';
      catFeedback.style.color = 'var(--red)';
      return;
    }
    socket.emit('host:addCategory', { name, words });
  });

  socket.on('host:categoryAdded', (name) => {
    catFeedback.textContent = `✓ "${name}" agregada`;
    catFeedback.style.color = 'var(--green-neon)';
    customCatName.value = '';
    customCatWords.value = '';
  });

  // ----- ERRORS -----
  socket.on('host:error', (msg) => {
    showToast(msg, true);
  });

  // ----- GAME EVENTS -----
  socket.on('game:elimination', (data) => {
    const msg = data.wasImpostor
      ? `🎯 ${data.name} ERA IMPOSTOR`
      : `😰 ${data.name} era futbolista...`;
    showToast(msg, !data.wasImpostor);
  });

  socket.on('game:over', (data) => {
    showToast(data.message, data.winner === 'impostors');
  });

  socket.on('game:reset', () => {
    showToast('Partida reiniciada');
  });

  // ----- TOAST -----
  function showToast(msg, isError) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ----- UTILS -----
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
