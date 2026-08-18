// Карта квартиры: комнаты стоят там, где они стоят, и каждая говорит, в каком
// она состоянии.
//
// Список дел по уборке — это список, на который не смотрят. План этажа смотрят,
// потому что он совпадает с тем, как человек про свой дом думает: не «17 задач»,
// а «на кухне пол и плита, в ванной всё нормально».

import { html, raw, icon, esc, toast, wide } from "../../../core/dom.js";
import { pageHead, headBtn, headLink } from "../../../core/screens/head.js";
import { touch, commit, uid } from "../../../core/state.js";
import * as M from "../lib/model.js";
import { moveIn } from "../lib/store.js";

/** Комната, открытая на карте: её поверхности показываются прямо в плитке. */
let opened = null;

function tone(share, due) {
  if (share === null) return "unknown";
  if (due) return share < 0.5 ? "bad" : "warn";
  return "calm";
}

function roomTile(state, room, now) {
  const health = M.roomHealth(state, room.id, now);
  const isOpen = opened === room.id;
  const spots = M.sortByUrgency(M.spotsIn(state, room.id).map(M.asDue), now, (s) => s.name)
    .map((d) => M.spotsIn(state, room.id).find((s) => s.id === d.id));

  const meter = health.share === null
    ? `<span class="meter meter--room" data-tone="unknown" role="img" aria-label="ничего не отмечено"><i style="width:0"></i></span>`
    : `<span class="meter meter--room" data-tone="${tone(health.share, health.due)}" role="img"
         aria-label="${Math.round(health.share * 100)}% в порядке"><i style="width:${Math.round(health.share * 100)}%"></i></span>`;

  // «Всё в порядке» про комнату, которую ни разу не убирали, — вранье с
  // хорошим настроением. Неизвестно и чисто это разные вещи.
  const summary = health.total === 0
    ? "пусто"
    : health.due
      ? `${health.due} ${M.plural(health.due, "дело", "дела", "дел")}`
      : health.share === null
        ? "ещё не убирали"
        : health.unknown
          ? `${health.unknown} не отмечено`
          : "всё в порядке";

  return html`<div class="room" data-room="${room.id}" data-open="${isOpen ? 1 : 0}" data-due="${health.due ? 1 : 0}"
      style="grid-column: ${room.col ?? "auto"} / span ${room.w ?? 1}; grid-row: ${room.row ?? "auto"} / span ${room.h ?? 1}">
    <!-- The header is the button; the surfaces are its siblings. They contain
         their own buttons and links, and a button inside a button is silently
         gutted by the parser — the row came out as an empty div. -->
    <button class="room-open" type="button" data-act="open" data-room="${room.id}"
        aria-expanded="${isOpen}" aria-label="${room.name}: ${summary}">
      <span class="room-head">
        <span class="tile" aria-hidden="true">${raw(icon(room.icon ?? "i-shelf", { size: 18, stroke: health.due ? "#c1481f" : "#1c3327" }))}</span>
        <span class="room-name">${room.name}</span>
        <span class="room-sum ${health.due ? "tburn" : "tdim"}">${summary}</span>
      </span>
      ${raw(meter)}
    </button>

    ${raw(isOpen ? `<div class="room-spots">${spots.map((s) => spotRow(s, now)).join("")}</div>` : "")}
  </div>`;
}

function spotRow(spot, now) {
  const st = M.stateOf(spot, now);
  const due = M.isDue(spot, now);

  return html`<div class="spot" data-tone="${st.tone}">
    <button class="spot-tick" type="button" data-act="done" data-id="${spot.id}"
        aria-label="${spot.name}: убрал сейчас" title="Убрал">
      ${raw(icon("i-check", { size: 12, stroke: due ? "#f4f1e6" : "#5f7468", width: 2.6 }))}
    </button>
    <a class="spot-main" href="#spot/${spot.id}">
      <span class="spot-name">${spot.name}</span>
      <span class="spot-why">${M.lastLabel(spot, now)} · ${M.everyLabel(spot)}</span>
    </a>
    ${raw(due ? `<span class="chip chip--alarm chip--sm">${esc(st.key)}</span>` : "")}
  </div>`;
}

function emptyScreen() {
  return html`<main class="screen">
    ${raw(pageHead({ title: `Уборка`, said: `карта пустая` }))}
    <div class="body">
      <div class="empty">
        <h2>Дом ещё не описан</h2>
        <p>Уборка держится на карте: комнаты и что в каждой убирают. Заселю обычную квартиру — кухня, комната, ванная, туалет, коридор, девятнадцать поверхностей с обычными циклами. Лишнее удалишь, недостающее допишешь: это быстрее, чем вспоминать всё с нуля.</p>
        <button class="btn" type="button" data-act="moveIn">Заселить квартиру</button>
      </div>
    </div>
  </main>`;
}

export default {
  title: () => "Уборка",

  render(state) {
    if (!M.alive(state).length) return emptyScreen();

    const now = M.today();
    const rooms = M.roomsOf(state);
    const plan = M.planOf(state);
    const due = M.dueEverywhere(state, now);
    const cols = Math.max(...plan.map((r) => (r.col ?? 1) + (r.w ?? 1) - 1), 1);

    const soon = due.slice(0, wide.matches ? 6 : 3);

    return html`<main class="screen">
      ${raw(pageHead({
        title: "Уборка",
        said: due.length ? `${due.length} ${M.plural(due.length, "дело", "дела", "дел")} ждёт` : "всё в порядке",
        actions: headLink("План на вечер", "#today"),
      }))}

      <div class="workbar">
        <span class="toolbar-hint">${M.alive(state).length} ${esc(M.plural(M.alive(state).length, "поверхность", "поверхности", "поверхностей"))} в ${rooms.length} ${esc(M.plural(rooms.length, "комнате", "комнатах", "комнатах"))}</span>
        <span class="toolbar-gap"></span>
        <a class="linkbtn" href="#rooms">Комнаты целиком</a>
      </div>

      <div class="body">
        ${raw(due.length ? `<div class="aisle">Пора</div>
          <div class="duebar">${soon.map((s) => {
            const room = rooms.find((r) => r.id === s.room);
            return `<button class="chip chip--alarm" type="button" data-act="done" data-id="${esc(s.id)}"
                title="Отметить убранным">${esc(room?.name ?? "")} · ${esc(s.name)}</button>`;
          }).join("")}${due.length > soon.length ? `<span class="tdim">и ещё ${due.length - soon.length}</span>` : ""}</div>` : "")}

        <div class="aisle">Карта дома</div>
        <div class="plan" style="--plan-cols: ${cols}">
          ${raw(plan.map((room) => roomTile(state, room, now)).join(""))}
        </div>

        <p class="prose prose--muted plan-note">Нажми на комнату — раскроется, что в ней убирают. Галочка отмечает сделанное сегодня и сдвигает следующий раз.</p>
      </div>
    </main>`;
  },

  leave() {
    opened = null;
  },

  actions: {
    open(el) {
      opened = opened === el.dataset.room ? null : el.dataset.room;
      touch();
    },

    moveIn() {
      commit("clean.moveIn", (s) => {
        s.spots.push(...moveIn(uid));
        return { kind: "spots", bulk: true };
      });
      toast("Квартира заселена — правь под себя");
    },

    /**
     * Убрано сейчас.
     *
     * Одна кнопка и никакого диалога: уборку отмечают мокрыми руками, стоя, и
     * любой вопрос в этот момент означает, что не отметят вовсе. Ошибку можно
     * вернуть из тоста.
     */
    done(el, state) {
      const spot = M.alive(state).find((s) => s.id === el.dataset.id);
      if (!spot) return;
      const was = M.doneSnapshot(spot);

      commit("clean.done", (s) => {
        const target = s.spots.find((x) => x.id === spot.id);
        if (!target) return null;
        M.markDone(target);
        return { kind: "spots", id: target.id };
      });

      const next = spot.every ? `следующий раз через ${spot.every} ${M.plural(spot.every, "день", "дня", "дней")}` : "";
      toast([spot.name, next].filter(Boolean).join(" · "), "calm", {
        undo: () => commit("clean.undone", (s) => {
          const target = s.spots.find((x) => x.id === spot.id);
          if (!target) return null;
          M.restoreDone(target, was);
          return { kind: "spots", id: target.id };
        }),
      });
    },
  },
};
