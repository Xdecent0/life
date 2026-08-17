// Карточка проекта: вехи и дела одним списком, как на доске.
//
// Колонок «надо / делаю / готово» здесь нет по той же причине, что и там: такого
// поля в заметках не существует, и рисовать его значило бы завести второй
// источник правды.

import { html, raw, icon, esc, toast } from "../../../core/dom.js";
import { commit } from "../../../core/state.js";
import * as M from "../lib/model.js";

/* Путь заметки закодирован в маршруте целиком: слэши внутри него — это слэши
   пути, а не границы маршрута, и оболочка режет ровно по ним. */
const currentId = () => decodeURIComponent(location.hash.split("/")[1] ?? "");

export default {
  title: (state, id) => M.find(state, decodeURIComponent(id ?? ""))?.имя ?? "Проект",

  render(state) {
    const project = M.find(state, currentId());

    if (!project) {
      return html`<main class="screen">
        <header class="head"><h1>Не нашлось</h1></header>
        <div class="body"><div class="empty"><h2>Такого проекта нет</h2><p>Он мог переехать или закрыться — следующий снимок покажет.</p><a class="btn" href="#projects">К проектам</a></div></div>
      </main>`;
    }

    const now = M.today();
    const milestones = M.milestonesOf(state, project);
    const done = M.progress(milestones);
    const status = M.statusOf(state, project);
    const deeds = M.deeds(state).filter((d) => d.проект && project.имя.includes(d.проект.replace(/^.*\//, "")));

    return html`<main class="screen">
      <header class="head">
        <div class="head-row">
          <a class="icon-btn icon-btn--sm" href="#projects" aria-label="Ко всем проектам">${raw(icon("i-back", { size: 18, stroke: "#1c3327" }))}</a>
          <span class="head-sub">${project.здоровье ?? ""} ${esc(project.пространство ?? "")}</span>
        </div>
        <h1>${project.имя}</h1>
        <div class="chips">
          ${raw(M.STATUSES.map((s) => `<button class="chip chip--sm" type="button" data-act="status" data-status="${esc(s)}" aria-pressed="${status.value === s}">${esc(s)}</button>`).join(""))}
          ${raw(status.ждёт ? `<span class="chip chip--alarm chip--sm">ждёт волта</span>` : "")}
        </div>
      </header>

      <div class="body">
        ${raw(project.цель || project.аппетит || project.цикл ? `<section class="pane">
          <div class="label">Про что это</div>
          ${project.цель ? `<p class="prose">${esc(project.цель)}</p>` : ""}
          ${project.аппетит ? `<div class="insp-row"><span>Аппетит</span><span class="tdim">${esc(project.аппетит)}</span></div>` : ""}
          ${project.цикл ? `<div class="insp-row"><span>Цикл</span><span class="tdim">${esc(project.цикл)}</span></div>` : ""}
          ${project.обновлено ? `<div class="insp-row"><span>Заметка правилась</span><span class="tdim">${esc(project.обновлено)}</span></div>` : ""}
          ${(project.дней_без_движения ?? 0) >= M.STALE_DAYS
            ? `<p class="prose prose--muted">${project.дней_без_движения} дней без движения. Это не упрёк — иногда проект честно ждёт своей очереди.</p>`
            : ""}
        </section>` : "")}

        <section class="pane">
          <div class="head-row">
            <div class="label">Вехи</div>
            ${raw(done ? `<span class="tdim num">${done.done}/${done.total}</span>` : "")}
          </div>
          ${raw(milestones.length
            ? milestones.map((m) => `<label class="check ${m.закрыта ? "check--done" : ""}">
                <input type="checkbox" data-act-change="milestone" data-line="${m.строка}"
                       data-text="${esc(m.текст)}" ${m.закрыта ? "checked" : ""}>
                <span class="check-text">${esc(m.текст)}</span>
                ${m.ждёт ? `<span class="chip chip--sm">ждёт волта</span>` : m.дата ? `<span class="tdim">${esc(m.дата)}</span>` : ""}
              </label>`).join("")
            : `<p class="prose prose--muted">Вех в заметке нет. Их заводят на доске или прямо в заметке — здесь только галочки.</p>`)}
        </section>

        ${raw(deeds.length ? `<section class="pane">
          <div class="label">Дела</div>
          ${deeds.map((d) => `<label class="check ${d.сделано ? "check--done" : ""}">
            <input type="checkbox" data-act-change="deed" data-id="${esc(d.ид)}" ${d.сделано ? "checked" : ""}>
            <span class="check-text">${esc(d.текст)}</span>
            ${d.ждёт ? `<span class="chip chip--sm">ждёт волта</span>`
              : d.срок ? `<span class="tdim ${M.overdue(d, now) ? "tdim--alarm" : ""}">${esc(d.срок)}</span>` : ""}
          </label>`).join("")}
        </section>` : "")}

        <p class="prose prose--muted">Галочка отсюда не правит заметку сама: она уезжает правкой, мост применяет её к файлу теми же границами, что и доска. Пока этого не случилось, рядом написано «ждёт волта».</p>
      </div>
    </main>`;
  },

  actions: {
    status(el, state) {
      const project = M.find(state, currentId());
      if (!project) return;
      const value = el.dataset.status;
      if (value === M.statusOf(state, project).value) return;

      queue(M.change("поле", { проект: project.ид, ключ: "статус", значение: value }));
      toast(`Статус → ${value}`);
    },

    /* Галочки приходят сюда же: оболочка разводит click и change по одному
       набору действий, а не по двум. */
    milestone(el, state) {
      const project = M.find(state, currentId());
      if (!project) return;

      queue(M.change("веха", {
        проект: project.ид,
        строка: Number(el.dataset.line),
        текст: el.dataset.text,
        закрыта: el.checked,
      }));
    },

    deed(el) {
      queue(M.change("дело", { ид: el.dataset.id, сделано: el.checked }));
    },
  },
};

/* ---------- очередь правок ---------- */

function queue(edit) {
  commit("правка", (s) => {
    // Одна и та же строка, отмеченная дважды, — это одна правка, а не две:
    // вторая перетирает первую, иначе мост применит их обе по очереди и вторая
    // упрётся в текст, который первая уже поменяла.
    const same = s.edits.find(
      (e) => e.применено === null && !e.deleted && e.что === edit.что &&
        e.проект === edit.проект && e.строка === edit.строка && e.ид === edit.ид &&
        e.ключ === edit.ключ
    );

    if (same) {
      Object.assign(same, edit, { id: same.id });
      return { kind: "edits", id: same.id };
    }

    s.edits.push(edit);
    return { kind: "edits", id: edit.id };
  });
}
