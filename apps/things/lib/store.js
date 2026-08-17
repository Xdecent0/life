// The shape of a state with no things in it, plus the tables that ship with the
// app until the vault has better ones.

import { SEED_PLACES, SEED_KINDS } from "./model.js";

export { SEED_PLACES, SEED_KINDS };

export const EMPTY_STATE = {
  version: 1,
  currency: "₴",
  showCurrencies: [],
  rates: null,

  /** One record per object. Two identical chairs are two records — they wear out apart. */
  things: [],

  places: SEED_PLACES,
  kinds: SEED_KINDS,

  queue: [],
  syncedAt: null,
};

/** A thing, with every field the app will look for already present. */
export function blank({ id, name, place = null, kind = null }) {
  return {
    id,
    name,
    kind,
    place,
    note: "",
    serial: "",
    price: null,
    boughtAt: null,
    warrantyUntil: null,
    /** Given away, sold or thrown out — kept as a record of what used to be here. */
    gone: false,
    at: Date.now(),
  };
}
