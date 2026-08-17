// Проекты: список, карточка, настройки. Оснастка — общая.

import "./manifest.js";

import { mountIcons } from "../../core/icons.js";
import { guardUnload } from "../../core/state.js";
import * as log from "../../core/log.js";
import { boot } from "../../core/shell.js";
import * as M from "./lib/model.js";

import projects from "./screens/projects.js";
import project from "./screens/project.js";
import settings from "./screens/settings.js";

log.captureGlobals();
guardUnload();
mountIcons();

boot({
  screens: { projects, project, settings },
  nav: [{ route: "projects", label: "Проекты", icon: "i-check" }],
  home: "projects",
  /* Значок считает то, ради чего список открывают: стоящее и просроченное. */
  badge: (route, state) =>
    route === "projects"
      ? M.stalled(state).length + M.open(state).filter((d) => M.overdue(d)).length
      : 0,
});
