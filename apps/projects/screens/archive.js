// Архив: то, что закончилось. Та же строка, другой пул — иначе они разойдутся.

import { html, raw, esc } from "../../../core/dom.js";
import { pageHead, headBtn, headLink } from "../../../core/screens/head.js";
import * as M from "../lib/model.js";
import { row } from "./row.js";

export default {
  title: () => "Архив",

  render(state) {
    const rows = M.sortBy(M.archived(state), "имя");

    return html`<main class="screen">
      ${raw(pageHead({ title: "Архив", said: `${rows.length}` }))}

      <div class="body">
        ${raw(rows.length
          ? rows.map((p) => row(state, p)).join("")
          : `<div class="empty"><h2>Архив пуст</h2><p>Сюда попадают проекты со статусом «готово» или «закрыт». Ничего не удаляется — закрытое остаётся памятью о том, что было.</p></div>`)}
      </div>
    </main>`;
  },
};
