// The hub: one place where the whole set is looked at and set up.
//
// It owns nothing. Every app keeps its own state and works with the hub closed —
// that is the point of the arrangement, and the reason the kitchen still opens
// in a shop with nothing else running. What the hub owns is the *edges*: the one
// access key, the pairing, one honest answer to "what needs doing today", one
// search across all four, and the round trip that used to be four round trips.

import { declare } from "../core/app.js";

/* Runs after the imports below, which is what matters: the app manifests those
   pull in each declare themselves, and the hub has to be the last word. */
declare({
  key: "hub",
  name: "Жизнь",
  empty: { queue: [] },
  paths: {},
  collections: [],
});

import { html, raw, icon, esc, toast, fmtDate, fmtTime } from "../core/dom.js";
import { mountIcons } from "../core/icons.js";
import { APPS, peek, urgentEverywhere, searchEverywhere, actOn } from "../core/registry.js";
import { quiet } from "../core/health.js";
import { syncApp } from "../core/sync.js";
import { today, plural } from "../core/time.js";
import * as gh from "../core/github.js";
import * as QR from "../core/qr.js";
import * as log from "../core/log.js";
import { encodePairing } from "../core/pair.js";
import * as INSTALL from "../core/install.js";
import { states, dayPane, planPane, gaugePane, appsPane, heatPane, weekPane, missingPane } from "./panels.js";
import * as KEYS from "./keys.js";

import KITCHEN from "../apps/kitchen/manifest.js";
import THINGS from "../apps/things/manifest.js";
import CLEAN from "../apps/clean/manifest.js";
import PLACES from "../apps/places/manifest.js";
import PROJECTS from "../apps/projects/manifest.js";

const MANIFESTS = { kitchen: KITCHEN, things: THINGS, clean: CLEAN, places: PLACES, projects: PROJECTS };

/** The pairing code holds a live key, so it is never on screen unless asked for. */
let pairing = false;
let checking = false;
let checked = null;
let syncing = null;
let query = "";
let showLog = false;

const root = document.getElementById("root");

/* ---------- приложения ---------- */

function tile(entry) {
  const seen = peek(entry);

  /* Three different silences, and they are not the same thing: not built yet,
     built but never opened here, and open with nothing in it. */
  const state = !entry.ready
    ? "ещё не построено"
    : !seen
      ? "на этом устройстве не открывалось"
      : seen.summary || "пусто";

  const inner = html`<span class="tile" aria-hidden="true">${raw(icon(entry.icon, { size: 19, stroke: "#1c3327" }))}</span>
    <span class="hub-app-name">${entry.name}</span>
    <span class="hub-app-what">${entry.what}</span>
    <span class="hub-app-state">${state}${raw(seen?.pending ? ` <span class="chip chip--alarm chip--sm">${seen.pending} не отправлено</span>` : "")}</span>`;

  return entry.href
    ? `<a class="hub-app" href="${esc(entry.href)}">${inner}</a>`
    : `<div class="hub-app" data-soon="1">${inner}</div>`;
}

/* ---------- тишина ---------- */

/**
 * Что молчит дольше положенного.
 *
 * Все поломки набора выглядят одинаково: экран показывает вчерашнее и молчит.
 * Сервер доски не поднялся, ключ протух, мост не применил правку — ничего не
 * падает, просто перестаёт происходить. Единственное место, где это видно
 * разом по всем приложениям, — здесь.
 */
function quietPane() {
  const keyed = gh.isConfigured();
  const rows = [];

  for (const entry of APPS) {
    const seen = peek(entry);
    if (!seen || seen.demo) continue;

    const snapshotAt = Date.parse(seen.state?.board?.собрано ?? "");
    rows.push(...quiet(seen.state, {
      name: entry.name,
      keyed,
      snapshotAt: Number.isFinite(snapshotAt) ? snapshotAt : null,
    }));
  }

  if (!rows.length) return "";

  return html`<section class="hub-section">
    <span class="hub-label">Тишина · ${rows.length}</span>
    <div class="pane pane--alarm">
      <div class="label">Перестало происходить</div>
      ${raw(rows.map((r) => `<p class="prose">${esc(r.said)}<span class="dim"> · ${esc(r.fix)}</span></p>`).join(""))}
      <p class="prose prose--muted">Это не ошибки — это то, чего не случилось. Такое видно только по возрасту: сколько дней назад оно в последний раз доезжало.</p>
    </div>
  </section>`;
}

/* ---------- красное ---------- */

/**
 * Алерты вотчдогов волта — на первом экране, а не в логах на компьютере.
 *
 * Снимок доски везёт их с самого начала: бэкап не прошёл, синк с Notion упал,
 * место кончается. Пульт — единственное место, где такое видно с телефона, и
 * прятать это ниже плиток значило бы узнавать о сломанном бэкапе через неделю.
 */
function alertPane() {
  const seen = peek(APPS.find((a) => a.key === "projects"));
  const rows = seen?.state?.board?.алерты ?? [];
  if (!rows.length) return "";

  const bad = rows.filter((a) => a.уровень !== "warn").length;

  return html`<section class="hub-section">
    <span class="hub-label">Волт · ${rows.length}</span>
    <div class="pane ${bad ? "pane--alarm" : "pane--calm"}">
      <div class="label">${bad ? "Не в порядке" : "Просит внимания"}</div>
      ${raw(rows.slice(0, 6).map((a) => `<p class="prose">${esc(a.текст ?? "")}
        <span class="tdim"> · ${esc(a.источник ?? "проверка")}</span></p>`).join(""))}
      <p class="prose prose--muted">Меряют вотчдоги на компьютере; сюда это приезжает снимком доски вместе с проектами.</p>
    </div>
  </section>`;
}

/* ---------- поиск ---------- */

function searchPane() {
  const found = searchEverywhere(query);
  const asked = query.trim().length >= 2;

  return html`<section class="hub-section">
    <label class="hub-search">
      <span class="sr-only">Найти во всех приложениях</span>
      <input class="field" type="search" name="q" value="${query}" data-act-input="search"
             placeholder="найти во всех приложениях — «дрель», «молоко», «кофейня»"
             autocomplete="off" spellcheck="false">
    </label>

    <p class="hub-keys">
      <kbd>/</kbd> искать · <kbd>↑↓</kbd> ходить по «Сегодня» · <kbd>Space</kbd> отметить ·
      <kbd>Enter</kbd> открыть · <kbd>1</kbd>–<kbd>5</kbd> приложение · <kbd>s</kbd> синк
    </p>

    ${raw(!asked ? "" : found.length
      ? `<div class="feed">${found.slice(0, 12).map((row, i) => `<div class="feed-line">
          <a class="feed-row" href="${esc(row.href)}">
            <span class="feed-mark" aria-hidden="true">${icon(row.icon, { size: 16, stroke: "currentColor" })}</span>
            <span class="feed-name">${esc(row.name)}</span>
            <span class="feed-note">${esc(row.note)}</span>
            <span class="feed-app">${esc(row.app)}</span>
          </a>
          ${row.act ? `<button class="btn btn--ghost btn--sm feed-do" type="button" data-act="markFound" data-row="${i}"
            aria-label="${esc(row.act.label)}: ${esc(row.name)}">${esc(row.act.label)}</button>` : ""}
        </div>`).join("")}</div>`
      : `<p class="prose prose--muted">Ничего не нашлось. Приложение, которое не открывали на этом устройстве, пока молчит — его данные лежат в репозитории, а не здесь.</p>`)}
  </section>`;
}

/* ---------- доступ ---------- */

function connectPane() {
  const cfg = gh.config();

  if (!gh.isConfigured()) {
    return html`<section class="pane">
      <div class="label">Общий доступ</div>
      <p class="prose">Один приватный репозиторий на все приложения и один ключ к нему. Введи его здесь — и он заработает везде, включая те приложения, которых ещё нет.</p>
      ${raw(connectForm(cfg))}
    </section>`;
  }

  return html`<section class="pane">
    <div class="head-row">
      <div class="label">Общий доступ</div>
      ${raw(checked === null ? "" : `<span class="chip ${checked ? "" : "chip--alarm"}">${checked ? "на месте" : "не отвечает"}</span>`)}
    </div>
    <div class="insp-row"><span>Репозиторий</span><span class="tdim">${cfg.repo}</span></div>
    <div class="insp-row"><span>Ветка</span><span class="tdim">${cfg.branch ?? "main"}</span></div>
    <div class="insp-row"><span>Ключ</span><span class="tdim">хранится в этом браузере</span></div>
    <div class="rowbtns">
      <button class="btn btn--ghost btn--grow" type="button" data-act="check" ${raw(checking ? "disabled" : "")}>${checking ? "Проверяю…" : "Проверить"}</button>
      <button class="btn btn--ghost" type="button" data-act="forget">Забыть ключ</button>
    </div>
  </section>`;
}

function connectForm(cfg) {
  return html`<form class="stack" data-act-submit="connect">
    <label class="fieldset">
      <span class="fieldset-label">Репозиторий</span>
      <input class="field" name="repo" value="${cfg.repo ?? ""}" placeholder="логин/life-data" autocomplete="off" spellcheck="false" required>
    </label>
    <label class="fieldset">
      <span class="fieldset-label">Ключ доступа</span>
      <input class="field" name="token" type="password" placeholder="github_pat_…" autocomplete="off" spellcheck="false" required>
    </label>
    <label class="fieldset">
      <span class="fieldset-label">Как тебя зовут</span>
      <input class="field" name="meName" value="${gh.identity().name}" placeholder="чтобы второй видел, кто что взял" autocomplete="off">
    </label>
    <button class="btn" type="submit" ${raw(checking ? "disabled" : "")}>${checking ? "Проверяю…" : "Подключить"}</button>
  </form>`;
}

/**
 * The key onto the phone without anyone typing it.
 *
 * Ninety-odd characters of random base62 on a phone keyboard is the worst minute
 * in the whole set, and it used to be paid once per app. One origin means one
 * key: pair here, and every app on the phone is paired.
 */
function pairPane() {
  if (!gh.isConfigured()) return "";

  if (!pairing) {
    return html`<section class="pane">
      <div class="label">Телефон</div>
      <p class="prose">Покажи код и наведи на него камеру телефона — ключ переедет сам, и сразу для всех приложений.</p>
      <button class="btn btn--ghost btn--sm" type="button" data-act="pairShow">Показать код</button>
    </section>`;
  }

  const cfg = gh.config();
  const payload = encodePairing({ repo: cfg.repo, branch: cfg.branch ?? "main", token: cfg.token, name: gh.identity().name });

  return html`<section class="pane">
    <div class="label">Телефон</div>
    <div class="qr-frame">${raw(QR.toSvg(payload, { scale: 5 }))}</div>
    <p class="prose prose--alarm">В коде лежит действующий ключ с правом записи. Не показывай его на общем экране и не фотографируй.</p>
    <button class="btn btn--ghost btn--sm" type="button" data-act="pairHide">Скрыть код</button>
  </section>`;
}

function installPane() {
  if (INSTALL.installed()) return "";

  return html`<section class="pane pane--calm">
    <div class="label">На телефон</div>
    <p class="prose">${INSTALL.platform() === "android"
      ? "Меню браузера → «Установить приложение». Появится значок, своё окно и своя карточка в списке задач."
      : "Открой этот адрес на телефоне и добавь на главный экран."}</p>
  </section>`;
}

/* ---------- данные ---------- */

/** Everything unsent, across all four, so the number is one number. */
function pendingTotal() {
  return APPS.reduce((sum, entry) => sum + (peek(entry)?.pending ?? 0), 0);
}

function syncPane() {
  const pending = pendingTotal();
  const last = APPS.map((a) => peek(a)?.syncedAt).filter(Boolean).sort().at(-1) ?? null;

  return html`<section class="pane">
    <div class="label">Синхронизация</div>
    <p class="prose">Один круг по всем четырём приложениям. Приложение, которое на этом устройстве не открывали, пропускается — синкать нечего.</p>
    <div class="insp-row"><span>Ждёт отправки</span><span class="tdim num">${pending || "—"}</span></div>
    <div class="insp-row"><span>Последний круг</span><span class="tdim">${last ? `${fmtDate(last)}, ${fmtTime(last)}` : "ни разу"}</span></div>
    <button class="btn btn--grow" type="button" data-act="syncAll" ${raw(!gh.isConfigured() || syncing ? "disabled" : "")}>
      ${syncing ? `Синкаю ${syncing}…` : "Синкнуть все"}
    </button>
    ${raw(gh.isConfigured() ? "" : `<p class="prose prose--muted">Пока нет ключа доступа, синкать некуда.</p>`)}
  </section>`;
}

/**
 * A copy of everything, in one file, readable without this app.
 *
 * The repository is the backup and always was — but it needs a key, a network
 * and GitHub still existing. This is the other kind: plain JSON on a disk,
 * openable in any text editor, which is what a backup is for.
 */
function backupPane() {
  const bytes = APPS.reduce((sum, entry) => sum + (peek(entry)?.bytes ?? 0), 0);

  return html`<section class="pane">
    <div class="label">Выгрузка</div>
    <p class="prose">Один файл со всем, что лежит в этом браузере: склад, вещи, дом, места. Обычный JSON — открывается блокнотом и читается без приложений.</p>
    <div class="insp-row"><span>Всего</span><span class="tdim num">${Math.round(bytes / 1024)} КБ</span></div>
    <button class="btn btn--ghost btn--grow" type="button" data-act="backup">Выгрузить файлом</button>
    <p class="prose prose--muted">Ключ доступа в файл не попадает.</p>
  </section>`;
}

function logPane() {
  const { fail, warn } = log.counts();
  const bad = fail + warn;

  if (!showLog) {
    return html`<section class="pane">
      <div class="head-row">
        <div class="label">Журнал</div>
        ${raw(bad ? `<span class="chip chip--alarm chip--sm">${bad}</span>` : "")}
      </div>
      <p class="prose">${bad
        ? `Что-то не сработало: ${fail} ${plural(fail, "ошибка", "ошибки", "ошибок")}, ${warn} ${plural(warn, "предупреждение", "предупреждения", "предупреждений")}.`
        : "Пока всё сработало."}</p>
      <button class="btn btn--ghost btn--sm" type="button" data-act="logShow">Показать журнал</button>
    </section>`;
  }

  const rows = log.entries({ limit: 40 }).slice().reverse();

  return html`<section class="pane">
    <div class="label">Журнал</div>
    ${raw(rows.length
      ? `<div class="logfeed">${rows.map((e) => `<div class="logrow" data-level="${esc(e.l)}">
          <span class="logrow-when">${fmtTime(e.t)}</span>
          <span class="logrow-src">${esc(e.s)}</span>
          <span class="logrow-msg">${esc(e.m)}${e.d ? ` · ${esc(e.d)}` : ""}</span>
        </div>`).join("")}</div>`
      : `<p class="prose prose--muted">Пусто.</p>`)}
    <div class="rowbtns">
      <button class="btn btn--ghost btn--sm btn--grow" type="button" data-act="logHide">Свернуть</button>
      <button class="btn btn--ghost btn--sm" type="button" data-act="logClear">Очистить</button>
    </div>
  </section>`;
}

/* ---------- раскладка ---------- */

/**
 * Панели раскладываются по колонкам по факту, а не по заранее нарисованной
 * схеме.
 *
 * Схема из двух жёстких колонок держалась ровно до первого настоящего
 * устройства: там не оказалось Уборки и Мест, половина блоков не нарисовалась,
 * левая колонка сдулась до четырёх строк, а правая тянулась на экран с лишним.
 * Половина экрана — пустое поле.
 *
 * Поэтому колонки набираются жадно: панель уходит в ту, что сейчас короче.
 * Вес — не высота в пикселях (её на сервере никто не знает), а грубая оценка
 * «сколько эта панель обычно занимает»; для ленты она считается по числу строк,
 * потому что именно лента и растёт.
 */
function dash(all, now) {
  const urgent = urgentEverywhere(now).map((row, i) => ({ ...row, index: i }));

  const panels = [
    { html: dayPane(all, urgent, now), weight: 2 + urgent.length },
    { html: gaugePane(all, now), weight: 3 },
    { html: appsPane(now), weight: 5 },
    { html: planPane(all, now), weight: 4 },
    { html: weekPane(all, now), weight: 2 },
    { html: quietPane(), weight: 3 },
    { html: alertPane(), weight: 3 },
    { html: heatPane(all), weight: 3 },
    { html: missingPane(), weight: 2 },
  ].filter((p) => p.html);

  // Три колонки на широком экране, две на среднем, одна на телефоне — решает
  // CSS, а здесь только раскладка на то число, которое CSS в итоге покажет.
  const count = window.innerWidth >= 1200 ? 3 : window.innerWidth >= 900 ? 2 : 1;
  const cols = Array.from({ length: count }, () => ({ weight: 0, html: [] }));

  for (const panel of panels) {
    const target = cols.reduce((a, b) => (b.weight < a.weight ? b : a));
    target.html.push(panel.html);
    target.weight += panel.weight;
  }

  return html`<div class="dash" data-cols="${count}">
    ${raw(cols.filter((c) => c.html.length).map((c) => `<div class="dash-col">${c.html.join("")}</div>`).join(""))}
  </div>`;
}

/* ---------- экран ---------- */

function render() {
  const focused = document.activeElement?.name === "q";
  const caret = focused ? document.activeElement.selectionStart : null;

  const searching = query.trim().length >= 2;
  const all = states();
  const now = today();
  const when = new Date();

  root.innerHTML = html`<div class="hub">
    <header class="hub-top">
      <h1>Жизнь</h1>
      <span class="hub-when num">${when.toLocaleDateString("ru", { weekday: "long", day: "numeric", month: "long" })} · ${fmtTime(when.getTime())}</span>
    </header>

    ${raw(searchPane())}

    ${raw(searching ? "" : dash(all, now))}

    <details class="hub-section switchboard">
      <summary class="hub-label">Щиток · ключ, синк, бэкап, журнал, телефон</summary>
      <div class="hub-panes">
        ${raw(connectPane())}
        ${raw(syncPane())}
        ${raw(pairPane())}
        ${raw(backupPane())}
        ${raw(logPane())}
        ${raw(installPane())}
      </div>
    </details>
  </div>`;

  KEYS.clamp(root.querySelectorAll(".hour").length);
  KEYS.paint(root);

  // Re-rendering on every keystroke would otherwise take the cursor with it.
  if (focused) {
    const field = root.querySelector('input[name="q"]');
    field?.focus();
    if (caret != null) field?.setSelectionRange(caret, caret);
  }
}

/* ---------- действия ---------- */

/** Одна отметка на два списка: и лента, и находки поиска зовут её. */
function markRow(row) {
  if (!row?.act) return;

  const { ok, undo } = actOn(row);
  if (!ok) return toast("Не вышло отметить — приложение переписало запись", "alarm");

  render();
  toast(`${row.name} — ${row.act.label.toLowerCase()}`, "calm", {
    undo: () => { undo(); render(); },
  });
}

const ACTIONS = {
  async connect(form) {
    const data = new FormData(form);
    const repo = String(data.get("repo") ?? "").trim();
    const token = String(data.get("token") ?? "").trim();
    const name = String(data.get("meName") ?? "").trim();

    if (!repo || !token) return;

    gh.setConfig({ repo, token, branch: "main" });
    if (name) gh.setName(name);

    checking = true;
    render();
    const ok = await gh.check(gh.config()).then(() => true).catch(() => false);
    checking = false;
    checked = ok;
    render();

    toast(ok ? "Подключено — ключ работает во всех приложениях" : "Ключ не подошёл", ok ? "calm" : "alarm");
  },

  async check() {
    checking = true;
    render();
    checked = await gh.check(gh.config()).then(() => true).catch(() => false);
    checking = false;
    render();
  },

  forget() {
    gh.clearConfig();
    checked = null;
    pairing = false;
    render();
    toast("Ключ забыт. Данные приложений остались на месте");
  },

  /**
   * Отметить прямо из ленты.
   *
   * Список берётся заново, а не из замыкания: между отрисовкой и нажатием могла
   * приехать синхронизация, и отметить тогда надо ту строку, что человек видит,
   * а не ту, что была.
   */
  mark(el) { markRow(urgentEverywhere(today())[Number(el.dataset.row)]); },

  /* Найденное отмечается так же, как срочное: человек уже нашёл нужную строку,
     и заставлять его открывать приложение ради галочки — та же лишняя дорога,
     от которой избавлена лента. */
  markFound(el) { markRow(searchEverywhere(query)[Number(el.dataset.row)]); },

  pairShow() { pairing = true; render(); },
  pairHide() { pairing = false; render(); },

  /**
   * One round for each app in turn.
   *
   * In turn, not at once: they share a repository and GitHub's Contents API
   * answers per file, so four parallel rounds would spend their time colliding
   * with each other and retrying.
   */
  async syncAll() {
    if (syncing) return;
    const done = [];
    const failed = [];

    for (const entry of APPS) {
      const manifest = MANIFESTS[entry.key];
      if (!manifest) continue;

      syncing = entry.name;
      render();

      try {
        const report = await syncApp(manifest);
        if (report?.skipped) continue;
        done.push(entry.name);
      } catch (err) {
        log.fail("синк", `${entry.name}: круг не прошёл`, err?.message);
        failed.push(entry.name);
      }
    }

    syncing = null;
    render();

    if (failed.length) toast(`Не прошло: ${failed.join(", ")}`, "alarm");
    else if (done.length) toast(`Синкнуто: ${done.join(", ")}`);
    else toast("Нечего синкать — приложения на этом устройстве пустые");
  },

  backup() {
    const dump = {
      что: "выгрузка приложений «Жизнь»",
      когда: new Date().toISOString(),
      приложения: {},
    };

    for (const entry of APPS) {
      const seen = peek(entry);
      if (seen) dump.приложения[entry.key] = seen.state;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `жизнь-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast("Выгружено");
  },

  logShow() { showLog = true; render(); },
  logHide() { showLog = false; render(); },
  logClear() { log.clear(); render(); toast("Журнал очищен"); },
};

/* ---------- события ---------- */

/* Клавиатура пульта: правила в keys.js, а что именно делать — знает этот экран.
   Строки «Сегодня» и лента срочного — одно и то же, поэтому и отметка тут та
   же, что по кнопке: один способ на два входа. */
KEYS.bind({
  rows: () => root.querySelectorAll(".hour").length,
  paint: () => KEYS.paint(root),
  focusSearch() {
    const field = root.querySelector('input[name="q"]');
    field?.focus();
    field?.select();
  },
  mark(i) {
    const btn = root.querySelectorAll(".hour")[i]?.querySelector('[data-act="mark"]');
    btn?.click();
  },
  open(i) {
    const link = root.querySelectorAll(".hour")[i]?.querySelector("a.hour-main");
    if (link) location.href = link.getAttribute("href");
  },
  sync() { root.querySelector('[data-act="syncAll"]')?.click(); },
  go(i) {
    const entry = APPS.filter((a) => a.ready)[i];
    if (entry?.href) location.href = entry.href;
  },
});

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const handler = ACTIONS[el.dataset.act];
  if (!handler) return;
  e.preventDefault();
  handler(el);
});

document.addEventListener("submit", (e) => {
  const form = e.target.closest("[data-act-submit]");
  if (!form) return;
  e.preventDefault();
  ACTIONS[form.dataset.actSubmit]?.(form);
});

document.addEventListener("input", (e) => {
  if (e.target.dataset?.actInput !== "search") return;
  query = e.target.value;
  render();
});

mountIcons();
render();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
