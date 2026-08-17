// Дела: все разом, а не по одному проекту. Срок красит только просроченное.

import { html, raw, esc, toast, wide } from "../../../core/dom.js";
import { touch } from "../../../core/state.js";
import { cursor, hint } from "../../../core/keys.js";
import * as M from "../lib/model.js";
import { queue } from "./row.js";

let showDone = false;
let view = "список";
const nav = cursor();

/**
 * Календарь дел.
 *
 * Список отвечает «что не сделано», и срок в нём — подпись сбоку. Вопрос, ради
 * которого сроки вообще ставят, другой: не завалена ли следующая среда. На него
 * отвечает только сетка — потому что в ней видно и пустые дни тоже.
 */
function grid(state) {
  const { days, overdue, later, noDate } = M.calendar(state);
  const now = M.today();

  const cell = (d) => {
    const rows = d.deeds.map((x) => `<button class="calrow" type="button" data-act="tick" data-id="${esc(x.ид)}"
      title="${esc(x.текст)}${x.проект ? ` · ${esc(x.проект)}` : ""}">${esc(x.текст)}</button>`).join("");

    return `<div class="calday" data-today="${d.today ? 1 : 0}" data-past="${d.past ? 1 : 0}" data-busy="${d.deeds.length ? 1 : 0}">
      <span class="calnum num">${M.dayNum(d.at)}</span>
      ${rows}
    </div>`;
  };

  const pile = (name, rows, tone) => rows.length
    ? `<section class="pane ${tone ?? ""}">
        <div class="head-row"><div class="label">${esc(name)}</div><span class="tdim num">${rows.length}</span></div>
        ${rows.map((d) => `<label class="check">
          <input type="checkbox" data-act-change="deed" data-id="${esc(d.ид)}">
          <span class="check-text">${esc(d.текст)}</span>
          ${d.срок ? `<span class="tdim ${M.overdue(d, now) ? "tdim--alarm" : ""}">${esc(d.срок)}</span>` : ""}
        </label>`).join("")}
      </section>`
    : "";

  return html`${raw(pile("Просрочено", overdue, "pane--alarm"))}

    <div class="cal">
      ${raw(M.WEEKDAYS.map((w) => `<span class="calhead">${w}</span>`).join(""))}
      ${raw(days.map(cell).join(""))}
    </div>

    ${raw(pile("Дальше", later))}
    ${raw(pile("Без срока", noDate))}

    <p class="prose prose--muted plan-note">Просроченное в сетку не идёт: у него уже нет своего места в будущем, а рисовать его на прошлой неделе значит прятать. Щелчок по делу в клетке закрывает его — правка уедет в заметку «Дела».</p>`;
}

export default {
  title: () => "Дела",

  render(state) {
    const now = M.today();
    const all = M.deeds(state);
    const rows = showDone ? all : all.filter((d) => !d.сделано);
    const late = all.filter((d) => M.overdue(d, now)).length;
    const at = nav.on(rows);

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
        <div class="seg seg--sm" role="group" aria-label="Как показывать">
          <span class="seg-label">видом</span>
          ${raw(["список", "календарём"].map((v) =>
            `<button class="seg-btn" type="button" data-act="view" data-view="${v}" aria-pressed="${view === v}">${v}</button>`).join(""))}
        </div>
      </header>

      <div class="body">
        ${raw(view === "календарём" ? grid(state) : rows.length ? `<section class="pane">
          ${rows.map((d, i) => `<label class="check ${d.сделано ? "check--done" : ""}" data-focused="${i === at ? 1 : 0}">
            <input type="checkbox" data-act-change="deed" data-id="${esc(d.ид)}" ${d.сделано ? "checked" : ""}>
            <span class="check-text">${esc(d.текст)}${d.проект ? ` <span class="tdim">· ${esc(d.проект)}</span>` : ""}</span>
            ${d.ждёт ? `<span class="chip chip--sm">ждёт волта</span>`
              : d.срок ? `<span class="tdim ${M.overdue(d, now) ? "tdim--alarm" : ""}">${esc(d.срок)}</span>` : ""}
          </label>`).join("")}
        </section>` : `<div class="empty"><h2>${showDone ? "Дел нет вовсе" : "Открытых дел нет"}</h2><p>Разовые дела живут строками в заметке «✅ Дела» волта. Заводятся на странице проекта или на доске.</p></div>`)}

        ${raw(wide.matches && rows.length ? hint([["↑↓", "ходить"], ["Space", "сделано"]]) : "")}

        <p class="prose prose--muted">Закрытое дело не удаляется — оно переезжает в раздел «Сделано» той же заметки.</p>
      </div>
    </main>`;
  },

  keys(e, state) {
    if (view === "календарём") return;
    const all = M.deeds(state);
    const rows = showDone ? all : all.filter((d) => !d.сделано);

    nav.keys(e, rows, {
      redraw: () => touch("дела.курсор"),
      act: (d) => {
        queue(M.change("дело", { ид: d.ид, сделано: !d.сделано }));
        toast(d.сделано ? "Снято" : "Сделано — уедет в заметку");
      },
    });
  },

  actions: {
    view(el) { view = el.dataset.view; touch("дела.вид"); },

    /** Щелчок по делу в клетке закрывает его — из календаря тоже. */
    tick(el, state) {
      const deed = M.deeds(state).find((d) => d.ид === el.dataset.id);
      if (!deed) return;
      queue(M.change("дело", { ид: deed.ид, сделано: true }));
      toast(`${deed.текст} — сделано`);
    },

    filter(el) {
      showDone = el.dataset.done === "1";
      touch("дела.фильтр");
      toast(showDone ? "Показаны все" : "Только открытые");
    },

    deed(el) {
      queue(M.change("дело", { ид: el.dataset.id, сделано: el.checked }));
    },
  },
};
