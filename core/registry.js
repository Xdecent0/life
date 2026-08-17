// The list of apps, and what can be known about one without running it.
//
// Every app on this account is served from a single origin, which means one
// localStorage for all of them. That is what makes a hub cheap: it reads each
// app's own saved state where the app left it, so a tile can say "12 позиций,
// 3 правки не отправлено" without the app being open — and so one feed can say
// what is urgent across all four without opening any of them.
//
// The arithmetic here is core/time.js, the same one the apps run on. What each
// app contributes is the vocabulary: which field holds a date, and what the
// answer is called when it comes due.
//
// Adding an app is a row here plus a folder. There is no plugin protocol,
// because four apps do not need one.

import { DAY, today, daysBetween, freshness, expiryLabel } from "./time.js";

const alive = (rows = []) => rows.filter((r) => !r.deleted);

/** Overdue or due within `soon` days, given a field holding the moment it is due. */
const dueBy = (at, now, soon) => at != null && daysBetween(now, at) <= soon;

export const APPS = [
  {
    key: "kitchen",
    name: "Кухня",
    what: "Что есть дома и что купить",
    href: "../apps/kitchen/",
    icon: "i-carton",
    ready: true,

    /** How this app's saved state answers "how much is in it". */
    count: (state) => {
      const stock = alive(state.stock).filter((i) => !i.empty).length;
      const list = alive(state.list).filter((i) => !i.done).length;
      return [stock ? `${stock} на складе` : null, list ? `${list} в списке` : null]
        .filter(Boolean)
        .join(" · ");
    },

    urgent: (state, now) =>
      alive(state.stock)
        .filter((i) => !i.empty)
        .map((item) => ({ item, left: freshness(item, now).left }))
        .filter(({ left }) => left != null && left <= 3)
        .map(({ item, left }) => ({
          left,
          name: item.product,
          note: expiryLabel(item, now, { gone: "просрочено", zero: "сегодня последний день", one: "до завтра" }),
          href: `#item/${item.id}`,
        })),

    search: (state, hit) => [
      ...alive(state.stock).filter((i) => hit(i.product)).map((i) => ({
        name: i.product,
        note: i.empty ? "кончилось" : [i.qty, i.zone].filter(Boolean).join(" · "),
        href: `#item/${i.id}`,
      })),
      ...alive(state.list).filter((i) => hit(i.product)).map((i) => ({
        name: i.product,
        note: i.done ? "в списке, взято" : "в списке",
        href: "#list",
      })),
    ],
  },

  {
    key: "things",
    name: "Вещи",
    what: "Техника, гарантии, где что лежит",
    href: "../apps/things/",
    icon: "i-shelf",
    ready: true,

    count: (state) => {
      const things = alive(state.things).filter((t) => !t.gone);
      const warranty = things.filter((t) => t.warrantyUntil).length;
      return [things.length ? `${things.length} вещей` : null, warranty ? `${warranty} с гарантией` : null]
        .filter(Boolean)
        .join(" · ");
    },

    /* A month, not three days: a guarantee that ends tomorrow is already too
       late to do anything about, which is the opposite of milk. */
    urgent: (state, now) =>
      alive(state.things)
        .filter((t) => !t.gone && dueBy(t.warrantyUntil, now, 30))
        .map((t) => ({
          left: daysBetween(now, t.warrantyUntil),
          name: t.name,
          note: `гарантия · ${expiryLabel({ expires: t.warrantyUntil }, now, { gone: "кончилась", zero: "сегодня последний день", one: "до завтра", long: true })}`,
          href: `#thing/${t.id}`,
        })),

    search: (state, hit) =>
      alive(state.things)
        .filter((t) => hit(t.name) || hit(t.note) || hit(t.serial))
        .map((t) => ({
          name: t.name,
          note: [t.gone ? "нет уже" : t.place, t.kind].filter(Boolean).join(" · "),
          href: `#thing/${t.id}`,
        })),
  },

  {
    key: "clean",
    name: "Уборка",
    what: "Карта дома: что убрано и до чего пора",
    href: "../apps/clean/",
    icon: "i-check",
    ready: true,

    count: (state) => {
      const spots = alive(state.spots);
      if (!spots.length) return "дом ещё не описан";
      const due = spots.filter((s) => nextClean(s) != null && nextClean(s) < today()).length;
      return due ? `${due} ждёт` : `${spots.length} поверхностей, всё в порядке`;
    },

    urgent: (state, now) => {
      const rooms = new Map((state.rooms ?? []).map((r) => [r.id, r.name]));
      return alive(state.spots)
        .map((spot) => ({ spot, at: nextClean(spot) }))
        .filter(({ at }) => at != null && at <= now)
        .map(({ spot, at }) => ({
          left: daysBetween(now, at),
          name: spot.name,
          note: [rooms.get(spot.room), overdueLabel(daysBetween(at, now))].filter(Boolean).join(" · "),
          href: `#spot/${spot.id}`,
        }));
    },

    search: (state, hit) => {
      const rooms = new Map((state.rooms ?? []).map((r) => [r.id, r.name]));
      return alive(state.spots)
        .filter((s) => hit(s.name) || hit(rooms.get(s.room)))
        .map((s) => ({ name: s.name, note: rooms.get(s.room) ?? "", href: `#spot/${s.id}` }));
    },
  },

  {
    key: "places",
    name: "Места",
    what: "Куда сходить и куда уже ходил",
    href: "../apps/places/",
    icon: "i-store",
    ready: true,

    count: (state) => {
      const all = alive(state.places);
      const been = all.filter((p) => (p.visits ?? []).length).length;
      return all.length ? `${all.length - been} хочу · ${been} был` : "пусто";
    },

    /* Only where a cycle was set on purpose. A museum visited once is not
       overdue — it simply has no rhythm, and inventing one would nag. */
    urgent: (state, now) =>
      alive(state.places)
        .map((place) => ({ place, at: nextVisit(place) }))
        .filter(({ at }) => at != null && at <= now)
        .map(({ place, at }) => ({
          left: daysBetween(now, at),
          name: place.name,
          note: ["зовёт обратно", place.area].filter(Boolean).join(" · "),
          href: `#place/${place.id}`,
        })),

    search: (state, hit) =>
      alive(state.places)
        .filter((p) => hit(p.name) || hit(p.area) || hit(p.note))
        .map((p) => ({
          name: p.name,
          note: [(p.visits ?? []).length ? "был" : "хочу сходить", p.area].filter(Boolean).join(" · "),
          href: `#place/${p.id}`,
        })),
  },
];

const nextClean = (spot) => (spot.lastDone && spot.every ? spot.lastDone + spot.every * DAY : null);
const nextVisit = (place) => {
  const visits = place.visits ?? [];
  return visits.length && place.every ? Math.max(...visits) + place.every * DAY : null;
};

const overdueLabel = (days) => (days <= 0 ? "пора" : `просрочено на ${days} дн.`);

/**
 * What an app's own storage says about itself, without loading the app.
 *
 * Returns null rather than a guess when nothing is saved — an app that has never
 * been opened on this device should say so, not show a confident zero.
 */
export function peek(entry) {
  if (!entry.ready) return null;

  try {
    const raw = localStorage.getItem(`${entry.key}.state.v1`);
    if (!raw) return null;

    const state = JSON.parse(raw);
    return {
      state,
      summary: entry.count?.(state) ?? "",
      pending: (state.queue ?? []).length,
      syncedAt: state.syncedAt ?? null,
      demo: Boolean(state.demo),
      bytes: raw.length,
    };
  } catch {
    return null;
  }
}

/**
 * Everything overdue or about to be, across every app, soonest first.
 *
 * Four apps meant four visits to find out whether anything needed doing today,
 * which is three more than anyone makes. The data was already here — every app
 * writes to the same localStorage, and the arithmetic was already shared.
 */
export function urgentEverywhere(now = today()) {
  const out = [];

  for (const entry of APPS) {
    const seen = peek(entry);
    if (!seen || seen.demo) continue;

    for (const row of entry.urgent?.(seen.state, now) ?? []) {
      out.push({ ...row, app: entry.name, appKey: entry.key, href: entry.href + row.href, icon: entry.icon });
    }
  }

  return out.sort((a, b) => a.left - b.left);
}

/**
 * One search across all four. Matching is on what a person would type — a
 * fragment, lower case, no regard for where in the word it falls.
 */
export function searchEverywhere(query) {
  const needle = String(query ?? "").trim().toLowerCase();
  if (needle.length < 2) return [];

  const hit = (value) => String(value ?? "").toLowerCase().includes(needle);
  const out = [];

  for (const entry of APPS) {
    const seen = peek(entry);
    if (!seen) continue;

    for (const row of entry.search?.(seen.state, hit) ?? []) {
      out.push({ ...row, app: entry.name, appKey: entry.key, href: entry.href + row.href, icon: entry.icon });
    }
  }

  return out;
}
