// Всё, что ядру нужно знать про Места.

import { declare } from "../../core/app.js";
import { EMPTY_STATE } from "./lib/store.js";

export default declare({
  key: "places",
  name: "Места",
  empty: EMPTY_STATE,

  paths: {
    places: "Места/Состояние/места.json",
  },

  collections: ["places"],

  references: {
    kinds: "Места/Справочники/Виды.md",
  },
});
