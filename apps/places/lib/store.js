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
    at: Date.now(),
  };
}
