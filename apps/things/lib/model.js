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

/** Сколько денег стоит за живыми гарантиями — то, что можно ещё вернуть. */
export const covered = (things, now = today()) =>
  worth(things.filter((t) => t.warrantyUntil && daysBetween(now, t.warrantyUntil) >= 0));
