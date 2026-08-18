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

/* ---------- как ходится на самом деле ---------- */

/**
 * Стопка визитов лежит с первого дня и работает счётчиком.
 *
 * `visits` — это список дат, а спрашивали у него всегда только две вещи:
 * сколько их и какая последняя. Между тем ровно в промежутках между ними лежит
 * ответ на вопрос, ради которого ставят цикл: «хочу раз в месяц» — это
 * пожелание, а раз в сорок дней — то, как есть.
 */

/** Три визита — два промежутка. По одному промежутку ритма не видно. */
export const RHYTHM_FLOOR = 3;

/** Ближе трети — не спор: пожелание и жизнь сошлись достаточно. */
export const DRIFT_SHARE = 0.34;

const median = (nums) => {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

/**
 * Как часто туда ходят на самом деле — медиана промежутков.
 *
 * Медиана, а не среднее: один месяц болезни не должен объявлять, что в
 * любимую кофейню ходят раз в квартал.
 */
export function rhythm(place) {
  const days = [...new Set(visitsOf(place))].sort((a, b) => a - b);
  if (days.length < RHYTHM_FLOOR) return null;

  const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d)).filter((g) => g > 0);
  return gaps.length ? median(gaps) : null;
}

/**
 * Пожелание разошлось с жизнью.
 *
 * В Уборке такое значит «цикл врёт про пора». Здесь мягче и честнее: цикл тут
 * не норматив, а желание, и разошедшееся желание — повод не поправить число, а
 * заметить. Ходишь реже, чем хотел, — либо место не настолько твоё, либо не
 * стоило обещать себе каждую неделю.
 */
export function drift(place) {
  const real = rhythm(place);
  if (real == null || !place.every) return null;

  const off = real - place.every;
  if (Math.abs(off) < Math.max(1, Math.round(place.every * DRIFT_SHARE))) return null;

  return {
    real,
    every: place.every,
    off,
    said: off > 0
      ? `хотел раз в ${place.every}, выходит раз в ${real}`
      : `хотел раз в ${place.every}, а бываешь чаще — раз в ${real}`,
    fix: off > 0
      ? "либо место не настолько твоё, либо обещание было слишком частым"
      : "ритм звал бы реже, чем ты и так ходишь",
  };
}

/**
 * Ритм был — и оборвался.
 *
 * Это не то же самое, что «был однажды и давно»: туда ходили подряд, а потом
 * перестали, и разрыв больше двух своих же промежутков. Такое место либо
 * закрылось, либо разонравилось, либо про него просто забыли — и последнее
 * единственное, что стоит чинить.
 */
export function faded(place, now = today()) {
  const real = rhythm(place);
  const last = lastVisit(place);
  if (real == null || !last) return null;

  const since = daysBetween(last, now);
  if (since < real * 2) return null;

  return { real, since, times: visitsOf(place).length };
}

/**
 * Записал и не дошёл — со сроком давности.
 *
 * «Хочу сходить» без даты — вечный список, в котором любая строка выглядит
 * одинаково свежей. Возраст превращает список желаний в список решений:
 * четыре месяца без движения — это уже не план, а тихий укор, и честнее
 * вычеркнуть, чем носить.
 *
 * Тонкость, из-за которой здесь два слова вместо одного: `at` — это последняя
 * правка, а не появление записи. Сказать по нему «записано полгода назад»
 * значило бы соврать про любую строку, которую человек однажды открыл. Поэтому
 * у новых записей есть `addedAt`, и только они говорят «записано»; у старых
 * приложение честно говорит «без движения» — это ровно то, что оно знает.
 */
export const WISH_STALE = 120;

export function staleWishes(state, now = today(), { after = WISH_STALE } = {}) {
  return wanted(state)
    .map((place) => {
      const from = place.addedAt ?? place.at ?? null;
      return {
        place,
        days: from == null ? null : daysBetween(from, now),
        exact: place.addedAt != null,
      };
    })
    .filter((r) => r.days != null && r.days >= after)
    .sort((a, b) => b.days - a.days);
}

/** Как назвать этот возраст, чтобы не соврать. */
export const wishAge = (row) =>
  `${row.exact ? "записано" : "без движения"} ${row.days} ${plural(row.days, "день", "дня", "дней")}`;

/* ---------- куда сходить ---------- */

/**
 * Ответ на вопрос, ради которого приложение открывают вечером в пятницу.
 *
 * Общий список отвечает «что у меня записано», а спрашивают другое: куда пойти
 * сегодня. Порядок здесь — не алфавит и не рейтинг: сначала то, что само зовёт
 * обратно по своему ритму, потом то, куда собирались и так и не дошли, потом
 * любимое, где давно не был.
 *
 * Ничего не выдумывается: ритм ставит человек, «хочу» — это отсутствие визитов,
 * а «давно не был» считается от последнего похода, и только для мест с оценкой.
 */
export function toGo(state, now = today(), { stale = 90 } = {}) {
  const rows = alive(state);
  const since = (p) => {
    const at = lastVisit(p);
    return at ? daysBetween(at, now) : null;
  };

  const calls = rows.filter((p) => callsBack(p, now));
  const never = rows.filter((p) => !visitsOf(p).length);
  const missed = rows.filter((p) =>
    !calls.includes(p) && (p.rating ?? 0) >= 4 && (since(p) ?? 0) >= stale);

  /* Ритм оборвался — это не то же самое, что «был однажды и давно»: туда ходили
     подряд, а потом перестали. Такое место либо закрылось, либо разонравилось,
     либо про него забыли — и только последнее стоит чинить. */
  const stopped = rows.filter((p) => !calls.includes(p) && !missed.includes(p) && faded(p, now));

  return [
    { key: "calls", name: "Зовёт обратно", note: "по ритму, который ты сам поставил", rows: calls },
    { key: "stopped", name: "Перестал ходить", note: "ходил подряд, а потом перестал", rows: stopped },
    { key: "never", name: "Хотел и не дошёл", note: "записано, но ни разу", rows: never },
    { key: "missed", name: "Любимое, но давно", note: `четыре звезды и больше ${stale} дней тишины`, rows: missed },
  ].filter((g) => g.rows.length);
}

/** Районы, где такие места есть, — чтобы выбирать по «куда доеду». */
export const areasOf = (rows) =>
  [...new Set(rows.map((p) => (p.area ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
