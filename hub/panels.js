// Блоки приборной панели: разметка поверх счёта из lib/dash.js.
//
// Пульт перестал быть меню. Пять плиток отвечали на «куда пойти», а открывают
// его, чтобы узнать, что происходит и что подкрутить, — поэтому здесь время,
// пространство, шкалы, приложения и щиток, а вход в приложение стал строкой, а
// не главным героем.

import { html, raw, esc, icon } from "../core/dom.js";
import { APPS, peek } from "../core/registry.js";
import { today, plural } from "../core/time.js";
import * as D from "./lib/dash.js";

/** Состояния всех приложений разом — все блоки считают по одному и тому же снимку. */
export function states() {
  const out = {};
  for (const entry of APPS) out[entry.key] = peek(entry)?.state ?? null;
  return out;
}

/* ---------- ось дня ---------- */

export function dayPane(all, urgent, now = today()) {
  const rows = D.dayAxis(all, urgent, now);

  if (!rows.length) {
    return html`<section class="panel">
      <div class="panel-h"><span class="panel-t">Сегодня</span></div>
      <p class="prose prose--muted">Ничего не записано и ничего не просрочено. День чистый.</p>
    </section>`;
  }

  return html`<section class="panel panel--day">
    <div class="panel-h">
      <span class="panel-t">Сегодня</span>
      <span class="dim num">${rows.length} ${plural(rows.length, "строка", "строки", "строк")}</span>
    </div>
    <div class="hours">
      ${raw(rows.map((r) => `<div class="hour" data-tone="${esc(r.tone ?? "calm")}" data-past="${r.past ? 1 : 0}">
        <span class="hour-at num">${r.at != null ? `${String(r.at).padStart(2, "0")}:00` : esc(r.when)}</span>
        <span class="hour-dot" aria-hidden="true"></span>
        ${r.href
          ? `<a class="hour-main" href="${esc(r.href)}"><span class="hour-said">${esc(r.said)}</span><span class="hour-note">${esc(r.note ?? "")} · ${esc(r.app)}</span></a>`
          : `<span class="hour-main"><span class="hour-said">${esc(r.said)}</span><span class="hour-note">${esc(r.note ?? "")} · ${esc(r.app)}</span></span>`}
        ${r.act ? `<button class="btn btn--ghost btn--sm" type="button" data-act="mark" data-row="${r.index}"
            aria-label="${esc(r.act.label)}: ${esc(r.said)}">${esc(r.act.label)}</button>` : ""}
      </div>`).join(""))}
    </div>
  </section>`;
}

/* ---------- план дома ---------- */

/**
 * План квартиры из настоящего справочника комнат.
 *
 * Комнаты, их ряд, колонка и ширина уже лежат в общем справочнике «Дом/Комнаты»
 * — том же, по которому Уборка рисует карту, а Вещи раскладывают места. Здесь
 * они собираются в одну сетку и красятся состоянием обеих половин сразу.
 */
export function planPane(all, now = today()) {
  const rooms = (all.clean?.rooms ?? []).filter((r) => r.row && r.col);
  /* Панель, которой нечего показать, — не «пустое состояние», а дыра: экран из
     таких выглядит сломанным, даже когда всё цело. Приглашение открыть Уборку
     уезжает одной строкой в конец пульта, где собраны все неоткрытые. */
  if (!rooms.length) return "";

  const cells = rooms.map((room) => D.roomState(room, all, now));
  const cols = Math.max(...cells.map((c) => c.col + c.w - 1));
  const rowsN = Math.max(...cells.map((c) => c.row));

  return html`<section class="panel">
    <div class="panel-h">
      <span class="panel-t">Дом сейчас</span>
      <span class="dim num">${cells.filter((c) => c.tone === "hot" || c.tone === "warm").length} из ${cells.length} просят внимания</span>
    </div>

    <div class="plan" style="--cols:${cols};--rows:${rowsN}">
      ${raw(cells.map((c) => `<a class="plan-room" data-tone="${esc(c.tone)}"
          style="grid-column:${c.col} / span ${c.w};grid-row:${c.row}"
          href="../apps/clean/#map">
        <span class="plan-name">${esc(c.name)}</span>
        <span class="plan-said">${esc(c.said)}</span>
      </a>`).join(""))}
    </div>

    <div class="plan-legend">
      <span data-tone="hot">просит внимания</span>
      <span data-tone="warm">скоро</span>
      <span data-tone="ok">в порядке</span>
    </div>
  </section>`;
}

/* ---------- шкалы ---------- */

export function gaugePane(all, now = today()) {
  const rows = D.gauges(all, now).filter((g) => g.value != null);
  if (!rows.length) return "";

  return html`<section class="panel">
    <div class="panel-h"><span class="panel-t">Шкалы</span></div>
    <div class="gauges">
      ${raw(rows.map((g) => {
        const v = g.value;
        // Дуга в 180°: длина 100 условных единиц, отсюда и доля.
        const len = v == null ? 0 : Math.max(2, v);
        return `<div class="gauge" data-tone="${esc(g.tone)}">
          <svg viewBox="0 0 100 58" role="img" aria-label="${esc(g.key)}: ${v == null ? "нет данных" : v + "%"}">
            <path class="gauge-bed" d="M10 52 a40 40 0 0 1 80 0" fill="none" stroke-width="7" stroke-linecap="round"/>
            <path class="gauge-arc" d="M10 52 a40 40 0 0 1 80 0" fill="none" stroke-width="7" stroke-linecap="round"
              pathLength="100" stroke-dasharray="${len} 100"/>
          </svg>
          <span class="gauge-v num">${v == null ? "—" : `${v}%`}</span>
          <span class="gauge-k">${esc(g.key)}</span>
          <span class="gauge-said">${esc(g.said)}</span>
        </div>`;
      }).join(""))}
    </div>
  </section>`;
}

/* ---------- приложения ---------- */

export function appsPane(now = today()) {
  const rows = APPS.map((entry) => ({ entry, row: D.appRow(entry, peek(entry), now) }));
  const top = Math.max(1, ...rows.flatMap((r) => r.row.spark));

  return html`<section class="panel">
    <div class="panel-h"><span class="panel-t">Приложения</span></div>
    <div class="applist">
      ${raw(rows.map(({ entry, row }) => `<a class="approw" href="${esc(entry.href)}" data-tone="${esc(row.tone)}">
        <span class="approw-dot" aria-hidden="true"></span>
        <span class="approw-main">
          <span class="approw-nm">${esc(entry.name)}</span>
          <span class="approw-said">${esc(row.said)}${row.pending ? ` · ${row.pending} не отправлено` : ""}</span>
        </span>
        ${row.spark.filter((n) => n > 0).length > 1
          ? `<span class="spark" aria-hidden="true">${row.spark.map((n) => `<i style="height:${Math.max(2, Math.round(18 * n / top))}px" ${n ? 'data-on="1"' : ""}></i>`).join("")}</span>`
          : `<span class="spark spark--none" aria-hidden="true"></span>`}
        <span class="approw-v num">${row.value == null ? "—" : row.value}</span>
      </a>`).join(""))}
    </div>
  </section>`;
}

/* ---------- полгода ---------- */

/**
 * Двадцать шесть недель по четырём приложениям.
 *
 * Считается по меткам времени самих записей — отдельного журнала ни у кого нет,
 * и заводить его ради картинки не нужно. Пустая неделя честно пустая: это и
 * есть провал, ради которого на такую карту смотрят.
 */
export function heatPane(all, now = Date.now()) {
  const lines = [
    { name: "кухня", items: all.kitchen?.stock ?? [] },
    { name: "уборка", items: all.clean?.spots ?? [] },
    { name: "вещи", items: all.things?.things ?? [] },
    { name: "места", items: all.places?.places ?? [] },
  ].map((l) => ({ ...l, weeks: D.activityWeeks(l.items, { weeks: 26, now }) }));

  const top = Math.max(1, ...lines.flatMap((l) => l.weeks));
  /* Сетка, где закрашены две клетки из ста четырёх, читается как сломанная, а
     не как «мало данных». Полгода показываются, когда есть что показывать:
     хотя бы четыре живые недели. */
  const alive = lines.flatMap((l) => l.weeks).filter((n) => n > 0).length;
  if (alive < 4) return "";

  return html`<section class="panel">
    <div class="panel-h">
      <span class="panel-t">Полгода</span>
      <span class="dim">чем плотнее, тем больше происходило</span>
    </div>
    <div class="heat">
      ${raw(lines.map((l) => `<div class="heat-row">
        <span class="heat-nm">${esc(l.name)}</span>
        <span class="heat-cells">${l.weeks.map((n) => `<i style="opacity:${n ? (0.18 + 0.8 * n / top).toFixed(2) : 0.06}"></i>`).join("")}</span>
      </div>`).join(""))}
    </div>
  </section>`;
}

/* ---------- неделя ---------- */

export function weekPane(all, now = today()) {
  const days = D.weekAhead(all, now);
  const names = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
  if (days.every((d) => !d.count)) return "";

  return html`<section class="panel">
    <div class="panel-h"><span class="panel-t">Неделя</span></div>
    <div class="week">
      ${raw(days.map((d, i) => `<div class="week-day" data-now="${d.today ? 1 : 0}" data-busy="${d.count ? 1 : 0}">
        <span class="week-d">${names[i]}</span>
        <span class="week-c num">${d.count || "·"}</span>
      </div>`).join(""))}
    </div>
  </section>`;
}

/* ---------- то, чего здесь нет ---------- */

/**
 * Одна строка вместо трёх пустых панелей.
 *
 * На новом устройстве открыты не все приложения, и раньше каждое неоткрытое
 * оставляло на пульте свою дыру: «плана нет», «ни одной отметки», пустая
 * полоска в полугодии. Три дыры подряд читаются как поломка, хотя всё цело —
 * просто здесь ещё не были.
 */
export function missingPane() {
  const cold = APPS.filter((entry) => entry.ready && !peek(entry));
  if (!cold.length) return "";

  const names = cold.map((e) => e.name).join(", ");
  return html`<section class="panel panel--quiet">
    <div class="panel-h"><span class="panel-t">Пока не открывалось здесь</span></div>
    <p class="prose prose--muted">${names} на этом устройстве ещё не открывали, поэтому дом, шкала чистоты и часть полугодия пустые. Открой — и они появятся сами.</p>
    <div class="rowbtns">
      ${raw(cold.map((e) => `<a class="btn btn--ghost btn--sm" href="${esc(e.href)}">${esc(e.name)}</a>`).join(""))}
    </div>
  </section>`;
}
