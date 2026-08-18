// Пустое состояние и форма записи.

import { SEED_KINDS } from "./model.js";

export { SEED_KINDS };

export const EMPTY_STATE = {
  version: 1,
  places: [],
  kinds: SEED_KINDS,
  queue: [],
  syncedAt: null,
};

export function blank({ id, name, kind = null, area = "" }) {
  return {
    id,
    name,
    kind,
    area,
    /** Каждый поход — отметка времени. Их число и есть «сколько раз был». */
    visits: [],
    /** Ноль означает «не оценивал», а не «плохо». */
    rating: null,
    /** Только для тех немногих, куда правда хочется возвращаться. */
    every: null,
    note: "",
    url: "",
    /* Когда запись завели. `at` — это последняя правка, и по нему нельзя
       сказать, сколько «хочу сходить» лежит без движения: любое касание
       обнуляет счёт. У записей, заведённых раньше этого поля, его нет — и
       тогда приложение честно говорит «без движения», а не «записано». */
    addedAt: Date.now(),
    at: Date.now(),
  };
}
