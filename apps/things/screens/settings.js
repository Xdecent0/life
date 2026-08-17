// Settings for Вещи. Short on purpose: the access key and the pairing live in
// the hub now, so this screen is only what belongs to this app — its two
// reference tables, and the way out to everything else.

import { html, raw, esc, toast } from "../../../core/dom.js";
import { commit, get } from "../../../core/state.js";
import { pullReferences } from "../../../core/sync.js";
import { parseZones, parseAisles } from "../../../core/vault.js";
import * as gh from "../../../core/github.js";
import * as log from "../../../core/log.js";
import * as M from "../lib/model.js";

let pulling = false;

export default {
  title: () => "Настройки",

  render(state) {
    const worth = M.worth(M.alive(state));

    return html`<main class="screen">
      <header class="head head--dark"><h1>Настройки</h1><span class="head-sub">Вещи</span></header>

      <div class="body">
        <section class="pane pane--calm">
          <div class="label">Доступ и телефон</div>
          <p class="prose">Ключ и пара с телефоном общие для всех приложений — они настраиваются один раз на пульте.</p>
          <a class="btn btn--ghost btn--sm" href="../../hub/">Открыть пульт</a>
        </section>

        <section class="pane">
          <div class="label">Справочники</div>
          <p class="prose">Места и виды — таблицы в волте: <code>Вещи/Справочники/Места.md</code> и <code>Вещи/Справочники/Виды.md</code>. Допиши строку — появится погреб, гараж или ящик с проводами.</p>
          <div class="insp-row"><span>Мест</span><span class="tdim num">${(state.places ?? []).length}</span></div>
          <div class="insp-row"><span>Видов</span><span class="tdim num">${(state.kinds ?? []).length}</span></div>
          <button class="btn btn--ghost btn--sm" type="button" data-act="pull" ${raw(gh.isConfigured() && !pulling ? "" : "disabled")}>${pulling ? "Читаю…" : "Обновить справочники из волта"}</button>
        </section>

        <section class="pane">
          <div class="label">Сколько всего</div>
          <div class="insp-row"><span>Вещей</span><span class="tdim num">${M.alive(state).length}</span></div>
          <div class="insp-row"><span>С гарантией</span><span class="tdim num">${M.alive(state).filter((t) => t.warrantyUntil).length}</span></div>
          <div class="insp-row"><span>Гарантия кончается</span><span class="tdim num">${M.alive(state).filter((t) => M.warrantyRunningOut(t)).length}</span></div>
          ${raw(worth ? `<div class="insp-row"><span>На сумму</span><span class="tdim num">${Math.round(worth).toLocaleString("ru")} ₴</span></div>` : "")}
          <p class="prose prose--muted">Сумма считается только по тем вещам, у которых записана цена — это не оценка имущества, а сложение того, что ты сам вписал.</p>
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
          // Only what was actually read is applied: a file that failed leaves the
          // table it feeds alone, so a permissions problem does not become data loss.
          if (refs.places?.status === "read") {
            const places = parseZones(refs.places.text).map((z) => ({ name: z.name, icon: z.icon }));
            if (places.length) s.places = places;
          }
          if (refs.kinds?.status === "read") {
            const kinds = parseAisles(refs.kinds.text);
            if (kinds.length) s.kinds = kinds.map((k) => ({ order: k.order, name: k.name, items: k.items }));
          }
          return null;
        }, { sync: false });

        const read = Object.values(refs).filter((r) => r.status === "read").length;
        toast(read ? `Справочники обновлены · ${read}` : "Файлы не нашлись", read ? "calm" : "alarm");
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
