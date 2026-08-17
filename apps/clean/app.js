// Уборка: карта, комната, поверхность, настройки. Оснастка — общая.

import "./manifest.js";

import { mountIcons } from "../../core/icons.js";
import { guardUnload } from "../../core/state.js";
import * as log from "../../core/log.js";
import { boot } from "../../core/shell.js";
import * as M from "./lib/model.js";

import today from "./screens/today.js";
import map from "./screens/map.js";
import rooms from "./screens/rooms.js";
import spot from "./screens/spot.js";
import settings from "./screens/settings.js";

log.captureGlobals();
guardUnload();
mountIcons();

boot({
  screens: { today, map, rooms, spot, settings },
  nav: [
    { route: "today", label: "Сегодня", icon: "i-check" },
    { route: "map", label: "Карта", icon: "i-stock" },
    { route: "rooms", label: "Комнаты", icon: "i-list" },
  ],
  /* Дом открывают не «посмотреть карту», а «что сегодня»: план идёт первым, и
     значок висит на нём же. */
  home: "today",
  badge: (route, state) => (route === "today" ? M.dueEverywhere(state).length : 0),
});
