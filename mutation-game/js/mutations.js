'use strict';

/* ============================================================================
   Движок мутаций.
   Поле — массив из 25 чисел (0 = пустая клетка). Все функции чистые:
   возвращают новое поле (для ⚫ возвращают исходную ссылку — поле не меняется).
   ============================================================================ */

/** Мутация 🔢: 4 клетки с очками 1..5 в случайных уникальных позициях.
 *  Данные фиксируются в момент генерации и при ретраях повторяются точно. */
function makeAdd() {
  const cells = [];
  while (cells.length < 4) {
    const i = rnd(CELL_COUNT);
    if (cells.some(c => c.i === i)) continue;
    cells.push({ i, v: 1 + rnd(5) });
  }
  return { type: ADD, cells };
}

/** Сдвиг всех клеток на 1 в направлении dir.
 *  Клетки на границе не двигаются; клетка не двигается, если место перед ней
 *  занято (обработка идёт от границы, к которой сдвигаем — «гравитация»). */
function shiftGrid(g, dir) {
  const ng = emptyGrid();

  // порядок обхода: от края, к которому сдвигаемся
  const order = [];
  if (dir === LEFT)  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++)        order.push(r * SIZE + c);
  if (dir === RIGHT) for (let r = 0; r < SIZE; r++) for (let c = SIZE - 1; c >= 0; c--)   order.push(r * SIZE + c);
  if (dir === UP)    for (let c = 0; c < SIZE; c++) for (let r = 0; r < SIZE; r++)        order.push(r * SIZE + c);
  if (dir === DOWN)  for (let c = 0; c < SIZE; c++) for (let r = SIZE - 1; r >= 0; r--)   order.push(r * SIZE + c);

  const canMove = i =>
    (dir === LEFT  && i % SIZE > 0) ||
    (dir === RIGHT && i % SIZE < SIZE - 1) ||
    (dir === UP    && i >= SIZE) ||
    (dir === DOWN  && i < CELL_COUNT - SIZE);

  const delta = dir === LEFT ? -1 : dir === RIGHT ? 1 : dir === UP ? -SIZE : SIZE;

  for (const i of order) {
    const v = g[i];
    if (!v) continue;
    if (canMove(i) && ng[i + delta] === 0) ng[i + delta] = v; // место свободно — двигаемся
    else ng[i] = v;                                           // граница или «пробка» — стоим
  }
  return ng;
}

/** Поворот поля на 90°: CW — по часовой (r,c)→(c, N−1−r), CCW — против. Игрока не трогает. */
function rotateGrid(g, dir) {
  const ng = emptyGrid();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = g[r * SIZE + c];
      if (!v) continue;
      const nr = dir === CW ? c : SIZE - 1 - c;
      const nc = dir === CW ? SIZE - 1 - r : r;
      ng[nr * SIZE + nc] = v;
    }
  }
  return ng;
}

/** Применить мутацию mut к полю grid, вернуть новое поле. */
function applyMutation(grid, mut) {
  switch (mut.type) {
    case GAP: return grid;
    case ADD: {
      const ng = grid.slice();
      for (const c of mut.cells) ng[c.i] = c.v;        // непустые клетки затираются
      return ng;
    }
    case INC: return grid.map(v => v ? Math.min(MAX_VALUE, v + 1) : 0);
    case DEC: return grid.map(v => v > 1 ? v - 1 : v); // единицы не уменьшаются
    case LEFT: case RIGHT: case UP: case DOWN:
      return shiftGrid(grid, mut.type);
    case CW: case CCW:
      return rotateGrid(grid, mut.type);
    default: return grid;
  }
}
