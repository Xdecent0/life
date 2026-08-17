// Места: список, карточка, настройки. Оснастка — общая.

import "./manifest.js";

import { mountIcons } from "../../core/icons.js";
import { guardUnload } from "../../core/state.js";
import * as log from "../../core/log.js";
import { boot } from "../../core/shell.js";
import * as M from "./lib/model.js";

import places from "./screens/places.js";
import place from "./screens/place.js";
import togo from "./screens/togo.js";
import settings from "./screens/settings.js";

log.captureGlobals();
guardUnload();
mountIcons();

boot({
  screens: { places, place, togo, settings },
  nav: [
    { route: "places", label: "Места", icon: "i-store" },
    { route: "togo", label: "Куда сходить", icon: "i-track" },
  ],
  home: "places",
  badge: (route, state) => (route === "togo" ? M.alive(state).filter((p) => M.callsBack(p)).length : 0),
});
