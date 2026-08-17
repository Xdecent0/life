// Настройки Проектов — только то, что про проекты. Доступ и телефон на пульте.

/* Панели отдаются строками, а не raw(): ядро их склеивает join("") — обёртка
   доехала бы до экрана словами «[object Object]». */
import { html, raw, esc, toast } from "../../../core/dom.js";
import { settings } from "../../../core/screens/settings.js";
import * as M from "../lib/model.js";
import { queue } from "./row.js";

export default settings({
  actions: {
    addSpace(form) {
      const data = new FormData(form);
      const name = String(data.get("имя") ?? "").trim();
      if (!name) return;

      queue(M.change("пространство+", { имя: name, описание: String(data.get("описание") ?? "").trim() }));
      form.reset();
      toast(`Папка «${name}» заведётся при синке`);
    },
  },

  panes(state) {
    const age = M.snapshotAge(state);
    const cycle = M.cycleOf(state);
    const waiting = M.waiting(state).length;
    const refused = M.refused(state).length;

    return [
      html`<section class="pane">
        <div class="label">Откуда это</div>
        <p class="prose">Проекты живут заметками в <code>10 - Проекты</code> волта. Доска на компьютере читает их напрямую; сюда приезжает снимок — его собирает та же доска, пока она поднята, и кладёт в общий репозиторий.</p>
        <div class="insp-row"><span>Снимок</span><span class="tdim">${age == null ? "не приезжал" : age === 0 ? "сегодня" : `${age} ${M.plural(age, "день", "дня", "дней")} назад`}</span></div>
        <div class="insp-row"><span>Проектов</span><span class="tdim num">${M.live(state).length} + ${M.archived(state).length} в архиве</span></div>
        <div class="insp-row"><span>Дел открыто</span><span class="tdim num">${M.openDeeds(state).length}</span></div>
      </section>`,

      cycle
        ? html`<section class="pane">
            <div class="label">Цикл</div>
            <div class="insp-row"><span>Идёт</span><span class="tdim">${cycle.имя}</span></div>
            <div class="insp-row"><span>Неделя</span><span class="tdim num">${cycle.неделя} из ${cycle.всего}</span></div>
            <div class="insp-row"><span>Осталось</span><span class="tdim num">${cycle.осталось} ${M.plural(cycle.осталось, "день", "дня", "дней")}</span></div>
            <div class="insp-row"><span>Кончается</span><span class="tdim">${cycle.конец}</span></div>
          </section>`
        : null,

      html`<section class="pane">
        <div class="label">Правки</div>
        <p class="prose">Галочка отсюда не правит заметку сама: она уезжает записью, а применяет её компьютер — теми же операциями и теми же границами, что сервер доски. Белый список действий, сверка текста строки, запись только внутрь «10 - Проекты», ничего не удаляется.</p>
        <div class="insp-row"><span>Ждут волта</span><span class="tdim num">${waiting || "—"}</span></div>
        <div class="insp-row"><span>Отбито</span><span class="tdim num">${refused || "—"}</span></div>
        ${raw(refused ? `<p class="prose prose--muted">Отбитая правка — почти всегда «строка разошлась»: заметку правили руками, пока правка ехала.</p>` : "")}
      </section>`,

      spacesPane(state),
    ];
  },
});

/** Пространства — папки в волте, не режимы приложения. Заводятся здесь же. */
function spacesPane(state) {
  const spaces = M.spaceCards(state);
  if (!spaces.length) return "";

  const coming = M.waiting(state).filter((e) => e.что === "пространство+");

  return html`<section class="pane">
    <div class="label">Пространства</div>
    ${raw(spaces.map((w) => `<div class="insp-row"><span>${esc(w.имя)}</span><span class="tdim">${esc(w.описание || w.папка || "")}</span></div>`).join(""))}
    ${raw(coming.map((e) => `<div class="insp-row"><span>${esc(e.имя)}</span><span class="tdim">ждёт волта</span></div>`).join(""))}
    <p class="prose prose--muted">Пространство — папка внутри «10 - Проекты», а не режим приложения: волт заведёт её вместе с инструкцией внутри.</p>
    <form class="stack" data-act-submit="addSpace">
      <label class="fieldset">
        <span class="fieldset-label">Новое пространство</span>
        <input class="field" name="имя" placeholder="как называется папка" autocomplete="off" required>
      </label>
      <label class="fieldset">
        <span class="fieldset-label">Описание</span>
        <input class="field" name="описание" placeholder="кто в нём и чего сюда не класть" autocomplete="off">
      </label>
      <button class="btn btn--ghost btn--sm" type="submit">Завести пространство</button>
    </form>
  </section>`;
}
