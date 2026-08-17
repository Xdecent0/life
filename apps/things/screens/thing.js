// One thing, on a phone. The same fields the desktop inspector has, in the order
// you would actually ask about them: где лежит, до какого числа гарантия, что
// про неё записано.

import { html, raw, icon, esc, cap, fmtMoney, toast, fmtAlso, fmtDate } from "../../../core/dom.js";
import { cardScreen } from "../../../core/screens/card.js";
import { commit } from "../../../core/state.js";
import { mark } from "../../../core/sync.js";
import * as M from "../lib/model.js";
import { dateValue } from "./things.js";

const find = (state, id) => (state.things ?? []).find((t) => t.id === id);
const currentId = () => location.hash.split("/")[1] ?? null;

export default {
  title: (state, id) => find(state, id)?.name ?? "Вещь",

  render(state, id) {
    const thing = find(state, id);
    if (!thing) {
      return html`<main class="screen">
        <header class="head"><h1>Не нашлась</h1></header>
        <div class="body"><div class="empty"><h2>Такой вещи нет</h2><p>Её удалили, или ссылка старая.</p><a class="btn" href="#things">К вещам</a></div></div>
      </main>`;
    }

    const warranty = M.warrantyLabel(thing);
    const running = M.warrantyRunningOut(thing);

    const head = html`<header class="head">
        <div class="head-row">
          <a class="icon-btn icon-btn--sm" href="#things" aria-label="Назад к вещам">${raw(icon("i-back", { size: 18, stroke: "#1c3327" }))}</a>
          <span class="head-sub">${thing.place ? cap(thing.place) : "без места"}</span>
        </div>
        <h1>${thing.name}</h1>
        <div class="chips">
          ${raw(warranty ? `<span class="chip ${running ? "chip--alarm" : ""}">${esc(warranty)}</span>` : "")}
          <span class="chip">${M.kindOf(thing, state.kinds ?? []).name}</span>
          ${raw(thing.gone ? `<span class="chip">больше нет</span>` : "")}
        </div>
      </header>`;

    const main = html`<section class="pane">
          <div class="label">Где лежит</div>
          <div class="chips">
            ${raw((state.places ?? []).map((p) => `<button class="chip" type="button" data-act="place" data-place="${esc(p.name)}" aria-pressed="${thing.place === p.name}">${raw(icon(p.icon ?? "i-shelf", { size: 15, stroke: "#1c3327" }))} ${esc(p.name)}</button>`).join(""))}
          </div>
        </section>

        <section class="pane">
          <div class="label">Вид</div>
          <div class="chips">
            ${raw((state.kinds ?? []).map((k) => `<button class="chip chip--sm" type="button" data-act="kind" data-kind="${esc(k.name)}" aria-pressed="${M.kindOf(thing, state.kinds ?? []).name === k.name}">${esc(k.name)}</button>`).join(""))}
          </div>
        </section>

        <section class="pane">
          <div class="label">Куплено</div>
          <input class="field field--date" type="date" value="${raw(dateValue(thing.boughtAt))}"
              aria-label="Дата покупки" data-act-change="bought">
        </section>

        <section class="pane">
          <div class="label">Гарантия до</div>
          <input class="field field--date" type="date" value="${raw(dateValue(thing.warrantyUntil))}"
              aria-label="Гарантия до" data-act-change="warranty">
          <p class="prose prose--muted">${thing.warrantyUntil
            ? "За месяц до конца вещь начнёт подсвечиваться — чтобы успеть сходить, пока меняют."
            : "Большинству вещей это не нужно. Ставь технике и всему, что чинят по чеку."}</p>
        </section>

        <section class="pane">
          <div class="label">Что про неё помнить</div>
          <form class="stack stack--tight" data-act-submit="save">
            <input class="field" name="name" value="${thing.name}" aria-label="Название" autocomplete="off" required>
            <input class="field" name="note" value="${thing.note ?? ""}" placeholder="заметка" aria-label="Заметка" autocomplete="off">
            <input class="field" name="serial" value="${thing.serial ?? ""}" placeholder="серийник, если важен" aria-label="Серийный номер" autocomplete="off">
            <input class="field" name="price" value="${thing.price ?? ""}" placeholder="цена" aria-label="Цена" autocomplete="off" inputmode="decimal">
            <button class="btn btn--ghost btn--sm" type="submit">Сохранить</button>
          </form>
          ${raw(thing.price ? `<p class="prose prose--muted">${esc(fmtMoney(thing.price))} ${fmtAlso(thing.price, thing.boughtAt ?? Date.now())}</p>` : "")}
        </section>`;

    const foot = html`<div class="foot foot--wrap">
      <button class="btn btn--grow" type="button" data-act="gone">${thing.gone ? "Вернулась" : "Больше нет"}</button>
      <button class="btn btn--ghost btn--danger" type="button" data-act="remove">Удалить</button>
    </div>`;

    return cardScreen({
      head,
      main,
      foot,
      label: "Про эту вещь",
      side: (cls) => sideOf(state, thing, cls),
    });
  },

  actions: {
    place(el) { patch((t) => { t.place = el.dataset.place; }); },

    kind(el) {
      commit("things.kind", (s) => {
        const thing = s.things.find((t) => t.id === currentId());
        if (!thing) return null;
        const guess = M.kindOf({ name: thing.name }, s.kinds).name;
        thing.kind = guess === el.dataset.kind ? null : el.dataset.kind;
        thing.at = Date.now();
        return { kind: "things", id: thing.id };
      });
    },

    bought(el) { patch((t) => { t.boughtAt = el.value ? Date.parse(`${el.value}T00:00:00Z`) : null; }); },

    warranty(el) {
      patch((t) => { t.warrantyUntil = el.value ? Date.parse(`${el.value}T00:00:00Z`) : null; });
      toast(el.value ? `Гарантия до ${el.value}` : "Гарантия снята");
    },

    save(form) {
      const data = new FormData(form);
      const name = String(data.get("name") ?? "").trim();
      if (!name) return;
      const price = String(data.get("price") ?? "").replace(",", ".").trim();

      patch((t) => {
        t.name = name;
        t.note = String(data.get("note") ?? "").trim();
        t.serial = String(data.get("serial") ?? "").trim();
        t.price = price ? Number(price) : null;
      });
      toast("Сохранено");
    },

    gone(_el, state) {
      const thing = find(state, currentId());
      if (!thing) return;
      const next = !thing.gone;
      patch((t) => { t.gone = next; t.goneAt = next ? Date.now() : null; });
      toast(next ? `${thing.name} — больше нет` : `${thing.name} — снова есть`);
    },

    remove(_el, state) {
      const thing = find(state, currentId());
      if (!thing) return;

      commit("things.remove", (s) => {
        const target = s.things.find((t) => t.id === thing.id);
        if (!target) return null;
        mark(target, "deleted", true);
        return { kind: "things", id: target.id };
      });

      location.hash = "things";
      toast(`${thing.name} удалена`, "calm", {
        undo: () => commit("things.undelete", (s) => {
          const target = s.things.find((t) => t.id === thing.id);
          if (!target) return null;
          mark(target, "deleted", false);
          return { kind: "things", id: target.id };
        }),
      });
    },
  },
};

/**
 * Колонка фактов: сводка, соседи по месту, родня по виду.
 *
 * Соседи — не украшение. «Где лежит дрель» почти всегда спрашивают вместе с
 * «что там ещё лежит», а «такие же» отвечает на «сколько у меня этих кабелей»
 * раньше, чем человек пойдёт считать их руками.
 */
function sideOf(state, thing, cls) {
  const kind = M.kindOf(thing, state.kinds ?? []).name;
  const near = M.alive(state).filter((t) => t.id !== thing.id && thing.place && t.place === thing.place);
  const same = M.alive(state).filter((t) => t.id !== thing.id && M.kindOf(t, state.kinds ?? []).name === kind);

  const rows = [
    ["Место", thing.place ? cap(thing.place) : ""],
    ["Вид", kind],
    ["Куплено", thing.boughtAt ? fmtDate(thing.boughtAt) : ""],
    ["Гарантия", M.warrantyLabel(thing) || ""],
    ["Цена", thing.price ? fmtMoney(thing.price) : ""],
    ["Серийник", thing.serial || ""],
  ].filter(([, value]) => value);

  const list = (items) => items.slice(0, 8).map((t) =>
    `<a class="insp-row" href="#thing/${esc(t.id)}"><span>${esc(t.name)}</span><span class="tdim">${esc(t.place ? cap(t.place) : "без места")}</span></a>`).join("");

  return html`<div class="${cls}">
      <div class="label">Коротко</div>
      ${raw(rows.map(([name, value]) => `<div class="insp-row"><span>${esc(name)}</span><span class="tdim">${esc(value)}</span></div>`).join(""))}
    </div>
    ${raw(near.length ? `<div class="${cls}">
      <div class="head-row"><div class="label">Там же лежит</div><span class="tdim num">${near.length}</span></div>
      ${list(near)}
    </div>` : "")}
    ${raw(same.length ? `<div class="${cls}">
      <div class="head-row"><div class="label">Такие же</div><span class="tdim num">${same.length}</span></div>
      ${list(same)}
    </div>` : "")}`;
}

function patch(change) {
  commit("things.edit", (s) => {
    const thing = s.things.find((t) => t.id === currentId());
    if (!thing) return null;
    change(thing);
    thing.at = Date.now();
    return { kind: "things", id: thing.id };
  });
}
