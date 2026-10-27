'use strict';

/* ============================================================================
   Рантайм и интерфейс.
   G — генерация мини-игры { seq, startGrid, goal, limit } (фиксируется до победы).
   R — текущая попытка { grid, pos, score, steps, cursor, finished }.
   При поражении attempt перезапускается с ТОЙ ЖЕ последовательностью.
   ============================================================================ */

let G = null;
let R = null;
let attempts = 1;
let inputLocked = false;
let lastGrid = null;
let loseTimer = null;

/* ---------- mobile touch support ---------- */
let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
let lastTapTime = 0;
const SWIPE_THRESHOLD = 30;   // пикселей для свайпа
const DOUBLE_TAP_MS   = 300;  // окно для двойного тапа

let boardEl, scoreEl, stepsEl, attemptEl, upcomingEl, overlayEl, ovTitleEl, ovTextEl, ovBtnEl;

/** Начать попытку: поле из стартового состояния, игрок в центре, первая 🔢 применена. */
function startRun() {
  R = { grid: G.startGrid.slice(), pos: CENTER, score: 0, steps: 0, cursor: 1, finished: false };
  lastGrid = emptyGrid();
  render(null, 0);
}

/** Новая мини-игра: новая последовательность, цель и лимит. */
function newGame() {
  G = generateGame();
  attempts = 1;
  startRun();
}

function render(mut, gained) {
  boardEl.innerHTML = '';
  for (let i = 0; i < CELL_COUNT; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell' + (i === R.pos ? ' cursor' : '');
    const v = R.grid[i];
    if (v) {
      const val = document.createElement('span');
      val.className = 'v v' + v;
      val.textContent = v;
      if (lastGrid && lastGrid[i] === 0) val.classList.add('pop'); // новые клетки «вспыхивают»
      cell.appendChild(val);
    }
    boardEl.appendChild(cell);
  }

  if (gained > 0) {                                   // всплывающие «+N» над игроком
    const gEl = document.createElement('div');
    gEl.className = 'gain';
    gEl.textContent = '+' + gained;
    const r = Math.floor(R.pos / SIZE), c = R.pos % SIZE;
    gEl.style.left = `calc(var(--gap) + ${c} * (var(--cell) + var(--gap)))`;
    gEl.style.top  = `calc(var(--gap) + ${r} * (var(--cell) + var(--gap)))`;
    boardEl.appendChild(gEl);
    setTimeout(() => gEl.remove(), 700);
  }

  if (mut && mut.type !== GAP) {                      // вспышка поля при эффектной мутации
    boardEl.classList.remove('flash');
    void boardEl.offsetWidth;
    boardEl.classList.add('flash');
  }

  scoreEl.textContent   = `очки: ${R.score}/${G.goal}`;
  stepsEl.textContent   = `шаги: ${R.steps}/${G.limit}`;
  attemptEl.textContent = `попытка №${attempts}`;

  upcomingEl.innerHTML = '';                          // 3 ближайшие мутации
  for (let k = 0; k < 3; k++) {
    const m = G.seq[R.cursor + k] || GAP_MUT;
    const slot = document.createElement('span');
    slot.className = 'slot' + (k === 0 ? ' now' : '');
    slot.textContent = m.type;
    upcomingEl.appendChild(slot);
  }

  lastGrid = R.grid.slice();
}

function showOverlay(title, text, cls, showButton) {
  ovTitleEl.textContent = title;
  ovTitleEl.className = cls;
  ovTextEl.textContent = text;
  ovBtnEl.classList.toggle('hidden', !showButton);
  overlayEl.classList.remove('hidden');
}

function hideOverlay() {
  overlayEl.classList.add('hidden');
}

function win() {
  R.finished = true;
  showOverlay('ПОБЕДА!',
    `${R.score}/${G.goal} очков за ${R.steps}/${G.limit} шагов — оптимальный маршрут найден.`,
    'win', true);
}

function lose() {
  R.finished = true;
  inputLocked = true;
  attempts++;
  showOverlay('ПОРАЖЕНИЕ',
    `${R.score}/${G.goal} очков за ${G.limit} шагов. Последовательность мутаций не меняется — запоминайте. Попытка №${attempts}.`,
    'lose', false);
  loseTimer = setTimeout(() => {
    hideOverlay();
    inputLocked = false;
    startRun();                                      // та же последовательность, с начала
  }, 1500);
}

/** Обработка действия игрока (общая для клавиатуры и тача). */
function playerAction(action) {
  if (!R || R.finished || inputLocked) return;

  let acted = true;
  let gained = 0;

  if (action === 'consume') {                        // потребление клетки
    const v = R.grid[R.pos];
    if (v > 0) { R.grid[R.pos] = 0; R.score += v; gained = v; }
  } else if (action === 'up'    && R.pos >= SIZE)           R.pos -= SIZE;
  else if (action === 'down'  && R.pos < CELL_COUNT - SIZE) R.pos += SIZE;
  else if (action === 'left'  && R.pos % SIZE > 0)          R.pos -= 1;
  else if (action === 'right' && R.pos % SIZE < SIZE - 1)   R.pos += 1;
  else acted = false;

  if (!acted) return;                                // движение в стену — не ход

  R.steps++;
  const mut = G.seq[R.cursor] || GAP_MUT;            // действие игрока → мутация → сдвиг курсора
  R.grid = applyMutation(R.grid, mut);
  R.cursor++;

  render(mut, gained);

  if (R.score >= G.goal) { win(); return; }          // цель набрана
  if (R.steps >= G.limit) lose();                    // ходы кончились
}

function onKey(e) {
  const codes = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
  if (!codes.includes(e.code)) return;
  e.preventDefault();

  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Space: 'consume' };
  playerAction(map[e.code]);
}

/* ---------- touch handlers (swipe + double-tap) ---------- */
function onTouchStart(e) {
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartTime = Date.now();
}

function onTouchEnd(e) {
  if (!R || R.finished || inputLocked) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const elapsed = Date.now() - touchStartTime;

  // Проверка двойного тапа (потребление клетки)
  const now = Date.now();
  if (elapsed < DOUBLE_TAP_MS && Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
    if (now - lastTapTime < DOUBLE_TAP_MS) {
      playerAction('consume');
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;
  }

  // Свайп (перемещение)
  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return; // слишком коротко
  if (Math.abs(dx) > Math.abs(dy)) {
    playerAction(dx > 0 ? 'right' : 'left');
  } else {
    playerAction(dy > 0 ? 'down' : 'up');
  }
}

function initUI() {
  boardEl    = document.getElementById('board');
  scoreEl    = document.getElementById('score');
  stepsEl    = document.getElementById('steps');
  attemptEl  = document.getElementById('attempt');
  upcomingEl = document.getElementById('upcoming');
  overlayEl  = document.getElementById('overlay');
  ovTitleEl  = document.getElementById('ovTitle');
  ovTextEl   = document.getElementById('ovText');
  ovBtnEl    = document.getElementById('ovBtn');

  window.addEventListener('keydown', onKey);
  ovBtnEl.addEventListener('click', () => {          // «НОВАЯ ИГРА» — новая генерация
    clearTimeout(loseTimer);
    hideOverlay();
    inputLocked = false;
    newGame();
  });

  // Touch controls (mobile)
  boardEl.addEventListener('touchstart', onTouchStart, { passive: true });
  boardEl.addEventListener('touchend', onTouchEnd, { passive: true });

  newGame();
}

/* В браузере запускаем сразу; в node (тесты логики) — пропускаем */
if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initUI();
}
