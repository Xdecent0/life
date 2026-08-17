// Проекты: доска, страница проекта, дела, архив, настройки. Оснастка — общая.
//
// Это пятое приложение набора, и живёт оно по тем же правилам: та же оболочка,
// та же система, тот же круг синка, а ключ доступа и телефон настраиваются один
// раз на пульте. Своё у него только одно — оно **не источник правды**. Проекты
// живут заметками в волте, сюда приезжает снимок, а правки уезжают обратно
// очередью.

import "./manifest.js";

import { mountIcons } from "../../core/icons.js";
import { guardUnload } from "../../core/state.js";
import * as log from "../../core/log.js";
import { boot } from "../../core/shell.js";
import * as M from "./lib/model.js";

import board from "./screens/board.js";
import project from "./screens/project.js";
import deeds from "./screens/deeds.js";
import archive from "./screens/archive.js";
import settings from "./screens/settings.js";

log.captureGlobals();
guardUnload();
mountIcons();

boot({
  screens: { board, project, deeds, archive, settings },
  nav: [
    { route: "board", label: "Доска", icon: "i-list" },
    { route: "deeds", label: "Дела", icon: "i-check" },
    { route: "archive", label: "Архив", icon: "i-stock" },
  ],
  home: "board",
  /* Значок считает то, ради чего список открывают: стоящее и просроченное. */
  badge: (route, state) =>
    route === "board" ? M.stalled(state).length
      : route === "deeds" ? M.openDeeds(state).filter((d) => M.overdue(d)).length
        : 0,
});
