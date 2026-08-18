// Гарантии: по чему я успеваю сходить прямо сейчас.
//
// Даты лежали с самого начала, а показывались одной подсветкой в общем списке —
// то есть отвечали на «эта вещь ещё на гарантии?». Спрашивают другое, и обычно
// когда вещь уже сломалась: что из моего ещё меняют, и сколько у меня на это
// дней. Ради этого вопроса дату и записывают.

import { html, raw, esc, cap, fmtMoney, fmtDate, toast, wide } from "../../../core/dom.js";
import { pageHead, headBtn, headLink } from "../../../core/screens/head.js";
import { commit, touch } from "../../../core/state.js";
import { cursor, hint } from "../../../core/keys.js";
import * as M from "../lib/model.js";

let show = "всё";
const nav = cursor();

/* Строка гарантии — та же строка вещи, но справа не место, а срок: колонка,
   ради которой экран открыли, должна стоять в одном столбце сверху вниз. */
function row(thing, now, focused) {
  const left = thing.warrantyUntil ? M.daysBetween(now, thing.warrantyUntil) : null;
  const tone = left != null && left >= 0 && left <= M.WARRANTY_SOON;

  const said = left == null
    ? (thing.price ? fmtMoney(thing.price) : "цена не записана")
    : left < 0
      ? `кончилась ${fmtDate(thing.warrantyUntil)}`
      : `${left} ${M.plural(left, "день", "дня", "дней")} · до ${fmtDate(thing.warrantyUntil)}`;

  const nags = M.warrantyNags(thing, now);

  return html`<div class="row row--twoline" data-focused="${focused ? 1 : 0}">
    <a class="row-name" href="#thing/${esc(thing.id)}">${esc(thing.name)}</a>
    <span class="row-why">${esc([cap(thing.place ?? ""), thing.serial ? `№ ${thing.serial}` : "", thing.warrantySeen && !nags ? "разобрался" : ""].filter(Boolean).join(" · "))}</span>
    ${raw(tone
      ? `<span class="rowend">
          <span class="tdim tdim--alarm">${esc(said)}</span>
          ${nags ? `<button class="btn btn--ghost btn--sm" type="button" data-act="seen" data-id="${esc(thing.id)}">Разобрался</button>` : ""}
        </span>`
      : `<span class="tdim">${esc(said)}</span>`)}
  </div>`;
}

export default {
  title: () => "Гарантии",

  render(state) {
    const now = M.today();
    const groups = M.warranties(M.alive(state), now);

    if (!groups.length) {
      return html`<main class="screen">
        ${raw(pageHead({ title: `Гарантии`, said: `пусто` }))}
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
    const flat = shown.flatMap((g) => g.rows);
    const at = nav.on(flat);

    return html`<main class="screen">
      ${raw(pageHead({ title: "Гарантии", said: `${soon ? `${soon} кончается в этом месяце` : "срочного нет"}${money ? ` · под защитой ${fmtMoney(money)}` : ""}` }))}

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
          ${g.rows.map((t) => row(t, now, flat[at]?.id === t.id)).join("")}`).join(""))}

        ${raw(wide.matches ? hint([["↑↓", "ходить"], ["Space", "разобрался"], ["Enter", "открыть"]]) : "")}

        <p class="prose prose--muted plan-note">Срок считается от даты в карточке вещи, а не от чека: чек может быть на месяц раньше, чем начали пользоваться. «Без гарантии» показывает только дорогое — у ложки её и не должно быть.</p>
      </div>
    </main>`;
  },

  keys(e, state) {
    const now = M.today();
    const groups = M.warranties(M.alive(state), now);
    const rows = (show === "всё" ? groups : groups.filter((g) => g.key === show)).flatMap((g) => g.rows);

    nav.keys(e, rows, {
      redraw: () => touch("гарантии.курсор"),
      open: (t) => { location.hash = `thing/${t.id}`; },
      act: (t) => seen(t),
    });
  },

  actions: {
    seen(el, state) {
      const thing = M.alive(state).find((t) => t.id === el.dataset.id);
      if (thing) seen(thing);
    },

    show(el) {
      show = el.dataset.show;
      touch("гарантии.разрез");
      if (show !== "всё") toast(`Только «${el.textContent}»`);
    },
  },
};

/**
 * «Разобрался» — не «сделано».
 *
 * Вещь остаётся на гарантии; меняется только то, дёргает она или молчит. И
 * молчит не навсегда: за неделю до конца напомнит ещё раз, потому что это
 * последний момент, когда решение вообще можно принять.
 */
function seen(thing) {
  if (!M.warrantyNags(thing)) return;

  const was = thing.warrantySeen ?? null;
  const put = (value) => commit("things.warrantySeen", (s) => {
    const target = s.things.find((t) => t.id === thing.id);
    if (!target) return null;
    target.warrantySeen = value;
    target.at = Date.now();
    return { kind: "things", id: target.id };
  });

  put(M.today());
  toast(`${thing.name} — напомню за неделю до конца`, "calm", { undo: () => put(was) });
}
