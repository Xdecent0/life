// Клавиатура пульта.
//
// На телефоне пульт трогают пальцем, и этого хватает. На компьютере — нет:
// экран, с которого нельзя ничего сделать руками на клавиатуре, остаётся
// витриной. Отсюда правило простое: всё, ради чего пульт открывают, должно
// делаться, не трогая мышь.
//
//   ↑ ↓ или j k   ходить по строкам «Сегодня»
//   Space          отметить сделанным — то же, что кнопка в строке
//   Enter          открыть в приложении
//   /              встать в строку поиска, Esc — выйти из неё
//   1…5            перейти в приложение по номеру
//   s              круг синка по всем
//
// Курсор живёт здесь, а не в разметке: пульт перерисовывается на каждое
// изменение, и хранить его в DOM значило бы терять место после первой же
// отметки.

let cursor = -1;

export const at = () => cursor;

/** После перерисовки строк стало меньше — курсор не должен указывать в пустоту. */
export function clamp(total) {
  if (!total) cursor = -1;
  else if (cursor >= total) cursor = total - 1;
  return cursor;
}

/** Подсветить и подтянуть к глазам ту строку, на которой стоим. */
export function paint(root) {
  const rows = [...root.querySelectorAll(".hour")];
  rows.forEach((row, i) => {
    row.dataset.cursor = i === cursor ? "1" : "0";
    if (i === cursor) row.scrollIntoView({ block: "nearest" });
  });
}

/**
 * Одна раскладка на весь пульт.
 *
 * `deps` — то, чего клавиатура сама не знает: сколько сейчас строк, как
 * отметить, куда уйти и как перерисовать. Так же устроена клавиатура списков в
 * приложениях: правила общие, а что именно делать — говорит экран.
 */
export function bind(deps) {
  document.addEventListener("keydown", (e) => {
    /* Клавиша может прилететь, когда фокус нигде: тогда цель события — сам
       документ, а у него нет `matches`, и обработчик падал целиком. Пульт при
       этом выглядел рабочим — просто ничего не делал. */
    const el = e.target instanceof Element ? e.target : null;
    const typing = Boolean(el?.matches("input, textarea, select"));

    if (e.key === "/" && !typing) {
      e.preventDefault();
      deps.focusSearch();
      return;
    }

    if (e.key === "Escape" && typing) {
      el.blur();
      return;
    }

    if (typing) return;

    const rows = deps.rows();

    if (e.key === "ArrowDown" || e.key === "j") {
      if (!rows) return;
      e.preventDefault();
      cursor = Math.min(rows - 1, cursor + 1);
      deps.paint();
      return;
    }

    if (e.key === "ArrowUp" || e.key === "k") {
      if (!rows) return;
      e.preventDefault();
      // Вверх с первой строки — не «по кругу в конец»: список кончился, и
      // прыжок через весь экран человек читает как промах, а не как переход.
      cursor = Math.max(0, cursor - 1);
      deps.paint();
      return;
    }

    if (e.key === " " && cursor >= 0) {
      e.preventDefault();
      deps.mark(cursor);
      return;
    }

    if (e.key === "Enter" && cursor >= 0) {
      e.preventDefault();
      deps.open(cursor);
      return;
    }

    if (e.key === "s") {
      e.preventDefault();
      deps.sync();
      return;
    }

    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      deps.go(Number(e.key) - 1);
    }
  });
}
