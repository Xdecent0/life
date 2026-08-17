// The kitchen: which screens it has, what goes on their badges, and the three
// things that are true of this app and no other — the demo seed, the currencies
// shown beside the hryvnia, and the banner for when the browser stops saving.
//
// Everything else — routing, the sidebar, the keyboard, the sync strip, the
// update notice — is core/shell.js and identical in every app.

/* First, and deliberately: declaring the app is what lets every core module
   below know whose state, whose paths and whose reference tables it is holding. */
import "./manifest.js";

import { $, html, raw, toast, setCurrency } from "../../core/dom.js";
import { mountIcons } from "../../core/icons.js";
import { get, replace, guardUnload, whenSaveFails } from "../../core/state.js";
import * as log from "../../core/log.js";
import * as install from "../../core/install.js";
import * as gh from "../../core/github.js";
import { boot, render } from "../../core/shell.js";
import { demoState, isFresh, stripDemo } from "./lib/store.js";
import * as M from "./lib/model.js";

import list from "./screens/list.js";
import stock from "./screens/stock.js";
import item from "./screens/item.js";
import scan from "./screens/scan.js";
import audit from "./screens/audit.js";
import recipes from "./screens/recipes.js";
import recipe from "./screens/recipe.js";
import cook from "./screens/cook.js";
import menu from "./screens/menu.js";
import stores from "./screens/stores.js";
import tracking from "./screens/tracking.js";
import receiptsScreen from "./screens/receipts.js";
import settings from "./screens/settings.js";
import pair from "./screens/pair.js";

const SCREENS = {
  list, stock, item, scan, audit, recipes, recipe, cook,
  menu, stores, tracking, receipts: receiptsScreen, settings, pair,
};

const NAV = [
  { route: "list", label: "Список", icon: "i-list" },
  { route: "stock", label: "Склад", icon: "i-stock" },
  { route: "recipes", label: "Рецепты", icon: "i-recipes" },
  { route: "menu", label: "Меню", icon: "i-menu" },
  { route: "stores", label: "Магазины", icon: "i-store" },
  { route: "tracking", label: "Трекинг", icon: "i-track" },
  { route: "receipts", label: "Чеки", icon: "i-receipts" },
];

function badgeFor(route, state) {
  const now = M.today();
  if (route === "list") return state.list.filter((e) => !e.done && !e.deleted).length;
  if (route === "stock") return state.stock.filter((i) => !i.deleted && M.isBurning(i, now)).length;
  return 0;
}

/* Nothing catches what happens before this line, so it runs before anything else
   that can throw — including the demo seed below. */
log.captureGlobals();
guardUnload();
/* The browser fires this once, early, and only sometimes — so it is caught
   before anything else and the offer waits for the screen that explains it. */
install.watch();
install.whenChanged(() => render());

/**
 * Persistence stopped working. Until now this was reported to nobody: the hook
 * existed and nothing was hung on it, so the app kept accepting edits it could
 * no longer keep, while the status line cheerfully counted a queue that would
 * not survive the tab. The one thing that can still save the data is a sync, so
 * the banner offers exactly that.
 */
whenSaveFails((ok, state) => {
  const el = $("[data-alert]");
  if (!el) return;

  if (ok) {
    el.hidden = true;
    el.innerHTML = "";
    log.info("хранилище", "запись снова работает");
    return;
  }

  const configured = gh.isConfigured();
  el.hidden = false;
  el.innerHTML = html`<span class="alert-text">Не удаётся сохранить: место в браузере кончилось. Всё, что ты меняешь сейчас, живёт только до закрытия вкладки.</span>
    ${raw(configured
      ? `<button class="btn btn--sm" type="button" data-act="rescue">Отправить в репозиторий</button>`
      : `<a class="btn btn--sm" href="#settings">Подключить репозиторий</a>`)}`;

  log.fail("хранилище", "данные только в памяти", { очередь: state.queue.length, подключено: configured });
});

log.info("приложение", "запуск", { экран: location.hash || "#list", офлайн: !navigator.onLine });

/* First run has nothing to judge the interface by, so seed the demo once —
   keyed on "nothing was ever saved", not on "the arrays are empty". Keyed on
   emptiness, a deliberate "start clean" was undone by the next reload. */
{
  const s = get();
  if (isFresh() && !s.stock.length && !s.list.length && !s.receipts.length) {
    replace({ ...demoState(M.today()), recipes: s.recipes, stores: s.stores }, "seed");
  } else if (s.demo && s.receipts.some((r) => !String(r.id).startsWith("rc_"))) {
    // A real receipt landed on top of the demo: drop the invented rows rather
    // than making the person choose between their data and a working sync.
    replace(stripDemo(s), "demo.strip");
  }
}

const applyCurrency = (state) =>
  setCurrency(state.currency, { rates: state.rates, show: state.showCurrencies ?? [] });

applyCurrency(get());
$(".app").dataset.feed = localStorage.getItem("kitchen.feed.off") === "1" ? "off" : "on";

mountIcons();
boot({
  screens: SCREENS,
  nav: NAV,
  home: "list",
  badge: badgeFor,
  afterRender: applyCurrency,
});

if (!navigator.onLine) toast("Офлайн — правки подождут", "offline");
