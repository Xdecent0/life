// Everything the shared core needs to know about the kitchen, and nothing more.
//
// Imported first by app.js so the declaration happens before any module asks the
// core a question. The paths are the ones already in the data repository — the
// move into the monorepo changes where the code lives, not where the data does.

import { declare } from "../../core/app.js";
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
  collections: ["list", "stock", "receipts", "menu", "meals", "stores"],

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
