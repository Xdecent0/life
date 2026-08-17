// Цикл: пройти по проектам и закрыть его решениями, а не текстом по памяти.
//
// Итог цикла записывался одним полем «что вышло» — то есть человек садился
// вспоминать двенадцать недель разом. Ритуал устроен иначе и так же, как его
// делают на бумаге: идёшь по списку, по каждому проекту говоришь одно слово, и
// текст итога собирается из сказанного сам.
//
// Решение — это две вещи сразу: строка в итоге и правка статуса в заметке.
// Поэтому «зарезать» здесь не эвфемизм: проект честно уходит в «закрыт», а не
// растворяется между циклами, будто его и не было.

import { html, raw, esc, toast } from "../../../core/dom.js";
import { touch } from "../../../core/state.js";
import * as M from "../lib/model.js";
import { queue } from "./row.js";

/* Решения живут до перезагрузки: это черновик разговора с собой, а не данные.
   Уехавший итог — уже заметка в волте, и второй копии ему не нужно. Словарь
   решений и сборка текста — в модели: их проверяют тесты, а не глаз. */
let calls = new Map();

/* ---------- экран ---------- */

function row(p) {
  const call = calls.get(p.путь);
  const prog = M.progressOf(p);

  return html`<div class="row row--call ${call ? "row--picked" : ""}" data-health="${M.healthOf(p)}">
    <a class="proj-name" href="#project/${esc(encodeURIComponent(p.путь))}">${p.имя}</a>
    <span class="proj-meta">
      ${raw([p.раздел, p.аппетит, prog.said, `${p.дней_без_движения ?? 0} дн. без движения`]
        .filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join(" · "))}
    </span>
    <span class="callbtns">
      ${raw(M.CALLS.map((c) =>
        `<button class="chip chip--sm" type="button" data-act="call" data-path="${esc(p.путь)}" data-call="${c.key}" aria-pressed="${call === c.key}">${esc(c.label)}</button>`).join(""))}
    </span>
  </div>`;
}

export default {
  title: () => "Цикл",

  render(state) {
    const c = M.cycleOf(state);
    const rows = M.live(state).filter((p) => p.цикл === c?.имя);
    const pool = rows.length ? rows : M.live(state);

    if (!c) {
      return html`<main class="screen">
        <header class="head head--dark"><h1>Цикл</h1><span class="head-sub">не идёт</span></header>
        <div class="body"><div class="empty">
          <h2>Цикла сейчас нет</h2>
          <p>Цикл заводится в волте — заметкой в «10 - Проекты/Циклы». Пока его нет, ритуал закрывать нечего.</p>
          <a class="btn" href="#board">К проектам</a>
        </div></div>
      </main>`;
    }

    const made = pool.filter((p) => calls.has(p.путь)).length;
    const text = M.cycleSummary(pool, calls);
    const sent = M.waiting(state).some((e) => e.что === "итог+" && e.цикл === c.имя);

    return html`<main class="screen">
      <header class="head head--dark">
        <div>
          <h1>Цикл ${esc(c.имя)}</h1>
          <span class="head-sub num">неделя ${c.неделя} из ${c.всего} · осталось ${c.осталось} ${M.plural(c.осталось, "день", "дня", "дней")}</span>
        </div>
      </header>

      <div class="body">
        <p class="prose plan-note">Пройди по проектам и скажи по каждому одно слово. Итог соберётся из сказанного — а решения уедут в заметки теми же правками, что и всё остальное.</p>

        <div class="aisle aisle--grp">
          <span>${rows.length ? "В цикле" : "Все активные"}</span>
          <span class="tdim num">${made} из ${pool.length}</span>
        </div>
        ${raw(pool.map(row).join(""))}

        <section class="pane">
          <div class="head-row">
            <div class="label">Итог ${esc(c.имя)}</div>
            ${raw(sent ? `<span class="chip chip--sm">ждёт волта</span>` : "")}
          </div>
          ${raw(made
            ? `<pre class="summary">${esc(text)}</pre>`
            : `<p class="prose prose--muted">Пока ни одного решения — писать нечего.</p>`)}
          <form class="stack" data-act-submit="write">
            <label class="fieldset">
              <span class="fieldset-label">Цель цикла</span>
              <input class="field" name="цель" placeholder="чего хотели" autocomplete="off">
            </label>
            <label class="fieldset">
              <span class="fieldset-label">Что добавить своими словами</span>
              <textarea class="field field--area" name="хвост" rows="3" placeholder="то, чего не видно по проектам"></textarea>
            </label>
            <div class="rowbtns">
              <button class="btn btn--ghost btn--sm" type="submit" ${raw(made ? "" : "disabled")}>Записать итог и применить решения</button>
              ${raw(made ? `<button class="btn btn--ghost btn--sm" type="button" data-act="reset">Начать заново</button>` : "")}
            </div>
          </form>
          <p class="prose prose--muted">Итог ляжет заметкой в «10 - Проекты/Циклы», статусы — в шапки карточек. «Везём дальше» статус не трогает.</p>
        </section>
      </div>
    </main>`;
  },

  actions: {
    call(el) {
      const path = el.dataset.path;
      if (calls.get(path) === el.dataset.call) calls.delete(path);
      else calls.set(path, el.dataset.call);
      touch("цикл.решение");
    },

    reset() { calls = new Map(); touch("цикл.сброс"); toast("Решения сброшены"); },

    /** Одной кнопкой: заметка итога и по правке на каждый изменённый статус. */
    write(form, state) {
      const c = M.cycleOf(state);
      if (!c) return;

      const rows = M.live(state).filter((p) => p.цикл === c.имя);
      const pool = rows.length ? rows : M.live(state);
      if (!pool.some((p) => calls.has(p.путь))) return;

      const data = new FormData(form);
      const tail = String(data.get("хвост") ?? "").trim();
      const text = [M.cycleSummary(pool, calls), tail].filter(Boolean).join("\n\n");

      queue(M.change("итог+", { цикл: c.имя, цель: String(data.get("цель") ?? "").trim(), текст: text }));

      let moved = 0;
      for (const p of pool) {
        const call = M.CALLS.find((x) => x.key === calls.get(p.путь));
        // Статусы решений — уже словарь заметки, а не имена групп доски.
        if (!call?.status || call.status === p.статус) continue;
        queue(M.change("поле", { проект: p.путь, ключ: "статус", значение: call.status }));
        moved += 1;
      }

      calls = new Map();
      touch("цикл.итог");
      toast(`Итог ${c.имя} и ${moved} ${M.plural(moved, "перенос", "переноса", "переносов")} уедут в волт`);
    },
  },
};
