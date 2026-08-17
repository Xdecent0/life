// Клавиатура списков — одна на весь набор.
//
// На складе Кухни она была с самого начала: стрелки ходят, Enter открывает,
// пробел отмечает. Остальные шесть списков её не получили, и человек, привыкший
// к складу, на соседнем экране тянулся к мыши — то есть привычка не переносилась,
// хотя списки одинаковые.
//
// Здесь только курсор и раскладка. Что значит «открыть» и «отметить», знает
// экран: у поверхности это «убрал», у места «был», у дела «сделано». Общее —
// какими клавишами это зовут и как курсор себя ведёт на краях списка.

/* Курсор не ползёт по кругу: список кончается, и упереться в конец честнее, чем
   молча оказаться в начале — особенно когда список длиной в экран. */
const clamp = (i, len) => Math.max(0, Math.min(i, len - 1));

/**
 * Курсор по строкам одного экрана.
 *
 * Экран держит его у себя между перерисовками, как держит фильтры: это состояние
 * взгляда, а не данные.
 */
export function cursor() {
  let at = 0;

  return {
    get index() { return at; },
    set index(v) { at = Math.max(0, v); },

    /** Номер строки под курсором с поправкой на то, что список мог укоротиться. */
    on(rows) { return (at = clamp(at, rows.length)); },

    /**
     * Разложить нажатие. Возвращает true, если клавиша была своя.
     *
     * @param {KeyboardEvent} e
     * @param {Array} rows  строки экрана, ровно в том порядке, что на экране
     * @param {object} how
     * @param {function} how.redraw  перерисовать: курсор — часть картинки
     * @param {function} [how.open]  Enter: открыть строку
     * @param {function} [how.act]   пробел: сделать с ней главное
     * @param {string}  [how.search] селектор поля поиска для «/»
     */
    keys(e, rows, { redraw, open, act, search } = {}) {
      if (!rows.length) return false;
      const row = () => rows[clamp(at, rows.length)];

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        at = clamp(at + (e.key === "ArrowDown" ? 1 : -1), rows.length);
        redraw?.();
        seeFocused();
        return true;
      }

      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        at = e.key === "Home" ? 0 : rows.length - 1;
        redraw?.();
        seeFocused();
        return true;
      }

      if (e.key === "Enter" && open) {
        e.preventDefault();
        open(row());
        return true;
      }

      /* Пробел, а не Enter: главное действие списка делают чаще, чем открывают
         строку, и оно не должно требовать возврата обратно. */
      if (e.key === " " && act) {
        e.preventDefault();
        act(row());
        return true;
      }

      if (e.key === "/" && search) {
        e.preventDefault();
        document.querySelector(search)?.focus();
        return true;
      }

      return false;
    },
  };
}

/* Строка под курсором должна быть видна — иначе стрелка уводит выделение за
   край экрана и человек листает вслепую. «nearest» не дёргает список, когда
   строка и так на виду. */
export function seeFocused(selector = '[data-focused="1"]') {
  requestAnimationFrame(() => {
    document.querySelector(selector)?.scrollIntoView({ block: "nearest" });
  });
}

/**
 * Подсказка о клавишах — теми же словами на всех экранах.
 *
 * Показывается только там, где есть мышь и место: на телефоне клавиш нет, а
 * строка про них съела бы место у списка.
 */
export function hint(pairs) {
  return `<span class="toolbar-hint">${pairs
    .map(([key, said]) => `<kbd>${key}</kbd> ${said}`)
    .join(" · ")}</span>`;
}
