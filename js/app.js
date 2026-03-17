const CIRC = 2 * Math.PI * 130; // ≈ 816.814

// ─── State ───────────────────────────────────────────
const state = {
  dark: false,
  chrono: {
    running : false,
    time    : 0,
    laps    : [],
    _iv     : null,
    _start  : 0,
  },
  timer: {
    running : false,
    total   : 300000,
    time    : 300000,
    input   : { h: 0, m: 5, s: 0 },
    done    : false,
    _iv     : null,
    _start  : 0,
  },
};

// ─── DOM helpers ─────────────────────────────────────
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ─── Format time ─────────────────────────────────────
function fmt(ms) {
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  const s  = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  const p  = n => String(n).padStart(2, '0');
  return h > 0
    ? `${p(h)}:${p(m)}:${p(s)}.${p(cs)}`
    : `${p(m)}:${p(s)}.${p(cs)}`;
}

// ─── Button factory ───────────────────────────────────
function mkBtn(label, handler, variant, disabled) {
  const btn = document.createElement('button');
  btn.className = 'action-btn' + (variant ? ' ' + variant : '');
  btn.textContent = label;
  if (disabled) btn.disabled = true;
  btn.addEventListener('click', handler);
  btn.addEventListener('mousedown',  () => { if (!disabled) btn.style.transform = 'scale(0.95)'; });
  btn.addEventListener('mouseup',    () => { btn.style.transform = 'scale(1)'; });
  btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });
  return btn;
}

// ═════════════════════════════════════════════════════
// CHRONO
// ═════════════════════════════════════════════════════
const chronoDisplay = $('chronoDisplay');
const chronoArcEl   = $('chronoArc');
const chronoBtnsEl  = $('chronoBtns');
const lapListEl     = $('lapList');
const lapCountEl    = $('lapCount');
const lapItemsEl    = $('lapItems');

function chronoStart() {
  const c = state.chrono;
  c._start  = performance.now() - c.time;
  c.running = true;
  chronoArcEl.style.opacity = '1';

  c._iv = setInterval(() => {
    c.time = Math.floor(performance.now() - c._start);
    chronoDisplay.textContent = fmt(c.time);
    // Arc: 1 revolution = 60 seconds
    const pct = (c.time % 60000) / 60000;
    chronoArcEl.setAttribute('stroke-dashoffset', CIRC - pct * CIRC);
  }, 10);

  renderChronoBtns();
}

function chronoPause() {
  const c = state.chrono;
  c.running = false;
  clearInterval(c._iv);
  chronoArcEl.style.opacity = '0';
  renderChronoBtns();
}

function chronoReset() {
  const c = state.chrono;
  clearInterval(c._iv);
  c.running = false;
  c.time    = 0;
  c.laps    = [];
  chronoDisplay.textContent = '00:00.00';
  chronoArcEl.setAttribute('stroke-dashoffset', CIRC);
  chronoArcEl.style.opacity = '0';
  lapListEl.classList.add('hidden');
  lapItemsEl.innerHTML = '';
  renderChronoBtns();
}

function chronoLap() {
  state.chrono.laps.unshift(state.chrono.time);
  renderLaps();
}

function renderChronoBtns() {
  const { running, time } = state.chrono;
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
  const laps = state.chrono.laps;
  if (!laps.length) {
    lapListEl.classList.add('hidden');
    return;
  }

  lapListEl.classList.remove('hidden');
  lapCountEl.textContent = laps.length + ' tour' + (laps.length > 1 ? 's' : '');

  // Per-lap delta (vs previous lap)
  const diffs = laps.map((lap, i) =>
    i < laps.length - 1 ? lap - laps[i + 1] : lap
  );
  const best  = Math.min(...diffs);
  const worst = Math.max(...diffs);

  lapItemsEl.innerHTML = '';
  laps.forEach((lap, i) => {
    const diff    = diffs[i];
    const isBest  = laps.length > 1 && diff === best;
    const isWorst = laps.length > 1 && diff === worst;
    const div = document.createElement('div');
    div.className = 'lap-item' + (isBest ? ' best' : isWorst ? ' worst' : '');
    div.innerHTML = `
      <div class="lap-left">
        <span class="lap-num">#${laps.length - i}</span>
        <span class="lap-time">${fmt(lap)}</span>
      </div>
      <span class="lap-diff">+${fmt(diff)}</span>`;
    lapItemsEl.appendChild(div);
  });
}

// ═════════════════════════════════════════════════════
// TIMER
// ═════════════════════════════════════════════════════
const timerInputRowEl = $('timerInputRow');
const timerCircleEl   = $('timerCircle');
const timerDisplayEl  = $('timerDisplay');
const timerArcEl      = $('timerArc');
const timerBtnsEl     = $('timerBtns');
const presetRowEl     = $('presetRow');
const timerLabelEl    = $('timerLabelText');
const spinHEl = $('spinH'), spinMEl = $('spinM'), spinSEl = $('spinS');

function timerApplyInput() {
  const { h, m, s } = state.timer.input;
  const ms = (h * 3600 + m * 60 + s) * 1000;
  state.timer.total = ms;
  state.timer.time  = ms;
  state.timer.done  = false;
}

function timerStart() {
  const t = state.timer;
  t.done    = false;
  t.running = true;
  t._start  = performance.now() - (t.total - t.time);
  timerArcEl.style.opacity = '1';

  t._iv = setInterval(() => {
    const elapsed   = performance.now() - t._start;
    const remaining = Math.max(0, t.total - elapsed);
    t.time = Math.floor(remaining);
    timerDisplayEl.textContent = fmt(t.time);

    // Arc progress
    const pct = t.total > 0 ? (t.total - remaining) / t.total : 0;
    timerArcEl.setAttribute('stroke-dashoffset', CIRC * (1 - pct));

    // Done
    if (remaining <= 0) {
      clearInterval(t._iv);
      t.running = false;
      t.done    = true;
      t.time    = 0;
      timerDisplayEl.textContent = '00:00.00';
      timerDisplayEl.classList.add('done');
      timerArcEl.style.stroke = '#E53E3E';
      timerLabelEl.textContent = 'Terminé !';
      timerLabelEl.classList.add('done-text');
      renderTimerBtns();
    }
  }, 10);

  renderTimerView();
  renderTimerBtns();
}

function timerPause() {
  state.timer.running = false;
  clearInterval(state.timer._iv);
  renderTimerBtns();
}

function timerReset() {
  const t = state.timer;
  clearInterval(t._iv);
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
  renderTimerView();
  renderTimerBtns();
}

function renderTimerView() {
  const { running, time, total, done } = state.timer;
  const showInput = !running && time === total && !done;
  timerInputRowEl.classList.toggle('hidden', !showInput);
  presetRowEl.classList.toggle('hidden', !showInput);
  timerCircleEl.classList.toggle('hidden', showInput);
}

function renderTimerBtns() {
  const { running, time, total, done, input } = state.timer;
  timerBtnsEl.innerHTML = '';

  if (!running && time === total && !done) {
    const off = input.h === 0 && input.m === 0 && input.s === 0;
    timerBtnsEl.append(mkBtn('Lancer', () => { timerApplyInput(); timerStart(); }, 'primary', off));
  } else if (running) {
    timerBtnsEl.append(mkBtn('Pause', timerPause, 'primary'));
  } else if (!done) {
    timerBtnsEl.append(mkBtn('Reprendre', timerStart, 'primary'));
    timerBtnsEl.append(mkBtn('Reset', timerReset, 'danger'));
  } else {
    timerBtnsEl.append(mkBtn('Reset', timerReset, 'primary'));
  }
}

function renderSpinners() {
  const { h, m, s } = state.timer.input;
  spinHEl.textContent = String(h).padStart(2, '0');
  spinMEl.textContent = String(m).padStart(2, '0');
  spinSEl.textContent = String(s).padStart(2, '0');
}

function updateActivePreset() {
  const { h, m, s } = state.timer.input;
  $$('.preset-btn').forEach(btn => {
    btn.classList.toggle('active-preset', h === 0 && +btn.dataset.min === m && s === 0);
  });
}

// ─── Spinner listeners ────────────────────────────────
$$('.spinner').forEach(spin => {
  const key = spin.dataset.key;
  const max = key === 'h' ? 23 : 59;

  spin.querySelector('.spin-up').addEventListener('click', () => {
    state.timer.input[key] = Math.min(state.timer.input[key] + 1, max);
    renderSpinners();
    updateActivePreset();
    renderTimerBtns();
  });

  spin.querySelector('.spin-down').addEventListener('click', () => {
    state.timer.input[key] = Math.max(state.timer.input[key] - 1, 0);
    renderSpinners();
    updateActivePreset();
    renderTimerBtns();
  });
});

// ─── Preset listeners ─────────────────────────────────
$$('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const min = +btn.dataset.min;
    state.timer.input = { h: 0, m: min, s: 0 };
    const ms = min * 60000;
    state.timer.total = ms;
    state.timer.time  = ms;
    renderSpinners();
    updateActivePreset();
    renderTimerBtns();
  });
});

// ═════════════════════════════════════════════════════
// TAB SWITCHING
// ═════════════════════════════════════════════════════
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    $$('.tab-btn').forEach(b  => b.classList.toggle('active', b === btn));
    $$('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
  });
});

// ═════════════════════════════════════════════════════
// DARK MODE
// ═════════════════════════════════════════════════════
$('darkToggle').addEventListener('click', () => {
  state.dark = !state.dark;
  document.body.classList.toggle('dark', state.dark);
  $('darkToggle').textContent = state.dark ? '☀' : '☽';
});

// ═════════════════════════════════════════════════════
// INIT
// ═════════════════════════════════════════════════════
renderChronoBtns();
renderSpinners();
updateActivePreset();
renderTimerView();
renderTimerBtns();
