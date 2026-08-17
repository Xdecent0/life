// Пустое состояние и заселение квартиры.

import { SEED_ROOMS, SEED_SPOTS } from "./model.js";

export { SEED_ROOMS, SEED_SPOTS };

export const EMPTY_STATE = {
  version: 1,
  rooms: SEED_ROOMS,
  /** Одна запись на поверхность. Пол на кухне и пол в ванной — разные записи. */
  spots: [],
  queue: [],
  syncedAt: null,
};

export function blankSpot({ id, room, name, every = 7 }) {
  return {
    id,
    room,
    name,
    every,
    /** Никогда не убиралось — не то же самое, что убиралось давно. */
    lastDone: null,
    note: "",
    at: Date.now(),
  };
}

/**
 * Заселение: обычная квартира одним нажатием.
 *
 * Пустой экран с полем «добавь поверхность» — это тест на терпение: никто не
 * вспомнит с нуля, что в ванной четыре разных дела. Список правится и чистится,
 * лишнее удаляется двумя кликами — это дешевле, чем вспоминать.
 */
export function moveIn(uid) {
  return SEED_SPOTS.map((s) => blankSpot({ id: uid("sp"), room: s.room, name: s.name, every: s.every }));
}
