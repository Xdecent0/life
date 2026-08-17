// The frame every app is drawn in: which screen is on, the nav down the side,
// the strip that says how the exchange is doing, and one delegated listener per
// kind of gesture.
//
// Screens own their markup. This owns nothing but the arrangement — so a second
// app gets the router, the keyboard, the scroll-keeping and the update notice by
// declaring its screens rather than by copying four hundred lines.

import { $, html, raw, icon, toast, wide } from "./dom.js";
import { get, subscribe } from "./state.js";
import * as log from "./log.js";
import * as gh from "./github.js";
import { app } from "./app.js";
import { sync, syncing, autoSync } from "./sync.js";

let screens = {};
let nav = [];
let badge = () => 0;
let home = "";
let afterRender = null;

let current = { name: "", arg: null };
let mounted = null;
let previous = null;
let previousArg = null;

export const route = () => current;
export const go = (to) => { location.hash = to; };

function parseHash() {
  const raw_ = location.hash.slice(1) || home;
  const [name, arg] = raw_.split("/");
  return screens[name] ? { name, arg: arg ?? null } : { name: home, arg: null };
}

function renderNav(state) {
  const host = $("[data-tabs]");
  if (!host) return;

  host.innerHTML = nav.map((entry) => {
    const n = badge(entry.route, state) || 0;
    const on = current.name === entry.route;
    const hint = n > 0 ? `${entry.label} · ${n}` : entry.label;
    return html`<a class="tab" href="#${entry.route}" data-route="${entry.route}" title="${hint}"${raw(on ? ' aria-current="page"' : "")}>
      ${raw(icon(entry.icon))}
      <span class="tab-label">${entry.label}</span>
      ${raw(n > 0 ? `<span class="tab-badge">${n}</span>` : "")}
    </a>`;
  }).join("");

  const settingsTab = $('[data-route="settings"]');
  if (settingsTab) settingsTab.toggleAttribute("aria-current", current.name === "settings");
}

export function renderSyncStatus() {
  const el = $("[data-sync-status]");
  if (!el) return;

  const pending = get().queue.length;

  // The strip is the one thing on screen that always says how the exchange is
  // doing, so it is also where the exchange is started. It used to be a label,
  // and the button for it lived two panes deep in the settings.
  if (!gh.isConfigured()) {
    el.hidden = false;
    el.dataset.tone = "idle";
    el.dataset.act = "go";
    el.dataset.to = "settings";
    el.disabled = false;
    el.textContent = "Репозиторий не подключён";
    el.title = "Открыть настройки";
    return;
  }

  el.hidden = false;
  el.dataset.act = "sync";
  delete el.dataset.to;
  el.disabled = syncing();
  el.title = syncing() ? "Идёт обмен" : "Синхронизировать сейчас";

  if (syncing()) {
    el.dataset.tone = "busy";
    el.textContent = "Синхронизация…";
  } else if (!navigator.onLine) {
    el.dataset.tone = "offline";
    el.textContent = pending ? `Офлайн · ${pending} правок ждут` : "Офлайн";
  } else if (pending) {
    el.dataset.tone = "busy";
    el.textContent = `${pending} правок не отправлено`;
  } else {
    el.dataset.tone = "idle";
    const at = get().syncedAt;
    el.textContent = at
      ? `Синхронизировано в ${new Date(at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}`
      : "Готово к синхронизации";
  }
}

export function render() {
  const state = get();
  const screen = screens[current.name];
  const stage = $("[data-stage]");
  if (!screen || !stage) return;

  // leave() tears down screen-local state, so it must fire only on a real
  // departure — calling it on every re-render resets wizards mid-flow.
  if (mounted && mounted !== current.name) screens[mounted].leave?.();
  mounted = current.name;

  // Every tap rebuilds the screen, and the scroller dies with it. Ticking five
  // items in the meat aisle meant scrolling back five times, one-handed, with a
  // trolley — so the position is carried across a re-render of the same screen.
  const sameScreen = previous === current.name && previousArg === current.arg;
  const keep = sameScreen ? [...stage.querySelectorAll(".body, .table, .feed, .inspector")].map((el) => el.scrollTop) : null;

  // Fine at fifty rows, not fine at five hundred, and the difference is invisible
  // until someone is standing in a queue — so the slow ones say so in the journal.
  const stop = log.time("отрисовка", current.name, { warnAfter: 60 });

  try {
    stage.innerHTML = screen.render(state, current.arg);
  } catch (err) {
    // A screen that throws used to leave a blank app with no way back.
    log.fail("отрисовка", `${current.name} не собрался`, err?.stack?.slice(0, 240) ?? err?.message);
    stage.innerHTML = html`<div class="pane pane--alarm">
      <h2 class="pane-title">Экран не собрался</h2>
      <p class="pane-note">${err?.message ?? "неизвестная ошибка"}</p>
      <p class="pane-note">Данные целы. Запись есть в журнале: Настройки → Журнал.</p>
      <a class="btn btn--ghost btn--sm" href="#${home}">Назад</a>
    </div>`;
    stop({ ошибка: true });
    previous = current.name;
    previousArg = current.arg;
    return;
  }

  if (keep) {
    [...stage.querySelectorAll(".body, .table, .feed, .inspector")].forEach((el, i) => {
      if (keep[i]) el.scrollTop = keep[i];
    });
  }

  try {
    screen.mount?.(stage, state, current.arg);
  } catch (err) {
    log.fail("отрисовка", `${current.name}: mount упал`, err?.message);
  }

  stop({ строк: stage.querySelectorAll(".row, .trow, .card").length });
  previous = current.name;
  previousArg = current.arg;

  renderNav(state);
  renderSyncStatus();
  afterRender?.(state, current);

  // «Вещи · Вещи» is what happens when an app has one screen named after it.
  const name = app().name;
  const heading = screen.title?.(state, current.arg);
  document.title = !heading || heading === name ? name : `${heading} · ${name}`;
}

export async function runSync() {
  if (!gh.isConfigured()) {
    toast("Сначала подключи репозиторий", "alarm");
    go("settings");
    return;
  }

  renderSyncStatus();
  try {
    const report = await sync();
    toast(report.pushed ? `Отправлено · ${report.pushed}` : "Всё уже совпадает");
  } catch (err) {
    toast(err?.message ?? "Обмен не прошёл", "alarm");
  }
  renderSyncStatus();
}

/* Sidebar width is a preference, so it outlives the session — and it is the
   person's preference, not the app's, so every app reads the same one. */
const NAV_KEY = "life.nav.mini";

function applyNavMode(mini) {
  const root = $(".app");
  if (!root) return;
  root.dataset.nav = mini ? "mini" : "full";

  const rail = $(".rail");
  if (!rail) return;
  rail.setAttribute("aria-expanded", String(!mini));
  rail.setAttribute("aria-label", mini ? "Развернуть боковую панель" : "Свернуть боковую панель");
}

const GLOBAL_ACTIONS = {
  back: () => history.back(),
  go: (el) => go(el.dataset.to),
  sync: () => runSync(),
  /* Nothing can be written locally, so the repository is the only place the
     edits can still go. Not a normal sync button: this one is the exit. */
  rescue: () => runSync(),
  rail: () => {
    const mini = localStorage.getItem(NAV_KEY) !== "1";
    localStorage.setItem(NAV_KEY, mini ? "1" : "0");
    applyNavMode(mini);
  },
};

/**
 * Start the app.
 *
 * @param {object} opts
 * @param {object} opts.screens  route name → screen module
 * @param {Array}  opts.nav      what goes in the sidebar
 * @param {string} opts.home     the route an unknown hash falls back to
 * @param {function} [opts.badge]  route, state → a number to show on the tab
 * @param {object} [opts.actions]  extra global actions
 * @param {function} [opts.afterRender]
 */
export function boot(opts) {
  screens = opts.screens;
  nav = opts.nav ?? [];
  home = opts.home ?? Object.keys(screens)[0];
  badge = opts.badge ?? (() => 0);
  afterRender = opts.afterRender ?? null;
  Object.assign(GLOBAL_ACTIONS, opts.actions ?? {});

  current = parseHash();
  applyNavMode(localStorage.getItem(NAV_KEY) === "1");

  window.addEventListener("hashchange", () => {
    current = parseHash();
    render();
  });

  subscribe(() => render());

  /* The queue has to leave on its own: the shop is the last place anyone opens
     settings, and until it does, every per-entry merge runs empty. */
  const tryAutoSync = () => {
    const started = autoSync(get());
    if (started) started.then(renderSyncStatus);
    renderSyncStatus();
  };

  window.addEventListener("online", tryAutoSync);
  window.addEventListener("offline", renderSyncStatus);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tryAutoSync();
  });

  /* Phone and desktop are different structures, not the same one restyled,
     so crossing the breakpoint has to re-render rather than reflow. */
  wide.addEventListener("change", () => render());

  document.addEventListener("keydown", (e) => {
    // Escape means "get me out of this" wherever it is pressed — including out of
    // a field being edited. Every other key belongs to whatever has focus.
    if (e.target?.closest?.("input, textarea, select") && e.key !== "Escape") return;
    screens[current.name]?.keys?.(e, get());
  });

  /* One delegated listener for every screen action. */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.matches("input[type=file]")) return;

    const handler = screens[current.name]?.actions?.[el.dataset.act] ?? GLOBAL_ACTIONS[el.dataset.act];
    if (!handler) return;

    e.preventDefault();
    handler(el, get());
  });

  /* Editing in place: a second click on something already selected opens it, the
     way a filename does. Separate from the click above so a single click keeps
     meaning "select" and nothing opens by accident. */
  document.addEventListener("dblclick", (e) => {
    const el = e.target.closest("[data-act-dbl]");
    if (!el) return;

    const handler = screens[current.name]?.actions?.[el.dataset.actDbl];
    if (!handler) return;

    e.preventDefault();
    handler(el, get());
  });

  /* Leaving a field is an answer too. Without this, clicking away from an open
     editor would throw the typing away on the next render. */
  document.addEventListener("focusout", (e) => {
    const el = e.target.closest("[data-act-blur]");
    if (!el) return;
    screens[current.name]?.actions?.[el.dataset.actBlur]?.(el, get());
  });

  document.addEventListener("change", (e) => {
    const file = e.target.closest("input[type=file][data-act]");
    if (file) {
      screens[current.name]?.actions?.[file.dataset.act]?.(file, get());
      return;
    }

    /* Pickers answer on change, not on click: a date or a dropdown has no useful
       value at the moment it is opened. */
    const el = e.target.closest("[data-act-change]");
    if (!el) return;
    screens[current.name]?.actions?.[el.dataset.actChange]?.(el, get());
  });

  document.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-act-submit]");
    if (!form) return;

    const handler = screens[current.name]?.actions?.[form.dataset.actSubmit];
    if (!handler) return;

    e.preventDefault();
    handler(form, get());
  });

  render();

  /**
   * Register the worker and say something when a new build lands. A silent update
   * that only applies on the next cold start means the person keeps using the
   * version that had the bug they just reported.
   */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const fresh = reg.installing;
          if (!fresh) return;

          fresh.addEventListener("statechange", () => {
            if (fresh.state === "installed" && navigator.serviceWorker.controller) {
              toast("Обновление готово — перезагрузи страницу");
            }
          });
        });
      })
      .catch(() => {});
  }
}
