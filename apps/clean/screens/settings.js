// Настройки Уборки — только то, что про дом. Остальное в ядре.

import { html, raw } from "../../../core/dom.js";
import { settings } from "../../../core/screens/settings.js";
import { parseRooms } from "../../../core/vault.js";
import * as M from "../lib/model.js";

export default settings({
  refs: {
    label: "Справочник комнат",
    note: "Планировка живёт в волте: <code>Дом/Комнаты.md</code> — один список на весь дом, общий с Вещами. Колонки: комната, значок, ряд, колонка, ширина. Допиши строку, и на карте появится кабинет или вторая ванная.",
    button: "Обновить карту из волта",
    done: "Карта обновлена",
    rows: (state) => [["Комнат", (state.rooms ?? []).length]],

    apply(read, s) {
      if (read.rooms?.status !== "read") return 0;
      const rooms = parseRooms(read.rooms.text);
      if (!rooms.length) return 0;
      s.rooms = rooms;
      return 1;
    },
  },

  panes(state) {
    const now = M.today();
    const spots = M.alive(state);
    const due = M.dueEverywhere(state, now);
    const never = spots.filter((s) => !s.lastDone);

    return [
      html`<section class="pane">
        <div class="label">Как дела</div>
        <div class="insp-row"><span>Поверхностей</span><span class="tdim num">${spots.length}</span></div>
        <div class="insp-row"><span>Ждут</span><span class="tdim num">${due.length}</span></div>
        <div class="insp-row"><span>Ни разу не убирали</span><span class="tdim num">${never.length}</span></div>
        ${raw(never.length ? `<p class="prose prose--muted">Про них приложение молчит, а не ругается: неизвестно — это не то же самое, что грязно.</p>` : "")}
      </section>`,
    ];
  },
});
