(function () {
  'use strict';

  // ═════════════════════════════════════════════════════
  // CONSTANTES & HELPERS
  // ═════════════════════════════════════════════════════
  const CIRC = 2 * Math.PI * 130; // ≈ 816.814
  const STORAGE_KEY = 'tempoci';

  const $  = function (id)  { return document.getElementById(id); };
  const $$ = function (sel) { return document.querySelectorAll(sel); };

  // ─── Formatage du temps en MM:SS.CS ou HH:MM:SS.CS ──
  function fmt(ms) {
    var h  = Math.floor(ms / 3600000);
    var m  = Math.floor((ms % 3600000) / 60000);
    var s  = Math.floor((ms % 60000) / 1000);
    var cs = Math.floor((ms % 1000) / 10);
    var p  = function (n) { return String(n).padStart(2, '0'); };
    return h > 0
      ? p(h) + ':' + p(m) + ':' + p(s) + '.' + p(cs)
      : p(m) + ':' + p(s) + '.' + p(cs);
  }

  // ─── Fabrique de boutons d'action ──────────────────────
  function mkBtn(label, handler, variant, disabled) {
    var btn = document.createElement('button');
    btn.className = 'action-btn' + (variant ? ' ' + variant : '');
    btn.textContent = label;
    if (disabled) btn.disabled = true;
    btn.addEventListener('click', handler);
    btn.addEventListener('mousedown', function () {
      if (!disabled) btn.style.transform = 'scale(0.95)';
    });
    btn.addEventListener('mouseup', function () { btn.style.transform = 'scale(1)'; });
    btn.addEventListener('mouseleave', function () { btn.style.transform = 'scale(1)'; });
    return btn;
  }

  // ─── Vibration haptique (mobile) ───────────────────────
  function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // ═════════════════════════════════════════════════════
  // LOCALSTORAGE
  // ═════════════════════════════════════════════════════
  function saveState() {
    var data = {
      dark: state.dark,
      chrono: { laps: state.chrono.laps },
      timer:  { input: state.timer.input },
      history: state.history,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* quota */ }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ─── Sauvegarder une session dans l'historique ─────────
  function saveSession(type, data) {
    var entry = { type: type, date: new Date().toISOString() };
    for (var k in data) entry[k] = data[k];
    state.history.unshift(entry);
    if (state.history.length > 50) state.history.length = 50;
    saveState();
  }

  // ═════════════════════════════════════════════════════
  // AUDIO — Son de fin de minuteur (Web Audio API)
  // ═════════════════════════════════════════════════════
  var audioCtx = null;

  function playTimerEndSound() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var notes = [880, 1100, 880];
      var dur = 0.15, gap = 0.08;
      notes.forEach(function (freq, i) {
        var t = audioCtx.currentTime + i * (dur + gap);
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + dur);
      });
    } catch (e) { /* Audio non supporté */ }
  }

  // ═════════════════════════════════════════════════════
  // STATE GLOBAL
  // ═════════════════════════════════════════════════════
  var state = {
    dark: false,
    chrono: { running: false, time: 0, laps: [], _start: 0 },
    timer:  { running: false, total: 300000, time: 300000, input: { h: 0, m: 5, s: 0 }, done: false, _start: 0 },
    history: [],
  };

  // ─── Restaurer les données sauvegardées ────────────────
  var saved = loadState();
  if (saved) {
    if (saved.dark) state.dark = true;
    if (saved.chrono && saved.chrono.laps) state.chrono.laps = saved.chrono.laps;
    if (saved.timer && saved.timer.input) {
      state.timer.input = saved.timer.input;
      var inp = state.timer.input;
      var ms = (inp.h * 3600 + inp.m * 60 + inp.s) * 1000;
      state.timer.total = ms;
      state.timer.time = ms;
    }
    if (saved.history) state.history = saved.history;
  }

  // ═════════════════════════════════════════════════════
  // CHRONO
  // ═════════════════════════════════════════════════════
  var chronoDisplay = $('chronoDisplay');
  var chronoArcEl   = $('chronoArc');
  var chronoBtnsEl  = $('chronoBtns');
  var lapListEl     = $('lapList');
  var lapCountEl    = $('lapCount');
  var lapItemsEl    = $('lapItems');
  var exportLapBtn  = $('exportLapBtn');
  var chronoRAF     = null;

  // ─── Boucle d'animation avec requestAnimationFrame ─────
  function chronoTick() {
    var c = state.chrono;
    if (!c.running) return;
    c.time = Math.floor(performance.now() - c._start);
    chronoDisplay.textContent = fmt(c.time);
    var pct = (c.time % 60000) / 60000;
    chronoArcEl.setAttribute('stroke-dashoffset', CIRC - pct * CIRC);
    chronoRAF = requestAnimationFrame(chronoTick);
  }

  function chronoStart() {
    var c = state.chrono;
    c._start  = performance.now() - c.time;
    c.running = true;
    chronoArcEl.style.opacity = '1';
    vibrate(20);
    chronoRAF = requestAnimationFrame(chronoTick);
    renderChronoBtns();
  }

  function chronoPause() {
    var c = state.chrono;
    c.running = false;
    cancelAnimationFrame(chronoRAF);
    chronoArcEl.style.opacity = '0';
    vibrate(20);
    renderChronoBtns();
  }

  function chronoReset() {
    var c = state.chrono;
    if (c.time > 0) {
      saveSession('chrono', { totalTime: c.time, laps: c.laps.slice() });
    }
    cancelAnimationFrame(chronoRAF);
    c.running = false;
    c.time    = 0;
    c.laps    = [];
    chronoDisplay.textContent = '00:00.00';
    chronoArcEl.setAttribute('stroke-dashoffset', CIRC);
    chronoArcEl.style.opacity = '0';
    lapListEl.classList.add('hidden');
    lapItemsEl.innerHTML = '';
    vibrate(30);
    saveState();
    renderChronoBtns();
  }

  function chronoLap() {
    state.chrono.laps.unshift(state.chrono.time);
    vibrate(15);
    renderLaps();
    saveState();
  }

  function renderChronoBtns() {
    var running = state.chrono.running, time = state.chrono.time;
    chronoBtnsEl.innerHTML = '';
    if (!running && time === 0) {
      chronoBtnsEl.append(mkBtn('Lancer', chronoStart, 'primary'));
    } else if (running) {
      chronoBtnsEl.append(mkBtn('Lap', chronoLap));
      chronoBtnsEl.append(mkBtn('Pause', chronoPause, 'primary'));
    } else {
      chronoBtnsEl.append(mkBtn('Reprendre', chronoStart, 'primary'));
      chronoBtnsEl.append(mkBtn('Reset', chronoReset, 'danger'));
    }
  }

  function renderLaps() {
    var laps = state.chrono.laps;
    if (!laps.length) { lapListEl.classList.add('hidden'); return; }

    lapListEl.classList.remove('hidden');
    lapCountEl.textContent = laps.length + ' tour' + (laps.length > 1 ? 's' : '');

    var diffs = laps.map(function (lap, i) {
      return i < laps.length - 1 ? lap - laps[i + 1] : lap;
    });
    var best  = Math.min.apply(null, diffs);
    var worst = Math.max.apply(null, diffs);

    lapItemsEl.innerHTML = '';
    laps.forEach(function (lap, i) {
      var diff    = diffs[i];
      var isBest  = laps.length > 1 && diff === best;
      var isWorst = laps.length > 1 && diff === worst;
      var div = document.createElement('div');
      div.className = 'lap-item' + (isBest ? ' best' : isWorst ? ' worst' : '');
      div.innerHTML =
        '<div class="lap-left">' +
          '<span class="lap-num">#' + (laps.length - i) + '</span>' +
          '<span class="lap-time">' + fmt(lap) + '</span>' +
        '</div>' +
        '<span class="lap-diff">+' + fmt(diff) + '</span>';
      lapItemsEl.appendChild(div);
    });
  }

  // ─── Export des tours dans le presse-papier ────────────
  function exportLaps() {
    var laps = state.chrono.laps;
    if (!laps.length) return;
    var diffs = laps.map(function (lap, i) {
      return i < laps.length - 1 ? lap - laps[i + 1] : lap;
    });
    var text = 'TempoCI - Laps\n';
    for (var i = 0; i < 30; i++) text += '─';
    text += '\n';
    laps.forEach(function (lap, i) {
      var num = laps.length - i;
      text += '#' + String(num).padStart(2, ' ') + '  ' + fmt(lap) + '  (+' + fmt(diffs[i]) + ')\n';
    });
    for (var j = 0; j < 30; j++) text += '─';
    text += '\nTotal: ' + fmt(laps[0]) + '\n';

    navigator.clipboard.writeText(text).then(function () {
      exportLapBtn.textContent = 'Copié !';
      exportLapBtn.classList.add('copied');
      setTimeout(function () {
        exportLapBtn.textContent = 'Exporter';
        exportLapBtn.classList.remove('copied');
      }, 1500);
    });
  }

  if (exportLapBtn) exportLapBtn.addEventListener('click', exportLaps);

  // ═════════════════════════════════════════════════════
  // TIMER
  // ═════════════════════════════════════════════════════
  var timerInputRowEl = $('timerInputRow');
  var timerCircleEl   = $('timerCircle');
  var timerDisplayEl  = $('timerDisplay');
  var timerArcEl      = $('timerArc');
  var timerBtnsEl     = $('timerBtns');
  var presetRowEl     = $('presetRow');
  var timerLabelEl    = $('timerLabelText');
  var spinHEl = $('spinH'), spinMEl = $('spinM'), spinSEl = $('spinS');
  var timerRAF = null;

  function timerApplyInput() {
    var i = state.timer.input;
    var ms = (i.h * 3600 + i.m * 60 + i.s) * 1000;
    state.timer.total = ms;
    state.timer.time  = ms;
    state.timer.done  = false;
  }

  // ─── Boucle d'animation avec requestAnimationFrame ─────
  function timerTick() {
    var t = state.timer;
    if (!t.running) return;
    var elapsed   = performance.now() - t._start;
    var remaining = Math.max(0, t.total - elapsed);
    t.time = Math.floor(remaining);
    timerDisplayEl.textContent = fmt(t.time);

    var pct = t.total > 0 ? (t.total - remaining) / t.total : 0;
    timerArcEl.setAttribute('stroke-dashoffset', CIRC * (1 - pct));

    if (remaining <= 0) {
      t.running = false;
      t.done    = true;
      t.time    = 0;
      timerDisplayEl.textContent = '00:00.00';
      timerDisplayEl.classList.add('done');
      timerArcEl.style.stroke = '#E53E3E';
      timerLabelEl.textContent = 'Terminé !';
      timerLabelEl.classList.add('done-text');
      playTimerEndSound();
      vibrate([100, 50, 100, 50, 200]);
      saveSession('timer', { duration: t.total });
      renderTimerBtns();
      return;
    }
    timerRAF = requestAnimationFrame(timerTick);
  }

  function timerStart() {
    var t = state.timer;
    t.done    = false;
    t.running = true;
    t._start  = performance.now() - (t.total - t.time);
    timerArcEl.style.opacity = '1';
    vibrate(20);
    timerRAF = requestAnimationFrame(timerTick);
    renderTimerView();
    renderTimerBtns();
  }

  function timerPause() {
    state.timer.running = false;
    cancelAnimationFrame(timerRAF);
    vibrate(20);
    renderTimerBtns();
  }

  function timerReset() {
    var t = state.timer;
    cancelAnimationFrame(timerRAF);
    t.running = false;
    t.done    = false;
    timerApplyInput();
    timerDisplayEl.textContent = fmt(t.time);
    timerDisplayEl.classList.remove('done');
    timerArcEl.style.stroke  = '#009E49';
    timerArcEl.style.opacity = '0';
    timerArcEl.setAttribute('stroke-dashoffset', CIRC);
    timerLabelEl.textContent = 'restant';
    timerLabelEl.classList.remove('done-text');
    vibrate(30);
    renderTimerView();
    renderTimerBtns();
  }

  function renderTimerView() {
    var t = state.timer;
    var showInput = !t.running && t.time === t.total && !t.done;
    timerInputRowEl.classList.toggle('hidden', !showInput);
    presetRowEl.classList.toggle('hidden', !showInput);
    timerCircleEl.classList.toggle('hidden', showInput);
  }

  function renderTimerBtns() {
    var t = state.timer;
    timerBtnsEl.innerHTML = '';
    if (!t.running && t.time === t.total && !t.done) {
      var off = t.input.h === 0 && t.input.m === 0 && t.input.s === 0;
      timerBtnsEl.append(mkBtn('Lancer', function () { timerApplyInput(); timerStart(); }, 'primary', off));
    } else if (t.running) {
      timerBtnsEl.append(mkBtn('Pause', timerPause, 'primary'));
    } else if (!t.done) {
      timerBtnsEl.append(mkBtn('Reprendre', timerStart, 'primary'));
      timerBtnsEl.append(mkBtn('Reset', timerReset, 'danger'));
    } else {
      timerBtnsEl.append(mkBtn('Reset', timerReset, 'primary'));
    }
  }

  function renderSpinners() {
    var i = state.timer.input;
    spinHEl.textContent = String(i.h).padStart(2, '0');
    spinMEl.textContent = String(i.m).padStart(2, '0');
    spinSEl.textContent = String(i.s).padStart(2, '0');
  }

  function updateActivePreset() {
    var i = state.timer.input;
    $$('.preset-btn').forEach(function (btn) {
      btn.classList.toggle('active-preset', i.h === 0 && +btn.dataset.min === i.m && i.s === 0);
    });
  }

  // ─── Spinners ──────────────────────────────────────────
  $$('.spinner').forEach(function (spin) {
    var key = spin.dataset.key;
    var max = key === 'h' ? 23 : 59;
    spin.querySelector('.spin-up').addEventListener('click', function () {
      state.timer.input[key] = Math.min(state.timer.input[key] + 1, max);
      renderSpinners(); updateActivePreset(); renderTimerBtns(); saveState();
    });
    spin.querySelector('.spin-down').addEventListener('click', function () {
      state.timer.input[key] = Math.max(state.timer.input[key] - 1, 0);
      renderSpinners(); updateActivePreset(); renderTimerBtns(); saveState();
    });
  });

  // ─── Presets ───────────────────────────────────────────
  $$('.preset-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var min = +btn.dataset.min;
      state.timer.input = { h: 0, m: min, s: 0 };
      var ms = min * 60000;
      state.timer.total = ms;
      state.timer.time  = ms;
      renderSpinners(); updateActivePreset(); renderTimerBtns(); saveState();
    });
  });

  // ═════════════════════════════════════════════════════
  // ONGLETS
  // ═════════════════════════════════════════════════════
  var tabSwitcherEl = $('tabSwitcher');
  var menuToggleEl  = $('menuToggle');

  function getActiveTab() {
    var active = document.querySelector('.tab-btn.active');
    return active ? active.dataset.tab : 'chrono';
  }

  function closeMenu() {
    tabSwitcherEl.classList.remove('open');
    menuToggleEl.classList.remove('open');
    menuToggleEl.setAttribute('aria-expanded', 'false');
  }

  $$('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tab = btn.dataset.tab;
      $$('.tab-btn').forEach(function (b) {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      $$('.tab-pane').forEach(function (p) {
        p.classList.toggle('active', p.id === 'tab-' + tab);
      });
      closeMenu();
      // Rafraîchir l'historique quand on ouvre l'onglet
      if (tab === 'history') renderHistory();
    });
  });

  // ═════════════════════════════════════════════════════
  // MENU HAMBURGER
  // ═════════════════════════════════════════════════════
  menuToggleEl.addEventListener('click', function () {
    var isOpen = tabSwitcherEl.classList.toggle('open');
    menuToggleEl.classList.toggle('open', isOpen);
    menuToggleEl.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.navbar')) closeMenu();
  });

  // ═════════════════════════════════════════════════════
  // DARK MODE (avec persistance)
  // ═════════════════════════════════════════════════════
  function applyTheme() {
    document.body.classList.toggle('dark', state.dark);
    $('darkToggle').textContent = state.dark ? '☀' : '☽';
  }

  $('darkToggle').addEventListener('click', function () {
    state.dark = !state.dark;
    applyTheme();
    saveState();
  });

  // ═════════════════════════════════════════════════════
  // PLEIN ÉCRAN
  // ═════════════════════════════════════════════════════
  var fsBtn = $('fullscreenToggle');
  if (fsBtn) {
    fsBtn.addEventListener('click', function () {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function () {});
        fsBtn.textContent = '⊡';
        fsBtn.setAttribute('aria-label', 'Quitter le plein écran');
      } else {
        document.exitFullscreen();
        fsBtn.textContent = '⛶';
        fsBtn.setAttribute('aria-label', 'Plein écran');
      }
    });
    document.addEventListener('fullscreenchange', function () {
      if (!document.fullscreenElement) {
        fsBtn.textContent = '⛶';
        fsBtn.setAttribute('aria-label', 'Plein écran');
      }
    });
  }

  // ═════════════════════════════════════════════════════
  // RACCOURCIS CLAVIER
  // ═════════════════════════════════════════════════════
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    var tab = getActiveTab();
    var key = e.code;

    // F = plein écran (tous onglets)
    if (key === 'KeyF') { e.preventDefault(); if (fsBtn) fsBtn.click(); return; }

    if (tab === 'chrono') {
      var c = state.chrono;
      if (key === 'Space') {
        e.preventDefault();
        if (!c.running && c.time === 0) chronoStart();
        else if (c.running) chronoPause();
        else chronoStart();
      }
      if (key === 'KeyL' && c.running) { e.preventDefault(); chronoLap(); }
      if (key === 'KeyR' && !c.running && c.time > 0) { e.preventDefault(); chronoReset(); }
    }

    if (tab === 'timer') {
      var t = state.timer;
      if (key === 'Space') {
        e.preventDefault();
        if (!t.running && t.time === t.total && !t.done) { timerApplyInput(); timerStart(); }
        else if (t.running) timerPause();
        else if (!t.done) timerStart();
      }
      if (key === 'KeyR' && !t.running) { e.preventDefault(); timerReset(); }
    }
  });

  // ═════════════════════════════════════════════════════
  // HISTORIQUE DES SESSIONS
  // ═════════════════════════════════════════════════════
  function renderHistory() {
    var container = $('historyItems');
    var emptyMsg  = $('historyEmpty');
    if (!container) return;

    var history = state.history || [];
    container.innerHTML = '';

    if (history.length === 0) {
      if (emptyMsg) emptyMsg.classList.remove('hidden');
      return;
    }
    if (emptyMsg) emptyMsg.classList.add('hidden');

    history.forEach(function (entry) {
      var div = document.createElement('div');
      div.className = 'history-item';

      var date = new Date(entry.date);
      var dateStr = date.toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

      var icon = entry.type === 'chrono' ? '⏱' : '⏳';
      var detail = entry.type === 'chrono'
        ? fmt(entry.totalTime) + ' — ' + entry.laps.length + ' tour(s)'
        : fmt(entry.duration);

      div.innerHTML =
        '<span class="history-icon">' + icon + '</span>' +
        '<div class="history-detail">' +
          '<span class="history-type">' + (entry.type === 'chrono' ? 'Chronomètre' : 'Minuteur') + '</span>' +
          '<span class="history-value">' + detail + '</span>' +
        '</div>' +
        '<span class="history-date">' + dateStr + '</span>';
      container.appendChild(div);
    });
  }

  var clearHistoryBtn = $('clearHistoryBtn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', function () {
      state.history = [];
      saveState();
      renderHistory();
    });
  }

  // ═════════════════════════════════════════════════════
  // INIT
  // ═════════════════════════════════════════════════════
  applyTheme();
  renderChronoBtns();
  renderLaps();
  renderSpinners();
  updateActivePreset();
  renderTimerView();
  renderTimerBtns();
  renderHistory();

  // ─── Enregistrer le Service Worker (PWA) ───────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  }

})();
