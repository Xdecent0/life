// Настройки Проектов — только то, что про проекты. Остальное в ядре.
//
// Справочников у этого приложения нет: всё, что оно знает, приезжает снимком.
// Поэтому вместо кнопки «обновить справочник» здесь честное объяснение, откуда
// берутся данные и что делать, если они устарели.

import { html, raw } from "../../../core/dom.js";
import { settings } from "../../../core/screens/settings.js";
import * as M from "../lib/model.js";

export default settings({
  panes(state) {
    const age = M.snapshotAge(state);
    const waiting = M.waiting(state).length;
    const refused = M.refused(state).length;
    const cycle = M.boardOf(state)?.цикл;

    return [
      html`<section class="pane">
        <div class="label">Откуда это</div>
        <p class="prose">Проекты живут заметками в <code>10 - Проекты</code> волта. Доска на компьютере читает их напрямую; сюда приезжает снимок, который собирает <code>AI\\board_bridge.py sync</code>.</p>
        <div class="insp-row"><span>Снимок</span><span class="tdim">${age == null ? "не приезжал" : age === 0 ? "сегодня" : `${age} ${M.plural(age, "день", "дня", "дней")} назад`}</span></div>
        <div class="insp-row"><span>Проектов</span><span class="tdim num">${M.projects(state).length}</span></div>
        <div class="insp-row"><span>Дел открыто</span><span class="tdim num">${M.open(state).length}</span></div>
      </section>`,

      cycle
        ? html`<section class="pane">
            <div class="label">Цикл</div>
            <div class="insp-row"><span>Идёт</span><span class="tdim">${cycle.имя}</span></div>
            <div class="insp-row"><span>Неделя</span><span class="tdim num">${cycle.неделя} из ${cycle.всего}</span></div>
            <div class="insp-row"><span>Осталось</span><span class="tdim num">${cycle.осталось} ${M.plural(cycle.осталось, "день", "дня", "дней")}</span></div>
          </section>`
        : null,

      html`<section class="pane">
        <div class="label">Правки</div>
        <p class="prose">Галочка отсюда не правит заметку сама: она уезжает записью, а применяет её мост на компьютере — теми же операциями и теми же границами, что сервер доски. Пока волт не ответил, рядом с галочкой написано «ждёт волта».</p>
        <div class="insp-row"><span>Ждут волта</span><span class="tdim num">${waiting || "—"}</span></div>
        <div class="insp-row"><span>Отбито</span><span class="tdim num">${refused || "—"}</span></div>
        ${raw(refused ? `<p class="prose prose--muted">Отбитая правка — почти всегда «строка разошлась»: заметку правили руками, пока правка ехала.</p>` : "")}
      </section>`,
    ];
  },
});
