// Дотянуться до соседнего приложения, не открывая его.
//
// Лента «Сегодня» на пульте отвечала на вопрос «что надо сделать» и не давала
// ничего сделать: молоко на сегодня, пол, не мытый десять дней, и просроченное
// дело показывались рядом — а отметить каждое можно было только сходив в своё
// приложение. Три перехода ради трёх галочек, то есть ровно та работа, ради
// избавления от которой пульт и заводился.
//
// Технически это дёшево: одно происхождение — одно localStorage, и состояние
// каждого приложения лежит там под своим ключом. Дорого другое — честность.
// Правка отсюда обязана выглядеть ровно так же, как правка изнутри: та же метка
// времени на записи (по ней синк решает, чья версия свежее) и та же строка в
// очереди отправки. Иначе отметка с пульта тихо проиграет слияние.

const keyOf = (app) => `${app}.state.v1`;

/**
 * Прочитать, изменить, записать — и вернуть способ передумать.
 *
 * @param {string} app  ключ приложения: kitchen, clean, places, projects
 * @param {function} mutate  (state) => op | null — op в том же виде, что commit()
 * @returns {{ok: boolean, undo: function|null}}
 */
export function reach(app, mutate) {
  const key = keyOf(app);

  let raw = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return { ok: false, undo: null };
  }
  if (!raw) return { ok: false, undo: null };

  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    return { ok: false, undo: null };
  }

  const op = mutate(state);
  if (!op) return { ok: false, undo: null };

  state.queue = [...(state.queue ?? []), { ...op, at: Date.now(), id: crypto.randomUUID() }];
  localStorage.setItem(key, JSON.stringify(state));

  /* Отмена — это прежний файл целиком, а не вычисленное обратное действие.
     Обратное действие нужно выводить для каждого случая отдельно, и первая же
     невыведенная разновидность оставила бы кнопку «отменить», которая врёт. */
  return { ok: true, undo: () => localStorage.setItem(key, raw) };
}

/** Состояние соседа, если оно вообще есть на этом устройстве. */
export function peekState(app) {
  try {
    const raw = localStorage.getItem(keyOf(app));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
