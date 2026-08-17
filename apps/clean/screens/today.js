// Сегодня: план на вечер, а не карта дома.
//
// Карта отвечает «как у меня с квартирой» — она про состояние. Вопрос, с которым
// приложение открывают чаще, другой и короче: что сделать сейчас и успею ли я.
// Карта на него отвечала россыпью красных точек по четырём комнатам, то есть
// заставляла собирать план глазами.
//
// Порядок здесь по комнатам, а не по срочности: убирают комнату целиком —
// тряпка уже в руке, и метаться из кухни в ванную ради двух просроченных
// поверхностей никто не станет.

import { html, raw, esc, cap, toast, wide } from "../../../core/dom.js";
import { commit, touch } from "../../../core/state.js";
import { cursor, hint } from "../../../core/keys.js";
import * as M from "../lib/model.js";

/* Курсор живёт между перерисовками: это состояние взгляда, а не данные. */
const nav = cursor();

function row(spot, now, focused) {
  const st = M.stateOf(spot, now);

  return html`<div class="row row--twoline" data-focused="${focused ? 1 : 0}">
    <a class="row-name" href="#spot/${esc(spot.id)}">${esc(spot.name)}</a>
    <span class="row-why">${esc([st.key, M.lastLabel(spot, now), `${M.minutesOf(spot)} мин`].join(" · "))}</span>
    <button class="btn btn--ghost btn--sm" type="button" data-act="done" data-id="${esc(spot.id)}">Убрал</button>
  </div>`;
}

export default {
  title: () => "Сегодня",

  render(state) {
    const now = M.today();
    const { groups, minutes, count } = M.plan(state, now);
    const flat = groups.flatMap((g) => g.rows);
    const at = nav.on(flat);

    if (!count) {
      const known = M.alive(state).length;

      return html`<main class="screen">
        <header class="head head--dark"><h1>Сегодня</h1><span class="head-sub">${known ? "всё свежее" : "дом ещё не описан"}</span></header>
        <div class="body"><div class="empty">
          <h2>${known ? "Сегодня ничего не ждёт" : "Дом ещё не описан"}</h2>
          <p>${known
            ? "Это не значит «идеально» — это значит, что ни один цикл ещё не подошёл. Пустой вечер тоже ответ."
            : "Уборка держится на карте: комнаты и что в каждой убирают. Заведи их на карте — сюда попадёт то, до чего пора."}</p>
          <a class="btn" href="#map">${known ? "Посмотреть карту" : "К карте"}</a>
        </div></div>
      </main>`;
    }

    return html`<main class="screen">
      <header class="head head--dark">
        <div>
          <h1>Сегодня</h1>
          <span class="head-sub num">${count} ${M.plural(count, "поверхность", "поверхности", "поверхностей")} · ${M.saidMinutes(minutes)}</span>
        </div>
      </header>

      <div class="body">
        ${raw(groups.map((g) => `<div class="aisle aisle--grp">
            <span>${esc(cap(g.name))}</span>
            <span class="tdim num">${g.rows.length} · ${esc(M.saidMinutes(g.minutes))}</span>
          </div>
          ${g.rows.map((s) => row(s, now, flat[at]?.id === s.id)).join("")}`).join(""))}

        ${raw(wide.matches ? hint([["↑↓", "ходить"], ["Space", "убрал"], ["Enter", "открыть"]]) : "")}

        <p class="prose prose--muted plan-note">Время прикидочное: считается от цикла, потому что другого признака «сколько работы» в данных нет. Раковину протирают, окно моют долго — этого хватает, чтобы понять, влезет ли уборка в вечер.</p>
      </div>
    </main>`;
  },

  keys(e, state) {
    const flat = M.plan(state).groups.flatMap((g) => g.rows);
    nav.keys(e, flat, {
      redraw: () => touch("сегодня.курсор"),
      open: (spot) => { location.hash = `spot/${spot.id}`; },
      act: (spot) => done(spot),
    });
  },

  actions: {
    /** Та же отметка, что на карте и в карточке: одна запись на три экрана. */
    done(el, state) {
      const spot = M.alive(state).find((s) => s.id === el.dataset.id);
      if (spot) done(spot);
    },
  },
};

/** Отметка одна на кнопку и на пробел — иначе они разойдутся первой же правкой. */
function done(spot) {
  const was = spot.lastDone;
  const put = (value) => commit("clean.done", (s) => {
    const target = s.spots.find((x) => x.id === spot.id);
    if (!target) return null;
    target.lastDone = value;
    target.at = Date.now();
    return { kind: "spots", id: target.id };
  });

  put(M.today());
  toast(`${spot.name} — убрано`, "calm", { undo: () => put(was) });
}
