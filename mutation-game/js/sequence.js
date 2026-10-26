'use strict';

/* ============================================================================
   Генерация случайной последовательности мутаций.
   Правила из ТЗ:
     • первая мутация всегда 🔢 (с фиксированными позициями/значениями);
     • между эффектными мутациями минимум один пробел ⚫ (1..3);
     • после активной части — только пробелы до конца SEQ_LEN.
   ============================================================================ */

function genSequence() {
  const seq = [makeAdd()];                 // первая мутация — всегда 🔢
  let adds = 1;

  const extras = 5 + rnd(4);               // 5..8 мутаций после первой
  for (let k = 0; k < extras; k++) {
    const at = seq.length + 1 + rnd(3);    // индекс следующей мутации: ≥1 пробел после предыдущей
    if (at >= SEQ_LEN - 3) break;          // оставляем хвост из пробелов
    while (seq.length < at) seq.push(GAP_MUT);

    const r = Math.random();
    if (r < 0.18 && adds < MAX_ADDS) { seq.push(makeAdd()); adds++; }               // 🔢
    else if (r < 0.53)               seq.push({ type: [LEFT, RIGHT, UP, DOWN][rnd(4)] });
    else if (r < 0.68)               seq.push({ type: INC });
    else if (r < 0.83)               seq.push({ type: DEC });
    else                             seq.push({ type: rnd(2) ? CW : CCW });
  }

  while (seq.length < SEQ_LEN) seq.push(GAP_MUT);   // дальше — только пробелы
  return seq;
}
