// Уборка: комнаты, поверхности в них, и одна арифметика — «когда снова».
//
// Это тот же счёт, что говорит на кухне «кончилось два дня назад, берёшь каждые
// три»: цикл плюс дата последнего раза даёт дату следующего. Поэтому здесь нет
// своей математики сроков — она в core/time.js.

import { today, daysBetween, plural, freshness, sortByUrgency } from "../../../core/time.js";
import { onPlan } from "../../../core/vault.js";

export { today, daysBetween, plural, sortByUrgency };

/** Комнаты обычной квартиры и место каждой на карте: ряд, колонка, ширина. */
export const SEED_ROOMS = [
  { id: "kitchen", name: "кухня", icon: "i-carton", row: 1, col: 1, w: 2 },
  { id: "room", name: "комната", icon: "i-shelf", row: 1, col: 3, w: 2 },
  { id: "bath", name: "ванная", icon: "i-veg", row: 2, col: 1, w: 1 },
  { id: "toilet", name: "туалет", icon: "i-veg", row: 2, col: 2, w: 1 },
  { id: "hall", name: "коридор", icon: "i-store", row: 2, col: 3, w: 2 },
];

/**
 * Что в комнате убирают и как часто.
 *
 * Циклы — это не норматив, а стартовая догадка: пол на кухне правда пачкается
 * быстрее, чем в комнате. Всё правится в карточке, а справочник живёт в волте.
 */
export const SEED_SPOTS = [
  { room: "kitchen", name: "пол", every: 4 },
  { room: "kitchen", name: "плита", every: 3 },
  { room: "kitchen", name: "рабочая поверхность", every: 2 },
  { room: "kitchen", name: "раковина", every: 3 },
  { room: "kitchen", name: "холодильник внутри", every: 30 },
  { room: "kitchen", name: "вытяжка", every: 60 },

  { room: "room", name: "пол", every: 7 },
  { room: "room", name: "полки и пыль", every: 10 },
  { room: "room", name: "постель", every: 14 },
  { room: "room", name: "окно", every: 90 },

  { room: "bath", name: "пол", every: 7 },
  { room: "bath", name: "ванна или душ", every: 5 },
  { room: "bath", name: "раковина и зеркало", every: 5 },
  { room: "bath", name: "стиральная машина", every: 60 },

  { room: "toilet", name: "унитаз", every: 3 },
  { room: "toilet", name: "пол", every: 7 },

  { room: "hall", name: "пол", every: 5 },
  { room: "hall", name: "обувь по местам", every: 7 },
  { room: "hall", name: "зеркало", every: 14 },
];

export const alive = (state) => (state.spots ?? []).filter((s) => !s.deleted);

export const roomsOf = (state) => state.rooms ?? SEED_ROOMS;

/**
 * Комнаты, у которых есть квадрат на плане.
 *
 * Список комнат теперь один на весь дом и его же читают Вещи, а там есть
 * ответы вроде «с собой» и «в машине» — настоящие ответы на «где оно», но
 * рисовать их на плане квартиры нечем.
 */
export const planOf = (state) => onPlan(roomsOf(state));

export const spotsIn = (state, roomId) => alive(state).filter((s) => s.room === roomId);

/**
 * Поверхность как запись со сроком: убрано плюс цикл — это дата следующего раза.
 *
 * Никогда не убиралось — значит срока нет вовсе. Это честнее, чем считать
 * просроченным то, о чём приложение ничего не знает: пустая квартира не грязная,
 * она просто не описана.
 */
export function asDue(spot) {
  return {
    ...spot,
    boughtAt: spot.lastDone ?? null,
    shelfDays: spot.every ?? null,
    expires: spot.lastDone && spot.every ? spot.lastDone + spot.every * 86400000 : null,
  };
}

export const STATES = ["чисто", "скоро", "пора", "давно"];

/**
 * В каком состоянии поверхность.
 *
 * Четыре ступени, а не «чисто/грязно»: разница между «пора» и «давно» — это
 * разница между сегодняшним вечером и виноватой субботой.
 */
export function stateOf(spot, now = today()) {
  if (!spot.lastDone) return { key: "неизвестно", left: null, share: null, tone: "calm" };

  const f = freshness(asDue(spot), now);
  if (f.left == null) return { key: "неизвестно", left: null, share: null, tone: "calm" };

  const key = f.left < 0
    ? (Math.abs(f.left) > (spot.every ?? 7) ? "давно" : "пора")
    : f.share <= 0.25 ? "скоро" : "чисто";

  const tone = key === "давно" ? "bad" : key === "пора" ? "warn" : "calm";
  return { key, left: f.left, share: f.share, tone };
}

export const isDue = (spot, now = today()) => ["пора", "давно"].includes(stateOf(spot, now).key);

/** Сколько дней назад убирали, словами. */
export function lastLabel(spot, now = today()) {
  if (!spot.lastDone) return "ещё ни разу";
  const days = daysBetween(spot.lastDone, now);
  if (days <= 0) return "сегодня";
  if (days === 1) return "вчера";
  return `${days} ${plural(days, "день", "дня", "дней")} назад`;
}

/** Как часто, словами. */
export function everyLabel(spot) {
  const n = spot.every;
  if (!n) return "без цикла";
  if (n === 1) return "каждый день";
  if (n === 7) return "раз в неделю";
  if (n === 14) return "раз в две недели";
  if (n === 30) return "раз в месяц";
  if (n === 90) return "раз в сезон";
  return `раз в ${n} ${plural(n, "день", "дня", "дней")}`;
}

/**
 * Насколько комната в порядке: доля поверхностей, до которых ещё не пора.
 *
 * Комната, о которой ничего не известно, возвращает null, а не ноль — иначе
 * пустая карта выглядела бы как запущенная квартира.
 */
export function roomHealth(state, roomId, now = today()) {
  const spots = spotsIn(state, roomId);
  if (!spots.length) return { share: null, due: 0, total: 0, worst: null };

  const known = spots.filter((s) => s.lastDone);
  const due = spots.filter((s) => isDue(s, now));
  const worst = sortByUrgency(spots.map(asDue), now, (s) => s.name)[0] ?? null;

  return {
    // Доля считается по тем, про кого известно. Пять неотмеченных поверхностей
    // и одна убранная — это не «всё в порядке», это одна убранная.
    share: known.length ? (known.length - due.length) / known.length : null,
    due: due.length,
    unknown: spots.length - known.length,
    total: spots.length,
    worst: worst ? spots.find((s) => s.id === worst.id) : null,
  };
}

/** Всё, до чего пора, по всей квартире — то, ради чего экран вообще открывают. */
export function dueEverywhere(state, now = today()) {
  return sortByUrgency(alive(state).filter((s) => isDue(s, now)).map(asDue), now, (s) => s.name)
    .map((d) => alive(state).find((s) => s.id === d.id))
    .filter(Boolean);
}

/* ---------- план на вечер ---------- */

/**
 * Сколько это займёт.
 *
 * Не хронометраж, а порядок величины: раковину протирают, пол моют, окно моют
 * долго. Считается от цикла, потому что другого признака «сколько работы» в
 * данных нет, а спрашивают всегда одно — «я успею до сериала?».
 */
export const minutesOf = (spot) => {
  const n = spot.every ?? 7;
  if (n <= 2) return 5;
  if (n <= 7) return 10;
  if (n <= 30) return 20;
  return 40;
};

/**
 * План на вечер: что пора, по комнатам, с честной оценкой времени.
 *
 * По комнатам, а не одним списком по срочности: убирают комнату целиком —
 * тряпка уже в руке, и метаться из кухни в ванную и обратно ради двух
 * просроченных поверхностей никто не станет.
 *
 * Комнаты идут по тому, где хуже: сначала та, где просрочено больше всего.
 */
export function plan(state, now = today()) {
  const due = dueEverywhere(state, now);
  const rooms = roomsOf(state);
  const named = new Map(rooms.map((r) => [r.id, r.name]));

  const groups = [];
  for (const spot of due) {
    const key = spot.room ?? "";
    let group = groups.find((g) => g.id === key);
    if (!group) {
      group = { id: key, name: named.get(key) ?? "без комнаты", rows: [], minutes: 0 };
      groups.push(group);
    }
    group.rows.push(spot);
    group.minutes += minutesOf(spot);
  }

  const order = rooms.map((r) => r.id);
  groups.sort((a, b) => b.rows.length - a.rows.length || order.indexOf(a.id) - order.indexOf(b.id));

  return { groups, minutes: groups.reduce((n, g) => n + g.minutes, 0), count: due.length };
}

/** Время словами: «полчаса» понятнее, чем «31 минута». */
export function saidMinutes(minutes) {
  if (!minutes) return "нисколько";
  if (minutes < 15) return `${minutes} минут`;
  if (minutes < 25) return "минут двадцать";
  if (minutes < 40) return "полчаса";
  if (minutes < 70) return "около часа";
  return `часа ${Math.round(minutes / 60)}`;
}
