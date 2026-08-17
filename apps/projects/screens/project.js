// Страница проекта: вехи и дела одним списком, как на доске.
//
// Колонок «надо / делаю / готово» здесь нет по той же причине, что и там:
// такого поля в заметках не существует, и рисовать его значило бы завести
// второй источник правды.

import { html, raw, icon, esc, toast } from "../../../core/dom.js";
import * as M from "../lib/model.js";
import { queue } from "./row.js";

const currentPath = () => decodeURIComponent(location.hash.split("/")[1] ?? "");

export default {
  title: (state, id) => M.find(state, decodeURIComponent(id ?? ""))?.имя ?? "Проект",

  render(state) {
    const p = M.find(state, currentPath());

    if (!p) {
      return html`<main class="screen">
        <header class="head"><h1>Не нашлось</h1></header>
        <div class="body"><div class="empty"><h2>Такого проекта нет</h2><p>Он мог переехать или закрыться — следующий снимок покажет.</p><a class="btn" href="#board">К проектам</a></div></div>
      </main>`;
    }

    const now = M.today();
    const milestones = M.milestonesOf(p);
    const deeds = M.deedsOf(state, p);
    const pc = M.percent(p);
    const group = M.groupOf(p);

    return html`<main class="screen">
      <header class="head">
        <div class="head-row">
          <a class="icon-btn icon-btn--sm" href="#board" aria-label="Ко всем проектам">${raw(icon("i-back", { size: 18, stroke: "#1c3327" }))}</a>
          <span class="head-sub">${[p.здоровье, p.пространство].filter(Boolean).join(" · ")}</span>
        </div>
        <h1>${p.имя}</h1>
        <div class="chips">
          ${raw([...M.GROUPS, "готово"].map((g) =>
            `<button class="chip chip--sm" type="button" data-act="status" data-group="${esc(g)}" aria-pressed="${group === g}">${esc(g)}</button>`).join(""))}
          ${raw(p.ждёт ? `<span class="chip chip--sm">ждёт волта</span>` : "")}
        </div>
      </header>

      <div class="body">
        ${raw(p.цель || p.аппетит || p.цикл || p.раздел ? `<section class="pane">
          <div class="label">Про что это</div>
          ${p.цель ? `<p class="prose">${esc(p.цель)}</p>` : ""}
          ${p.аппетит ? `<div class="insp-row"><span>Аппетит</span><span class="tdim">${esc(p.аппетит)}</span></div>` : ""}
          ${p.цикл ? `<div class="insp-row"><span>Цикл</span><span class="tdim">${esc(p.цикл)}</span></div>` : ""}
          ${p.раздел ? `<div class="insp-row"><span>Раздел</span><span class="tdim">${esc(p.раздел)}</span></div>` : ""}
          ${(p.области ?? []).length ? `<div class="insp-row"><span>Область</span><span class="tdim">${esc(p.области.join(", "))}</span></div>` : ""}
          ${p.обновлено ? `<div class="insp-row"><span>Заметка правилась</span><span class="tdim">${esc(p.обновлено)}</span></div>` : ""}
          ${(p.дней_без_движения ?? 0) >= M.STALE_DAYS
            ? `<p class="prose prose--muted">${p.дней_без_движения} дней без движения. Это не упрёк — иногда проект честно ждёт своей очереди.</p>`
            : ""}
        </section>` : "")}

        ${raw((p.ждёт ?? []).length ? `<section class="pane">
          <div class="label">Ждёт</div>
          <p class="prose">${esc((p.ждёт ?? []).join(" · "))}</p>
        </section>` : "")}

        <section class="pane">
          <div class="head-row">
            <div class="label">Вехи</div>
            ${raw(milestones.length ? `<span class="tdim num">${M.doneCount(p)}/${milestones.length}${pc == null ? "" : ` · ${pc}%`}</span>` : "")}
          </div>
          ${raw(milestones.length
            ? milestones.map((m) => `<label class="check ${m.закрыта ? "check--done" : ""}">
                <input type="checkbox" data-act-change="milestone" data-line="${m.строка}"
                       data-text="${esc(m.текст)}" ${m.закрыта ? "checked" : ""}>
                <span class="check-text">${esc(m.текст)}</span>
                ${m.ждёт ? `<span class="chip chip--sm">ждёт волта</span>` : m.дата ? `<span class="tdim">${esc(m.дата)}</span>` : ""}
              </label>`).join("")
            : `<p class="prose prose--muted">Вех в заметке нет.</p>`)}
          <form class="stack stack--tight" data-act-submit="addMilestone">
            <input class="field" name="текст" placeholder="новая веха — можно вставить сразу списком" aria-label="Новая веха" autocomplete="off" required>
            <button class="btn btn--ghost btn--sm" type="submit">Добавить веху</button>
          </form>
        </section>

        ${raw(deeds.length || true ? `<section class="pane">
          <div class="label">Дела</div>
          ${deeds.map((d) => `<label class="check ${d.сделано ? "check--done" : ""}">
            <input type="checkbox" data-act-change="deed" data-id="${esc(d.ид)}" ${d.сделано ? "checked" : ""}>
            <span class="check-text">${esc(d.текст)}</span>
            ${d.ждёт ? `<span class="chip chip--sm">ждёт волта</span>`
              : d.срок ? `<span class="tdim ${M.overdue(d, now) ? "tdim--alarm" : ""}">${esc(d.срок)}</span>` : ""}
          </label>`).join("")}
          ${deeds.length ? "" : `<p class="prose prose--muted">Дел по этому проекту нет.</p>`}
          <form class="stack stack--tight" data-act-submit="addDeed">
            <input class="field" name="текст" placeholder="что сделать" aria-label="Новое дело" autocomplete="off" required>
            <input class="field field--date" name="срок" type="date" aria-label="Срок">
            <button class="btn btn--ghost btn--sm" type="submit">Завести дело</button>
          </form>
        </section>` : "")}

        <p class="prose prose--muted">Правка отсюда не меняет заметку сама: она уезжает записью, а применяет её компьютер — теми же операциями и теми же границами, что сервер доски. Пока волт не ответил, рядом написано «ждёт волта».</p>
      </div>
    </main>`;
  },

  actions: {
    status(el, state) {
      const p = M.find(state, currentPath());
      if (!p) return;
      const status = M.TO_VAULT[el.dataset.group];
      if (!status || status === p.статус) return;

      queue(M.change("поле", { проект: p.путь, ключ: "статус", значение: status }));
      toast(`${p.имя} → ${status}`);
    },

    milestone(el, state) {
      const p = M.find(state, currentPath());
      if (!p) return;
      queue(M.change("веха", {
        проект: p.путь,
        строка: Number(el.dataset.line),
        текст: el.dataset.text,
        закрыта: el.checked,
      }));
    },

    deed(el) {
      queue(M.change("дело", { ид: el.dataset.id, сделано: el.checked }));
    },

    addMilestone(form, state) {
      const p = M.find(state, currentPath());
      const text = String(new FormData(form).get("текст") ?? "").trim();
      if (!p || !text) return;

      queue(M.change("веха+", { проект: p.путь, текст: text }));
      form.reset();
      toast("Веха уедет в заметку при синке");
    },

    addDeed(form, state) {
      const p = M.find(state, currentPath());
      const data = new FormData(form);
      const text = String(data.get("текст") ?? "").trim();
      if (!p || !text) return;

      queue(M.change("дело+", { текст: text, срок: String(data.get("срок") ?? ""), проект: p.имя }));
      form.reset();
      toast("Дело уедет в «Дела» при синке");
    },
  },
};
