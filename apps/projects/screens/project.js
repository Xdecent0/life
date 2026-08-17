// Страница проекта: работа слева, карточка справа.
//
// Колонок «надо / делаю / готово» здесь нет по той же причине, что и на доске:
// такого поля в заметках не существует, и рисовать его значило бы завести
// второй источник правды.
//
// Зато всё, что заметка про себя рассказала, показано: подпроекты, вид и мера
// прогресса, владелец с участниками, гейт, шевеление по неделям. Снимок вёз это
// с самого начала — экран просто выбрасывал, и человеку приходилось открывать
// Obsidian ради строчки из шапки.

import { html, raw, icon, esc, toast, wide } from "../../../core/dom.js";
import * as M from "../lib/model.js";
import { queue } from "./row.js";

const currentPath = () => decodeURIComponent(location.hash.split("/")[1] ?? "");

let editing = false;

/* ---------- работа ---------- */

function milestonesPane(state, p) {
  const all = M.milestonesOf(p);
  const prog = M.progressOf(p);

  return html`<section class="pane">
    <div class="head-row">
      <div class="label">Вехи</div>
      ${raw(all.length ? `<span class="tdim num">${M.doneCount(p)}/${all.length}${prog.pc == null ? "" : ` · ${prog.pc}%`}</span>` : "")}
    </div>
    ${raw(all.length
      ? all.map((m) => `<label class="check ${m.закрыта ? "check--done" : ""}">
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
  </section>`;
}

function deedsPane(state, p) {
  const now = M.today();
  const deeds = M.deedsOf(state, p);

  return html`<section class="pane">
    <div class="label">Дела</div>
    ${raw(deeds.map((d) => `<label class="check ${d.сделано ? "check--done" : ""}">
      <input type="checkbox" data-act-change="deed" data-id="${esc(d.ид)}" ${d.сделано ? "checked" : ""}>
      <span class="check-text">${esc(d.текст)}</span>
      ${d.ждёт ? `<span class="chip chip--sm">ждёт волта</span>`
        : d.срок ? `<span class="tdim ${M.overdue(d, now) ? "tdim--alarm" : ""}">${esc(d.срок)}</span>` : ""}
    </label>`).join(""))}
    ${raw(deeds.length ? "" : `<p class="prose prose--muted">Дел по этому проекту нет.</p>`)}
    <form class="stack stack--tight" data-act-submit="addDeed">
      <input class="field" name="текст" placeholder="что сделать" aria-label="Новое дело" autocomplete="off" required>
      <input class="field field--date" name="срок" type="date" aria-label="Срок">
      <button class="btn btn--ghost btn--sm" type="submit">Завести дело</button>
    </form>
  </section>`;
}

/**
 * Подпроекты — то, из чего проект собран.
 *
 * Они и так перечислены в заметке, со своим состоянием у каждого; экран их не
 * показывал, и большой проект выглядел как список вех без единого признака, что
 * под ним есть ещё пять карточек.
 */
function subPane(p) {
  const subs = M.subOf(p);
  if (!subs.length) return "";

  return html`<section class="pane">
    <div class="head-row">
      <div class="label">Подпроекты</div>
      <span class="tdim num">${subs.length}</span>
    </div>
    ${raw(subs.map((s) => `<div class="subrow" data-health="${esc(M.healthOf(s))}">
      <span class="subrow-name">${esc(s.имя)}</span>
      <span class="tdim">${esc(s.что ?? "")}</span>
    </div>`).join(""))}
    <p class="prose prose--muted">Состояние подпроекта считает волт по дате правки его карточки.</p>
  </section>`;
}

/* ---------- карточка ---------- */

/* Блоки карточки одни и те же на обоих экранах, а обёртка разная: в колонке
   инспектора это его полосы, на телефоне — обычные панели. Обернуть панель в
   панель было бы вложенной карточкой, самой заметной приметой поделки. */
function progressBlock(p, cls) {
  const prog = M.progressOf(p);

  return html`<div class="${cls === "pane" ? "pane" : "insp-head"}">
    <div class="label">Ход</div>
    <p class="insp-name">${prog.pc == null ? "—" : `${prog.pc}%`}</p>
    <span class="tdim">${prog.said}</span>
    ${raw(prog.pc == null ? "" : `<span class="proj-bar proj-bar--wide" role="img" aria-label="${prog.said}">
      <span class="proj-fill" style="width: ${prog.pc}%"></span>
    </span>`)}
  </div>`;
}

function factsBlock(p, cls) {
  const rows = M.FACTS.map(([name, of]) => [name, (of(p) ?? "").toString().trim()]).filter(([, v]) => v);

  return html`<div class="${cls}">
    <div class="head-row">
      <div class="label">Карточка</div>
      <button class="linkbtn" type="button" data-act="edit">${editing ? "Свернуть" : "Править"}</button>
    </div>
    ${raw(p.цель ? `<p class="prose">${esc(p.цель)}</p>` : "")}
    ${raw(rows.map(([name, value]) => `<div class="insp-row"><span>${esc(name)}</span><span class="tdim">${esc(value)}</span></div>`).join(""))}
    ${raw(editing ? editForm(p) : "")}
  </div>`;
}

/* Правится ровно то, что правит сервер доски: поле не из его белого списка мост
   отобьёт, и рисовать для него поле ввода значило бы врать кнопкой. */
function editForm(p) {
  return html`<form class="stack" data-act-submit="save">
    ${raw(M.EDITABLE.map((f) => `<label class="fieldset">
      <span class="fieldset-label">${esc(f.label)}</span>
      ${f.long
        ? `<textarea class="field field--area" name="${esc(f.key)}" rows="2" placeholder="${esc(f.hint ?? "")}">${esc(valueOf(p, f.key))}</textarea>`
        : `<input class="field" name="${esc(f.key)}" value="${esc(valueOf(p, f.key))}" placeholder="${esc(f.hint ?? "")}" autocomplete="off">`}
    </label>`).join(""))}
    <button class="btn btn--ghost btn--sm" type="submit">Сохранить в заметку</button>
    <p class="prose prose--muted">Уедет правкой: заметку меняет компьютер, теми же границами, что доска.</p>
  </form>`;
}

const valueOf = (p, key) => (key === "область" ? (p.области ?? []).join(", ") : p[key] ?? "");

function waitBlock(p, cls) {
  const rows = p.ждёт ?? [];
  if (!rows.length) return "";

  return html`<div class="${cls}">
    <div class="label">Ждёт</div>
    <p class="prose">${esc(rows.join(" · "))}</p>
  </div>`;
}

/**
 * Шевеление по неделям — из коммитов волта, а не из ощущений.
 *
 * «Стоит 30 дней» отвечает только про последнюю правку; полоска отвечает, было
 * ли это затишьем после работы или проект не двигался с самого начала.
 */
function moveBlock(p, cls) {
  const weeks = M.activityOf(p);
  const stale = p.дней_без_движения ?? 0;
  if (!weeks.length && !stale) return "";

  const top = Math.max(1, ...weeks);

  return html`<div class="${cls}">
    <div class="label">Движение</div>
    ${raw(weeks.length ? `<span class="spark" role="img" aria-label="правки карточки по неделям за ${weeks.length} ${M.plural(weeks.length, "неделю", "недели", "недель")}">
      ${weeks.map((n) => `<i style="--v: ${(n / top).toFixed(2)}" ${n ? 'data-on="1"' : ""}></i>`).join("")}
    </span>` : "")}
    <div class="insp-row"><span>Последняя правка</span><span class="tdim num">${stale} ${M.plural(stale, "день", "дня", "дней")} назад</span></div>
    ${raw(stale >= M.STALE_DAYS
      ? `<p class="prose prose--muted">Это не упрёк — иногда проект честно ждёт своей очереди.</p>`
      : "")}
  </div>`;
}

/* ---------- экран ---------- */

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

    const group = M.groupOf(p);
    const pending = M.pendingFor(state, p);

    const head = html`<header class="head head--dark">
      <div class="head-row">
        <a class="icon-btn icon-btn--sm" href="#board" aria-label="Ко всем проектам">${raw(icon("i-back", { size: 18, stroke: "#1c3327" }))}</a>
        <span class="head-sub">${[p.пространство, p.раздел].filter(Boolean).join(" · ")}</span>
      </div>
      <h1>${p.имя}</h1>
      <div class="chips">
        ${raw([...M.GROUPS, "готово"].map((g) =>
          `<button class="chip chip--sm" type="button" data-act="status" data-group="${esc(g)}" aria-pressed="${group === g}">${esc(g)}</button>`).join(""))}
        ${raw(pending ? `<span class="chip chip--sm">ждёт волта: ${pending}</span>` : "")}
      </div>
    </header>`;

    const work = html`${raw(milestonesPane(state, p))}
      ${raw(deedsPane(state, p))}
      ${raw(subPane(p))}
      <p class="prose prose--muted plan-note">Правка отсюда не меняет заметку сама: она уезжает записью, а применяет её компьютер — теми же операциями и теми же границами, что сервер доски. Пока волт не ответил, рядом написано «ждёт волта».</p>`;

    const card = (cls) => html`${raw(progressBlock(p, cls))}
      ${raw(factsBlock(p, cls))}
      ${raw(waitBlock(p, cls))}
      ${raw(moveBlock(p, cls))}`;

    /* На телефоне это одна колонка сверху вниз: сначала чем меряется и что в
       шапке, потом работа. На компьютере карточка уходит вправо и стоит на
       месте, пока список вех скроллится — иначе половина окна пустует, а факты,
       ради которых страницу открывают, уезжают вверх. */
    if (!wide.matches) {
      return html`<main class="screen">
        ${raw(head)}
        <div class="body">
          ${raw(card("pane"))}
          ${raw(work)}
        </div>
      </main>`;
    }

    return html`<main class="screen">
      ${raw(head)}
      <div class="split">
        <div class="table workcol">${raw(work)}</div>
        <aside class="inspector" aria-label="Карточка проекта">${raw(card("insp-block"))}</aside>
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

    edit() { editing = !editing; },

    /** Одна правка на изменившееся поле: неизменившееся не трогаем вовсе. */
    save(form, state) {
      const p = M.find(state, currentPath());
      if (!p) return;

      const data = new FormData(form);
      let sent = 0;

      for (const f of M.EDITABLE) {
        const value = String(data.get(f.key) ?? "").trim();
        if (value === valueOf(p, f.key).trim()) continue;
        queue(M.change("поле", { проект: p.путь, ключ: f.key, значение: value }));
        sent += 1;
      }

      editing = false;
      toast(sent ? `${sent} ${M.plural(sent, "поле уедет", "поля уедут", "полей уедут")} в заметку` : "Ничего не изменилось");
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
