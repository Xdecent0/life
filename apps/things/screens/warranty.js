// Гарантии: по чему я успеваю сходить прямо сейчас.
//
// Даты лежали с самого начала, а показывались одной подсветкой в общем списке —
// то есть отвечали на «эта вещь ещё на гарантии?». Спрашивают другое, и обычно
// когда вещь уже сломалась: что из моего ещё меняют, и сколько у меня на это
// дней. Ради этого вопроса дату и записывают.

import { html, raw, esc, cap, fmtMoney, fmtDate, toast } from "../../../core/dom.js";
import { touch } from "../../../core/state.js";
import * as M from "../lib/model.js";

let show = "всё";

/* Строка гарантии — та же строка вещи, но справа не место, а срок: колонка,
   ради которой экран открыли, должна стоять в одном столбце сверху вниз. */
function row(thing, now) {
  const left = thing.warrantyUntil ? M.daysBetween(now, thing.warrantyUntil) : null;
  const tone = left != null && left >= 0 && left <= M.WARRANTY_SOON;

  const said = left == null
    ? (thing.price ? fmtMoney(thing.price) : "цена не записана")
    : left < 0
      ? `кончилась ${fmtDate(thing.warrantyUntil)}`
      : `${left} ${M.plural(left, "день", "дня", "дней")} · до ${fmtDate(thing.warrantyUntil)}`;

  return html`<a class="row row--twoline" href="#thing/${esc(thing.id)}">
    <span class="row-name">${esc(thing.name)}</span>
    <span class="row-why">${esc([cap(thing.place ?? ""), thing.serial ? `№ ${thing.serial}` : ""].filter(Boolean).join(" · "))}</span>
    <span class="tdim ${tone ? "tdim--alarm" : ""}">${esc(said)}</span>
  </a>`;
}

export default {
  title: () => "Гарантии",

  render(state) {
    const now = M.today();
    const groups = M.warranties(M.alive(state), now);

    if (!groups.length) {
      return html`<main class="screen">
        <header class="head head--dark"><h1>Гарантии</h1><span class="head-sub">пусто</span></header>
        <div class="body"><div class="empty">
          <h2>Гарантий пока не записано</h2>
          <p>Дата стоит того, чтобы её записать, у техники и у всего, что чинят по чеку. Открой вещь и поставь «гарантия до» — за месяц до конца она сама начнёт напоминать.</p>
          <a class="btn" href="#things">К вещам</a>
        </div></div>
      </main>`;
    }

    const shown = show === "всё" ? groups : groups.filter((g) => g.key === show);
    const soon = groups.find((g) => g.key === "soon")?.rows.length ?? 0;
    const money = M.covered(M.alive(state), now);

    return html`<main class="screen">
      <header class="head head--dark">
        <div>
          <h1>Гарантии</h1>
          <span class="head-sub num">${soon ? `${soon} кончается в этом месяце` : "срочного нет"}${money ? ` · под защитой ${fmtMoney(money)}` : ""}</span>
        </div>
      </header>

      <div class="groupbar">
        <div class="seg seg--sm" role="group" aria-label="Что показывать">
          <span class="seg-label">показать</span>
          ${raw(["всё", ...groups.map((g) => g.key)].map((key) => {
            const name = key === "всё" ? "всё" : groups.find((g) => g.key === key).name.toLowerCase();
            return `<button class="seg-btn" type="button" data-act="show" data-show="${esc(key)}" aria-pressed="${show === key}">${esc(name)}</button>`;
          }).join(""))}
        </div>
      </div>

      <div class="body">
        ${raw(shown.map((g) => `<div class="aisle aisle--grp">
            <span>${esc(g.name)} · ${esc(g.note)}</span>
            <span class="tdim num">${g.rows.length}</span>
          </div>
          ${g.rows.map((t) => row(t, now)).join("")}`).join(""))}

        <p class="prose prose--muted plan-note">Срок считается от даты в карточке вещи, а не от чека: чек может быть на месяц раньше, чем начали пользоваться. «Без гарантии» показывает только дорогое — у ложки её и не должно быть.</p>
      </div>
    </main>`;
  },

  actions: {
    show(el) {
      show = el.dataset.show;
      touch("гарантии.разрез");
      if (show !== "всё") toast(`Только «${el.textContent}»`);
    },
  },
};
