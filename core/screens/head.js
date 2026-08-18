// Одна шапка на все экраны.
//
// Шапку писал каждый экран сам, и получалось так: заголовок с подписью — 85 px,
// заголовок без подписи — 78, панель под ним то 58, то 67, то её нет вовсе.
// Контент из-за этого начинался то на 120-й точке, то на 183-й, и при переходе
// между экранами всё содержимое прыгало. Разница нигде не была решением — она
// была суммой мелких случайностей.
//
// Поэтому здесь один компонент с фиксированным ритмом, а экраны только
// назначают ему своё: имя, строку смысла, действия справа, ряд управления.
//
// Две строки, обе обязательные:
//
//   ┌──────────────────────────────────────────────┐
//   │ [назад] Заголовок              [действия]    │  имя
//   ├──────────────────────────────────────────────┤
//   │ строка смысла        [фильтры · переключатели]│  управление
//   └──────────────────────────────────────────────┘
//
// Вторая строка есть всегда — не ради симметрии, а потому что у каждого экрана
// есть что в ней сказать: где нет фильтров, там стоит строка смысла («19
// поверхностей · 4 ждут»), которая раньше жила в шапке и меняла её высоту.

import { html, raw, icon, esc } from "../dom.js";

/**
 * @param {object} opts
 * @param {string} opts.title      имя экрана
 * @param {string} [opts.said]     одна строка смысла: счётчики, состояние
 * @param {string} [opts.back]     href «назад», если экран открыт из списка
 * @param {string} [opts.backLabel] что читает голосовой доступ вместо стрелки
 * @param {string} [opts.actions]  готовая разметка кнопок справа
 * @param {string} [opts.bar]      готовая разметка ряда управления
 * @param {string} [opts.tone]     "dark" (по умолчанию) или "light"
 * @param {string} [opts.chips]    чипы состояния под именем — только у карточек
 */
export function pageHead({
  title,
  said = "",
  back = "",
  backLabel = "Назад",
  actions = "",
  bar = "",
  tone = "dark",
  chips = "",
} = {}) {
  const stroke = tone === "dark" ? "#f4f1e6" : "#1c3327";

  return html`<header class="pagehead" data-tone="${tone}">
    <div class="pagehead-name">
      ${raw(back ? `<a class="pagehead-back" href="${esc(back)}" aria-label="${esc(backLabel)}">${icon("i-back", { size: 18, stroke })}</a>` : "")}
      <h1 class="pagehead-title">${title}</h1>
      ${raw(actions ? `<div class="pagehead-acts">${actions}</div>` : "")}
    </div>

    <div class="pagehead-bar">
      ${raw(said ? `<span class="pagehead-said num">${esc(said)}</span>` : "")}
      ${raw(chips ? `<div class="chips">${chips}</div>` : "")}
      ${raw(bar ? `<div class="pagehead-tools">${bar}</div>` : "")}
    </div>
  </header>`;
}

/** Кнопка для правой части шапки — чтобы экраны не выдумывали свой размер. */
export const headBtn = (label, attrs = "") =>
  `<button class="btn btn--head" type="button" ${attrs}>${esc(label)}</button>`;

export const headLink = (label, href, attrs = "") =>
  `<a class="btn btn--head" href="${esc(href)}" ${attrs}>${esc(label)}</a>`;
