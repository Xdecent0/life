// The hub: one place where the whole set is looked at and set up.
//
// It owns nothing. Every app keeps its own state and works with the hub closed —
// that is the point of the arrangement, and the reason the kitchen still opens
// in a shop with nothing else running. What the hub owns is the *edges*: the one
// access key, the pairing, and an honest answer to "what is where right now".

import { declare } from "../core/app.js";

declare({
  key: "hub",
  name: "Жизнь",
  empty: { queue: [] },
  paths: {},
  collections: [],
});

import { html, raw, icon, esc, toast } from "../core/dom.js";
import { mountIcons } from "../core/icons.js";
import { APPS, peek } from "../core/registry.js";
import * as gh from "../core/github.js";
import * as QR from "../core/qr.js";
import { encodePairing } from "../core/pair.js";
import * as INSTALL from "../core/install.js";

/** The pairing code holds a live key, so it is never on screen unless asked for. */
let pairing = false;
let checking = false;
let checked = null;

const root = document.getElementById("root");

/* ---------- pieces ---------- */

function tile(entry) {
  const seen = peek(entry);

  const status = !entry.ready
    ? `<span class="tdim">ещё не построено</span>`
    : seen
      ? `<span class="tdim">${esc(seen.summary || "пусто")}</span>${seen.pending ? ` <span class="chip chip--alarm chip--sm">${seen.pending} не отправлено</span>` : ""}`
      : `<span class="tdim">на этом устройстве ещё не открывалось</span>`;

  const inner = html`<span class="tile tile--lg" aria-hidden="true">${raw(icon(entry.icon, { size: 22, stroke: "#1c3327" }))}</span>
    <span class="row-main">
      <span class="row-name">${entry.name}</span>
      <span class="row-why">${entry.what}</span>
      <span class="row-why">${raw(status)}</span>
    </span>`;

  return entry.href
    ? `<a class="zone zone--app" href="${esc(entry.href)}">${inner}</a>`
    : `<div class="zone zone--app" data-soon="1">${inner}</div>`;
}

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

/* ---------- screen ---------- */

function render() {
  root.innerHTML = html`<div class="screen">
    <header class="head head--dark">
      <h1>Жизнь</h1>
      <span class="head-sub">Приложения, которые знают про твои вещи, дом и еду. Настройка у них общая.</span>
    </header>

    <div class="body">
      <div class="aisle">Приложения</div>
      <div class="zones zones--apps">${raw(APPS.map(tile).join(""))}</div>

      ${raw(connectPane())}
      ${raw(pairPane())}
      ${raw(installPane())}
    </div>
  </div>`;
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

  pairShow() { pairing = true; render(); },
  pairHide() { pairing = false; render(); },
};

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

mountIcons();
render();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
