// Куда хочется сходить и куда уже ходил — один экран, а не два списка.
//
// Список желаний, который никогда не пересматривают, — это свалка. Поэтому
// сверху стоит то, что зовёт обратно, а место переходит из «хочу» в «был» одним
// нажатием, не выпадая из списка: в нём остаётся история и оценка.

import { html, raw, icon, esc, toast, wide } from "../../../core/dom.js";
import { pageHead, headBtn, headLink } from "../../../core/screens/head.js";
import { touch, commit, uid } from "../../../core/state.js";
import { mark } from "../../../core/sync.js";
import * as M from "../lib/model.js";
import { blank } from "../lib/store.js";

let grouping = "state";
let query = "";
let cursor = 0;
let editing = null;

const kindsOf = (state) => state.kinds ?? [];

function filtered(state) {
  let places = M.alive(state);
  if (query) {
    const q = query.toLowerCase();
    places = places.filter((p) =>
      [p.name, p.area, p.note, p.kind].some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }
  return places;
}

const groups = (state) => M.groupBy(filtered(state), grouping, { kinds: kindsOf(state) });
const visible = (state) => groups(state).flatMap((g) => g.entries);

function stars(place) {
  if (!place.rating) return "";
  return `<span class="stars" role="img" aria-label="${place.rating} из 5">${"★".repeat(place.rating)}${"☆".repeat(5 - place.rating)}</span>`;
}

function groupSwitch() {
  const options = [["state", "по делу"], ["kind", "виды"], ["area", "районы"]];

  return html`<div class="seg seg--sm" role="group" aria-label="Как раскладывать">
    <span class="seg-label">раскладка</span>
    ${raw(options.map(([key, name]) =>
      `<button class="seg-btn" type="button" data-act="grouping" data-grouping="${key}" aria-pressed="${grouping === key}">${esc(name)}</button>`).join(""))}
  </div>`;
}

function addbar(flat = false) {
  return html`<form class="addbar${flat ? " addbar--flat addbar--slim" : ""}" data-act-submit="add">
    <input class="field" name="name" placeholder="Куда хочу" aria-label="Название места" autocomplete="off" required>
    <button class="icon-btn${flat ? " icon-btn--sm" : ""}" type="submit" aria-label="Добавить место">
      ${raw(icon("i-plus", { size: flat ? 18 : 22, stroke: "#1c3327" }))}
    </button>
  </form>`;
}

function emptyScreen() {
  return html`<main class="screen">
    ${raw(pageHead({ title: `Места`, said: `пусто` }))}
    <div class="body">
      <div class="empty">
        <h2>Список пустой</h2>
        <p>Сюда идёт то, что услышал и захотел: кафе, парк, выставка, мастерская. Одна строка сейчас — и через месяц будет что ответить на «а куда сходим».</p>
        ${raw(addbar(true))}
      </div>
    </div>
  </main>`;
}

/* ---------- phone ---------- */

function row(place, state, now) {
  const been = M.visitsOf(place).length;
  const calls = M.callsBack(place, now);
  const kind = M.kindOf(place, kindsOf(state)).name;

  return html`<div class="row row--place" data-calls="${calls ? 1 : 0}">
    <button class="spot-tick" type="button" data-act="went" data-id="${place.id}"
        aria-label="${place.name}: был сегодня" title="Был">
      ${raw(icon("i-check", { size: 12, stroke: been ? "#f4f1e6" : "#5f7468", width: 2.6 }))}
    </button>
    <a class="row-main" href="#place/${place.id}">
      <span class="row-name">${place.name} ${raw(stars(place))}</span>
      <span class="row-why">${[kind, place.area, M.historyLabel(place, now)].filter(Boolean).join(" · ")}</span>
    </a>
    ${raw(calls ? `<span class="chip chip--alarm chip--sm">зовёт</span>` : "")}
  </div>`;
}

function phone(state) {
  const now = M.today();
  const all = M.alive(state);
  const calls = all.filter((p) => M.callsBack(p, now));

  const body = groups(state).map((g) => html`<div class="aisle">${g.name} <span class="num">${g.entries.length}</span></div>
    ${raw(g.entries.map((p) => row(p, state, now)).join(""))}`).join("");

  return html`<main class="screen">
    ${raw(pageHead({ title: "Места", said: `${M.wanted(state).length} хочу · ${M.visited(state).length} был${calls.length ? ` · ${calls.length} зовёт` : ""}` }))}

    <div class="body">
      <div class="groupbar">${raw(groupSwitch())}</div>
      ${raw(body || `<div class="empty"><h2>Ничего не нашлось</h2><p>По этому запросу пусто.</p></div>`)}
      ${raw(addbar())}
    </div>
  </main>`;
}

/* ---------- desktop ---------- */

const none = () => '<span class="tnone" aria-label="неизвестно">–</span>';

function desk(state) {
  const now = M.today();
  const shown = visible(state);
  cursor = Math.min(cursor, Math.max(0, shown.length - 1));
  const focused = shown[cursor] ?? null;
  const calls = M.alive(state).filter((p) => M.callsBack(p, now));

  const cell = (place, field, body, cls = "") => {
    if (editing?.id === place.id && editing.field === field) {
      return `<form class="tedit" data-act-submit="editSave">
        <input class="field field--cell" name="value" value="${esc(place[field] ?? "")}"
            aria-label="${field === "name" ? "Название" : "Район"}" autocomplete="off"
            data-act-blur="editSave" autofocus>
      </form>`;
    }
    return `<span class="${cls} tcell" data-act-dbl="editOpen" data-id="${place.id}" data-field="${field}"
        title="Двойной клик — правка">${body}</span>`;
  };

  let index = -1;
  const rows = groups(state).map((g) => {
    const head = `<div class="trow trow--group" role="row"><span role="rowheader">${esc(g.name)}</span><span class="tdim num">${g.entries.length}</span></div>`;

    return head + g.entries.map((place) => {
      const i = (index += 1);
      const back = M.callsBack(place, now);

      return html`<div class="trow" data-act="focus" data-id="${place.id}" data-index="${i}"
          data-burning="${back ? 1 : 0}" data-focused="${i === cursor ? 1 : 0}" role="row" tabindex="-1">
        <button class="tcheck tcheck--go" type="button" data-act="went" data-id="${place.id}"
            aria-label="Отметить поход в ${place.name}" title="Был сегодня">
          ${raw(icon("i-check", { size: 11, stroke: M.visitsOf(place).length ? "#1c3327" : "#8b9a90", width: 2.6 }))}
        </button>
        ${raw(cell(place, "name", `${esc(place.name)} ${stars(place)}`, "tname"))}
        <span class="tdim">${M.kindOf(place, kindsOf(state)).name}</span>
        ${raw(cell(place, "area", place.area ? esc(place.area) : none(), "tdim"))}
        <span class="${back ? "tburn" : "tdim"}">${M.historyLabel(place, now)}</span>
      </div>`;
    }).join("");
  }).join("");

  return html`<main class="screen">
    ${raw(pageHead({
      title: "Места",
      said: `${M.wanted(state).length} хочу · ${M.visited(state).length} был${calls.length ? ` · ${calls.length} зовёт обратно` : ""}`,
      actions: headLink("Куда сходить", "#togo"),
      bar: `<form class="search search--head" data-act-submit="search" role="search">
          <label class="sr-only" for="places-q">Поиск по местам</label>
          ${icon("i-search", { size: 16, stroke: "#a9bcaf" })}
          <input class="search-field" id="places-q" name="q" value="${esc(query)}" placeholder="Поиск" autocomplete="off">
          <kbd>/</kbd>
        </form>`,
    }))}

    <div class="workbar">
      ${raw(addbar(true))}
      <span class="toolbar-sep" aria-hidden="true"></span>
      ${raw(groupSwitch())}
      <span class="toolbar-gap"></span>
      <span class="toolbar-hint"><kbd>↑↓</kbd> ходить · <kbd>Enter</kbd> править</span>
    </div>

    <div class="split">
      <div class="table" role="table" aria-label="Места" data-cols="5">
        <div class="trow trow--head" role="row">
          <span role="columnheader"></span>
          <span role="columnheader">место</span>
          <span role="columnheader">вид</span>
          <span role="columnheader">район</span>
          <span role="columnheader">когда был</span>
        </div>
        ${raw(rows || `<div class="empty"><h2>Ничего не нашлось</h2><p>По этому запросу пусто.</p></div>`)}
      </div>

      <aside class="inspector" aria-label="Инспектор">${raw(inspector(state, focused, now))}</aside>
    </div>
  </main>`;
}

function inspector(state, place, now) {
  if (!place) {
    return html`<div class="pane pane--calm">
      <p class="prose">Выбери строку слева — здесь появится, что это за место, сколько раз ты там был и стоит ли возвращаться.</p>
    </div>`;
  }

  const visits = M.visitsOf(place);

  return html`<div class="insp-head">
    <h2 class="insp-name">${place.name}</h2>
    <div class="chips">
      <span class="chip">${M.kindOf(place, kindsOf(state)).name}</span>
      ${raw(place.area ? `<span class="chip">${esc(place.area)}</span>` : "")}
      ${raw(M.callsBack(place, now) ? `<span class="chip chip--alarm">зовёт обратно</span>` : "")}
    </div>
  </div>

  <div class="insp-block">
    <div class="label">Ходил</div>
    <p class="prose">${M.historyLabel(place, now)}${place.every ? ` · ${M.everyLabel(place)}` : ""}</p>
    <div class="rowbtns">
      <button class="btn btn--grow" type="button" data-act="went">Был сегодня</button>
      ${raw(visits.length ? `<button class="btn btn--ghost" type="button" data-act="unwent">Убрать последний</button>` : "")}
    </div>
  </div>

  <div class="insp-block">
    <div class="label">Как оно</div>
    <div class="chips">
      ${raw(M.STARS.map((n) => `<button class="chip chip--sm" type="button" data-act="rate" data-rating="${n}" aria-pressed="${place.rating === n}">${"★".repeat(n)}</button>`).join(""))}
      ${raw(place.rating ? `<button class="chip chip--sm chip--dashed" type="button" data-act="rate" data-rating="0">снять</button>` : "")}
    </div>
  </div>

  <div class="insp-block">
    <div class="label">Вид</div>
    <div class="chips">
      ${raw(kindsOf(state).map((k) => `<button class="chip chip--sm" type="button" data-act="kind" data-kind="${esc(k.name)}" aria-pressed="${M.kindOf(place, kindsOf(state)).name === k.name}">${esc(k.name)}</button>`).join(""))}
    </div>
  </div>

  <div class="insp-block">
    <div class="label">Возвращаться</div>
    <div class="chips">
      ${raw([7, 30, 90, 365].map((n) => `<button class="chip chip--sm" type="button" data-act="every" data-every="${n}" aria-pressed="${place.every === n}">${esc(M.everyLabel({ every: n }))}</button>`).join(""))}
      ${raw(place.every ? `<button class="chip chip--sm chip--dashed" type="button" data-act="every" data-every="0">не напоминать</button>` : "")}
    </div>
    <p class="prose prose--muted">Ставь цикл только тому, куда правда хочется возвращаться. Музей, в котором был однажды, не просрочен.</p>
  </div>

  <div class="insp-block">
    <div class="label">Заметка</div>
    <form class="stack stack--tight" data-act-submit="note">
      <input class="field" name="note" value="${place.note ?? ""}" placeholder="что там хорошего" aria-label="Заметка" autocomplete="off">
      <input class="field" name="url" value="${place.url ?? ""}" placeholder="ссылка" aria-label="Ссылка" autocomplete="off" inputmode="url">
      <button class="btn btn--ghost btn--sm" type="submit">Сохранить</button>
    </form>
    ${raw(place.url ? `<a class="btn btn--ghost btn--sm" href="${esc(place.url)}" target="_blank" rel="noopener noreferrer">Открыть ссылку</a>` : "")}
  </div>

  <div class="insp-foot">
    <button class="btn btn--ghost btn--danger btn--wide" type="button" data-act="remove">Удалить место</button>
  </div>`;
}

/* ---------- screen ---------- */

export default {
  title: () => "Места",

  render(state) {
    if (!M.alive(state).length) return emptyScreen();
    return wide.matches ? desk(state) : phone(state);
  },

  leave() {
    cursor = 0;
    query = "";
    editing = null;
  },

  keys(e, state) {
    if (!wide.matches) return;
    const shown = visible(state);

    if (e.key === "Escape") {
      if (!editing) return;
      editing = null;
      touch();
      return;
    }

    if (e.key === "Enter" && !editing) {
      const place = shown[cursor];
      if (!place) return;
      e.preventDefault();
      editing = { id: place.id, field: "name" };
      touch();
      return;
    }

    if (e.key === "/") {
      e.preventDefault();
      document.getElementById("places-q")?.focus();
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      cursor = Math.max(0, Math.min(shown.length - 1, cursor + (e.key === "ArrowDown" ? 1 : -1)));
      touch();
    }
  },

  actions: {
    grouping(el) {
      grouping = el.dataset.grouping;
      cursor = 0;
      touch();
    },

    search(form) {
      query = String(new FormData(form).get("q") ?? "").trim();
      cursor = 0;
      touch();
    },

    focus(el) {
      cursor = Number(el.dataset.index);
      touch();
    },

    add(form) {
      const name = String(new FormData(form).get("name") ?? "").trim();
      if (!name) return;

      let added = null;
      commit("places.add", (s) => {
        added = blank({ id: uid("pl"), name });
        s.places.push(added);
        return { kind: "places", id: added.id };
      });

      toast(`${name} — в списке`);

      const live = document.querySelector('[data-act-submit="add"]');
      live?.reset();
      live?.querySelector('[name="name"]')?.focus();
    },

    editOpen(el) {
      editing = { id: el.dataset.id, field: el.dataset.field };
      touch();
    },

    editSave(node) {
      if (!editing) return;
      const form = node.closest("form") ?? node;
      const value = String(new FormData(form).get("value") ?? "").trim();
      const { id, field } = editing;
      editing = null;

      let changed = false;
      commit("places.edit", (s) => {
        const place = s.places.find((p) => p.id === id);
        if (!place) return null;
        if (field === "name" && !value) return null;
        if ((place[field] ?? "") === value) return null;
        place[field] = value;
        place.at = Date.now();
        changed = true;
        return { kind: "places", id: place.id };
      });

      if (!changed) touch();
    },

    /**
     * Был сегодня.
     *
     * Каждый поход — отдельная отметка, а не флажок «посещено»: во второй раз в
     * то же кафе идут не потому, что забыли про первый.
     */
    went(el, state) {
      const id = el.dataset.id ?? visible(state)[cursor]?.id;
      const place = M.alive(state).find((p) => p.id === id);
      if (!place) return;

      commit("places.went", (s) => {
        const target = s.places.find((p) => p.id === id);
        if (!target) return null;
        target.visits = [...(target.visits ?? []), M.today()];
        target.at = Date.now();
        return { kind: "places", id: target.id };
      });

      toast(`${place.name} — отмечено`, "calm", {
        undo: () => commit("places.unwent", (s) => {
          const target = s.places.find((p) => p.id === id);
          if (!target) return null;
          target.visits = (target.visits ?? []).slice(0, -1);
          target.at = Date.now();
          return { kind: "places", id: target.id };
        }),
      });
    },

    unwent(_el, state) {
      const place = visible(state)[cursor];
      if (!place || !M.visitsOf(place).length) return;

      commit("places.unwent", (s) => {
        const target = s.places.find((p) => p.id === place.id);
        if (!target) return null;
        target.visits = (target.visits ?? []).slice(0, -1);
        target.at = Date.now();
        return { kind: "places", id: target.id };
      });

      toast("Последний поход убран");
    },

    rate(el, state) {
      const place = visible(state)[cursor];
      if (!place) return;
      const rating = Number(el.dataset.rating) || null;
      patch(place.id, (p) => { p.rating = p.rating === rating ? null : rating; });
    },

    kind(el, state) {
      const place = visible(state)[cursor];
      if (!place) return;

      commit("places.kind", (s) => {
        const target = s.places.find((p) => p.id === place.id);
        if (!target) return null;
        // Выбор того, что догадка и так дала бы, снимает переопределение.
        const guess = M.kindOf({ name: target.name }, s.kinds).name;
        target.kind = guess === el.dataset.kind ? null : el.dataset.kind;
        target.at = Date.now();
        return { kind: "places", id: target.id };
      });
    },

    every(el, state) {
      const place = visible(state)[cursor];
      if (!place) return;
      const every = Number(el.dataset.every) || null;
      patch(place.id, (p) => { p.every = p.every === every ? null : every; });
    },

    note(form, state) {
      const place = visible(state)[cursor];
      if (!place) return;
      const data = new FormData(form);
      patch(place.id, (p) => {
        p.note = String(data.get("note") ?? "").trim();
        p.url = String(data.get("url") ?? "").trim();
      });
      toast("Сохранено");
    },

    remove(_el, state) {
      const place = visible(state)[cursor];
      if (!place) return;

      commit("places.remove", (s) => {
        const target = s.places.find((p) => p.id === place.id);
        if (!target) return null;
        mark(target, "deleted", true);
        return { kind: "places", id: target.id };
      });

      toast(`${place.name} удалено`, "calm", {
        undo: () => commit("places.undelete", (s) => {
          const target = s.places.find((p) => p.id === place.id);
          if (!target) return null;
          mark(target, "deleted", false);
          return { kind: "places", id: target.id };
        }),
      });
    },
  },
};

function patch(id, change) {
  commit("places.edit", (s) => {
    const place = s.places.find((p) => p.id === id);
    if (!place) return null;
    change(place);
    place.at = Date.now();
    return { kind: "places", id: place.id };
  });
}
