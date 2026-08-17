// Доска: цикл, пространства, разрез, подсказки, группы, строки проектов.
//
// Тот же экран, что на компьютере, в нашей оболочке: разделы остаются
// разделами, состояние — состоянием, «стоит три недели» — тем же порогом.
// Меняется только то, чем это нарисовано.

import { html, raw, icon, esc, toast, wide } from "../../../core/dom.js";
import { commit, touch } from "../../../core/state.js";
import { cursor, hint } from "../../../core/keys.js";
import * as M from "../lib/model.js";
import { row, queue } from "./row.js";

let cut = "раздел";
let sort = "состояние";
let space = "все";
let cycle = "все";
let query = "";
let picked = new Set();
let making = "";
const nav = cursor();

export const state = () => ({ cut, sort, space, cycle, query });

/* ---------- полосы ---------- */

/**
 * Цикл: где мы в нём.
 *
 * Полоска недель, а не число: цикл — это про «сколько ещё осталось», и
 * двенадцать делений отвечают на это раньше, чем глаз дочитает цифру.
 */
function cycleBar(state) {
  const c = M.cycleOf(state);
  if (!c) return "";

  const weeks = Array.from({ length: c.всего }, (_, i) =>
    `<s class="${i < c.неделя ? "on" : ""}"></s>`).join("");

  /* На телефоне та же правда короче: полная фраза переносится на вторую строку
     и стоит столько же места, сколько две строки проектов. */
  const said = wide.matches
    ? `неделя ${c.неделя} из ${c.всего} · осталось ${c.осталось} ${M.plural(c.осталось, "день", "дня", "дней")}`
    : `${c.неделя}/${c.всего} · ${c.осталось} дн.`;

  return html`<div class="cycbar">
    <span class="wk" role="img" aria-label="неделя ${c.неделя} из ${c.всего}">${raw(weeks)}</span>
    <span class="cycname">${c.имя}</span>
    <span class="tdim">${said}</span>
  </div>`;
}

/** Раскладка — тот же переключатель и то же слово, что у соседей. */
function cutSwitch() {
  return html`<div class="seg seg--sm" role="group" aria-label="Как раскладывать">
    <span class="seg-label">раскладка</span>
    ${raw(M.CUTS.map((x) =>
      `<button class="seg-btn" type="button" data-act="cut" data-cut="${x.key}" aria-pressed="${cut === x.key}">${esc(x.label.toLowerCase())}</button>`).join(""))}
  </div>`;
}

/** Фильтры, которые действуют разом на всё: цикл и пространство. */
function filterBar(state) {
  const spaces = M.spacesOf(state);
  const chip = (act, value, current) =>
    `<button class="chip chip--sm" type="button" data-act="${act}" data-${act}="${esc(value)}" aria-pressed="${current === value}">${esc(value)}</button>`;

  return html`<div class="filterbar">
    <span class="seg-label">цикл</span>
    ${raw(["все", "в цикле", "вне"].map((v) => chip("cycle", v, cycle)).join(""))}
    ${raw(spaces.length > 1
      ? `<span class="toolbar-sep" aria-hidden="true"></span><span class="seg-label">где</span>`
        + ["все", ...spaces].map((w) => chip("space", w, space)).join("")
      : "")}
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

/* ---------- заведение ---------- */

/**
 * Завести проект и записать итог цикла — операции доски, которых телефон был
 * лишён.
 *
 * Сервер умеет и то и другое с самого начала; экран просто не давал их позвать,
 * и «завести проект» означало «дойти до компьютера». Форма открывается по
 * кнопке и закрывается после отправки: пустой бланк над списком — это шум.
 */
function makeForm(state) {
  if (making === "проект") {
    return html`<section class="pane">
      <div class="head-row">
        <div class="label">Новый проект</div>
        <button class="linkbtn" type="button" data-act="make" data-make="">Свернуть</button>
      </div>
      <form class="stack" data-act-submit="addProject">
        <label class="fieldset">
          <span class="fieldset-label">Имя</span>
          <input class="field" name="имя" placeholder="как назовём" autocomplete="off" required>
        </label>
        <label class="fieldset">
          <span class="fieldset-label">Цель</span>
          <textarea class="field field--area" name="цель" rows="2" placeholder="что должно случиться"></textarea>
        </label>
        <div class="rowbtns">
          <label class="fieldset fieldset--grow">
            <span class="fieldset-label">Аппетит</span>
            <input class="field" name="аппетит" placeholder="6 недель" autocomplete="off">
          </label>
          <label class="fieldset fieldset--grow">
            <span class="fieldset-label">Раздел</span>
            <input class="field" name="раздел" placeholder="Главное сейчас" autocomplete="off">
          </label>
          <label class="fieldset fieldset--grow">
            <span class="fieldset-label">Область</span>
            <input class="field" name="область" placeholder="Обучение" autocomplete="off">
          </label>
        </div>
        <label class="fieldset">
          <span class="fieldset-label">Вехи</span>
          <textarea class="field field--area" name="вехи" rows="3" placeholder="по одной в строке — можно вставить готовым списком"></textarea>
        </label>
        <button class="btn btn--ghost btn--sm" type="submit">Завести карточку</button>
        <p class="prose prose--muted">Карточку слепит волт по шаблону — тем же, что у Obsidian и CLI. До следующего снимка она будет висеть здесь как «в пути».</p>
      </form>
    </section>`;
  }

  return "";
}

/** Заведённое ещё не в снимке: без этой полосы оно исчезает до следующего круга. */
function comingPane(state) {
  const rows = M.creations(state);
  if (!rows.length) return "";

  return html`<section class="pane pane--calm">
    <div class="head-row">
      <div class="label">В пути</div>
      <span class="tdim num">${rows.length}</span>
    </div>
    ${raw(rows.map((r) => `<div class="insp-row"><span>${esc(r.said)}</span><span class="tdim">ждёт волта</span></div>`).join(""))}
  </section>`;
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
    const flat = blocks.flatMap((g) => g.items);
    const at = nav.on(flat);
    const refused = M.refused(s);
    const age = M.snapshotAge(s);

    const list = html`
      ${raw(refused.length ? `<section class="refused">
        <div class="label">Волт не принял ${refused.length} ${M.plural(refused.length, "правку", "правки", "правок")}</div>
        ${refused.map((e) => `<p class="prose">${esc(e.ответ)}</p>`).join("")}
        <p class="prose prose--muted">Почти всегда это значит, что строку правили руками, пока правка ехала.</p>
        <button class="btn btn--ghost btn--sm" type="button" data-act="forget">Понятно</button>
      </section>` : "")}

      ${raw(cycleBar(s))}
      ${raw(filterBar(s))}
      ${raw(makeForm(s))}
      ${raw(comingPane(s))}
      ${raw(bulkBar())}
      ${raw(query ? "" : hints(s))}

      ${raw(blocks.map((g) => `<div class="aisle aisle--grp">
          <span>${esc(g.name)}</span><span class="tdim num">${g.items.length}</span>
        </div>
        ${g.items.length
          ? g.items.map((p) => row(s, p, { picked: picked.has(p.путь), focused: flat[at]?.путь === p.путь })).join("")
          : `<p class="prose prose--muted grp-empty">пусто</p>`}`).join(""))}

      <p class="prose prose--muted plan-note">Окно в доску, а не вторая её копия: карточки живут заметками в волте. ${raw(age == null ? "Снимок не датирован." : age === 0 ? "Снимок собран сегодня." : `Снимку ${age} ${esc(M.plural(age, "день", "дня", "дней"))}.`)}</p>`;

    const head = html`<h1>Проекты</h1>
      <span class="head-sub num">${M.live(s).length} в работе · ${M.openDeeds(s).length} ${M.plural(M.openDeeds(s).length, "дело", "дела", "дел")}</span>`;

    /* Панель с порядком и подсказкой клавиш — десктопная деталь системы; на
       телефоне соседние приложения ставят одну строку с раскладкой, и три
       переключателя над списком там стоили бы четверти экрана. */
    if (!wide.matches) {
      return html`<main class="screen">
        <header class="head head--dark"><div>${raw(head)}</div></header>
        <div class="body">
          <div class="groupbar groupbar--split">
            ${raw(cutSwitch())}
            <button class="btn btn--ghost btn--sm" type="button" data-act="make" data-make="${making === "проект" ? "" : "проект"}">Новый проект</button>
          </div>
          ${raw(list)}
        </div>
      </main>`;
    }

    return html`<main class="screen">
      <header class="head head--dark">
        <div class="head-row">
          <div>${raw(head)}</div>
          <form class="search" data-act-submit="find" role="search">
            <label class="sr-only" for="proj-q">Поиск по проектам</label>
            ${raw(icon("i-search", { size: 16, stroke: "#5f7468" }))}
            <input class="search-field" id="proj-q" name="q" value="${query}" placeholder="Поиск" autocomplete="off">
            <kbd>/</kbd>
          </form>
        </div>
      </header>

      <div class="toolbar">
        ${raw(cutSwitch())}
        <span class="toolbar-sep" aria-hidden="true"></span>
        <div class="seg seg--sm" role="group" aria-label="Порядок">
          <span class="seg-label">порядок</span>
          ${raw(M.SORTS.map((x) =>
            `<button class="seg-btn" type="button" data-act="sort" data-sort="${x.key}" aria-pressed="${sort === x.key}">${x.short}</button>`).join(""))}
        </div>
        <span class="toolbar-gap"></span>
        ${raw(hint([["↑↓", "ходить"], ["Space", "выбрать"], ["Enter", "открыть"], ["/", "искать"]]))}
        <button class="btn btn--ghost btn--sm" type="button" data-act="make" data-make="${making === "проект" ? "" : "проект"}">Новый проект</button>
        ${raw(M.cycleOf(s) ? `<a class="btn btn--ghost btn--sm" href="#cycle">Закрыть цикл</a>` : "")}
      </div>

      <div class="body">${raw(list)}</div>
    </main>`;
  },

  /* Та же клавиша, что в остальных четырёх: подсказка в панели должна работать,
     а не быть картинкой клавиши. */
  keys(e, s) {
    const c = M.cycleOf(s);
    const pool = M.filter(M.live(s), { space, cycle, query, cycleName: c?.имя ?? "" });
    const flat = M.groups(s, { cut, sort, rows: pool }).flatMap((g) => g.items);

    nav.keys(e, flat, {
      redraw: () => touch("доска.курсор"),
      open: (p) => { location.hash = `project/${encodeURIComponent(p.путь)}`; },
      act: (p) => {
        if (picked.has(p.путь)) picked.delete(p.путь);
        else picked.add(p.путь);
        touch("доска.выбор");
      },
      search: "#proj-q",
    });
  },

  actions: {
    cut(el) { cut = el.dataset.cut; touch("доска.разрез"); },
    sort(el) { sort = el.dataset.sort; touch("доска.порядок"); },
    space(el) { space = el.dataset.space; touch("доска.пространство"); },
    cycle(el) { cycle = el.dataset.cycle; touch("доска.цикл"); },
    find(form) { query = String(new FormData(form).get("q") ?? "").trim(); touch("доска.поиск"); },

    pick(el) {
      const path = el.dataset.path;
      if (picked.has(path)) picked.delete(path);
      else picked.add(path);
      touch("доска.выбор");
    },

    unpick() { picked.clear(); touch("доска.выбор"); },

    make(el) { making = el.dataset.make; touch("доска.форма"); },

    /** Карточку лепит волт по шаблону: сюда уезжает только то, что человек назвал. */
    addProject(form) {
      const data = new FormData(form);
      const name = String(data.get("имя") ?? "").trim();
      if (!name) return;

      const fields = {};
      for (const key of ["цель", "аппетит", "раздел", "область", "вехи"]) {
        const value = String(data.get(key) ?? "").trim();
        if (value) fields[key] = value;
      }

      queue(M.change("проект+", { имя: name, ...fields }));
      making = "";
      touch("доска.форма");
      toast(`«${name}» заведётся при синке`);
    },

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
