// Settings, once, for every app.
//
// Three apps had their own copy of this screen and two of the three panes were
// identical in all of them, word for word: the way out to the hub, and the
// button that re-reads the reference tables out of the vault. The fifth app
// would have made a fifth copy.
//
// What is genuinely per-app is the wording of the tables and the counts the
// person wants to see, so those arrive as arguments. Everything else lives here
// — including the things the small apps never got round to, like saying how
// much room the state takes and whether anything is still waiting to go out.

import { html, raw, esc, toast, fmtDate, fmtTime } from "../dom.js";
import { commit } from "../state.js";
import { size } from "../store.js";
import { pullReferences } from "../sync.js";
import { app } from "../app.js";
import * as gh from "../github.js";
import * as log from "../log.js";

let pulling = false;

/** The access key and the paired phone belong to the whole account, not to one app. */
export function hubPane() {
  return html`<section class="pane pane--calm">
    <div class="label">Доступ и телефон</div>
    <p class="prose">Ключ и пара с телефоном общие для всех приложений — они настраиваются один раз на пульте.</p>
    <a class="btn btn--ghost btn--sm" href="../../hub/">Открыть пульт</a>
  </section>`;
}

/**
 * The vault tables this app reads.
 *
 * `rows` is what the person can count on screen — how many rooms, how many
 * kinds — so an empty table is visibly empty instead of quietly doing nothing.
 */
export function referencePane({ label = "Справочники", note, button = "Обновить справочники из волта", rows = [] }) {
  return html`<section class="pane">
    <div class="label">${label}</div>
    <p class="prose">${raw(note)}</p>
    ${raw(rows.map(([name, value]) => `<div class="insp-row"><span>${esc(name)}</span><span class="tdim num">${esc(value)}</span></div>`).join(""))}
    <button class="btn btn--ghost btn--sm" type="button" data-act="pull" ${raw(gh.isConfigured() && !pulling ? "" : "disabled")}>${pulling ? "Читаю…" : button}</button>
  </section>`;
}

/**
 * What this app is holding and whether any of it is still only here.
 *
 * The kitchen has said this since the beginning; the other three said nothing,
 * so a queue that never drained was invisible until the data went missing.
 */
export function dataPane(state) {
  const kb = Math.round(size() / 1024);
  const queued = (state.queue ?? []).length;
  const synced = state.syncedAt;

  return html`<section class="pane">
    <div class="label">Данные</div>
    <div class="insp-row"><span>Занимает</span><span class="tdim num">${kb} КБ</span></div>
    <div class="insp-row"><span>Ждёт отправки</span><span class="tdim num">${queued || "—"}</span></div>
    <div class="insp-row"><span>Синк</span><span class="tdim">${synced ? `${fmtDate(synced)}, ${fmtTime(synced)}` : "ни разу"}</span></div>
    ${raw(queued && !gh.isConfigured() ? `<p class="prose prose--muted">Правки лежат на этом устройстве и никуда не уедут, пока на пульте не появится ключ доступа.</p>` : "")}
  </section>`;
}

/**
 * Build the whole screen.
 *
 * @param {object} opts
 * @param {object} [opts.refs]   the vault tables: how to describe them, how to apply them
 * @param {function} [opts.panes]  state → array of app-specific panes, placed between hub and data
 * @param {object} [opts.actions]  anything else this app's settings can do
 */
export function settings({ refs, panes = () => [], actions = {} } = {}) {
  return {
    title: () => "Настройки",

    render(state) {
      const own = panes(state).filter(Boolean);

      return html`<main class="screen">
        <header class="head head--dark"><h1>Настройки</h1><span class="head-sub">${app().name}</span></header>

        <div class="body">
          ${raw(hubPane())}
          ${raw(own.join(""))}
          ${raw(refs ? referencePane({ ...refs, rows: refs.rows?.(state) ?? [] }) : "")}
          ${raw(dataPane(state))}
        </div>
      </main>`;
    },

    actions: {
      ...actions,

      async pull() {
        if (!refs?.apply) return;
        pulling = true;
        commit("refs.pulling", () => null, { sync: false });

        try {
          const read = await pullReferences();
          let applied = 0;

          commit("refs.pull", (s) => {
            // Only what was actually read is applied, and an empty table is «файл
            // не готов», not «комнат больше нет» — a permissions problem must not
            // turn into data loss.
            applied = refs.apply(read, s) ?? 0;
            return null;
          }, { sync: false });

          toast(
            applied ? refs.done ?? "Справочники обновлены" : "Файл не нашёлся",
            applied ? "calm" : "alarm"
          );
        } catch (err) {
          log.fail("справочники", "не прочитаны", err?.message);
          toast("Не удалось прочитать справочники", "alarm");
        } finally {
          pulling = false;
          commit("refs.done", () => null, { sync: false });
        }
      },
    },
  };
}
