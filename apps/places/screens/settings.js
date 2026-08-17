// Настройки Мест: только своё. Ключ и телефон — на пульте.

import { html, raw, esc, toast } from "../../../core/dom.js";
import { commit } from "../../../core/state.js";
import { pullReferences } from "../../../core/sync.js";
import { parseAisles } from "../../../core/vault.js";
import * as gh from "../../../core/github.js";
import * as log from "../../../core/log.js";
import * as M from "../lib/model.js";

let pulling = false;

export default {
  title: () => "Настройки",

  render(state) {
    const now = M.today();
    const all = M.alive(state);
    const best = M.best(M.visited(state), 5);

    return html`<main class="screen">
      <header class="head head--dark"><h1>Настройки</h1><span class="head-sub">Места</span></header>

      <div class="body">
        <section class="pane pane--calm">
          <div class="label">Доступ и телефон</div>
          <p class="prose">Ключ и пара с телефоном общие для всех приложений — они настраиваются один раз на пульте.</p>
          <a class="btn btn--ghost btn--sm" href="../../hub/">Открыть пульт</a>
        </section>

        <section class="pane">
          <div class="label">Как дела</div>
          <div class="insp-row"><span>Хочу сходить</span><span class="tdim num">${M.wanted(state).length}</span></div>
          <div class="insp-row"><span>Был</span><span class="tdim num">${M.visited(state).length}</span></div>
          <div class="insp-row"><span>Зовёт обратно</span><span class="tdim num">${all.filter((p) => M.callsBack(p, now)).length}</span></div>
        </section>

        ${raw(best.length ? `<section class="pane">
          <div class="label">Лучшее</div>
          ${best.map((p) => `<div class="insp-row"><a href="#place/${esc(p.id)}">${esc(p.name)}</a><span class="tdim">${"★".repeat(p.rating)}</span></div>`).join("")}
        </section>` : "")}

        <section class="pane">
          <div class="label">Справочник видов</div>
          <p class="prose">Виды мест — таблица в волте: <code>Места/Справочники/Виды.md</code>. По ней приложение угадывает вид из названия.</p>
          <button class="btn btn--ghost btn--sm" type="button" data-act="pull" ${raw(gh.isConfigured() && !pulling ? "" : "disabled")}>${pulling ? "Читаю…" : "Обновить справочник из волта"}</button>
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
          // Пустая таблица — это «файл не готов», а не «видов больше нет».
          if (refs.kinds?.status === "read") {
            const kinds = parseAisles(refs.kinds.text);
            if (kinds.length) s.kinds = kinds.map((k) => ({ order: k.order, name: k.name, items: k.items }));
          }
          return null;
        }, { sync: false });

        const ok = refs.kinds?.status === "read";
        toast(ok ? "Справочник обновлён" : "Файл не нашёлся", ok ? "calm" : "alarm");
      } catch (err) {
        log.fail("справочники", "не прочитаны", err?.message);
        toast("Не удалось прочитать справочник", "alarm");
      } finally {
        pulling = false;
        commit("refs.done", () => null, { sync: false });
      }
    },
  },
};
