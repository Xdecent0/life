// Входящее: заметки из «00 - Inbox», которые могут оказаться проектами.
//
// Снимок вёз этот список с самого начала, а экрана для него не было — значит,
// разобрать входящее можно было только за компьютером. Операция у сервера доски
// уже есть и делает единственно честную вещь: заметка *переезжает* в проекты со
// своим содержимым, ей дописывается шапка, копии не остаётся.

import { html, raw, esc, toast } from "../../../core/dom.js";
import * as M from "../lib/model.js";
import { queue } from "./row.js";

/** Уже поставленное в очередь: снимок ещё старый, а второй раз слать нечего. */
const queued = (state) =>
  new Set(M.waiting(state).filter((e) => e.что === "из входящего").map((e) => e.из));

export default {
  title: () => "Входящее",

  render(state) {
    const rows = M.inboxOf(state);
    const sent = queued(state);

    if (!rows.length) {
      return html`<main class="screen">
        <header class="head head--dark"><h1>Входящее</h1><span class="head-sub">пусто</span></header>
        <div class="body">
          <div class="empty">
            <h2>Входящее разобрано</h2>
            <p>Быстрые мысли ложатся заметками в «00 - Inbox» волта. Те, что дотянут до проекта, появятся здесь.</p>
            <a class="btn" href="#board">К проектам</a>
          </div>
        </div>
      </main>`;
    }

    return html`<main class="screen">
      <header class="head head--dark">
        <div>
          <h1>Входящее</h1>
          <span class="head-sub num">${rows.length} ${M.plural(rows.length, "заметка", "заметки", "заметок")}</span>
        </div>
      </header>

      <div class="body">
        ${raw(rows.map((r) => `<div class="row row--inbox">
          <span class="proj-name">${esc(r.имя)}</span>
          <span class="proj-meta">${esc(r.первая_строка || "пустая заметка")}</span>
          <span class="proj-count">
            <span class="tdim num">${r.дней} ${esc(M.plural(r.дней, "день", "дня", "дней"))}</span>
            ${sent.has(r.путь)
              ? `<span class="chip chip--sm">ждёт волта</span>`
              : `<button class="btn btn--ghost btn--sm" type="button" data-act="promote" data-path="${esc(r.путь)}" data-name="${esc(r.имя)}">В проекты</button>`}
          </span>
        </div>`).join(""))}

        <p class="prose prose--muted plan-note">Заметка переедет целиком: содержимое останется её содержимым, поменяется папка и шапка. Обратный ход — обычное перемещение файла в Obsidian.</p>
      </div>
    </main>`;
  },

  actions: {
    promote(el) {
      queue(M.change("из входящего", { из: el.dataset.path, имя: el.dataset.name }));
      toast(`«${el.dataset.name}» переедет в проекты при синке`);
    },
  },
};
