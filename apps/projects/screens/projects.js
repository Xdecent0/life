// Список проектов: разрез, здоровье, что стоит и что почти готово.

import { html, raw, icon, esc, toast } from "../../../core/dom.js";
import { commit, touch } from "../../../core/state.js";
import * as gh from "../../../core/github.js";
import * as M from "../lib/model.js";

const CUTS = [
  { key: "раздел", label: "Разделы" },
  { key: "группа", label: "Состояние" },
  { key: "область", label: "Область" },
];

let cut = "раздел";

function emptyScreen(state) {
  const known = Boolean(M.boardOf(state));

  return html`<main class="screen">
    <header class="head head--dark"><h1>Проекты</h1><span class="head-sub">${known ? "пусто" : "снимок не приезжал"}</span></header>
    <div class="body">
      <div class="empty">
        <h2>${known ? "Проектов нет" : "Снимок ещё не приезжал"}</h2>
        <p>${known
          ? "Доска читает папку «10 - Проекты» волта. Заведи карточку там или на самой доске — здесь она появится следующим снимком."
          : "Это окно в доску проектов, а не вторая её копия. Снимок собирается на компьютере командой AI\\board_bridge.py sync и приезжает сюда через репозиторий данных."}</p>
        ${raw(gh.isConfigured()
          ? `<button class="btn" type="button" data-act="sync">Проверить</button>`
          : `<a class="btn" href="../../hub/">Настроить доступ</a>`)}
      </div>
    </div>
  </main>`;
}

function hintRow(state) {
  const stalled = M.stalled(state);
  const almost = M.almostDone(state);
  if (!stalled.length && !almost.length) return "";

  const chip = (p, text, tone) =>
    `<a class="chip ${tone}" href="#project/${esc(encodeURIComponent(p.ид))}">${esc(p.имя)} · ${esc(text)}</a>`;

  return html`<div class="aisle">Стоит присмотреться</div>
    <div class="hints">
      ${raw(stalled.map((p) => chip(p, `${p.дней_без_движения} дн. без движения`, "chip--alarm")).join(""))}
      ${raw(almost.map((p) => chip(p, "осталась одна веха", "")).join(""))}
    </div>`;
}

function card(state, project) {
  const milestones = M.milestonesOf(state, project);
  const done = M.progress(milestones);
  const status = M.statusOf(state, project);

  /* Идентификатор проекта — путь его заметки, а в пути есть слэши, и маршрут
     оболочки режется ровно по ним. Поэтому он едет закодированным. */
  return html`<a class="row row--project" href="#project/${esc(encodeURIComponent(project.ид))}">
    <span class="proj-health" aria-hidden="true">${project.здоровье ?? "⚪"}</span>
    <span class="proj-name">${project.имя}</span>
    <span class="proj-meta">${[
      status.value,
      project.аппетит,
      project.цикл,
    ].filter(Boolean).map(esc).join(" · ")}${raw(status.ждёт ? ' <span class="chip chip--sm">ждёт волта</span>' : "")}</span>
    ${raw(done
      ? `<span class="proj-bar" role="img" aria-label="${done.done} из ${done.total}">
           <span class="proj-fill" style="width: ${Math.round(done.share * 100)}%"></span>
         </span>
         <span class="proj-count num">${done.done}/${done.total}</span>`
      : `<span class="proj-count tdim">${esc(project.цель || "без вех")}</span>`)}
  </a>`;
}

export default {
  title: () => "Проекты",

  render(state) {
    if (!M.projects(state).length) return emptyScreen(state);

    const groups = M.groupBy(state, cut);
    const age = M.snapshotAge(state);
    const open = M.open(state).length;
    const refused = M.refused(state);

    return html`<main class="screen">
      <header class="head head--dark">
        <div>
          <h1>Проекты</h1>
          <span class="head-sub num">${M.projects(state).length} · ${open ? `${open} ${M.plural(open, "дело", "дела", "дел")}` : "дел нет"}</span>
        </div>
        <div class="seg" role="group" aria-label="Разрез">
          ${raw(CUTS.map((c) => `<button class="seg-btn" type="button" data-act="cut" data-cut="${c.key}" aria-pressed="${cut === c.key}">${c.label}</button>`).join(""))}
        </div>
      </header>

      <div class="body">
        ${raw(refused.length ? `<section class="refused">
          <div class="label">Волт не принял ${refused.length} ${M.plural(refused.length, "правку", "правки", "правок")}</div>
          ${refused.map((e) => `<p class="prose">${esc(e.ответ)}</p>`).join("")}
          <p class="prose prose--muted">Чаще всего это значит, что строку правили в заметке, пока правка ехала. Открой доску и посмотри, как там на самом деле.</p>
          <button class="btn btn--ghost btn--sm" type="button" data-act="forget">Понятно</button>
        </section>` : "")}

        ${raw(hintRow(state))}

        ${raw(groups.map((g) => `<div class="aisle">${esc(g.name)}</div>
          ${g.items.map((p) => card(state, p)).join("")}`).join(""))}

        <p class="prose prose--muted plan-note">Окно в доску, а не вторая её копия: карточки живут заметками в волте. ${raw(age == null ? "Снимок не датирован." : age === 0 ? "Снимок собран сегодня." : `Снимку ${age} ${esc(M.plural(age, "день", "дня", "дней"))}.`)}</p>
      </div>
    </main>`;
  },

  actions: {
    cut(el) {
      cut = el.dataset.cut;
      touch("проекты.разрез");
    },

    /** Отбитые правки убираются по одной кнопке: человек их прочитал. */
    forget() {
      commit("правки.забыть", (s) => {
        for (const e of s.edits) if (e.применено === false) e.deleted = true;
        return null;
      }, { sync: false });
      toast("Убрано");
    },
  },
};
