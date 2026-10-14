/* Alternância visual entre os modos; não altera o motor de áudio nem os valores dos controles. */
(() => {
  const compactBtn = document.getElementById('compactModeBtn');
  const advancedBtn = document.getElementById('advancedModeBtn');
  const help = document.getElementById('modeHelp');
  if (!compactBtn || !advancedBtn) return;

  const STORAGE_KEY = 'nichodev.voiceStudio.uiMode.v1';

  function setMode(mode, save = true) {
    const advanced = mode === 'advanced';
    document.body.classList.toggle('advanced-mode', advanced);
    document.body.classList.toggle('compact-mode', !advanced);
    compactBtn.setAttribute('aria-pressed', String(!advanced));
    advancedBtn.setAttribute('aria-pressed', String(advanced));
    help.textContent = advanced
      ? 'Modo avançado: todos os recursos estão disponíveis. Abra EFEITOS para ajustar o som.'
      : 'Modo compacto: controles essenciais à vista. Abra EFEITOS para ajustar o som; ative Avançado para gerenciar seus presets.';
    if (save) {
      try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) { /* preferência opcional */ }
    }
  }

  compactBtn.addEventListener('click', () => setMode('compact'));
  advancedBtn.addEventListener('click', () => setMode('advanced'));

  let initialMode = 'compact';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'advanced' || saved === 'compact') initialMode = saved;
  } catch (_) { /* usa o padrão compacto */ }
  setMode(initialMode, false);
})();
