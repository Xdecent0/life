// Что происходит с правкой между телефоном и волтом.
//
// Экран у этого приложения не свой: это та же доска проектов, перенесённая из
// волта файлом (см. tools/port_board.mjs). Здесь только то, чего у доски на
// компьютере нет и быть не может — жизнь правки, которая уехала, но ещё не
// доехала.
//
// На компьютере доска правит заметку и перечитывает волт: увиденное всегда
// равно тому, что лежит в файлах. С телефона волт недостижим, поэтому правка
// ложится в очередь, а на экран накладывается поверх снимка — и рядом честно
// написано, что она ещё в пути.

export const DAY = 86400000;

/** Форма состояния, в котором ещё ничего не приезжало. */
export const blank = () => ({ version: 1, board: null, edits: [], queue: [], syncedAt: null });

export const alive = (rows = []) => rows.filter((r) => !r.deleted);

/** Правки, которых волт ещё не видел. */
export const waiting = (state) => alive(state.edits).filter((e) => e.применено === null);

/** Отбитые: строка разошлась, поле не то, файла нет. Их надо показать. */
export const refused = (state) => alive(state.edits).filter((e) => e.применено === false);

let counter = 0;

/**
 * Новая правка. `что` — имя операции из белого списка доски, остальное — её
 * поля: мост отдаёт запись прямо в `board_server.OPS`, ничего не переводя.
 */
export function change(kind, fields, now = Date.now()) {
  counter += 1;
  return { id: `e${now.toString(36)}${counter.toString(36)}`, что: kind, ...fields, применено: null, ответ: "", at: now };
}

/**
 * Снимок с наложенными правками, которые ещё в пути.
 *
 * Доска рисует из того, что ей дали, и знать про очередь не должна — иначе
 * пришлось бы править перенесённый файл, а он должен оставаться тем же самым.
 * Поэтому очередь накладывается здесь, до того как снимок к ней попадёт.
 */
export function withPending(board, edits = []) {
  if (!board) return null;
  const next = structuredClone(board);

  for (const edit of edits) {
    if (edit.что === "веха") {
      const project = next.проекты?.find((p) => p.путь === edit.проект || p.ид === edit.проект);
      const milestone = project?.вехи?.find((m) => m.строка === edit.строка);
      if (milestone) milestone.закрыта = Boolean(edit.закрыта);
      continue;
    }

    if (edit.что === "дело") {
      const deed = next.дела?.find((d) => d.ид === edit.ид);
      if (deed && "сделано" in edit) deed.сделано = Boolean(edit.сделано);
      continue;
    }

    if (edit.что === "поле") {
      const project = next.проекты?.find((p) => p.путь === edit.проект || p.ид === edit.проект);
      if (project) project[edit.ключ] = edit.значение;
    }

    /* Операции, которые заводят новое — проект, дело, пространство, — поверх
       снимка не показываются: у них ещё нет ни строки, ни ид, которые придумает
       волт. Они появятся следующим снимком, и интерфейс так и говорит. */
  }

  return next;
}

/**
 * Что показывает метка волта в шапке.
 *
 * На компьютере там имя волта и «читается и пишется». Здесь волта нет — есть
 * репозиторий и очередь, и врать про это в единственном месте, которое доска
 * отвела под правду о связи, было бы худшим из вариантов.
 */
export function vaultLabel(state) {
  if (!state.board) return "снимок не приезжал";
  const n = waiting(state).length;
  const bad = refused(state).length;
  if (bad) return `репозиторий · отбито: ${bad}`;
  return n ? `репозиторий · ждут волта: ${n}` : "репозиторий";
}

/**
 * Дешёвый отпечаток — тем же способом, каким доска следит за волтом.
 *
 * Меняется, когда приехал новый снимок или встала в очередь правка, и доска
 * перерисовывается сама, без кнопки.
 */
export function fingerprint(state) {
  return `${state.board?.собрано ?? "-"}:${state.syncedAt ?? 0}:${waiting(state).length}:${refused(state).length}`;
}

/**
 * Ответ приехал — запись отслужила. Через месяц она становится обычным
 * надгробием, чтобы файл правок не рос историей всех галочек за год.
 */
export function foldAnswered(entries, days = 30, now = Date.now()) {
  const cutoff = now - days * DAY;

  return entries.map((e) => {
    if (e.применено === null || e.deleted) return e;
    const at = e.at ?? 0;
    if (at > cutoff) return e;
    return { id: e.id, deleted: true, deletedAt: at, at };
  });
}

/**
 * Поиск по снимку — вместо поиска по всему волту, которого здесь нет.
 *
 * На компьютере доска спрашивает сервер и получает имена всех 2300 заметок.
 * С телефона доступны только проекты и дела из снимка; отвечать на «найдено»
 * тишиной было бы честнее всего, но бесполезно, а притворяться, что искали
 * везде, — нечестно. Поэтому ищем по тому, что есть.
 */
export function findInSnapshot(board, query) {
  const needle = String(query ?? "").trim().toLowerCase();
  if (!board || needle.length < 2) return [];

  const hit = (v) => String(v ?? "").toLowerCase().includes(needle);

  return (board.проекты ?? [])
    .filter((p) => hit(p.имя) || hit(p.цель) || hit(p.аппетит))
    .slice(0, 40)
    .map((p) => ({ имя: p.имя, путь: p.путь, папка: (p.путь ?? "").split("/").slice(0, -1).join("/") }));
}
