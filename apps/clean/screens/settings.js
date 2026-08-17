// Настройки Уборки: только своё. Ключ и телефон — на пульте.

import { html, raw, toast } from "../../../core/dom.js";
import { commit } from "../../../core/state.js";
import { pullReferences } from "../../../core/sync.js";
import { parseTable } from "../../../core/vault.js";
import * as gh from "../../../core/github.js";
import * as log from "../../../core/log.js";
import * as M from "../lib/model.js";

let pulling = false;

const num = (v) => (v === "" || v == null ? null : Number(String(v).replace(",", ".")));

export default {
  title: () => "Настройки",

  render(state) {
    const now = M.today();
    const spots = M.alive(state);
    const due = M.dueEverywhere(state, now);
    const never = spots.filter((s) => !s.lastDone);

    return html`<main class="screen">
      <header class="head head--dark"><h1>Настройки</h1><span class="head-sub">Уборка</span></header>

      <div class="body">
        <section class="pane pane--calm">
          <div class="label">Доступ и телефон</div>
          <p class="prose">Ключ и пара с телефоном общие для всех приложений — они настраиваются один раз на пульте.</p>
          <a class="btn btn--ghost btn--sm" href="../../hub/">Открыть пульт</a>
        </section>

        <section class="pane">
          <div class="label">Как дела</div>
          <div class="insp-row"><span>Поверхностей</span><span class="tdim num">${spots.length}</span></div>
          <div class="insp-row"><span>Ждут</span><span class="tdim num">${due.length}</span></div>
          <div class="insp-row"><span>Ни разу не убирали</span><span class="tdim num">${never.length}</span></div>
          ${raw(never.length ? `<p class="prose prose--muted">Про них приложение молчит, а не ругается: неизвестно — это не то же самое, что грязно.</p>` : "")}
        </section>

        <section class="pane">
          <div class="label">Справочник комнат</div>
          <p class="prose">Планировка живёт в волте: <code>Уборка/Справочники/Комнаты.md</code>. Колонки — комната, значок, ряд, колонка, ширина. Допиши строку, и на карте появится кабинет или вторая ванная.</p>
          <button class="btn btn--ghost btn--sm" type="button" data-act="pull" ${raw(gh.isConfigured() && !pulling ? "" : "disabled")}>${pulling ? "Читаю…" : "Обновить карту из волта"}</button>
        </section>
      </div>
    </main>`;
  },

  actions: {
    async pull() {
      pulling = true;
      commit("refs.pulling", () => null, { sync: false });

      try {
        const refs = await pullReferences();

        commit("refs.pull", (s) => {
          if (refs.rooms?.status === "read") {
            const rows = parseTable(refs.rooms.text)
              .filter((r) => r["комната"])
              .map((r) => ({
                id: (r["ключ"] || r["комната"]).toLowerCase(),
                name: r["комната"].toLowerCase(),
                icon: r["значок"] || null,
                row: num(r["ряд"]),
                col: num(r["колонка"]),
                w: num(r["ширина"]) ?? 1,
              }));
            // Пустая таблица — это не «снести все комнаты», а «файл не готов».
            if (rows.length) s.rooms = rows;
          }
          return null;
        }, { sync: false });

        const ok = refs.rooms?.status === "read";
        toast(ok ? "Карта обновлена" : "Файл не нашёлся", ok ? "calm" : "alarm");
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
