// Scanned receipts, newest first. Useful for checking what the parser actually did.

import { html, raw, esc, fmtDate, fmtMoney } from "../../../core/dom.js";
import { pageHead, headLink } from "../../../core/screens/head.js";
import { touch } from "../../../core/state.js";
import * as M from "../lib/model.js";

let open = null;

export default {
  title: () => "Чеки",

  render(state) {
    if (!state.receipts.length) {
      return html`<main class="screen">
        ${raw(pageHead({ title: "Чеки", said: "пока ни одного" }))}
        <div class="body">
          <div class="empty">
            <h2>Чеков ещё нет</h2>
            <p>QR в подвале фискального чека даёт чистые позиции — правки почти не нужны. Если QR нет, приложение распознает фото, но строки придётся поправить руками.</p>
            <a class="btn" href="#scan">Сканировать чек</a>
          </div>
        </div>
      </main>`;
    }

    const total = state.receipts.reduce((sum, r) => sum + (r.total ?? 0), 0);

    const rows = state.receipts.map((receipt) => {
      const lines = receipt.lines ?? [];
      const expanded = open === receipt.id;

      return html`<div class="receipt">
        <button class="row" type="button" data-act="toggle" data-id="${receipt.id}" aria-expanded="${expanded}">
          <span class="row-main">
            <span class="row-name">${receipt.store || "магазин не назван"}</span>
            <span class="row-why">${fmtDate(receipt.at)} · ${lines.length} ${M.plural(lines.length, "позиция", "позиции", "позиций")}</span>
          </span>
          <span class="row-qty num">${fmtMoney(receipt.total)}</span>
        </button>
        ${raw(expanded ? `<div class="receipt-lines">${lines.map((l) => `<div class="ing" data-have="1">
          <span class="ing-name">${esc(l.product)}</span>
          <span class="ing-qty num">${[l.qty, l.price ? fmtMoney(l.price) : null].filter(Boolean).map(esc).join(" · ")}</span>
        </div>`).join("")}</div>` : "")}
      </div>`;
    }).join("");

    return html`<main class="screen">
      ${raw(pageHead({
        title: "Чеки",
        said: `${state.receipts.length} ${M.plural(state.receipts.length, "чек", "чека", "чеков")} · ${fmtMoney(total)}`,
        actions: headLink("Сканировать", "#scan"),
      }))}
      <div class="workbar">
        <span class="toolbar-hint">Строка открывает чек целиком · QR даёт чистые позиции, фото — черновик</span>
      </div>

      <div class="body">${raw(rows)}</div>
      <div class="foot"><a class="btn btn--grow" href="#scan">Сканировать чек</a></div>
    </main>`;
  },

  actions: {
    toggle(el) {
      open = open === el.dataset.id ? null : el.dataset.id;
      touch();
    },
  },
};
