// Проекты: зеркало доски плюс то, что ещё не доехало до волта.
//
// Своих данных приложение не держит — ровно как доска. Снимок `доска.json`
// собирается на компьютере из заметок и читается здесь как есть. Единственное,
// что приложение пишет, — правки: «закрой эту веху», «дело сделано». Они уезжают
// записями, мост применяет их к заметкам, и следующий снимок приходит уже
// с ними. Волт остаётся единственным хранилищем.
//
// Отсюда главное правило экрана: **правка, которую волт ещё не видел, показана
// как ожидающая, а не как сделанная.** Галочка, поставленная в метро, и галочка,
// доехавшая до файла, — разные вещи, и врать про это нельзя.

import { DAY, today, daysBetween, plural } from "../../../core/time.js";
import { uid } from "../../../core/state.js";

export { today, daysBetween, plural };

export const STATUSES = ["идея", "активно", "пауза", "готово"];

/** Порядок разделов: сначала то, что в работе. */
const GROUP_ORDER = ["в работе", "на паузе", "беклог", "готово", "закрыт"];

export const boardOf = (state) => state.board ?? null;

export const alive = (rows = []) => rows.filter((r) => !r.deleted);

/* ---------- правки ---------- */

/**
 * Новая правка. `что` — имя операции из белого списка доски, остальное — её
 * поля; ядро довезёт запись, мост отдаст её `board_server.OPS`.
 */
export function change(kind, fields) {
  return { id: uid("e"), что: kind, ...fields, применено: null, ответ: "", at: Date.now() };
}

/** Правки, которых волт ещё не видел. */
export const waiting = (state) => alive(state.edits).filter((e) => e.применено === null);

/** Отбитые: строка разошлась, поле не то, файла нет. Их надо показать. */
export const refused = (state) => alive(state.edits).filter((e) => e.применено === false);

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

/* ---------- проекты ---------- */

export function projects(state) {
  return boardOf(state)?.проекты ?? [];
}

export function find(state, id) {
  return projects(state).find((p) => p.ид === id) ?? null;
}

/**
 * Вехи проекта с наложенными правками, которые ещё в пути.
 *
 * Правка адресует веху номером строки в заметке — так же, как это делает доска,
 * и по той же причине: у вехи нет своего идентификатора, она просто строка
 * в файле.
 */
export function milestonesOf(state, project) {
  const pending = new Map(
    waiting(state)
      .filter((e) => e.что === "веха" && e.проект === project.ид)
      .map((e) => [e.строка, e])
  );

  return (project.вехи ?? []).map((m) => {
    const edit = pending.get(m.строка);
    return edit ? { ...m, закрыта: Boolean(edit.закрыта), ждёт: true } : m;
  });
}

/** Доля закрытого — по тому, что видно сейчас, включая ожидающие правки. */
export function progress(milestones) {
  const total = milestones.length;
  if (!total) return null;
  const done = milestones.filter((m) => m.закрыта).length;
  return { done, total, share: done / total };
}

export function statusOf(state, project) {
  const edit = waiting(state).find(
    (e) => e.что === "поле" && e.ключ === "статус" && e.проект === project.ид
  );
  return edit ? { value: edit.значение, ждёт: true } : { value: project.статус, ждёт: false };
}

/* ---------- дела ---------- */

export function deeds(state) {
  const pending = new Map(
    waiting(state).filter((e) => e.что === "дело").map((e) => [e.ид, e])
  );

  return (boardOf(state)?.дела ?? []).map((d) => {
    const edit = pending.get(d.ид);
    return edit ? { ...d, сделано: Boolean(edit.сделано), ждёт: true } : d;
  });
}

export const open = (state) => deeds(state).filter((d) => !d.сделано);

/** Просрочено — по дате, а не по настроению. Дело без срока не просрочено. */
export function overdue(deed, now = today()) {
  if (!deed.срок || deed.сделано) return false;
  return Date.parse(deed.срок) <= now;
}

/* ---------- что стоит и что почти готово ---------- */

/* Те же две подсказки, что даёт доска, и по тем же порогам: проект без движения
   дольше трёх недель и проект, где осталась одна веха. Считать их иначе значило
   бы завести второй ответ на один вопрос. */
export const STALE_DAYS = 21;

export const stalled = (state) =>
  projects(state).filter((p) => p.статус === "активно" && (p.дней_без_движения ?? 0) >= STALE_DAYS);

export const almostDone = (state) =>
  projects(state).filter(
    (p) => p.статус === "активно" && p.вехи_всего > 1 && p.вехи_всего - p.вехи_закрыто === 1
  );

/* ---------- разрезы ---------- */

/**
 * Разделы — слово из шапки карточки, и секция существует ровно пока в ней
 * кто-то лежит. Порядок задан волтом, а не алфавитом: алфавит не догадается,
 * что «Главное сейчас» выше «Фона».
 */
export function groupBy(state, cut = "раздел") {
  const rows = projects(state);
  const order = boardOf(state)?.разделы ?? [];
  const buckets = new Map();

  for (const p of rows) {
    const name = (cut === "раздел" ? p.раздел : cut === "область" ? (p.области ?? [])[0] : p.группа) || fallback(cut);
    if (!buckets.has(name)) buckets.set(name, []);
    buckets.get(name).push(p);
  }

  const rank = (name) => {
    const declared = cut === "раздел" ? order.indexOf(name) : GROUP_ORDER.indexOf(name);
    return declared === -1 ? 999 : declared;
  };

  return [...buckets.entries()]
    .map(([name, items]) => ({ name, items: items.sort(byUrgency) }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, "ru"));
}

const fallback = (cut) => (cut === "раздел" ? "без раздела" : cut === "область" ? "без области" : "без статуса");

/* Стоящее — выше: проект, к которому три недели не прикасались, это то, о чём
   человек и открывает список. Дальше по проценту: почти готовое — следом. */
const byUrgency = (a, b) =>
  (b.дней_без_движения ?? 0) - (a.дней_без_движения ?? 0) ||
  (b.процент ?? 0) - (a.процент ?? 0) ||
  String(a.имя).localeCompare(String(b.имя), "ru");

/** Как давно собран снимок — чтобы экран не притворялся живым. */
export function snapshotAge(state, now = Date.now()) {
  const at = boardOf(state)?.собрано;
  if (!at) return null;
  const parsed = Date.parse(at);
  return Number.isFinite(parsed) ? Math.max(0, Math.round((now - parsed) / DAY)) : null;
}
