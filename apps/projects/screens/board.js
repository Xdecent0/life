// Доска: цикл, пространства, разрез, подсказки, группы, строки проектов.
//
// Тот же экран, что на компьютере, в нашей оболочке: разделы остаются
// разделами, состояние — состоянием, «стоит три недели» — тем же порогом.
// Меняется только то, чем это нарисовано.

import { html, raw, icon, esc, toast, wide } from "../../../core/dom.js";
import { commit, touch } from "../../../core/state.js";
import * as M from "../lib/model.js";
import { row, queue } from "./row.js";

let cut = "раздел";
let sort = "состояние";
let space = "все";
let cycle = "все";
let query = "";
let picked = new Set();

export const state = () => ({ cut, sort, space, cycle, query });

/* ---------- полосы ---------- */

/** Цикл: где мы в нём. Полоска недель — та же, что на доске. */
function cycleBar(state) {
  const c = M.cycleOf(state);
  if (!c) return "";

  const weeks = Array.from({ length: c.всего }, (_, i) =>
    `<s class="${i < c.неделя ? "on" : ""}"></s>`).join("");

  return html`<div class="cycbar">
    <span class="cycname">${c.имя}</span>
    <span class="wk" role="img" aria-label="неделя ${c.неделя} из ${c.всего}">${raw(weeks)}</span>
    <span class="tdim">неделя ${c.неделя} из ${c.всего} · осталось ${c.осталось} ${M.plural(c.осталось, "день", "дня", "дней")}</span>
    <span class="cycfilter">
      ${raw(["все", "в цикле", "вне"].map((v) =>
        `<button class="chip chip--sm" type="button" data-act="cycle" data-cycle="${esc(v)}" aria-pressed="${cycle === v}">${esc(v)}</button>`).join(""))}
    </span>
  </div>`;
}

function spaceBar(state) {
  const spaces = M.spacesOf(state);
  if (spaces.length < 2) return "";

  return html`<div class="chips chips--bar">
    ${raw(["все", ...spaces].map((w) =>
      `<button class="chip chip--sm" type="button" data-act="space" data-space="${esc(w)}" aria-pressed="${space === w}">${esc(w)}</button>`).join(""))}
  </div>`;
}

/** Что стоит и что почти готово — те же две подсказки и те же пороги. */
function hints(state) {
  const stale = M.stalled(state);
  const almost = M.almostDone(state);
  if (!stale.length && !almost.length) return "";

  const chip = (p, text, tone) =>
    `<a class="chip ${tone}" href="#project/${esc(encodeURIComponent(p.путь))}">${esc(p.имя)} · ${esc(text)}</a>`;

  return html`<div class="aisle">Стоит присмотреться</div>
    <div class="hints">
      ${raw(stale.map((p) => chip(p, `${p.дней_без_движения} дн. без движения`, "chip--alarm")).join(""))}
      ${raw(almost.map((p) => chip(p, "осталась одна веха", "")).join(""))}
    </div>`;
}

/** Выбрано несколько — можно перенести разом. Правки уходят по одной. */
function bulkBar() {
  if (!picked.size) return "";

  return html`<div class="bulkbar">
    <span>выбрано <b class="num">${picked.size}</b></span>
    ${raw(M.GROUPS.map((g) =>
      `<button class="btn btn--ghost btn--sm" type="button" data-act="move" data-group="${esc(g)}">${esc(g)}</button>`).join(""))}
    <button class="btn btn--ghost btn--sm" type="button" data-act="move" data-group="готово">в архив</button>
    <button class="btn btn--ghost btn--sm" type="button" data-act="unpick">снять выбор</button>
  </div>`;
}

/* ---------- экран ---------- */

function emptyScreen(state) {
  const known = Boolean(M.boardOf(state));

  return html`<main class="screen">
    <header class="head head--dark"><h1>Проекты</h1><span class="head-sub">${known ? "пусто" : "снимок не приезжал"}</span></header>
    <div class="body">
      <div class="empty">
        <h2>${known ? "Проектов нет" : "Снимок ещё не приезжал"}</h2>
        <p>${known
          ? "Карточки живут заметками в папке «10 - Проекты» волта. Заведи одну там или на доске — здесь она появится следующим снимком."
          : "Это окно в доску проектов, а не вторая её копия. Снимок собирает компьютер, пока доска поднята, и кладёт в общий репозиторий. Ключ доступа к нему — на пульте."}</p>
        <a class="btn" href="../../hub/">Открыть пульт</a>
      </div>
    </div>
  </main>`;
}

export default {
  title: () => "Проекты",

  render(s) {
    if (!M.projects(s).length) return emptyScreen(s);

    const c = M.cycleOf(s);
    const pool = M.filter(M.live(s), { space, cycle, query, cycleName: c?.имя ?? "" });
    const blocks = M.groups(s, { cut, sort, rows: pool });
    const refused = M.refused(s);
    const age = M.snapshotAge(s);

    return html`<main class="screen">
      <header class="head head--dark">
        <div>
          <h1>Проекты</h1>
          <span class="head-sub num">${M.live(s).length} в работе · ${M.openDeeds(s).length} ${M.plural(M.openDeeds(s).length, "дело", "дела", "дел")}</span>
        </div>
        <div class="seg" role="group" aria-label="Разрез">
          ${raw(M.CUTS.map((x) =>
            `<button class="seg-btn" type="button" data-act="cut" data-cut="${x.key}" aria-pressed="${cut === x.key}">${x.label}</button>`).join(""))}
        </div>
      </header>

      <div class="body">
        ${raw(refused.length ? `<section class="refused">
          <div class="label">Волт не принял ${refused.length} ${M.plural(refused.length, "правку", "правки", "правок")}</div>
          ${refused.map((e) => `<p class="prose">${esc(e.ответ)}</p>`).join("")}
          <p class="prose prose--muted">Почти всегда это значит, что строку правили руками, пока правка ехала.</p>
          <button class="btn btn--ghost btn--sm" type="button" data-act="forget">Понятно</button>
        </section>` : "")}

        ${raw(cycleBar(s))}
        ${raw(spaceBar(s))}

        <div class="findrow">
          <label class="sr-only" for="proj-q">Поиск по проектам</label>
          <input class="field" id="proj-q" type="search" value="${query}" data-act-input="find"
                 placeholder="название, цель, аппетит" autocomplete="off">
          <div class="seg seg--quiet" role="group" aria-label="Порядок">
            ${raw(M.SORTS.map((x) =>
              `<button class="seg-btn" type="button" data-act="sort" data-sort="${x.key}" aria-pressed="${sort === x.key}">${x.label}</button>`).join(""))}
          </div>
        </div>

        ${raw(bulkBar())}
        ${raw(query ? "" : hints(s))}

        ${raw(blocks.map((g) => `<div class="aisle aisle--grp">
            <span>${esc(g.name)}</span><span class="tdim num">${g.items.length}</span>
          </div>
          ${g.items.length
            ? g.items.map((p) => row(s, p, { picked: picked.has(p.путь) })).join("")
            : `<p class="prose prose--muted grp-empty">пусто</p>`}`).join(""))}

        <p class="prose prose--muted plan-note">Окно в доску, а не вторая её копия: карточки живут заметками в волте. ${raw(age == null ? "Снимок не датирован." : age === 0 ? "Снимок собран сегодня." : `Снимку ${age} ${esc(M.plural(age, "день", "дня", "дней"))}.`)}</p>
      </div>
    </main>`;
  },

  actions: {
    cut(el) { cut = el.dataset.cut; touch("доска.разрез"); },
    sort(el) { sort = el.dataset.sort; touch("доска.порядок"); },
    space(el) { space = el.dataset.space; touch("доска.пространство"); },
    cycle(el) { cycle = el.dataset.cycle; touch("доска.цикл"); },
    find(el) { query = el.value; touch("доска.поиск"); },

    pick(el) {
      const path = el.dataset.path;
      if (picked.has(path)) picked.delete(path);
      else picked.add(path);
      touch("доска.выбор");
    },

    unpick() { picked.clear(); touch("доска.выбор"); },

    /** Перенос идёт через заметку: правка на каждый проект, экран один раз. */
    move(el, s) {
      const group = el.dataset.group;
      const status = M.TO_VAULT[group];
      const rows = M.projects(s).filter((p) => picked.has(p.путь));
      picked.clear();

      for (const p of rows) queue(M.change("поле", { проект: p.путь, ключ: "статус", значение: status }));
      toast(`${rows.length} ${M.plural(rows.length, "проект", "проекта", "проектов")} → ${status}`);
    },

    forget() {
      commit("правки.забыть", (st) => {
        for (const e of st.edits) if (e.применено === false) e.deleted = true;
        return null;
      }, { sync: false });
      toast("Убрано");
    },
  },
};
