'use strict';

/* ============================================================================
   Решатель.
   Игра полностью детерминирована: последовательность мутаций зафиксирована,
   мутации не зависят от действий игрока. Состояние поиска — (поле, позиция
   игрока, счёт). На каждом шаге игрок: 4 движения либо потребление клетки
   (пустая тоже ход — холостой). После действия применяется мутация seq[d].

   computeBestScores возвращает best[d] — максимум очков, достижимый ровно
   за d действий. best не убывает (лишний ход можно «пересидеть»).
   ============================================================================ */

function computeBestScores(startGrid, seq, maxDepth) {
  const keyOf = (g, p) => g.join('') + '#' + p;
  let states = new Map([[keyOf(startGrid, CENTER), { g: startGrid, p: CENTER, s: 0 }]]);
  const best = [0];

  for (let d = 1; d <= maxDepth; d++) {
    const mut = seq[d] || GAP_MUT;
    const next = new Map();
    const offer = (g, p, s) => {
      const key = g.join('') + '#' + p;
      const cur = next.get(key);
      if (!cur || s > cur.s) next.set(key, { g, p, s });  // доминирование: max очков на (поле, позиция)
    };

    for (const { g, p, s } of states.values()) {
      const gStay = applyMutation(g, mut);      // поле после мутации, если игрок не потреблял клетку

      if (p >= SIZE)             offer(gStay, p - SIZE, s);
      if (p < CELL_COUNT - SIZE) offer(gStay, p + SIZE, s);
      if (p % SIZE > 0)          offer(gStay, p - 1, s);
      if (p % SIZE < SIZE - 1)   offer(gStay, p + 1, s);
      offer(gStay, p, s);                      // потребление пустой клетки = холостой ход

      const v = g[p];
      if (v) {                                  // потребление непустой клетки
        const gc = g.slice();
        gc[p] = 0;
        offer(applyMutation(gc, mut), p, s + v);
      }
    }

    states = next;
    let b = 0;
    for (const st of next.values()) if (st.s > b) b = st.s;
    best.push(b);
  }
  return best;
}

/** Выбор цели и лимита ходов.
 *  Берём последнюю точку роста best внутри окна [WIN_LO..WIN_HI]:
 *  тогда goal = best[D], и достигнуть goal быстрее чем за D шагов невозможно. */
function pickGoal(best) {
  let D = -1;
  for (let d = WIN_LO; d <= WIN_HI; d++) {
    if (best[d] > best[d - 1]) D = d;
  }
  if (D === -1) {                       // роста в окне нет: момент первого достижения максимума окна
    const target = best[WIN_HI];
    D = 0;
    while (D < WIN_HI && best[D] < target) D++;
  }
  return { limit: D, goal: best[D] };
}

/** Полная генерация мини-игры: последовательность + цель + лимит ходов. */
function generateGame() {
  let game = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const seq = genSequence();
    const startGrid = applyMutation(emptyGrid(), seq[0]);   // сразу применяем первую мутацию 🔢
    const best = computeBestScores(startGrid, seq, SOLVE_DEPTH);
    const { limit, goal } = pickGoal(best);
    game = { seq, startGrid, limit, goal };
    if (goal >= MIN_GOAL && limit >= MIN_LIMIT) break;      // принимаем «интересную» генерацию
  }
  return game;
}
