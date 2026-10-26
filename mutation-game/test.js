'use strict';

/* ============================================================================
   Тесты логики «МУТАГЕН» на node: examples из цель.txt + инварианты.
   Запуск:  node test.js
   Загружаем файлы игры в один vm-контекст (как это сделал бы браузер
   несколькими <script>), UI при этом не активируется (нет document).
   ============================================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = ['js/constants.js', 'js/mutations.js', 'js/sequence.js', 'js/solver.js', 'js/main.js'];

const sandbox = { console };
vm.createContext(sandbox);

for (const f of FILES) {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  vm.runInContext(src, sandbox, { filename: f });
}

const EXPORTS = {};
sandbox.__expose = obj => Object.assign(EXPORTS, obj);
vm.runInContext(`
;__expose({ SIZE, CELL_COUNT, CENTER, GAP, ADD, LEFT, RIGHT, UP, DOWN, INC, DEC, CW, CCW,
            SEQ_LEN, makeAdd, genSequence, applyMutation,
            computeBestScores, pickGoal, generateGame, emptyGrid });`, sandbox);

const E = EXPORTS;
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('FAIL:', msg); }
}
function gridEq(a, b) { return a.length === b.length && a.every((v, i) => v === b[i]); }
function fmt(g) {
  let s = '';
  for (let r = 0; r < 5; r++) s += '|' + g.slice(r * 5, r * 5 + 5).map(v => v ? String(v) : ' ').join(',') + '|\n';
  return s;
}

/* ---------- стартовое поле из ТЗ: [0,1]=2, [3,4]=3, [0,4]=5, [4,0]=3 ---------- */
const exGrid = (() => {
  const g = E.emptyGrid();
  g[1] = 2; g[4] = 5; g[19] = 3; g[20] = 3;
  return g;
})();

/* ---------- сдвиг влево (пример из ТЗ) ---------- */
{
  const out = E.applyMutation(exGrid.slice(), { type: E.LEFT });
  const exp = E.emptyGrid();
  exp[0] = 2; exp[3] = 5; exp[18] = 3; exp[20] = 3;
  assert(gridEq(out, exp), 'сдвиг влево\nполучено:\n' + fmt(out) + 'ожидалось:\n' + fmt(exp));
}

/* ---------- заблокированный сдвиг: клетки у границы и «пробки» ---------- */
{
  const g = E.emptyGrid();
  g[0] = 2; g[1] = 3;                       // |2|3| | | |
  const out = E.applyMutation(g, { type: E.LEFT });
  const exp = E.emptyGrid();
  exp[0] = 2; exp[1] = 3;
  assert(gridEq(out, exp), 'сдвиг влево: граница/пробка не двигаются');

  const g2 = E.emptyGrid();
  g2[1] = 2; g2[2] = 3;                     // | |2|3| | |
  const out2 = E.applyMutation(g2, { type: E.LEFT });
  const exp2 = E.emptyGrid();
  exp2[0] = 2; exp2[1] = 3;
  assert(gridEq(out2, exp2), 'сдвиг влево «поездом»');
}

/* ---------- ➕ (пример из ТЗ) ---------- */
{
  const out = E.applyMutation(exGrid.slice(), { type: E.INC });
  const exp = E.emptyGrid();
  exp[1] = 3; exp[4] = 6; exp[19] = 4; exp[20] = 4;
  assert(gridEq(out, exp), 'увеличение ➕');
}

/* ---------- ➖ (пример из ТЗ, единицы не трогаем) ---------- */
{
  const out = E.applyMutation(exGrid.slice(), { type: E.DEC });
  const exp = E.emptyGrid();
  exp[1] = 1; exp[4] = 4; exp[19] = 2; exp[20] = 2;
  assert(gridEq(out, exp), 'уменьшение ➖');

  const g = E.emptyGrid();
  g[0] = 1;
  assert(E.applyMutation(g, { type: E.DEC })[0] === 1, '➖ не трогает клетки со значением 1');
}

/* ---------- повороты (примеры из ТЗ) ---------- */
{
  const out = E.applyMutation(exGrid.slice(), { type: E.CW });
  const exp = E.emptyGrid();
  exp[0] = 3;   // [4,0] -> [0,0]
  exp[9] = 2;   // [0,1] -> [1,4]
  exp[21] = 3;  // [3,4] -> [4,1]
  exp[24] = 5;  // [0,4] -> [4,4]
  assert(gridEq(out, exp), 'поворот ↩ по часовой\nполучено:\n' + fmt(out) + 'ожидалось:\n' + fmt(exp));

  const out2 = E.applyMutation(exGrid.slice(), { type: E.CCW });
  const exp2 = E.emptyGrid();
  exp2[0] = 5;   // [0,4] -> [0,0]
  exp2[3] = 3;   // [3,4] -> [0,3]
  exp2[15] = 2;  // [0,1] -> [3,0]
  exp2[24] = 3;  // [4,0] -> [4,4]
  assert(gridEq(out2, exp2), 'поворот ↪ против часовой\nполучено:\n' + fmt(out2) + 'ожидалось:\n' + fmt(exp2));
}

/* ---------- 🔢 затирает непустые клетки ---------- */
{
  const mut = { type: E.ADD, cells: [{ i: 1, v: 4 }, { i: 0, v: 1 }, { i: 12, v: 5 }, { i: 24, v: 2 }] };
  const out = E.applyMutation(exGrid.slice(), mut);
  assert(out[1] === 4 && out[0] === 1 && out[12] === 5 && out[24] === 2, '🔢 перезаписывает клетки');
}

/* ---------- инварианты генерации последовательности ---------- */
{
  const valid = new Set([E.GAP, E.ADD, E.LEFT, E.RIGHT, E.UP, E.DOWN, E.INC, E.DEC, E.CW, E.CCW]);
  let ok = true;
  for (let t = 0; t < 500 && ok; t++) {
    const seq = E.genSequence();
    if (seq.length !== E.SEQ_LEN)                                    { assert(false, 'длина последовательности'); ok = false; break; }
    if (seq[0].type !== E.ADD)                                       { assert(false, 'первая мутация — 🔢'); ok = false; break; }
    if (seq[0].cells.length !== 4)                                   { assert(false, '🔢 добавляет 4 клетки'); ok = false; break; }
    if (new Set(seq[0].cells.map(c => c.i)).size !== 4)              { assert(false, 'позиции 🔢 уникальны'); ok = false; break; }
    if (!seq[0].cells.every(c => c.v >= 1 && c.v <= 5))              { assert(false, 'значения 🔢 от 1 до 5'); ok = false; break; }
    let adds = 0;
    for (let i = 0; i < seq.length; i++) {
      if (!valid.has(seq[i].type))                                   { assert(false, 'допустимый тип мутации'); ok = false; break; }
      if (seq[i].type === E.ADD) adds++;
      if (i > 0 && seq[i].type !== E.GAP && seq[i - 1].type !== E.GAP) { assert(false, 'между мутациями нет пробела'); ok = false; break; }
    }
    if (adds > 3)                                                    { assert(false, 'не больше 3 волн 🔢'); ok = false; break; }
    if (seq[seq.length - 1].type !== E.GAP || seq[seq.length - 2].type !== E.GAP) { assert(false, 'хвост из пробелов'); ok = false; break; }
  }
  if (ok) passed++;
}

/* ---------- решатель на «коротком примере» из ТЗ ----------
   🔢⚫⚫🔼⚫➕⚫⚫⚫↪⚫➕⚫⚫➕⚫⚫⚫⚫⚫...
   заполнение: [0,1]=2, [3,4]=3, [0,4]=5, [4,0]=3                              */
{
  const seq = Array.from({ length: E.SEQ_LEN }, () => ({ type: E.GAP }));
  seq[0]  = { type: E.ADD, cells: [{ i: 1, v: 2 }, { i: 19, v: 3 }, { i: 4, v: 5 }, { i: 20, v: 3 }] };
  seq[3]  = { type: E.UP };
  seq[5]  = { type: E.INC };
  seq[9]  = { type: E.CCW };
  seq[11] = { type: E.INC };
  seq[14] = { type: E.INC };

  const startGrid = E.applyMutation(E.emptyGrid(), seq[0]);
  const best = E.computeBestScores(startGrid, seq, 12);
  for (let d = 1; d < best.length; d++) assert(best[d] >= best[d - 1], 'best не убывает');
  assert(best[10] >= 10, 'за 10 шагов набирается 10 очков (пример из ТЗ), best=' + best.join(','));
  console.log('best по шагам (пример ТЗ):', best.join(','));

  /* точная репликация прохождения из ТЗ */
  let grid = startGrid, pos = E.CENTER, score = 0, cursor = 1;
  const moves = ['ArrowUp', 'ArrowUp', 'ArrowRight', 'Space', 'Space', 'ArrowRight', 'Space', 'ArrowLeft', 'ArrowLeft', 'Space'];
  for (const m of moves) {
    if (m === 'Space') { const v = grid[pos]; if (v) { grid[pos] = 0; score += v; } }
    else if (m === 'ArrowUp')    pos -= 5;
    else if (m === 'ArrowDown')  pos += 5;
    else if (m === 'ArrowLeft')  pos -= 1;
    else                         pos += 1;
    grid = E.applyMutation(grid, seq[cursor++]);
  }
  assert(score === 10 && pos === 2, `финал прохождения из ТЗ: 10 очков, игрок в [0,2] (score=${score}, pos=${pos})`);
  const expFin = E.emptyGrid();
  expFin[15] = 3; expFin[23] = 4;
  assert(gridEq(grid, expFin), 'финальное поле как в ТЗ\nполучено:\n' + fmt(grid) + 'ожидалось:\n' + fmt(expFin));
}

/* ---------- generateGame: цель достижима ровно за лимит ---------- */
{
  const t0 = Date.now();
  for (let t = 0; t < 5; t++) {
    const g = E.generateGame();
    assert(g.goal >= 1 && g.limit >= 1, 'цель и лимит положительны');
    assert(g.seq[0].type === E.ADD, 'генерация начинается с 🔢');
    const best = E.computeBestScores(g.startGrid, g.seq, g.limit);
    assert(best[g.limit] >= g.goal, `цель ${g.goal} достижима за лимит ${g.limit}`);
    assert(best[g.limit - 1] < g.goal, `цель ${g.goal} недостижима быстрее чем за ${g.limit} шагов`);
    console.log(`генерация: цель=${g.goal}, лимит=${g.limit}`);
  }
  console.log('generateGame: 5 игр за', Date.now() - t0, 'мс');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
