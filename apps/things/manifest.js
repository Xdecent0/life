// Everything the shared core needs to know about Вещи.
//
// One collection, two reference tables, a folder in the same data repository the
// kitchen uses. That is the whole declaration — proof that the core came out of
// the kitchen clean rather than the kitchen being renamed.

import { declare } from "../../core/app.js";
import { EMPTY_STATE } from "./lib/store.js";

export default declare({
  key: "things",
  name: "Вещи",
  empty: EMPTY_STATE,

  paths: {
    things: "Вещи/Состояние/вещи.json",
    rates: "Состояние/курсы.json",
  },

  collections: ["things"],

  /** Read, never written — the scheduled Action owns the rates file. */
  singles: [{ key: "rates", readOnly: true, accept: (data) => Boolean(data?.days) }],

  references: {
    /** One list for the whole house — Уборка read the same file. */
    places: "Дом/Комнаты.md",
    kinds: "Вещи/Справочники/Виды.md",
  },
});
