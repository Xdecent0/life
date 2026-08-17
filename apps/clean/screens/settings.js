// Настройки Уборки — только то, что про дом. Остальное в ядре.

import { html, raw, esc } from "../../../core/dom.js";
import { settings } from "../../../core/screens/settings.js";
import { parseRooms } from "../../../core/vault.js";
import * as M from "../lib/model.js";

export default settings({
  refs: {
    label: "Справочник комнат",
    note: "Планировка живёт в волте: <code>Дом/Комнаты.md</code> — один список на весь дом, общий с Вещами. Колонки: комната, значок, ряд, колонка, ширина. Допиши строку, и на карте появится кабинет или вторая ванная.",
    button: "Обновить карту из волта",
    done: "Карта обновлена",
    rows: (state) => [["Комнат", (state.rooms ?? []).length]],

    apply(read, s) {
      if (read.rooms?.status !== "read") return 0;
      const rooms = parseRooms(read.rooms.text);
      if (!rooms.length) return 0;
      s.rooms = rooms;
      return 1;
    },
  },

  panes(state) {
    const now = M.today();
    const spots = M.alive(state);
    const due = M.dueEverywhere(state, now);
    const never = spots.filter((s) => !s.lastDone);
    const off = M.drifting(state);
    const stuck = spots
      .map((s) => ({ spot: s, over: M.overdueCycles(s, now) }))
      .filter((r) => r.over >= 2)
      .sort((a, b) => b.over - a.over);

    return [
      html`<section class="pane">
        <div class="label">Как дела</div>
        <div class="insp-row"><span>Поверхностей</span><span class="tdim num">${spots.length}</span></div>
        <div class="insp-row"><span>Ждут</span><span class="tdim num">${due.length}</span></div>
        <div class="insp-row"><span>Ни разу не убирали</span><span class="tdim num">${never.length}</span></div>
        ${raw(never.length ? `<p class="prose prose--muted">Про них приложение молчит, а не ругается: неизвестно — это не то же самое, что грязно.</p>` : "")}
      </section>`,

      /* Циклы приложение посеяло само, и спорить с фактом должно оно, а не
         человек. Одним списком, потому что чинится это подряд: сел, поправил
         пять чисел — и «пора» перестало приходить не вовремя. */
      off.length || stuck.length
        ? html`<section class="pane">
            <div class="head-row">
              <div class="label">Циклы против жизни</div>
              <span class="tdim num">${off.length + stuck.length}</span>
            </div>

            ${raw(off.map(({ spot, drift }) => `<div class="finding">
              <div class="finding-head">
                <a href="#spot/${esc(spot.id)}">${esc(spot.name)}</a>
                <span class="dim">раз в ${drift.real} вместо ${drift.every}</span>
              </div>
              <p class="finding-why">${esc(drift.fix)}</p>
            </div>`).join(""))}

            ${raw(stuck.map(({ spot, over }) => `<div class="finding">
              <div class="finding-head">
                <a href="#spot/${esc(spot.id)}">${esc(spot.name)}</a>
                <span class="dim">просрочено на ${over} ${esc(M.plural(over, "цикл", "цикла", "циклов"))} · ${esc(M.lastLabel(spot, now))}</span>
              </div>
            </div>`).join(""))}

            ${raw(stuck.length ? `<p class="prose prose--muted">Столько циклов подряд — уже не «руки не дошли»: либо цикл не тот, либо задача, которую никто не собирается делать. Второе — тоже ответ.</p>` : "")}
            <p class="prose prose--muted">Ритм считается по последним ${M.DONE_KEPT} отметкам; пока их меньше ${M.RHYTHM_FLOOR}, приложение молчит и ничего не предлагает.</p>
          </section>`
        : "",
    ].filter(Boolean);
  },
});
