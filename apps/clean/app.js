// Уборка: карта, комната, поверхность, настройки. Оснастка — общая.

import "./manifest.js";

import { mountIcons } from "../../core/icons.js";
import { guardUnload } from "../../core/state.js";
import * as log from "../../core/log.js";
import { boot } from "../../core/shell.js";
import * as M from "./lib/model.js";

import map from "./screens/map.js";
import rooms from "./screens/rooms.js";
import spot from "./screens/spot.js";
import settings from "./screens/settings.js";

log.captureGlobals();
guardUnload();
mountIcons();

boot({
  screens: { map, rooms, spot, settings },
  nav: [
    { route: "map", label: "Карта", icon: "i-stock" },
    { route: "rooms", label: "Комнаты", icon: "i-list" },
  ],
  home: "map",
  badge: (route, state) => (route === "map" ? M.dueEverywhere(state).length : 0),
});
