// Одна поверхность: как часто, когда убирали, в какой комнате. Здесь же цикл
// правится — по нему считается всё остальное.

import { html, raw, icon, esc, cap, toast } from "../../../core/dom.js";
import { commit } from "../../../core/state.js";
import { mark } from "../../../core/sync.js";
import * as M from "../lib/model.js";

const find = (state, id) => M.alive(state).find((s) => s.id === id);
const currentId = () => location.hash.split("/")[1] ?? null;

/** Обычные циклы. Числом можно любой, но эти покрывают почти всё. */
const CYCLES = [1, 2, 3, 5, 7, 14, 30, 60, 90];

export default {
  title: (state, id) => find(state, id)?.name ?? "Поверхность",

  render(state, id) {
    const spot = find(state, id);
    if (!spot) {
      return html`<main class="screen">
        <header class="head"><h1>Не нашлось</h1></header>
        <div class="body"><div class="empty"><h2>Такой поверхности нет</h2><p>Её удалили, или ссылка старая.</p><a class="btn" href="#map">К карте</a></div></div>
      </main>`;
    }

    const now = M.today();
    const st = M.stateOf(spot, now);
    const room = M.roomsOf(state).find((r) => r.id === spot.room);

    return html`<main class="screen">
      <header class="head">
        <div class="head-row">
          <a class="icon-btn icon-btn--sm" href="#map" aria-label="Назад к карте">${raw(icon("i-back", { size: 18, stroke: "#1c3327" }))}</a>
          <span class="head-sub">${room ? cap(room.name) : "без комнаты"}</span>
        </div>
        <h1>${spot.name}</h1>
        <div class="chips">
          <span class="chip ${st.tone === "calm" ? "" : "chip--alarm"}">${esc(st.key)}</span>
          <span class="chip">${esc(M.everyLabel(spot))}</span>
        </div>
      </header>

      <div class="body">
        <section class="pane">
          <div class="label">Когда убирали</div>
          <p class="prose">${M.lastLabel(spot, now)}${spot.lastDone && spot.every ? ` · следующий раз ${st.left >= 0 ? `через ${st.left} ${M.plural(st.left, "день", "дня", "дней")}` : `был ${Math.abs(st.left)} ${M.plural(Math.abs(st.left), "день", "дня", "дней")} назад`}` : ""}</p>
          <div class="rowbtns">
            <button class="btn btn--grow" type="button" data-act="done">Убрал сейчас</button>
            <button class="btn btn--ghost" type="button" data-act="forget">Не убирал</button>
          </div>
        </section>

        <section class="pane">
          <div class="label">Как часто</div>
          <div class="chips">
            ${raw(CYCLES.map((n) => `<button class="chip chip--sm" type="button" data-act="every" data-every="${n}" aria-pressed="${spot.every === n}">${esc(M.everyLabel({ every: n }))}</button>`).join(""))}
          </div>
          <p class="prose prose--muted">Цикл — это когда напомнить, а не закон. Пол на кухне пачкается быстрее, чем в комнате, и приложение не спорит с тем, как у тебя.</p>
        </section>

        <section class="pane">
          <div class="label">Где и что</div>
          <form class="stack stack--tight" data-act-submit="save">
            <input class="field" name="name" value="${spot.name}" aria-label="Название" autocomplete="off" required>
            <input class="field" name="note" value="${spot.note ?? ""}" placeholder="чем мыть, что не забыть" aria-label="Заметка" autocomplete="off">
            <button class="btn btn--ghost btn--sm" type="submit">Сохранить</button>
          </form>
          <div class="chips">
            ${raw(M.roomsOf(state).map((r) => `<button class="chip chip--sm" type="button" data-act="room" data-room="${esc(r.id)}" aria-pressed="${spot.room === r.id}">${esc(r.name)}</button>`).join(""))}
          </div>
        </section>
      </div>

      <div class="foot">
        <button class="btn btn--ghost btn--danger btn--wide" type="button" data-act="remove">Удалить поверхность</button>
      </div>
    </main>`;
  },

  actions: {
    done(_el, state) {
      const spot = find(state, currentId());
      if (!spot) return;
      const was = spot.lastDone;
      patch((s) => { s.lastDone = M.today(); });
      toast(`${spot.name} — убрано`, "calm", {
        undo: () => patch((s) => { s.lastDone = was; }),
      });
    },

    /* Отмечено по ошибке. Не «удалить», а «этого не было» — запись остаётся. */
    forget() {
      patch((s) => { s.lastDone = null; });
      toast("Отметка снята");
    },

    every(el) {
      patch((s) => { s.every = Number(el.dataset.every); });
    },

    room(el) {
      patch((s) => { s.room = el.dataset.room; });
    },

    save(form) {
      const data = new FormData(form);
      const name = String(data.get("name") ?? "").trim();
      if (!name) return;
      patch((s) => {
        s.name = name;
        s.note = String(data.get("note") ?? "").trim();
      });
      toast("Сохранено");
    },

    remove(_el, state) {
      const spot = find(state, currentId());
      if (!spot) return;

      commit("clean.remove", (s) => {
        const target = s.spots.find((x) => x.id === spot.id);
        if (!target) return null;
        mark(target, "deleted", true);
        return { kind: "spots", id: target.id };
      });

      location.hash = "map";
      toast(`${spot.name} удалена`, "calm", {
        undo: () => commit("clean.undelete", (s) => {
          const target = s.spots.find((x) => x.id === spot.id);
          if (!target) return null;
          mark(target, "deleted", false);
          return { kind: "spots", id: target.id };
        }),
      });
    },
  },
};

function patch(change) {
  commit("clean.edit", (s) => {
    const spot = s.spots.find((x) => x.id === currentId());
    if (!spot) return null;
    change(spot);
    spot.at = Date.now();
    return { kind: "spots", id: spot.id };
  });
}
