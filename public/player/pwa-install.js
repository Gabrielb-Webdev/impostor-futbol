// ============================================================
// PWA Install handler — Impostor 412
// Android: intercepta beforeinstallprompt → muestra banner
// iOS: detecta Safari → muestra guía manual
// ============================================================

(function () {
  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Si ya está instalada como PWA, no mostrar nada
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    return;
  }

  const banner = document.getElementById('install-banner');
  const btnInstall = document.getElementById('btn-install');
  const btnClose = document.getElementById('btn-install-close');
  const iosGuide = document.getElementById('ios-install-guide');
  const btnIosClose = document.getElementById('btn-ios-close');

  let deferredPrompt = null;

  // ---- ANDROID / Chrome (beforeinstallprompt) ----
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    banner.classList.remove('hidden');
  });

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        banner.classList.add('hidden');
      }
      deferredPrompt = null;
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      banner.classList.add('hidden');
    });
  }

  // ---- iOS / Safari ----
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isInSafari() {
    const ua = navigator.userAgent;
    return /Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS|Chrome/i.test(ua);
  }

  if (isIOS() && isInSafari()) {
    // Mostrar después de 2 segundos para no ser invasivo
    setTimeout(() => {
      if (iosGuide) iosGuide.classList.remove('hidden');
    }, 2000);
  }

  if (btnIosClose) {
    btnIosClose.addEventListener('click', () => {
      iosGuide.classList.add('hidden');
    });
  }

  // Si se instala, ocultar todo
  window.addEventListener('appinstalled', () => {
    banner.classList.add('hidden');
    if (iosGuide) iosGuide.classList.add('hidden');
  });
})();
