// Настройки Мест — только то, что про места. Остальное в ядре.

import { html, raw, esc } from "../../../core/dom.js";
import { settings } from "../../../core/screens/settings.js";
import { parseAisles } from "../../../core/vault.js";
import * as M from "../lib/model.js";

export default settings({
  refs: {
    label: "Справочник видов",
    note: "Виды мест — таблица в волте: <code>Места/Справочники/Виды.md</code>. По ней приложение угадывает вид из названия.",
    button: "Обновить справочник из волта",
    done: "Справочник обновлён",
    rows: (state) => [["Видов", (state.kinds ?? []).length]],

    apply(read, s) {
      if (read.kinds?.status !== "read") return 0;
      const kinds = parseAisles(read.kinds.text);
      if (!kinds.length) return 0;
      s.kinds = kinds.map((k) => ({ order: k.order, name: k.name, items: k.items }));
      return 1;
    },
  },

  panes(state) {
    const now = M.today();
    const all = M.alive(state);
    const best = M.best(M.visited(state), 5);

    return [
      html`<section class="pane">
        <div class="label">Как дела</div>
        <div class="insp-row"><span>Хочу сходить</span><span class="tdim num">${M.wanted(state).length}</span></div>
        <div class="insp-row"><span>Был</span><span class="tdim num">${M.visited(state).length}</span></div>
        <div class="insp-row"><span>Зовёт обратно</span><span class="tdim num">${all.filter((p) => M.callsBack(p, now)).length}</span></div>
      </section>`,

      best.length
        ? html`<section class="pane">
            <div class="label">Лучшее</div>
            ${raw(best.map((p) => `<div class="insp-row"><a href="#place/${esc(p.id)}">${esc(p.name)}</a><span class="tdim">${"★".repeat(p.rating)}</span></div>`).join(""))}
          </section>`
        : null,
    ];
  },
});
