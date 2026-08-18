// Обзор: сколько чего, что шевелилось и из чего это всё собрано.
//
// Доска отвечает «что делать сейчас». Этот экран отвечает на другой вопрос —
// «как оно вообще идёт», и потому здесь нет ни одной кнопки, меняющей заметку.
// Только то, что снимок уже знает: недельная активность из коммитов волта,
// раскладка по состояниям, дела по срокам и дерево «раздел → проект → подпроект».
//
// Вкладки, а не пункты меню: числа, связи внутри и связи наружу — это один
// вопрос «как оно идёт», заданный с трёх сторон, и три раздела в боковой панели
// он бы не окупил.

import { html, raw, esc } from "../../../core/dom.js";
import { pageHead, headBtn, headLink } from "../../../core/screens/head.js";
import { touch } from "../../../core/state.js";
import * as M from "../lib/model.js";

let view = "числа";

/* ---------- числа ---------- */

/**
 * Шевеление всех проектов по неделям.
 *
 * Складывать активность честно: одна неделя — это сколько карточек трогали, а
 * не сколько раз. Провал в двенадцати столбиках виден раньше, чем в любой фразе.
 */
function heat(rows) {
  const weeks = Math.max(0, ...rows.map((p) => M.activityOf(p).length));
  if (!weeks) return "";

  const sums = Array.from({ length: weeks }, (_, i) =>
    rows.reduce((n, p) => n + (M.activityOf(p)[i] ?? 0), 0));
  const top = Math.max(1, ...sums);

  return html`<section class="pane">
    <div class="head-row">
      <div class="label">Шевеление, ${weeks} ${M.plural(weeks, "неделя", "недели", "недель")}</div>
      <span class="tdim num">${sums.reduce((a, b) => a + b, 0)} правок</span>
    </div>
    <span class="spark spark--tall" role="img" aria-label="правки карточек по неделям">
      ${raw(sums.map((n) => `<i style="--v: ${(n / top).toFixed(2)}" ${n ? 'data-on="1"' : ""}></i>`).join(""))}
    </span>
    <p class="prose prose--muted">Из коммитов волта: столбик — неделя, высота — сколько карточек в ней правили. Пустой хвост слева значит, что доски тогда ещё не было.</p>
  </section>`;
}

/** Раскладка по состоянию здоровья — та же, по которой доска красит точки. */
function health(rows) {
  const names = { bad: "горит", warn: "надо посмотреть", ok: "в порядке", idle: "стоит", done: "сделано", none: "без метки" };
  const counted = new Map();
  for (const p of rows) counted.set(M.healthOf(p), (counted.get(M.healthOf(p)) ?? 0) + 1);

  const order = ["bad", "warn", "ok", "idle", "done", "none"].filter((k) => counted.get(k));
  const total = rows.length || 1;

  return html`<section class="pane">
    <div class="label">Состояние</div>
    ${raw(order.map((k) => `<div class="insp-row">
      <span class="dotline" data-health="${k}">${esc(names[k])}</span>
      <span class="tdim num">${counted.get(k)} · ${Math.round(100 * counted.get(k) / total)}%</span>
    </div>`).join(""))}
  </section>`;
}

/** Дела по срокам: просрочено, сегодня, неделя, дальше, без срока. */
function deeds(state) {
  const now = M.today();
  const open = M.openDeeds(state);
  if (!open.length) return "";

  const at = (d) => (d.срок ? Date.parse(d.срок) : null);
  const buckets = [
    ["Просрочено", open.filter((d) => at(d) != null && at(d) < now)],
    ["Сегодня", open.filter((d) => at(d) === now)],
    ["На неделе", open.filter((d) => at(d) != null && at(d) > now && at(d) <= now + 7 * M.DAY)],
    ["Дальше", open.filter((d) => at(d) != null && at(d) > now + 7 * M.DAY)],
    ["Без срока", open.filter((d) => at(d) == null)],
  ].filter(([, rows]) => rows.length);

  return html`<section class="pane">
    <div class="head-row"><div class="label">Дела</div><span class="tdim num">${open.length} открыто</span></div>
    ${raw(buckets.map(([name, rows]) => `<div class="insp-row">
      <span>${esc(name)}</span>
      <span class="tdim num ${name === "Просрочено" ? "tdim--alarm" : ""}">${rows.length}</span>
    </div>`).join(""))}
    <p class="prose prose--muted">${esc(buckets[0][0] === "Просрочено"
      ? "Просроченное дело не краснеет вечно — оно просто первое в списке «Дела»."
      : "Всё в срок.")}</p>
  </section>`;
}

/** Крупные числа: то, ради чего экран открывают первым взглядом. */
function figures(state, rows) {
  const c = M.cycleOf(state);
  const inCycle = c ? rows.filter((p) => p.цикл === c.имя).length : 0;
  const stalled = M.stalled(state).length;
  const closed = rows.reduce((n, p) => n + M.doneCount(p), 0);
  const all = rows.reduce((n, p) => n + M.milestonesOf(p).length, 0);

  const tile = (big, small) => `<div class="fig"><span class="fig-num num">${esc(String(big))}</span><span class="fig-said">${esc(small)}</span></div>`;

  return html`<div class="figs">
    ${raw(tile(rows.length, "в работе"))}
    ${raw(c ? tile(inCycle, `в цикле ${c.имя}`) : tile(M.archived(state).length, "в архиве"))}
    ${raw(tile(stalled, "стоят три недели"))}
    ${raw(tile(all ? `${Math.round(100 * closed / all)}%` : "—", "вех закрыто"))}
  </div>`;
}

/* ---------- связи ---------- */

/**
 * Дерево: раздел → проект → подпроекты.
 *
 * Единственная связь, которая в волте настоящая: раздел объявлен в шапке, а
 * подпроекты перечислены в самой карточке. Рисовать сеть по совпадению областей
 * значило бы выдумать связи, которых человек не проводил.
 */
function tree(state) {
  const rows = M.live(state);
  const blocks = M.groups(state, { cut: "раздел", rows });

  return html`${raw(blocks.map((g) => `<div class="aisle aisle--grp">
      <span>${esc(g.name)}</span><span class="tdim num">${g.items.length}</span>
    </div>
    ${g.items.map((p) => {
      const subs = M.subOf(p);
      return `<div class="row row--tree" data-health="${esc(M.healthOf(p))}">
        <a class="proj-name" href="#project/${esc(encodeURIComponent(p.путь))}">${esc(p.имя)}</a>
        <span class="proj-meta">${esc(M.progressOf(p).said)}${subs.length ? ` · ${subs.length} ${esc(M.plural(subs.length, "подпроект", "подпроекта", "подпроектов"))}` : ""}</span>
        ${subs.length ? `<div class="twig">${subs.map((s) => `<span class="twig-row" data-health="${esc(M.healthOf(s))}">${esc(s.имя)}${s.что ? ` <span class="tdim">${esc(s.что)}</span>` : ""}</span>`).join("")}</div>` : ""}
      </div>`;
    }).join("")}`).join(""))}
    <p class="prose prose--muted plan-note">Разделы объявлены в индексе папки «10 - Проекты», подпроекты — в самих карточках. Других связей доска не выдумывает.</p>`;
}

/* ---------- наружу ---------- */

/**
 * Каналы наружу: что подключено, чем меряется и живо ли.
 *
 * Реестр лежит в волте с самого начала и приезжает в снимке рядом с проектами —
 * приложение не читало из него ни строчки. Красное про каналы уже говорит пульт
 * (алерты вотчдогов), поэтому здесь не тревога, а инвентарь.
 *
 * Смысл в том, чего в алертах не будет никогда: канал без проверки не может
 * поднять руку по построению. Он выглядит одинаково и когда работает, и когда
 * умер полгода назад, — и потому стоит первым блоком, а не серым хвостом.
 */
function outward(state) {
  const rows = M.channelRows(state);

  if (!rows.length) {
    return html`<div class="empty">
      <h2>Реестр пуст</h2>
      <p>Каналы наружу описаны в заметке «🔗 Каналы наружу» — снимок доски везёт их сюда вместе с проектами.</p>
    </div>`;
  }

  const blind = rows.filter((c) => c.tone === "none");
  const watched = rows.filter((c) => c.tone !== "none");

  const line = (c) => html`<div class="finding">
    <div class="finding-head">
      <span class="dotline" data-health="${c.tone}">${c.имя}</span>
      <span class="dim">${c.направление || "—"}${raw(c.дом ? ` · ${esc(c.дом)}` : "")}</span>
    </div>
    <p class="finding-why">${c.что || "без описания"}${raw(c.tone === "ok" ? "" : ` — ${esc(c.said)}`)}${raw(
      c.подробно && c.tone !== "ok" ? `<span class="dim"> · ${esc(c.подробно)}</span>` : ""
    )}</p>
  </div>`;

  return html`${raw(blind.length ? `<section class="pane">
      <div class="head-row">
        <div class="label">Никто не проверяет</div>
        <span class="tdim num">${blind.length} из ${rows.length}</span>
      </div>
      ${blind.map(line).join("")}
      <p class="prose prose--muted">У этих каналов нет вотчдога, поэтому в алертах их не будет никогда: некому поднять руку. Сломается — узнаешь, когда придёшь за результатом.</p>
    </section>` : "")}

    ${raw(watched.length ? `<section class="pane">
      <div class="head-row">
        <div class="label">Под присмотром</div>
        <span class="tdim num">${watched.filter((c) => c.tone === "ok").length} из ${watched.length} в порядке</span>
      </div>
      ${watched.map(line).join("")}
      <p class="prose prose--muted">Состояние меряют вотчдоги на компьютере — здесь оно такое, каким было в момент сборки снимка.</p>
    </section>` : "")}`;
}

/* ---------- экран ---------- */

export default {
  title: () => "Обзор",

  render(state) {
    const rows = M.live(state);

    if (!M.projects(state).length) {
      return html`<main class="screen">
        ${raw(pageHead({ title: `Обзор`, said: `снимок не приезжал` }))}
        <div class="body"><div class="empty">
          <h2>Считать пока нечего</h2>
          <p>Обзор считает по снимку доски. Он собирается на компьютере и приезжает через общий репозиторий — ключ к нему на пульте.</p>
          <a class="btn" href="../../hub/">Открыть пульт</a>
        </div></div>
      </main>`;
    }

    const body = view === "связи"
      ? tree(state)
      : view === "наружу"
      ? outward(state)
      : html`${raw(figures(state, rows))}
        ${raw(heat(rows))}
        ${raw(health(rows))}
        ${raw(deeds(state))}`;

    return html`<main class="screen">
      ${raw(pageHead({ title: "Обзор", said: `${rows.length} в работе · ${M.archived(state).length} в архиве` }))}

      <div class="groupbar">
        <div class="seg seg--sm" role="group" aria-label="Что смотреть">
          <span class="seg-label">смотрим</span>
          ${raw(["числа", "связи", "наружу"].map((v) =>
            `<button class="seg-btn" type="button" data-act="view" data-view="${v}" aria-pressed="${view === v}">${v}</button>`).join(""))}
        </div>
      </div>

      <div class="body">${raw(body)}</div>
    </main>`;
  },

  actions: {
    view(el) { view = el.dataset.view; touch("обзор.вкладка"); },
  },
};
