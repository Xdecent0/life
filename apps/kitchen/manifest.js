// Everything the shared core needs to know about the kitchen, and nothing more.
//
// Imported first by app.js so the declaration happens before any module asks the
// core a question. The paths are the ones already in the data repository — the
// move into the monorepo changes where the code lives, not where the data does.

import { declare } from "../../core/app.js";
import { foldClosed, mergeStamps, mergeRules, mergeLongest, mergeGone, mergeHistory } from "../../core/sync.js";
import { EMPTY_STATE, looksLikeDemo } from "./lib/store.js";

export default declare({
  key: "kitchen",
  name: "Кухня",
  empty: EMPTY_STATE,

  paths: {
    stock: "Состояние/склад.json",
    list: "Состояние/список.json",
    rules: "Состояние/правила.json",
    history: "Состояние/расход.json",
    gone: "Состояние/снятое.json",
    rulesGone: "Состояние/забытое.json",
    shelfLearned: "Состояние/сроки-выучено.json",
    /** Written only by the scheduled Action; the app reads it and never writes back. */
    rates: "Состояние/курсы.json",
    menu: "Состояние/меню.json",
    meals: "Состояние/трекинг.json",
    stores: "Состояние/магазины.json",
    receipts: "Состояние/чеки.json",
    receipt: (id) => `Чеки/${id}.json`,
  },

  /** Merged record by record, with tombstones. Order is the order they sync in. */
  collections: [
    "list",
    /* A finished position is flagged, never removed, so a year of groceries
       would stay in the file at full width. After three months it has nothing
       left to say and becomes an ordinary tombstone. */
    { key: "stock", fold: foldClosed },
    "receipts",
    "menu",
    "meals",
    "stores",
  ],

  /**
   * The files that are one blob rather than a list of records. Order matters:
   * removals are written before the thing that subtracts them, or there is one
   * round trip where a date the person deleted comes back. Each merge receives
   * what the earlier ones produced as its third argument.
   */
  singles: [
    { key: "rulesGone", message: "забытые правила", merge: (mine, theirs) => mergeStamps(mine ?? {}, theirs) },
    { key: "rules", message: "правила", merge: (mine, theirs, done) => mergeRules(mine ?? {}, theirs, done.rulesGone ?? {}) },
    // The longest observed life wins: both sides are reporting something that
    // actually survived that long, so the larger number is the truer one.
    { key: "shelfLearned", message: "выученные сроки", merge: (mine, theirs) => mergeLongest(mine ?? {}, theirs) },
    { key: "gone", message: "снятое", merge: (mine, theirs) => mergeGone(mine ?? {}, theirs) },
    { key: "history", message: "расход", merge: (mine, theirs, done) => mergeHistory(mine ?? {}, theirs, done.gone ?? {}) },
    /** Written by the scheduled Action alone; a day without rates is not an empty table. */
    { key: "rates", readOnly: true, accept: (data) => Boolean(data?.days) },
  ],

  references: {
    shelf: "Справочники/Сроки.md",
    synonyms: "Справочники/Синонимы.md",
    aisles: "Справочники/Отделы.md",
    zones: "Справочники/Зоны.md",
  },

  /* A state saved before the demo flag existed has to be recognised by its
     contents, or the seeded demo quietly syncs into a real repository. */
  onLoad(state) {
    if (state.demo === undefined) state.demo = looksLikeDemo(state);
  },
});
