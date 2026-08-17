// Вещи: три экрана и ничего своего в оснастке.
//
// The whole file is a declaration — screens, nav, and one badge. Routing, the
// sidebar, the keyboard, the sync strip, the offline notice and the update
// prompt all come from core/shell.js. That is the test the core had to pass.

import "./manifest.js";

import { mountIcons } from "../../core/icons.js";
import { setCurrency } from "../../core/dom.js";
import { get, guardUnload } from "../../core/state.js";
import * as log from "../../core/log.js";
import { boot } from "../../core/shell.js";
import * as M from "./lib/model.js";

import things from "./screens/things.js";
import thing from "./screens/thing.js";
import settings from "./screens/settings.js";

log.captureGlobals();
guardUnload();

const applyCurrency = (state) =>
  setCurrency(state.currency, { rates: state.rates, show: state.showCurrencies ?? [] });

applyCurrency(get());
mountIcons();

boot({
  screens: { things, thing, settings },
  nav: [{ route: "things", label: "Вещи", icon: "i-stock" }],
  home: "things",
  badge: (route, state) => (route === "things" ? M.alive(state).filter((t) => M.warrantyRunningOut(t)).length : 0),
  afterRender: applyCurrency,
});
