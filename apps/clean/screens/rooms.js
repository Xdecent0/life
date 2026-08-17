// Комнаты и что в них добавить. Правка карты живёт здесь, чтобы главный экран
// оставался тем, на что смотрят, а не тем, что настраивают.

import { html, raw, icon, esc, toast } from "../../../core/dom.js";
import { commit, uid, touch } from "../../../core/state.js";
import * as M from "../lib/model.js";
import { blankSpot } from "../lib/store.js";

let adding = null;

export default {
  title: () => "Комнаты",

  render(state) {
    const now = M.today();
    const rooms = M.roomsOf(state);

    return html`<main class="screen">
      <header class="head head--dark">
        <h1>Комнаты</h1>
        <span class="head-sub num">${rooms.length} ${M.plural(rooms.length, "комната", "комнаты", "комнат")} · ${M.alive(state).length} ${M.plural(M.alive(state).length, "поверхность", "поверхности", "поверхностей")}</span>
      </header>

      <div class="body">
        ${raw(rooms.map((room) => {
          const spots = M.spotsIn(state, room.id);
          const health = M.roomHealth(state, room.id, now);

          return `<section class="pane">
            <div class="head-row">
              <div class="label">${esc(room.name)}</div>
              <span class="tdim num">${spots.length} ${esc(M.plural(spots.length, "поверхность", "поверхности", "поверхностей"))}${health.due ? ` · ${health.due} ждёт` : ""}</span>
            </div>

            ${spots.map((s) => `<div class="insp-row">
              <a href="#spot/${esc(s.id)}">${esc(s.name)}</a>
              <span class="tdim">${esc(M.everyLabel(s))} · ${esc(M.lastLabel(s, now))}</span>
            </div>`).join("")}

            ${adding === room.id
              ? `<form class="addbar addbar--flat" data-act-submit="add">
                   <input type="hidden" name="room" value="${esc(room.id)}">
                   <input class="field" name="name" placeholder="что убирать" aria-label="Название поверхности" autocomplete="off" required autofocus>
                   <input class="field field--qty" name="every" placeholder="раз в N дней" aria-label="Раз в сколько дней" inputmode="numeric" value="7">
                   <button class="btn btn--ghost btn--sm" type="submit">Добавить</button>
                 </form>`
              : `<button class="btn btn--ghost btn--sm" type="button" data-act="addOpen" data-room="${esc(room.id)}">Добавить поверхность</button>`}
          </section>`;
        }).join(""))}

        <section class="pane pane--calm">
          <div class="label">Карта</div>
          <p class="prose">Комнаты и их места на плане — таблица в волте: <code>Уборка/Справочники/Комнаты.md</code>. Там же ряд, колонка и ширина, если планировка не такая, как по умолчанию.</p>
          <a class="btn btn--ghost btn--sm" href="#settings">Настройки</a>
        </section>
      </div>
    </main>`;
  },

  leave() {
    adding = null;
  },

  actions: {
    addOpen(el) {
      adding = el.dataset.room;
      touch();
    },

    add(form) {
      const data = new FormData(form);
      const name = String(data.get("name") ?? "").trim();
      const room = String(data.get("room") ?? "");
      const every = Number(String(data.get("every") ?? "").trim()) || 7;
      if (!name) return;

      adding = null;
      commit("clean.add", (s) => {
        const spot = blankSpot({ id: uid("sp"), room, name, every });
        s.spots.push(spot);
        return { kind: "spots", id: spot.id };
      });

      toast(`${name} · ${M.everyLabel({ every })}`);
    },
  },
};
