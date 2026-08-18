// Одно место на телефоне: сколько раз был, как оно, звать ли обратно.

import { html, raw, icon, esc, toast } from "../../../core/dom.js";
import { pageHead, headBtn, headLink } from "../../../core/screens/head.js";
import { cardScreen } from "../../../core/screens/card.js";
import { commit } from "../../../core/state.js";
import { mark } from "../../../core/sync.js";
import * as M from "../lib/model.js";

const find = (state, id) => M.alive(state).find((p) => p.id === id);
const currentId = () => location.hash.split("/")[1] ?? null;

export default {
  title: (state, id) => find(state, id)?.name ?? "Место",

  render(state, id) {
    const place = find(state, id);
    if (!place) {
      return html`<main class="screen">
        ${raw(pageHead({ title: `Не нашлось` }))}
        <div class="body"><div class="empty"><h2>Такого места нет</h2><p>Его удалили, или ссылка старая.</p><a class="btn" href="#places">К местам</a></div></div>
      </main>`;
    }

    const now = M.today();
    const visits = M.visitsOf(place);

    const head = pageHead({
      title: `${place.name}`,
      back: "#places",
      backLabel: "Назад к местам",
      said: `${M.kindOf(place, state.kinds ?? []).name}`,
      chips: [
        place.rating ? `<span class="chip">${"★".repeat(place.rating)}</span>` : "",
        place.area ? `<span class="chip">${esc(place.area)}</span>` : "",
        M.callsBack(place, now) ? `<span class="chip chip--alarm">зовёт обратно</span>` : "",
      ].join(""),
    });

    const main = html`<section class="pane">
          <div class="label">Как оно</div>
          <div class="chips">
            ${raw(M.STARS.map((n) => `<button class="chip" type="button" data-act="rate" data-rating="${n}" aria-pressed="${place.rating === n}">${"★".repeat(n)}</button>`).join(""))}
          </div>
        </section>

        <section class="pane">
          <div class="label">Вид и район</div>
          <div class="chips">
            ${raw((state.kinds ?? []).map((k) => `<button class="chip chip--sm" type="button" data-act="kind" data-kind="${esc(k.name)}" aria-pressed="${M.kindOf(place, state.kinds ?? []).name === k.name}">${esc(k.name)}</button>`).join(""))}
          </div>
          <form class="stack stack--tight" data-act-submit="save">
            <input class="field" name="name" value="${place.name}" aria-label="Название" autocomplete="off" required>
            <input class="field" name="area" value="${place.area ?? ""}" placeholder="район или город" aria-label="Район" autocomplete="off">
            <input class="field" name="note" value="${place.note ?? ""}" placeholder="что там хорошего" aria-label="Заметка" autocomplete="off">
            <input class="field" name="url" value="${place.url ?? ""}" placeholder="ссылка" aria-label="Ссылка" autocomplete="off" inputmode="url">
            <button class="btn btn--ghost btn--sm" type="submit">Сохранить</button>
          </form>
          ${raw(place.url ? `<a class="btn btn--ghost btn--sm" href="${esc(place.url)}" target="_blank" rel="noopener noreferrer">Открыть ссылку</a>` : "")}
        </section>

        <section class="pane">
          <div class="label">Возвращаться</div>
          <div class="chips">
            ${raw([7, 30, 90, 365].map((n) => `<button class="chip chip--sm" type="button" data-act="every" data-every="${n}" aria-pressed="${place.every === n}">${esc(M.everyLabel({ every: n }))}</button>`).join(""))}
          </div>
          <p class="prose prose--muted">Только тем, куда правда хочется возвращаться. Музей, в котором был однажды, не просрочен.</p>
        </section>`;

    const foot = html`<div class="foot foot--wrap">
      <button class="btn btn--grow" type="button" data-act="went">Был сегодня</button>
      ${raw(visits.length ? `<button class="btn btn--ghost" type="button" data-act="unwent">Убрать последний</button>` : "")}
      <button class="btn btn--ghost btn--danger" type="button" data-act="remove">Удалить</button>
    </div>`;

    return cardScreen({
      head,
      main,
      foot,
      label: "Про это место",
      side: (cls) => sideOf(state, place, now, cls),
    });
  },

  actions: {
    went(_el, state) {
      const place = find(state, currentId());
      if (!place) return;
      patch((p) => { p.visits = [...(p.visits ?? []), M.today()]; });
      toast(`${place.name} — отмечено`, "calm", {
        undo: () => patch((p) => { p.visits = (p.visits ?? []).slice(0, -1); }),
      });
    },

    unwent() {
      patch((p) => { p.visits = (p.visits ?? []).slice(0, -1); });
      toast("Последний поход убран");
    },

    rate(el) {
      const rating = Number(el.dataset.rating) || null;
      patch((p) => { p.rating = p.rating === rating ? null : rating; });
    },

    every(el) {
      const every = Number(el.dataset.every) || null;
      patch((p) => { p.every = p.every === every ? null : every; });
    },

    kind(el) {
      commit("places.kind", (s) => {
        const place = s.places.find((p) => p.id === currentId());
        if (!place) return null;
        // Выбор того, что догадка и так дала бы, снимает переопределение.
        const guess = M.kindOf({ name: place.name }, s.kinds).name;
        place.kind = guess === el.dataset.kind ? null : el.dataset.kind;
        place.at = Date.now();
        return { kind: "places", id: place.id };
      });
    },

    save(form) {
      const data = new FormData(form);
      const name = String(data.get("name") ?? "").trim();
      if (!name) return;
      patch((p) => {
        p.name = name;
        p.area = String(data.get("area") ?? "").trim();
        p.note = String(data.get("note") ?? "").trim();
        p.url = String(data.get("url") ?? "").trim();
      });
      toast("Сохранено");
    },

    remove(_el, state) {
      const place = find(state, currentId());
      if (!place) return;

      commit("places.remove", (s) => {
        const target = s.places.find((p) => p.id === place.id);
        if (!target) return null;
        mark(target, "deleted", true);
        return { kind: "places", id: target.id };
      });

      location.hash = "places";
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

/**
 * Колонка справа: сколько раз был, и что ещё есть в этом районе.
 *
 * «Куда сходить» — вопрос про район, а не про одно заведение: список соседей
 * рядом с карточкой отвечает на него сразу, вместо возврата к общему списку и
 * фильтра по тому же слову.
 */
function sideOf(state, place, now, cls) {
  const visits = M.visitsOf(place);
  const kind = M.kindOf(place, state.kinds ?? []).name;

  const near = M.alive(state).filter((p) => p.id !== place.id && place.area && p.area === place.area);
  const same = M.alive(state).filter((p) => p.id !== place.id && M.kindOf(p, state.kinds ?? []).name === kind);

  const rows = [
    ["Был раз", visits.length || ""],
    ["Последний", visits.length ? new Date(Math.max(...visits)).toLocaleDateString("ru", { day: "numeric", month: "short", year: "2-digit" }) : ""],
    ["Ритм", place.every ? M.everyLabel(place) : ""],
    ["Вид", kind],
    ["Район", place.area || ""],
  ].filter(([, value]) => value);

  const list = (items) => items.slice(0, 8).map((p) =>
    `<a class="insp-row" href="#place/${esc(p.id)}"><span>${esc(p.name)}</span><span class="tdim">${esc((p.visits ?? []).length ? "был" : "хочу")}</span></a>`).join("");

  return html`<div class="${cls}">
      <div class="label">Ходил</div>
      <p class="prose">${M.historyLabel(place, now)}</p>
      ${raw(rows.map(([name, value]) => `<div class="insp-row"><span>${esc(name)}</span><span class="tdim">${esc(String(value))}</span></div>`).join(""))}
      ${raw(place.note ? `<p class="prose prose--muted">${esc(place.note)}</p>` : "")}
    </div>
    ${raw(near.length ? `<div class="${cls}">
      <div class="head-row"><div class="label">Рядом, ${esc(place.area)}</div><span class="tdim num">${near.length}</span></div>
      ${list(near)}
    </div>` : "")}
    ${raw(same.length ? `<div class="${cls}">
      <div class="head-row"><div class="label">Такие же</div><span class="tdim num">${same.length}</span></div>
      ${list(same)}
    </div>` : "")}`;
}

function patch(change) {
  commit("places.edit", (s) => {
    const place = s.places.find((p) => p.id === currentId());
    if (!place) return null;
    change(place);
    place.at = Date.now();
    return { kind: "places", id: place.id };
  });
}
