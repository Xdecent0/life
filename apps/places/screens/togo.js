// Куда сходить: ответ на вопрос вечера пятницы.
//
// Общий список отвечает «что у меня записано». Спрашивают другое — куда пойти
// сегодня, — и ответ у приложения уже был, просто рассыпанный: ритм, который
// человек сам поставил, места без единого визита и любимое, где давно не был.
//
// Фильтр по району здесь не украшение: «куда сходить» почти всегда означает
// «куда доеду», и первый вопрос к списку — в какой он части города.

import { html, raw, esc, icon, toast, wide } from "../../../core/dom.js";
import { pageHead, headBtn, headLink } from "../../../core/screens/head.js";
import { commit, touch } from "../../../core/state.js";
import { cursor, hint } from "../../../core/keys.js";
import * as M from "../lib/model.js";

let area = "везде";
const nav = cursor();

function row(place, now, focused) {
  const stars = place.rating ? "★".repeat(place.rating) : "";

  return html`<div class="row row--twoline" data-focused="${focused ? 1 : 0}">
    <a class="row-name" href="#place/${esc(place.id)}">${esc(place.name)}</a>
    <span class="row-why">
      ${raw([place.area, place.kind, stars, M.historyLabel(place, now)]
        .filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join(" · "))}
    </span>
    <button class="btn btn--ghost btn--sm" type="button" data-act="went" data-id="${esc(place.id)}">Был</button>
  </div>`;
}

export default {
  title: () => "Куда сходить",

  render(state) {
    const now = M.today();
    const groups = M.toGo(state, now);
    const areas = M.areasOf(M.alive(state));

    if (!groups.length) {
      return html`<main class="screen">
        ${raw(pageHead({ title: `Куда сходить`, said: `пока нечего предложить` }))}
        <div class="body"><div class="empty">
          <h2>Список молчит — и честно</h2>
          <p>Сюда попадает то, что зовёт обратно по твоему же ритму, места без единого визита и любимое, где давно не был. Ничего из этого приложение не выдумывает: поставь ритм или заведи место, куда хочется.</p>
          <a class="btn" href="#places">К местам</a>
        </div></div>
      </main>`;
    }

    const keep = (rows) => (area === "везде" ? rows : rows.filter((p) => (p.area ?? "") === area));
    const shown = groups.map((g) => ({ ...g, rows: keep(g.rows) })).filter((g) => g.rows.length);
    const total = shown.reduce((n, g) => n + g.rows.length, 0);
    const flat = shown.flatMap((g) => g.rows);
    const at = nav.on(flat);

    return html`<main class="screen">
      ${raw(pageHead({
        title: "Куда сходить",
        said: `${total} ${M.plural(total, "вариант", "варианта", "вариантов")}${area === "везде" ? "" : ` · ${area}`}`,
        actions: headLink("Все места", "#places"),
        chips: areas.length > 1
          ? ["везде", ...areas].map((a) =>
              `<button class="chip chip--sm" type="button" data-act="area" data-area="${esc(a)}" aria-pressed="${area === a}">${esc(a)}</button>`).join("")
          : "",
      }))}

      <div class="workbar">
        <span class="toolbar-hint"><kbd>↑↓</kbd> ходить · <kbd>Space</kbd> отметить поход · порядок — сначала то, что зовёт само</span>
      </div>

      <div class="body">
        ${raw(shown.length ? shown.map((g) => `<div class="aisle aisle--grp">
            <span>${esc(g.name)} · ${esc(g.note)}</span>
            <span class="tdim num">${g.rows.length}</span>
          </div>
          ${g.rows.map((p) => row(p, now, flat[at]?.id === p.id)).join("")}`).join("")
          : `<p class="prose prose--muted plan-note">В районе «${esc(area)}» сейчас ничего не зовёт. Это не пустой экран, а ответ: значит, сегодня туда не надо.</p>`)}

        ${raw(wide.matches ? hint([["↑↓", "ходить"], ["Space", "был"], ["Enter", "открыть"]]) : "")}

        <p class="prose prose--muted plan-note">«Был» отмечается прямо отсюда — идти в карточку ради одной галочки не нужно. Ритм ставится в карточке места и только там, где возвращаться правда хочется.</p>
      </div>
    </main>`;
  },

  keys(e, state) {
    const rows = M.toGo(state).flatMap((g) => g.rows)
      .filter((p) => area === "везде" || (p.area ?? "") === area);

    nav.keys(e, rows, {
      redraw: () => touch("куда.курсор"),
      open: (p) => { location.hash = `place/${p.id}`; },
      act: (p) => went(p),
    });
  },

  actions: {
    area(el) { area = el.dataset.area; touch("куда.район"); },

    /** Та же отметка, что в списке и в карточке: одна запись на все три экрана. */
    went(el, state) {
      const place = M.alive(state).find((p) => p.id === el.dataset.id);
      if (place) went(place);
    },
  },
};

/** Одна отметка на кнопку и на пробел. */
function went(place) {
  const before = [...(place.visits ?? [])];
  const put = (visits) => commit("places.went", (s) => {
    const target = s.places.find((p) => p.id === place.id);
    if (!target) return null;
    target.visits = visits;
    target.at = Date.now();
    return { kind: "places", id: target.id };
  });

  put([...before, M.today()]);
  toast(`${place.name} — отмечено`, "calm", { undo: () => put(before) });
}
