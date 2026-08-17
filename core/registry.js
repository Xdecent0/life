// The list of apps, and what can be known about one without running it.
//
// Every app on this account is served from a single origin, which means one
// localStorage for all of them. That is what makes a hub cheap: it reads each
// app's own saved state where the app left it, so a tile can say "12 позиций,
// 3 правки не отправлено" without the app being open.
//
// Adding an app is a row here plus a folder. There is no plugin protocol,
// because four apps do not need one.

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
      const alive = (state.stock ?? []).filter((i) => !i.deleted && !i.empty).length;
      const list = (state.list ?? []).filter((i) => !i.deleted && !i.done).length;
      return [
        alive ? `${alive} на складе` : null,
        list ? `${list} в списке` : null,
      ].filter(Boolean).join(" · ");
    },
  },
  {
    key: "things",
    name: "Вещи",
    what: "Техника, гарантии, где что лежит",
    href: "../apps/things/",
    icon: "i-shelf",
    ready: true,
    count: (state) => {
      const alive = (state.things ?? []).filter((t) => !t.deleted && !t.gone);
      const warranty = alive.filter((t) => t.warrantyUntil).length;
      return [alive.length ? `${alive.length} вещей` : null, warranty ? `${warranty} с гарантией` : null].filter(Boolean).join(" · ");
    },
  },
  {
    key: "clean",
    name: "Уборка",
    what: "Карта дома: что убрано и до чего пора",
    href: "../apps/clean/",
    icon: "i-check",
    ready: true,
    count: (state) => {
      const spots = (state.spots ?? []).filter((s) => !s.deleted);
      if (!spots.length) return "дом ещё не описан";
      const day = 86400000;
      const now = Math.floor(Date.now() / day) * day;
      const due = spots.filter((s) => s.lastDone && s.every && s.lastDone + s.every * day < now).length;
      return due ? `${due} ждёт` : `${spots.length} поверхностей, всё в порядке`;
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
      const all = (state.places ?? []).filter((p) => !p.deleted);
      const been = all.filter((p) => (p.visits ?? []).length).length;
      return all.length ? `${all.length - been} хочу · ${been} был` : "пусто";
    },
  },
];

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
