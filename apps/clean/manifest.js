// Всё, что ядру нужно знать про Уборку.

import { declare } from "../../core/app.js";
import { EMPTY_STATE } from "./lib/store.js";

export default declare({
  key: "clean",
  name: "Уборка",
  empty: EMPTY_STATE,

  paths: {
    spots: "Уборка/Состояние/поверхности.json",
    rooms: "Уборка/Состояние/комнаты.json",
  },

  collections: ["spots", "rooms"],

  references: {
    /** One list for the whole house — Вещи read the same file. */
    rooms: "Дом/Комнаты.md",
    spots: "Уборка/Справочники/Поверхности.md",
  },
});
