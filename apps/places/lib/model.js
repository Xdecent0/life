// Места: куда хочется сходить и куда уже ходил.
//
// Две половины одного списка, а не два списка. Место переходит из «хочу» в «был»
// одним нажатием, и с этого момента у него появляется история — сколько раз и
// когда в последний. Любимое место с циклом снова начинает звать: «давно не был»
// считается тем же кодом, что «пора помыть пол» и «кончается молоко».

import { today, daysBetween, plural, freshness, sortByUrgency } from "../../../core/time.js";

export { today, daysBetween, plural, sortByUrgency };

/** Виды мест и по каким словам они узнаются в названии. */
export const SEED_KINDS = [
  { order: 1, name: "еда", items: ["кафе", "кофе", "ресторан", "бар", "паб", "пицц", "суши", "бургер", "пекарн", "столов"] },
  { order: 2, name: "прогулка", items: ["парк", "сквер", "набережн", "лес", "озер", "пляж", "сад", "гор"] },
  { order: 3, name: "культура", items: ["музе", "театр", "галере", "кино", "выставк", "концерт", "библиотек"] },
  { order: 4, name: "спорт", items: ["зал", "бассейн", "корт", "скал", "каток", "стадион", "трасс"] },
  { order: 5, name: "дела", items: ["сервис", "мастерск", "поликлин", "банк", "почт", "барбершоп", "салон"] },
  { order: 6, name: "поездка", items: ["город", "село", "остров", "страна"] },
  { order: 7, name: "прочее", items: [] },
];

export const alive = (state) => (state.places ?? []).filter((p) => !p.deleted);

/** Куда ещё не ходил, но собирался. */
export const wanted = (state) => alive(state).filter((p) => !visitsOf(p).length);

/** Где уже был хотя бы раз. */
export const visited = (state) => alive(state).filter((p) => visitsOf(p).length);

export const visitsOf = (place) => (place?.visits ?? []).filter(Boolean);

export const lastVisit = (place) => {
  const all = visitsOf(place);
  return all.length ? Math.max(...all) : null;
};

/** Вид места: что сказал человек, иначе догадка по названию. */
export function kindOf(place, kinds) {
  if (place?.kind) {
    const known = kinds.find((k) => k.name === place.kind);
    return known ?? { order: 98, name: place.kind };
  }

  const key = (place?.name ?? "").toLowerCase();
  const hit = kinds.find((k) => k.items.some((i) => key.includes(i)));
  return hit ?? { order: 99, name: "прочее" };
}

/**
 * Место как запись со сроком — но только если ты сам попросил напоминать.
 *
 * У большинства мест цикла нет и быть не должно: музей, в котором был однажды,
 * не «просрочен». Цикл ставится тем немногим, куда правда хочется возвращаться.
 */
export function asDue(place) {
  const last = lastVisit(place);
  return {
    ...place,
    boughtAt: last,
    shelfDays: place.every ?? null,
    expires: last && place.every ? last + place.every * 86400000 : null,
  };
}

export const callsBack = (place, now = today()) => {
  if (!place.every || !lastVisit(place)) return false;
  const { left } = freshness(asDue(place), now);
  return left != null && left < 0;
};

/** Сколько раз и когда в последний — одной строкой. */
export function historyLabel(place, now = today()) {
  const n = visitsOf(place).length;
  if (!n) return "ещё не был";

  const last = lastVisit(place);
  const days = daysBetween(last, now);
  const when = days <= 0 ? "сегодня" : days === 1 ? "вчера"
    : days < 60 ? `${days} ${plural(days, "день", "дня", "дней")} назад`
    : days < 730 ? `${Math.round(days / 30)} ${plural(Math.round(days / 30), "месяц", "месяца", "месяцев")} назад`
    : `${Math.round(days / 365)} ${plural(Math.round(days / 365), "год", "года", "лет")} назад`;

  return n === 1 ? `был раз · ${when}` : `${n} ${plural(n, "раз", "раза", "раз")} · ${when}`;
}

export function everyLabel(place) {
  const n = place.every;
  if (!n) return "";
  if (n === 7) return "хочу раз в неделю";
  if (n === 30) return "хочу раз в месяц";
  if (n === 90) return "хочу раз в сезон";
  if (n === 365) return "хочу раз в год";
  return `хочу раз в ${n} ${plural(n, "день", "дня", "дней")}`;
}

/**
 * Оценка звёздами, но по делу: понравилось — вернусь, нет — вычеркну.
 * Ноль означает «не оценивал», а не «плохо».
 */
export const STARS = [1, 2, 3, 4, 5];

export function groupBy(places, how, { kinds = [] } = {}, now = today()) {
  if (how === "kind") {
    const map = new Map();
    for (const place of places) {
      const kind = kindOf(place, kinds);
      if (!map.has(kind.name)) map.set(kind.name, { ...kind, entries: [] });
      map.get(kind.name).entries.push(place);
    }
    return [...map.values()].sort((a, b) => a.order - b.order).map((g) => ({ name: g.name, entries: g.entries }));
  }

  if (how === "area") {
    const map = new Map();
    for (const place of places) {
      const area = (place.area ?? "").trim() || "без района";
      if (!map.has(area)) map.set(area, { name: area, entries: [] });
      map.get(area).entries.push(place);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }

  // По состоянию: то, ради чего список и заводят.
  const groups = [
    { name: "зовёт обратно", entries: places.filter((p) => callsBack(p, now)) },
    { name: "хочу сходить", entries: places.filter((p) => !visitsOf(p).length) },
    { name: "был", entries: places.filter((p) => visitsOf(p).length && !callsBack(p, now)) },
  ];
  return groups.filter((g) => g.entries.length);
}

/** Лучшее из того, где был: оценка сначала, потом свежесть. */
export function best(places, limit = 5) {
  return [...places]
    .filter((p) => p.rating)
    .sort((a, b) => (b.rating - a.rating) || ((lastVisit(b) ?? 0) - (lastVisit(a) ?? 0)))
    .slice(0, limit);
}
