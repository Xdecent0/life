// Строка проекта — одна на доску и на архив, чтобы они не разошлись.

import { html, raw, icon, esc } from "../../../core/dom.js";
import { commit } from "../../../core/state.js";
import * as M from "../lib/model.js";

/**
 * Одна строка: здоровье, имя, область, полоса, счётчик.
 *
 * Полоса, а не кольцо: проценты сравнивают краем глаза, строку со строкой, и
 * дорожки одинаковой длины сравниваются, а кольца — нет. У «ожидания» полосы
 * нет вовсе: показать ноль значило бы соврать, будто ничего не делается.
 */
export function row(state, p, { picked = false } = {}) {
  const pc = M.percent(p);
  const done = M.doneCount(p);
  const all = M.milestonesOf(p).length;
  const pending = M.pendingFor(state, p);

  const meta = [
    p.аппетит,
    p.цикл,
    (p.дней_без_движения ?? 0) >= M.STALE_DAYS ? `стоит ${p.дней_без_движения} дн.` : null,
  ].filter(Boolean);

  return html`<div class="row row--project ${picked ? "row--picked" : ""}" data-health="${M.healthOf(p)}">
    <button class="pickbox" type="button" data-act="pick" data-path="${esc(p.путь)}"
            aria-pressed="${picked}" aria-label="Выбрать ${esc(p.имя)}">${raw(icon("i-check", { size: 12 }))}</button>

    <a class="proj-name" href="#project/${esc(encodeURIComponent(p.путь))}">${p.имя}</a>

    <span class="proj-meta">
      ${raw((p.области ?? []).slice(0, 2).map((a) => `<span class="cat">${esc(a)}</span>`).join(""))}
      ${raw(meta.map((m) => `<span>${esc(m)}</span>`).join(" · "))}
      ${raw(pending ? `<span class="chip chip--sm">ждёт волта: ${pending}</span>` : "")}
    </span>

    <span class="proj-count">${raw(pc == null
      ? `<span class="tdim">${esc(p.ждёт?.length ? `ждёт: ${p.ждёт.join(", ")}` : "ожидание")}</span>`
      : `<span class="proj-bar" role="img" aria-label="${all ? `${done} из ${all}` : `${pc}%`}">
           <span class="proj-fill" style="width: ${pc}%"></span>
         </span>
         <span class="num">${all ? `${done}/${all}` : `${pc}%`}</span>`)}</span>
  </div>`;
}

/**
 * Поставить правку в очередь.
 *
 * Одна и та же строка, отмеченная дважды, — это одна правка, а не две: вторая
 * перетирает первую, иначе мост применит обе по очереди и вторая упрётся в
 * текст, который первая уже поменяла.
 */
export function queue(edit) {
  commit("правка", (s) => {
    const same = s.edits.find((e) =>
      e.применено === null && !e.deleted && e.что === edit.что &&
      e.проект === edit.проект && e.строка === edit.строка &&
      e.ид === edit.ид && e.ключ === edit.ключ);

    if (same) {
      Object.assign(same, edit, { id: same.id });
      return { kind: "edits", id: same.id };
    }

    s.edits.push(edit);
    return { kind: "edits", id: edit.id };
  });
}
