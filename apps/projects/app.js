// Дверь наружу для перенесённой доски.
//
// Экран здесь не свой: `index.html` — это `AI/board/index.html` из волта,
// перенесённый файлом (tools/port_board.mjs). Доска ходит наружу через четыре
// адреса, и подменяются ровно они. На компьютере за ними сервер и волт; здесь —
// снимок в репозитории и очередь правок.
//
// Поэтому доска ничего не знает про телефон, а телефон ничего не знает про
// вёрстку доски. Правка доски доезжает сюда переносом, правка перевозки — сюда
// же, и ни одна не трогает другую.

import PROJECTS from "./manifest.js";
import { syncApp } from "../../core/sync.js";
import * as gh from "../../core/github.js";
import * as log from "../../core/log.js";
import * as M from "./lib/model.js";

const KEY = PROJECTS.storageKey;

/* ---------- состояние ---------- */

/* Читается с диска на каждый запрос, а не держится в памяти. Единственный
   писатель у этого ключа — syncApp, и он пишет из своей копии: держать рядом
   вторую значило бы гонку из-за файла, который и так лежит в одном месте. */
function read() {
  try {
    return { ...M.blank(), ...(JSON.parse(localStorage.getItem(KEY)) ?? {}) };
  } catch {
    log.fail("проекты", "сохранённое состояние не читается");
    return M.blank();
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    log.fail("проекты", "запись не прошла — место кончилось", err?.name);
    return false;
  }
}

/* ---------- дверь ---------- */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

/** Снимок, каким его увидит доска: с наложенной очередью и честной меткой связи. */
function board() {
  const state = read();
  const shown = M.withPending(state.board, M.waiting(state));
  if (!shown) return null;
  shown.волт = M.vaultLabel(state);
  return shown;
}

/**
 * Правка с телефона.
 *
 * Доска ждёт от сервера свежий снимок и перерисовывается из него — контракт
 * сохраняется: снимок возвращается, просто с правкой, наложенной поверх, а не
 * прочитанной из заметки. Слово «уедет» в ответе — единственное, чем этот ответ
 * отличается от серверного, и оно там обязано быть.
 */
function queue(req) {
  const state = read();
  const edit = M.change(req.что, rest(req));

  state.edits = [...(state.edits ?? []), edit];
  // Очередь ядра — то, по чему пульт считает «не отправлено» на плитке.
  state.queue = [...(state.queue ?? []), { kind: "edits", id: edit.id, at: edit.at }];

  if (!write(state)) return json({ ошибка: "не записалось на этом устройстве — кончилось место" }, 500);

  const shown = board();
  return json({ ок: `${WORDS[req.что] ?? "правка"} — уедет в волт при синке`, доска: shown });
}

const WORDS = {
  "веха": "веха отмечена",
  "веха+": "веха добавлена",
  "поле": "поле изменено",
  "дело": "дело обновлено",
  "дело+": "дело заведено",
  "проект+": "проект заведён",
  "из входящего": "переезд в проекты",
  "пространство+": "пространство заведено",
  "итог+": "итог записан",
  "разделы": "порядок разделов",
};

const rest = ({ что, ...fields }) => fields;

const ROUTES = {
  "/api/board": () => {
    const shown = board();
    return shown ? json(shown) : json({ ошибка: "снимок ещё не приезжал" }, 503);
  },

  "/api/rev": () => json({ отпечаток: M.fingerprint(read()) }),

  "/api/find": (url) => json({ найдено: M.findInSnapshot(read().board, url.searchParams.get("q")) }),

  /* Та же метка, что на компьютере, только за ней другое. Там она гоняет мост
     между волтом и репозиторием; здесь — круг между репозиторием и телефоном.
     Для человека это одно и то же действие: «доедь уже». */
  "/api/phone": () => json(phoneState()),
};

function phoneState() {
  const state = read();
  const bad = M.refused(state);

  return {
    когда: state.syncedAt ? state.syncedAt / 1000 : null,
    // Без ключа круг не то что не поехал — он и не может: это красная точка,
    // а не спокойная. Молчать про это хуже, чем сказать.
    ок: bad.length || !gh.isConfigured() ? false : true,
    ждут: M.waiting(state).length,
    идёт: running,
    текст: bad.length
      ? `волт не принял: ${bad[0].ответ}`
      : !gh.isConfigured()
        ? "нет ключа доступа — настрой его на пульте"
        : state.syncedAt
          ? "снимок на месте"
          : "ещё не синкалось",
  };
}

const native = window.fetch.bind(window);

window.fetch = function (input, init) {
  const url = new URL(typeof input === "string" ? input : input.url, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return native(input, init);

  if (url.pathname === "/api/do") {
    try {
      return Promise.resolve(queue(JSON.parse(init?.body ?? "{}")));
    } catch {
      return Promise.resolve(json({ ошибка: "тело запроса не разобрать" }, 400));
    }
  }

  if (url.pathname === "/api/phone" && (init?.method ?? "GET") !== "GET") {
    return sync({ force: true }).then(() => json(phoneState()));
  }

  const route = ROUTES[url.pathname];
  return Promise.resolve(route ? route(url) : json({ ошибка: "нет такого адреса" }, 404));
};

/* ---------- синк ---------- */

/* Тот же круг, что у остальных четырёх, только запускается не оболочкой: своей
   оболочки у этого приложения нет — у него доска. */
const COOLDOWN = 120000;
let last = 0;
let running = false;

async function sync({ force = false } = {}) {
  if (running || !gh.isConfigured() || !navigator.onLine) return null;
  if (!force && Date.now() - last < COOLDOWN) return null;

  running = true;
  last = Date.now();

  try {
    return await syncApp(PROJECTS);
  } catch (err) {
    log.fail("синк", "круг не прошёл", err?.message);
    return null;
  } finally {
    running = false;
  }
}

/* Доска сама спрашивает отпечаток раз в четыре секунды и перерисовывается,
   когда он изменился. Значит синк не должен ничего перерисовывать — достаточно
   сходить за свежим снимком, а показать его доска догадается сама. */
addEventListener("visibilitychange", () => {
  if (!document.hidden) sync();
});
addEventListener("online", () => sync({ force: true }));

log.captureGlobals();

sync({ force: true });
setInterval(() => sync(), COOLDOWN);

/* ---------- запуск ---------- */

/* Дверь встала — можно будить доску. Перенос отложил её запуск ровно на это. */
window.__ЗАПУСК?.();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
