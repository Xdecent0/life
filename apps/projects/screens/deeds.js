// Дела: все разом, а не по одному проекту. Срок красит только просроченное.

import { html, raw, esc, toast } from "../../../core/dom.js";
import * as M from "../lib/model.js";
import { queue } from "./row.js";

let showDone = false;

export default {
  title: () => "Дела",

  render(state) {
    const now = M.today();
    const all = M.deeds(state);
    const rows = showDone ? all : all.filter((d) => !d.сделано);
    const late = all.filter((d) => M.overdue(d, now)).length;

    return html`<main class="screen">
      <header class="head head--dark">
        <div>
          <h1>Дела</h1>
          <span class="head-sub num">${M.openDeeds(state).length} открыто${late ? ` · ${late} просрочено` : ""}</span>
        </div>
        <div class="seg" role="group" aria-label="Что показывать">
          <button class="seg-btn" type="button" data-act="filter" data-done="0" aria-pressed="${!showDone}">Открытые</button>
          <button class="seg-btn" type="button" data-act="filter" data-done="1" aria-pressed="${showDone}">Все</button>
        </div>
      </header>

      <div class="body">
        ${raw(rows.length ? `<section class="pane">
          ${rows.map((d) => `<label class="check ${d.сделано ? "check--done" : ""}">
            <input type="checkbox" data-act-change="deed" data-id="${esc(d.ид)}" ${d.сделано ? "checked" : ""}>
            <span class="check-text">${esc(d.текст)}${d.проект ? ` <span class="tdim">· ${esc(d.проект)}</span>` : ""}</span>
            ${d.ждёт ? `<span class="chip chip--sm">ждёт волта</span>`
              : d.срок ? `<span class="tdim ${M.overdue(d, now) ? "tdim--alarm" : ""}">${esc(d.срок)}</span>` : ""}
          </label>`).join("")}
        </section>` : `<div class="empty"><h2>${showDone ? "Дел нет вовсе" : "Открытых дел нет"}</h2><p>Разовые дела живут строками в заметке «✅ Дела» волта. Заводятся на странице проекта или на доске.</p></div>`)}

        <p class="prose prose--muted">Закрытое дело не удаляется — оно переезжает в раздел «Сделано» той же заметки.</p>
      </div>
    </main>`;
  },

  actions: {
    filter(el) {
      showDone = el.dataset.done === "1";
      toast(showDone ? "Показаны все" : "Только открытые");
    },

    deed(el) {
      queue(M.change("дело", { ид: el.dataset.id, сделано: el.checked }));
    },
  },
};
