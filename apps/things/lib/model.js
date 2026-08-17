// What a thing is, and the two questions the app exists to answer:
// «где оно лежит» и «гарантия ещё жива».
//
// Pure functions only. The counting-down part is core/time.js — a warranty and a
// shelf life are the same arithmetic, and this app proves it by not rewriting it.

import { today, daysBetween, plural, freshness, expiryLabel as label, sortByUrgency } from "../../../core/time.js";

export { today, daysBetween, plural, freshness, sortByUrgency };

/** Rooms and categories are vault tables; these are the starting rows. */
/* Те же комнаты, что и у Уборки, — до первого чтения общего справочника
   `Дом/Комнаты.md`. Ванная и туалет тоже места, где что-то лежит. */
export const SEED_PLACES = [
  { name: "кухня", icon: "i-carton" },
  { name: "комната", icon: "i-shelf" },
  { name: "ванная", icon: "i-veg" },
  { name: "туалет", icon: "i-veg" },
  { name: "коридор", icon: "i-store" },
  { name: "кладовка", icon: "i-stock" },
  { name: "балкон", icon: "i-veg" },
  { name: "с собой", icon: "i-store" },
];

export const SEED_KINDS = [
  { order: 1, name: "техника", items: ["ноутбук", "телефон", "наушник", "монитор", "мышь", "клавиатур", "роутер", "планшет", "камер", "часы"] },
  { order: 2, name: "бытовое", items: ["чайник", "пылесос", "утюг", "фен", "микроволнов", "холодильник", "стиральн"] },
  { order: 3, name: "инструмент", items: ["дрель", "отвёртк", "ключ", "молоток", "шуруповёрт", "пила"] },
  { order: 4, name: "мебель", items: ["стол", "стул", "шкаф", "полка", "кровать", "кресло"] },
  { order: 5, name: "одежда", items: ["куртк", "обувь", "ботинк", "кроссовк", "рюкзак", "сумк"] },
  { order: 6, name: "документы", items: ["паспорт", "договор", "страховк", "чек", "гарантийн"] },
  { order: 7, name: "прочее", items: [] },
];

/** Warranty runs from the purchase, so a thing needs both to count anything down. */
export function withWarranty(thing) {
  return {
    ...thing,
    expires: thing.warrantyUntil ?? null,
    boughtAt: thing.boughtAt ?? null,
    shelfDays: null,
  };
}

/**
 * How the guarantee is doing, in words a person would use about a guarantee.
 *
 * A thing with no warranty date is not broken data — most things do not have one
 * — so it says nothing rather than «срок неизвестен», which would read as a
 * problem to fix.
 */
export function warrantyLabel(thing, now = today()) {
  if (!thing.warrantyUntil) return "";
  return label(withWarranty(thing), now, {
    long: true,
    gone: "гарантия кончилась",
    zero: "гарантия кончается сегодня",
    one: "гарантия до завтра",
    unknown: "",
  });
}

/**
 * Гарантия, которая должна дёргать прямо сейчас.
 *
 * «Кончается через три недели» — не задача: посмотрел, решил, что вещь цела, и
 * дальше оно напоминает ещё двадцать дней подряд. Такое напоминание учат
 * игнорировать, и вместе с ним игнорируют настоящее.
 *
 * Поэтому «разобрался» гасит строку — но только до последней недели: там
 * напомнить надо ещё раз, даже если человек уже смотрел. Это единственный
 * момент, когда решение ещё можно принять, а завтра уже нет.
 */
export const WARRANTY_LAST = 7;

export function warrantyNags(thing, now = today()) {
  if (!warrantyRunningOut(thing, now)) return false;
  const left = daysBetween(now, thing.warrantyUntil);
  if (left <= WARRANTY_LAST) return true;
  return !thing.warrantySeen;
}

/** Under a month left, and not already gone: the window where doing something still works. */
export function warrantyRunningOut(thing, now = today()) {
  if (!thing.warrantyUntil) return false;
  const left = daysBetween(now, thing.warrantyUntil);
  return left >= 0 && left <= 30;
}

export const alive = (state) => (state.things ?? []).filter((t) => !t.deleted && !t.gone);

/** The kind a thing belongs to: what the person said, or a guess from the name. */
export function kindOf(thing, kinds) {
  if (thing?.kind) {
    const known = kinds.find((k) => k.name === thing.kind);
    return known ?? { order: 98, name: thing.kind };
  }

  const key = (thing?.name ?? "").toLowerCase();
  const hit = kinds.find((k) => k.items.some((i) => key.includes(i)));
  return hit ?? { order: 99, name: "прочее" };
}

export function groupBy(things, how, { kinds = [], places = [] } = {}, now = today()) {
  if (how === "place") {
    const named = places.map((p) => p.name);
    const groups = named.map((name) => ({ name, entries: things.filter((t) => t.place === name) }));
    const homeless = things.filter((t) => !named.includes(t.place));
    if (homeless.length) groups.push({ name: "без места", entries: homeless });
    return groups.filter((g) => g.entries.length);
  }

  if (how === "kind") {
    const map = new Map();
    for (const thing of things) {
      const kind = kindOf(thing, kinds);
      if (!map.has(kind.name)) map.set(kind.name, { ...kind, entries: [] });
      map.get(kind.name).entries.push(thing);
    }
    return [...map.values()].sort((a, b) => a.order - b.order).map((g) => ({ name: g.name, entries: g.entries }));
  }

  // By warranty: the only ordering where the app has an opinion about what matters.
  return [{ name: null, entries: sortByUrgency(things.map(withWarranty), now, (t) => t.name).map((t) => things.find((x) => x.id === t.id)) }];
}

/** What the whole lot cost, for the one screen that asks. */
export function worth(things) {
  return things.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
}

/* ---------- гарантии ---------- */

/** Месяц — окно, в котором ещё можно успеть сходить, пока меняют. */
export const WARRANTY_SOON = 30;

/**
 * Гарантии по срокам: горит · кончилась · есть ещё · без гарантии.
 *
 * Данные лежали с самого начала, а показывались одной подсветкой в общем списке,
 * то есть отвечали только на «эта вещь ещё на гарантии?». Вопрос, ради которого
 * гарантии вообще записывают, другой: «по чему я успеваю сходить прямо сейчас».
 *
 * «Без гарантии» — не мусорная корзина: туда попадает только то, что дороже
 * порога. Ложка без гарантии — это норма, а ноутбук без неё — забытое поле.
 */
export function warranties(things, now = today(), { rich = 1000 } = {}) {
  const left = (t) => daysBetween(now, t.warrantyUntil);
  const withDate = things.filter((t) => t.warrantyUntil);

  const soon = withDate.filter((t) => left(t) >= 0 && left(t) <= WARRANTY_SOON);
  const gone = withDate.filter((t) => left(t) < 0);
  const long = withDate.filter((t) => left(t) > WARRANTY_SOON);
  const none = things.filter((t) => !t.warrantyUntil && Number(t.price) >= rich);

  const byLeft = (a, b) => left(a) - left(b);

  return [
    { key: "soon", name: "Кончается", note: "успеть, пока меняют", rows: soon.sort(byLeft) },
    { key: "gone", name: "Кончилась", note: "чинить теперь за свои", rows: gone.sort(byLeft).reverse() },
    { key: "long", name: "Ещё есть", note: "лежит и ждёт", rows: long.sort(byLeft) },
    { key: "none", name: "Без гарантии", note: `дороже ${rich} — а даты нет`, rows: none.sort((a, b) => (b.price ?? 0) - (a.price ?? 0)) },
  ].filter((g) => g.rows.length);
}

/* ---------- сколько служат ---------- */

/**
 * Вещи, которых больше нет, — не мусор в файле, а единственный источник правды
 * о том, сколько такое живёт.
 *
 * «Больше нет» ставится с самого начала и пишет `goneAt`; вместе с `куплено`
 * это готовый срок службы. Приложение хранило обе даты и не задавало им ни
 * одного вопроса — при том что вопрос всегда один и тот же: чинить или менять.
 */

/** Сколько дней вещь у тебя: до ухода, а если ещё здесь — до сегодня. */
export function ageOf(thing, now = today()) {
  if (!thing?.boughtAt) return null;
  const end = thing.gone && thing.goneAt ? thing.goneAt : now;
  const days = daysBetween(thing.boughtAt, end);
  return days >= 0 ? days : null;
}

/** Во сколько обходится день владения — единственная честная цена сравнения. */
export function perDay(thing, now = today()) {
  const days = ageOf(thing, now);
  const price = Number(thing?.price) || 0;
  if (!price || !days) return null;
  return price / days;
}

const median = (nums) => {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

/** Две ушедшие вещи — это уже ряд; одна — это история одной вещи. */
export const SERVED_FLOOR = 2;

/**
 * Сколько прожили ушедшие вещи каждого вида.
 *
 * Медиана, а не среднее: одна вещь, выброшенная через неделю после покупки,
 * не должна утверждать, что такие живут полгода.
 */
export function lifespans(things, kinds = [], now = today()) {
  const out = new Map();

  for (const thing of things) {
    if (thing.deleted || !thing.gone) continue;
    const days = ageOf(thing, now);
    if (days == null) continue;

    const kind = kindOf(thing, kinds).name;
    if (!out.has(kind)) out.set(kind, { kind, days: [], names: [] });
    out.get(kind).days.push(days);
    out.get(kind).names.push(thing.name);
  }

  return new Map([...out].map(([kind, g]) => [kind, {
    kind,
    times: g.days.length,
    median: median(g.days),
    names: g.names,
  }]));
}

/**
 * Что прошлые такие вещи говорят про эту, или ничего.
 *
 * Молчит, пока ушедших меньше двух: на одной вещи это не ряд, а совпадение, и
 * фраза «такие живут два года» из одного примера — выдумка с точностью до
 * первого попавшегося случая.
 */
export function served(thing, things, kinds = [], now = today()) {
  const kind = kindOf(thing, kinds).name;
  const row = lifespans(things, kinds, now).get(kind);
  if (!row || row.times < SERVED_FLOOR) return null;

  const age = ageOf(thing, now);
  // «1.3 год» — не по-русски: с дробью всегда «года», и запятая, а не точка.
  const years = (d) => {
    if (d < 365) return `${d} ${plural(d, "день", "дня", "дней")}`;
    const n = d / 365;
    const whole = Math.round(n * 10) % 10 === 0;
    return whole
      ? `${Math.round(n)} ${plural(Math.round(n), "год", "года", "лет")}`
      : `${n.toFixed(1).replace(".", ",")} года`;
  };

  const said = `Прошлые «${kind}» уходили через ${years(row.median)} — по ${row.times} ${plural(row.times, "вещи", "вещам", "вещам")}`;
  if (age == null) return { said, over: null, median: row.median, times: row.times };

  const over = age - row.median;
  return {
    said,
    over,
    median: row.median,
    times: row.times,
    // Прожила дольше ряда — не «пора менять», а «ремонт уже не обидно»:
    // решение всё равно за человеком, приложение только показывает ряд.
    verdict: over >= 0
      ? `Эта служит дольше — ${years(age)}`
      : `Этой ${years(age)}, до ряда ещё ${years(-over)}`,
  };
}

/** Сколько денег стоит за живыми гарантиями — то, что можно ещё вернуть. */
export const covered = (things, now = today()) =>
  worth(things.filter((t) => t.warrantyUntil && daysBetween(now, t.warrantyUntil) >= 0));
