// Настройки Вещей — только то, что действительно про вещи. Остальное в ядре.

import { html, raw } from "../../../core/dom.js";
import { settings } from "../../../core/screens/settings.js";
import { parseRooms, parseAisles } from "../../../core/vault.js";
import * as M from "../lib/model.js";

export default settings({
  refs: {
    note: "Комнаты — общий список на весь дом: <code>Дом/Комнаты.md</code>, тот же, по которому Уборка рисует план. Виды — <code>Вещи/Справочники/Виды.md</code>. Допиши строку — появится погреб, гараж или ящик с проводами.",
    rows: (state) => [
      ["Мест", (state.places ?? []).length],
      ["Видов", (state.kinds ?? []).length],
    ],

    apply(read, s) {
      let applied = 0;

      if (read.places?.status === "read") {
        // Всё, включая «с собой»: место без координат на плане не рисуется,
        // но ответом на «где оно» остаётся.
        const places = parseRooms(read.places.text).map((r) => ({ name: r.name, icon: r.icon, into: r.into }));
        if (places.length) {
          s.places = places;
          applied += 1;
        }
      }

      if (read.kinds?.status === "read") {
        const kinds = parseAisles(read.kinds.text);
        if (kinds.length) {
          s.kinds = kinds.map((k) => ({ order: k.order, name: k.name, items: k.items }));
          applied += 1;
        }
      }

      return applied;
    },
  },

  panes(state) {
    const alive = M.alive(state);
    const worth = M.worth(alive);

    return [
      html`<section class="pane">
        <div class="label">Сколько всего</div>
        <div class="insp-row"><span>Вещей</span><span class="tdim num">${alive.length}</span></div>
        <div class="insp-row"><span>С гарантией</span><span class="tdim num">${alive.filter((t) => t.warrantyUntil).length}</span></div>
        <div class="insp-row"><span>Гарантия кончается</span><span class="tdim num">${alive.filter((t) => M.warrantyRunningOut(t)).length}</span></div>
        ${raw(worth ? `<div class="insp-row"><span>На сумму</span><span class="tdim num">${Math.round(worth).toLocaleString("ru")} ₴</span></div>` : "")}
        <p class="prose prose--muted">Сумма считается только по тем вещам, у которых записана цена — это не оценка имущества, а сложение того, что ты сам вписал.</p>
      </section>`,
    ];
  },
});
