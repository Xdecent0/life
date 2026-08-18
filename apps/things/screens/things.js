// Everything you own, laid out the way you were about to ask about it.
//
// Phone: rows under headings, because the question in a flat is «где оно».
// Desktop: a table with an inspector — the same data doing a different job, the
// arrangement the kitchen's shelf already proved.

import { html, raw, icon, esc, fmtMoney, toast, wide, fmtAlso } from "../../../core/dom.js";
import { pageHead, headBtn, headLink } from "../../../core/screens/head.js";
import { touch, commit, uid } from "../../../core/state.js";
import { mark } from "../../../core/sync.js";
import * as M from "../lib/model.js";
import { blank } from "../lib/store.js";

let grouping = "place";
let query = "";
let cursor = 0;
let selected = new Set();
let editing = null;
let showGone = false;

const placesOf = (state) => state.places ?? [];
const kindsOf = (state) => state.kinds ?? [];

function filtered(state) {
  let things = showGone
    ? (state.things ?? []).filter((t) => !t.deleted)
    : M.alive(state);

  if (query) {
    const q = query.toLowerCase();
    things = things.filter((t) =>
      [t.name, t.note, t.serial, t.place, t.kind].some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }

  return things;
}

const groups = (state) =>
  M.groupBy(filtered(state), grouping, { kinds: kindsOf(state), places: placesOf(state) });

const visible = (state) => groups(state).flatMap((g) => g.entries);

function groupSwitch() {
  const options = [["place", "места"], ["kind", "виды"], ["warranty", "гарантия"]];

  return html`<div class="seg seg--sm" role="group" aria-label="Как раскладывать">
    <span class="seg-label">раскладка</span>
    ${raw(options.map(([key, name]) =>
      `<button class="seg-btn" type="button" data-act="grouping" data-grouping="${key}" aria-pressed="${grouping === key}">${esc(name)}</button>`).join(""))}
  </div>`;
}

function addbar(state, flat = false) {
  const where = grouping === "place" && placesOf(state)[0] ? "" : "";

  return html`<form class="addbar${flat ? " addbar--flat addbar--slim" : ""}" data-act-submit="add">
    <input class="field" name="name" placeholder="Добавить вещь${where}" aria-label="Название вещи" autocomplete="off" required>
    <button class="icon-btn${flat ? " icon-btn--sm" : ""}" type="submit" aria-label="Добавить вещь">
      ${raw(icon("i-plus", { size: flat ? 18 : 22, stroke: "#1c3327" }))}
    </button>
  </form>`;
}

function emptyScreen(state) {
  return html`<main class="screen">
    ${raw(pageHead({ title: `Вещи`, said: `пусто` }))}
    <div class="body">
      <div class="empty">
        <h2>Я пока не знаю, что у тебя есть</h2>
        <p>Начни с того, что теряется и что на гарантии: техника, инструменты, документы. Остальное можно не заводить — списка ради списка тут не нужно.</p>
        ${raw(addbar(state, true))}
      </div>
    </div>
  </main>`;
}

/* ---------- phone ---------- */

function row(thing, state) {
  const warranty = M.warrantyLabel(thing);
  const running = M.warrantyRunningOut(thing);
  const place = placesOf(state).find((p) => p.name === thing.place);

  const why = [thing.place, warranty].filter(Boolean).join(" · ");

  return html`<a class="row" href="#thing/${thing.id}" data-burning="${running ? 1 : 0}">
    <span class="tile" aria-hidden="true">${raw(icon(place?.icon ?? "i-shelf", { size: 19, stroke: running ? "#c1481f" : "#1c3327" }))}</span>
    <span class="row-main">
      <span class="row-name">${thing.name}</span>
      <span class="row-why">${why || "где лежит — не сказано"}</span>
    </span>
    ${raw(thing.gone ? `<span class="tflag">нет</span>` : "")}
  </a>`;
}

function phone(state) {
  const things = M.alive(state);
  const running = things.filter((t) => M.warrantyRunningOut(t));

  const body = groups(state).map((g) => html`${raw(g.name ? `<div class="aisle">${esc(g.name)} <span class="num">${g.entries.length}</span></div>` : "")}
    ${raw(g.entries.map((t) => row(t, state)).join(""))}`).join("");

  return html`<main class="screen">
    ${raw(pageHead({
      title: "Вещи",
      said: `${things.length} ${M.plural(things.length, "вещь", "вещи", "вещей")}${running.length ? ` · ${running.length} по гарантии кончается` : ""}`,
      actions: headLink("Гарантии", "#warranty"),
    }))}

    <div class="workbar">${raw(groupSwitch())}</div>

    <div class="body">
      ${raw(body || `<div class="empty"><h2>Ничего не нашлось</h2><p>По этому фильтру пусто.</p></div>`)}
      ${raw(addbar(state))}
    </div>
  </main>`;
}

/* ---------- desktop ---------- */

const none = () => '<span class="tnone" aria-label="неизвестно">–</span>';

export function dateValue(at) {
  if (!at) return "";
  const d = new Date(at);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function desk(state) {
  const things = M.alive(state);
  const running = things.filter((t) => M.warrantyRunningOut(t));
  const shown = visible(state);
  cursor = Math.min(cursor, Math.max(0, shown.length - 1));
  const focused = shown[cursor] ?? null;
  const marked = shown.filter((t) => selected.has(t.id));

  const showPrice = shown.some((t) => t.price);

  const columns = [
    ["", ""],
    ["вещь", ""],
    ["где", ""],
    ["вид", ""],
    ["гарантия", ""],
    ...(showPrice ? [["цена", ""]] : []),
  ];

  const cell = (thing, field, body, cls = "") => {
    if (editing?.id === thing.id && editing.field === field) {
      return `<form class="tedit" data-act-submit="editSave">
        <input class="field field--cell" name="value" value="${esc(thing[field] ?? "")}"
            aria-label="${field === "name" ? "Название" : "Заметка"}" autocomplete="off"
            data-act-blur="editSave" autofocus>
      </form>`;
    }
    return `<span class="${cls} tcell" data-act-dbl="editOpen" data-id="${thing.id}" data-field="${field}"
        title="Двойной клик — правка">${body}</span>`;
  };

  let index = -1;
  const rows = groups(state).map((g) => {
    const head = g.name
      ? `<div class="trow trow--group" role="row"><span role="rowheader">${esc(g.name)}</span><span class="tdim num">${g.entries.length}</span></div>`
      : "";

    return head + g.entries.map((thing) => {
      const i = (index += 1);
      const runningOut = M.warrantyRunningOut(thing);
      const on = selected.has(thing.id);
      const warranty = M.warrantyLabel(thing);

      return html`<div class="trow" data-act="focus" data-id="${thing.id}" data-index="${i}"
          data-burning="${runningOut ? 1 : 0}" data-focused="${i === cursor ? 1 : 0}"
          data-marked="${on ? 1 : 0}" role="row" tabindex="-1">
        <button class="tcheck" type="button" data-act="mark" data-id="${thing.id}" role="checkbox" aria-checked="${on}"
            aria-label="Выделить ${thing.name}">
          ${raw(on ? icon("i-check", { size: 11, stroke: "#f4f1e6", width: 3 }) : "")}
        </button>
        ${raw(cell(thing, "name", `${esc(thing.name)}${thing.gone ? ` <span class="tflag">нет</span>` : ""}`, "tname"))}
        <span class="tdim">${raw(thing.place ? esc(thing.place) : none())}</span>
        <span class="tdim">${M.kindOf(thing, kindsOf(state)).name}</span>
        <span class="${runningOut ? "tburn" : "tdim"}">${raw(warranty ? esc(warranty) : none())}</span>
        ${raw(showPrice ? `<span class="tprice num">${thing.price ? esc(fmtMoney(thing.price)) : none()}</span>` : "")}
      </div>`;
    }).join("");
  }).join("");

  return html`<main class="screen">
    ${raw(pageHead({
      title: "Вещи",
      said: `${things.length} ${M.plural(things.length, "вещь", "вещи", "вещей")}${running.length ? ` · ${running.length} по гарантии кончается` : ""}`,
      actions: headLink("Гарантии", "#warranty"),
      bar: `<form class="search search--head" data-act-submit="search" role="search">
          <label class="sr-only" for="things-q">Поиск по вещам</label>
          ${icon("i-search", { size: 16, stroke: "#a9bcaf" })}
          <input class="search-field" id="things-q" name="q" value="${esc(query)}" placeholder="Поиск" autocomplete="off">
          <kbd>/</kbd>
        </form>`,
    }))}

    <div class="workbar">
      ${raw(addbar(state, true))}
      <span class="toolbar-sep" aria-hidden="true"></span>
      ${raw(groupSwitch())}
      <div class="chips">
        <button class="chip" type="button" data-act="showGone" aria-pressed="${showGone}">показывать то, чего уже нет</button>
      </div>
      <span class="toolbar-gap"></span>
      ${raw(marked.length
        ? `<span class="toolbar-bulk">Выделено ${marked.length} ·
             <button class="linkbtn" type="button" data-act="bulkGone">больше нет</button> ·
             <button class="linkbtn linkbtn--danger" type="button" data-act="bulkDelete">удалить</button>
             <span class="toolbar-move">переложить: ${placesOf(state).map((p) =>
               `<button class="linkbtn" type="button" data-act="bulkPlace" data-place="${esc(p.name)}">${esc(p.name)}</button>`).join(" · ")}</span>
           </span>`
        : `<span class="toolbar-hint"><kbd>↑↓</kbd> ходить · <kbd>Enter</kbd> править · <kbd>Del</kbd> удалить</span>`)}
    </div>

    <div class="split">
      <div class="table" role="table" aria-label="Вещи" data-cols="${columns.length}">
        <div class="trow trow--head" role="row">
          ${raw(columns.map(([name]) => `<span role="columnheader">${esc(name)}</span>`).join(""))}
        </div>
        ${raw(rows || `<div class="empty"><h2>Ничего не нашлось</h2><p>По этому запросу пусто.</p></div>`)}
      </div>

      <aside class="inspector" aria-label="Инспектор">${raw(inspector(state, focused))}</aside>
    </div>
  </main>`;
}

function inspector(state, thing) {
  if (!thing) {
    return html`<div class="pane pane--calm">
      <p class="prose">Выбери строку слева — здесь появится, где вещь лежит, до какого числа гарантия и что ты про неё записал.</p>
    </div>`;
  }

  const warranty = M.warrantyLabel(thing);

  return html`<div class="insp-head">
    <h2 class="insp-name">${thing.name}</h2>
    <div class="chips">
      ${raw(warranty ? `<span class="chip ${M.warrantyRunningOut(thing) ? "chip--alarm" : ""}">${esc(warranty)}</span>` : "")}
      ${raw(thing.place ? `<span class="chip">${esc(thing.place)}</span>` : "")}
      <span class="chip">${M.kindOf(thing, kindsOf(state)).name}</span>
    </div>
  </div>

  <div class="insp-block">
    <div class="label">Где лежит</div>
    <div class="chips">
      ${raw(placesOf(state).map((p) => `<button class="chip" type="button" data-act="place" data-place="${esc(p.name)}" aria-pressed="${thing.place === p.name}">${esc(p.name)}</button>`).join(""))}
    </div>
  </div>

  <div class="insp-block">
    <div class="label">Вид</div>
    <div class="chips">
      ${raw(kindsOf(state).map((k) => `<button class="chip chip--sm" type="button" data-act="kind" data-kind="${esc(k.name)}" aria-pressed="${M.kindOf(thing, kindsOf(state)).name === k.name}">${esc(k.name)}</button>`).join(""))}
    </div>
  </div>

  <div class="insp-block">
    <div class="label">Куплено</div>
    <input class="field field--date" type="date" value="${raw(dateValue(thing.boughtAt))}"
        aria-label="Дата покупки" data-act-change="bought">
  </div>

  <div class="insp-block">
    <div class="label">Гарантия до</div>
    <input class="field field--date" type="date" value="${raw(dateValue(thing.warrantyUntil))}"
        aria-label="Гарантия до" data-act-change="warranty">
    <p class="prose prose--muted">${thing.warrantyUntil
      ? "За месяц до конца вещь начнёт подсвечиваться — чтобы успеть сходить, пока меняют."
      : "Большинству вещей это поле не нужно. Ставь его технике и всему, что чинят по чеку."}</p>
  </div>

  <div class="insp-block">
    <div class="label">Заметка</div>
    <form class="stack stack--tight" data-act-submit="note">
      <input class="field" name="note" value="${thing.note ?? ""}" placeholder="что помнить про неё" aria-label="Заметка" autocomplete="off">
      <input class="field" name="serial" value="${thing.serial ?? ""}" placeholder="серийник, если важен" aria-label="Серийный номер" autocomplete="off">
      <input class="field field--qty" name="price" value="${thing.price ?? ""}" placeholder="цена" aria-label="Цена" autocomplete="off" inputmode="decimal">
      <button class="btn btn--ghost btn--sm" type="submit">Сохранить</button>
    </form>
    ${raw(thing.price ? `<p class="prose prose--muted">${esc(fmtMoney(thing.price))} ${fmtAlso(thing.price, thing.boughtAt ?? Date.now())}</p>` : "")}
  </div>

  <div class="insp-foot">
    <div class="rowbtns">
      <button class="btn btn--ghost btn--grow" type="button" data-act="gone">${thing.gone ? "Вернулась" : "Больше нет"}</button>
      <button class="btn btn--ghost btn--danger" type="button" data-act="remove">Удалить</button>
    </div>
  </div>`;
}

/* ---------- screen ---------- */

export default {
  title: () => "Вещи",

  render(state) {
    if (!(state.things ?? []).length) return emptyScreen(state);
    return wide.matches ? desk(state) : phone(state);
  },

  leave() {
    selected.clear();
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
      const thing = shown[cursor];
      if (!thing) return;
      e.preventDefault();
      editing = { id: thing.id, field: "name" };
      touch();
      return;
    }

    if (e.key === "Delete") {
      const thing = shown[cursor];
      if (!thing) return;
      e.preventDefault();
      remove([thing]);
      return;
    }

    if (e.key === "/") {
      e.preventDefault();
      document.getElementById("things-q")?.focus();
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

    showGone() {
      showGone = !showGone;
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

    mark(el) {
      const id = el.dataset.id;
      selected.has(id) ? selected.delete(id) : selected.add(id);
      touch();
    },

    add(form, state) {
      const name = String(new FormData(form).get("name") ?? "").trim();
      if (!name) return;

      // A first thing has to land somewhere, and the place being looked at is the
      // likeliest one — the person is standing in that room.
      const place = grouping === "place" ? (groups(state)[0]?.name ?? null) : null;

      let added = null;
      commit("things.add", (s) => {
        added = blank({ id: uid("t"), name, place: place === "без места" ? null : place });
        s.things.push(added);
        return { kind: "things", id: added.id };
      });

      toast([name, added?.place].filter(Boolean).join(" · "));

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
      commit("things.edit", (s) => {
        const thing = s.things.find((t) => t.id === id);
        if (!thing) return null;
        if (field === "name" && !value) return null;
        if ((thing[field] ?? "") === value) return null;

        thing[field] = value;
        thing.at = Date.now();
        changed = true;
        return { kind: "things", id: thing.id };
      });

      if (!changed) touch();
    },

    place(el, state) {
      const thing = visible(state)[cursor];
      if (thing) setField(thing, "place", el.dataset.place);
    },

    kind(el, state) {
      const thing = visible(state)[cursor];
      if (!thing) return;

      commit("things.kind", (s) => {
        const target = s.things.find((t) => t.id === thing.id);
        if (!target) return null;
        // Choosing what the guess would have said clears the override rather than
        // freezing it, so a better table still helps this record later.
        const guess = M.kindOf({ name: target.name }, s.kinds).name;
        target.kind = guess === el.dataset.kind ? null : el.dataset.kind;
        target.at = Date.now();
        return { kind: "things", id: target.id };
      });
    },

    bought(el, state) {
      const thing = visible(state)[cursor];
      if (thing) setField(thing, "boughtAt", el.value ? Date.parse(`${el.value}T00:00:00Z`) : null);
    },

    warranty(el, state) {
      const thing = visible(state)[cursor];
      if (!thing) return;
      setField(thing, "warrantyUntil", el.value ? Date.parse(`${el.value}T00:00:00Z`) : null);
      toast(el.value ? `Гарантия до ${el.value}` : "Гарантия снята");
    },

    note(form, state) {
      const thing = visible(state)[cursor];
      if (!thing) return;
      const data = new FormData(form);
      const price = String(data.get("price") ?? "").replace(",", ".").trim();

      commit("things.note", (s) => {
        const target = s.things.find((t) => t.id === thing.id);
        if (!target) return null;
        target.note = String(data.get("note") ?? "").trim();
        target.serial = String(data.get("serial") ?? "").trim();
        target.price = price ? Number(price) : null;
        target.at = Date.now();
        return { kind: "things", id: target.id };
      });

      toast("Сохранено");
    },

    gone(_el, state) {
      const thing = visible(state)[cursor];
      if (thing) setGone([thing], !thing.gone);
    },

    remove(_el, state) {
      const thing = visible(state)[cursor];
      if (thing) remove([thing]);
    },

    bulkPlace(el, state) {
      const marked = filtered(state).filter((t) => selected.has(t.id));
      for (const thing of marked) setField(thing, "place", el.dataset.place, { quiet: true });
      if (marked.length) toast(`${marked.length} → ${el.dataset.place}`);
      selected.clear();
    },

    bulkGone(_el, state) {
      setGone(filtered(state).filter((t) => selected.has(t.id)), true);
      selected.clear();
    },

    bulkDelete(_el, state) {
      remove(filtered(state).filter((t) => selected.has(t.id)));
      selected.clear();
    },
  },
};

function setField(thing, field, value, { quiet = false } = {}) {
  commit(`things.${field}`, (s) => {
    const target = s.things.find((t) => t.id === thing.id);
    if (!target) return null;
    target[field] = value;
    target.at = Date.now();
    return { kind: "things", id: target.id };
  });
  if (!quiet && field === "place") toast(`${thing.name} → ${value}`);
}

/**
 * Sold, given away, thrown out. Not deletion: what used to be here is worth
 * knowing, and «у меня был такой» is a real question people ask themselves.
 */
function setGone(things, gone) {
  if (!things.length) return;
  const ids = things.map((t) => t.id);

  commit("things.gone", (s) => {
    for (const thing of s.things) {
      if (!ids.includes(thing.id)) continue;
      thing.gone = gone;
      thing.goneAt = gone ? Date.now() : null;
      thing.at = Date.now();
    }
    return { kind: "things", bulk: true };
  });

  toast(things.length === 1
    ? `${things[0].name} — ${gone ? "больше нет" : "снова есть"}`
    : `${things.length} ${gone ? "убрано" : "возвращено"}`);
}

/** A tombstone, so a removal survives the trip through the other device. */
function remove(things) {
  if (!things.length) return;
  const ids = things.map((t) => t.id);

  commit("things.remove", (s) => {
    for (const thing of s.things) if (ids.includes(thing.id)) mark(thing, "deleted", true);
    return { kind: "things", bulk: true };
  });

  for (const id of ids) selected.delete(id);

  toast(things.length === 1 ? `${things[0].name} удалена` : `Удалено ${things.length}`, "calm", {
    undo: () => commit("things.undelete", (s) => {
      for (const thing of s.things) if (ids.includes(thing.id)) mark(thing, "deleted", false);
      return { kind: "things", bulk: true };
    }),
  });
}
