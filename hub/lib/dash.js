// Приборная панель дома: что показывать на пульте и откуда это берётся.
//
// Пульт был меню — пять плиток и стопка панелей. Стало приборной панелью:
// время, пространство, шкалы, приложения и щиток. Здесь только счёт, без
// разметки, — чтобы на каждое число можно было написать тест, а не сверять
// глазами на экране.
//
// Правило то же, что во всех приложениях: ничего не выдумывать. Нет данных —
// блок молчит или честно говорит, чего не хватает; выдуманный ноль хуже, чем
// признание, что мерить нечем.

import { DAY, today, daysBetween, plural } from "../../core/time.js";

/* ---------- время ---------- */

/** Часы, к которым приложение привязывает приёмы пищи. Ужин в 19, а не «вечером». */
const SLOT_HOUR = { завтрак: 8, обед: 13, ужин: 19 };

/**
 * Ось дня: что уже было, что просит сейчас, что вечером.
 *
 * Часа нет почти ни у чего — ни у покупок, ни у уборки, — и придумывать его
 * значило бы рисовать расписание, которого человек не составлял. Поэтому у
 * записи есть либо настоящий час (приём пищи, срок дела), либо место в одной из
 * трёх куч: было · сейчас · вечером.
 */
export function dayAxis(all, urgent = [], now = today(), hour = new Date().getHours()) {
  const rows = [];

  for (const meal of (all.kitchen?.meals ?? []).filter((m) => m.date === now)) {
    rows.push({
      at: SLOT_HOUR[meal.slot] ?? null,
      when: "было",
      said: meal.title,
      note: meal.cost ? `${Math.round(meal.cost)} ₴` : meal.source,
      app: "Кухня",
    });
  }

  /* Срочное берётся не своим счётом, а тем же, которым живёт лента: иначе на
     экране получаются два ответа на один вопрос, и один из них — пустой. Так и
     вышло в первый же день на настоящих данных: ось говорила «день чистый», а
     под ней лежали четыре просроченные строки. */
  for (const row of urgent) {
    rows.push({
      at: null,
      when: row.left <= 0 ? "сейчас" : "вечером",
      said: row.name,
      note: row.note,
      app: row.app,
      tone: row.left <= 0 ? "hot" : "warm",
      href: row.href,
      act: row.act ?? null,
      index: row.index,
    });
  }

  const order = { было: 0, сейчас: 1, вечером: 2 };
  return rows.sort((a, b) => {
    const byWhen = order[a.when] - order[b.when];
    if (byWhen) return byWhen;
    return (a.at ?? 99) - (b.at ?? 99);
  }).map((r) => ({ ...r, past: r.when === "было" && r.at != null && r.at < hour }));
}

/* ---------- пространство ---------- */

/**
 * Комната как одно состояние.
 *
 * Уборка знает, что в комнате пора мыть; Вещи знают, что в ней лежит и у чего
 * кончается гарантия. Обе половины про одно и то же место, и на плане они
 * должны светиться одним пятном, а не двумя.
 */
export function roomState(room, { clean, things }, now = today()) {
  const spots = (clean?.spots ?? []).filter((s) => !s.deleted && s.room === room.id);
  const overdue = spots.filter((s) => s.lastDone && s.every && daysBetween(now, s.lastDone + s.every * DAY) < 0);
  const deep = overdue.filter((s) => daysBetween(s.lastDone + s.every * DAY, now) > s.every);

  const here = (things?.things ?? []).filter((t) => !t.deleted && !t.gone && t.place === room.name);
  const warranty = here.filter((t) => t.warrantyUntil && daysBetween(now, t.warrantyUntil) >= 0 && daysBetween(now, t.warrantyUntil) <= 30);

  const said = [
    overdue.length ? overdue.slice(0, 2).map((s) => s.name).join(", ") : null,
    warranty.length ? `гарантия · ${warranty[0].name}` : null,
  ].filter(Boolean).join(" · ");

  return {
    id: room.id,
    name: room.name,
    row: room.row ?? 1,
    col: room.col ?? 1,
    w: room.w ?? 1,
    tone: deep.length ? "hot" : overdue.length || warranty.length ? "warm" : spots.length ? "ok" : "none",
    said: said || (spots.length ? "в порядке" : "ничего не описано"),
    spots: spots.length,
    things: here.length,
  };
}

/* ---------- шкалы ---------- */

/**
 * Три числа, за которыми стоит весь дом.
 *
 * У каждой шкалы свой знаменатель, и он честный: чистота считается только по
 * тем поверхностям, про которые вообще известно, когда их убирали. Пять
 * неотмеченных и одна убранная — это не «17% чисто», это одна убранная.
 */
export function gauges({ kitchen, clean, projects }, now = today()) {
  const stock = (kitchen?.stock ?? []).filter((i) => !i.deleted && !i.empty);
  const burning = stock.filter((i) => {
    const at = i.expires ?? (i.boughtAt && i.shelfDays ? i.boughtAt + i.shelfDays * DAY : null);
    return at != null && daysBetween(now, at) <= 1;
  });

  const spots = (clean?.spots ?? []).filter((s) => !s.deleted);
  const known = spots.filter((s) => s.lastDone && s.every);
  const due = known.filter((s) => daysBetween(now, s.lastDone + s.every * DAY) < 0);

  const rows = (projects?.board?.проекты ?? []).filter((p) => !["готово", "закрыт"].includes(p.статус));
  const milestones = rows.reduce((n, p) => n + (p.вехи_всего ?? 0), 0);
  const closed = rows.reduce((n, p) => n + (p.вехи_закрыто ?? 0), 0);

  return [
    {
      key: "склад",
      value: stock.length ? Math.round(100 * (stock.length - burning.length) / stock.length) : null,
      said: stock.length ? `${stock.length} ${plural(stock.length, "позиция", "позиции", "позиций")}, ${burning.length} горит` : "склад пуст",
      tone: burning.length ? "warm" : "ok",
    },
    {
      key: "чистота",
      value: known.length ? Math.round(100 * (known.length - due.length) / known.length) : null,
      said: known.length ? `${due.length} из ${known.length} ждут` : "ни одной отметки",
      tone: due.length > known.length / 2 ? "hot" : due.length ? "warm" : "ok",
    },
    {
      key: "проекты",
      value: milestones ? Math.round(100 * closed / milestones) : null,
      said: rows.length ? `${rows.length} в работе, вех ${closed} из ${milestones}` : "снимок не приезжал",
      tone: "ok",
    },
  ];
}

/* ---------- активность ---------- */

/**
 * Сколько записей трогали в каждую из последних недель.
 *
 * Метка времени есть у каждой записи в каждом приложении — по ней и считается,
 * без отдельного журнала. Неделя, в которую ничего не трогали, честно нулевая:
 * это и есть провал, который видно в полоске.
 */
export function activityWeeks(items, { weeks = 26, now = Date.now() } = {}) {
  const out = new Array(weeks).fill(0);
  const week = 7 * DAY;

  for (const item of items ?? []) {
    const at = item?.at ?? null;
    if (!at) continue;
    const back = Math.floor((now - at) / week);
    if (back < 0 || back >= weeks) continue;
    out[weeks - 1 - back] += 1;
  }

  return out;
}

/** Строка приложения: тон, число, что сказать и полоска активности. */
export function appRow(entry, seen, now = today()) {
  if (!seen) return { key: entry.key, name: entry.name, tone: "none", said: "не открывали на этом устройстве", value: null, spark: [] };

  const s = seen.state;
  const items = s.stock ?? s.spots ?? s.things ?? s.places ?? s.edits ?? [];

  return {
    key: entry.key,
    name: entry.name,
    said: seen.summary || "пусто",
    value: (entry.urgent?.(s, now) ?? []).length,
    tone: (entry.urgent?.(s, now) ?? []).some((r) => r.left <= 0) ? "hot" : (entry.urgent?.(s, now) ?? []).length ? "warm" : "ok",
    spark: activityWeeks(items, { weeks: 7 }),
    pending: seen.pending,
  };
}

/* ---------- неделя ---------- */

/** Сколько дел и уборок приходится на каждый день недели, начиная с понедельника. */
export function weekAhead({ clean, projects }, now = today()) {
  const shift = (new Date(now).getUTCDay() + 6) % 7;
  const start = now - shift * DAY;
  const days = Array.from({ length: 7 }, (_, i) => ({ at: start + i * DAY, count: 0, today: start + i * DAY === now }));

  for (const deed of (projects?.board?.дела ?? [])) {
    if (deed.сделано || !deed.срок) continue;
    const at = Date.parse(deed.срок);
    const cell = days.find((d2) => d2.at === at);
    if (cell) cell.count += 1;
  }

  for (const spot of (clean?.spots ?? [])) {
    if (spot.deleted || !spot.lastDone || !spot.every) continue;
    const at = spot.lastDone + spot.every * DAY;
    const cell = days.find((d2) => d2.at === at);
    if (cell) cell.count += 1;
  }

  return days;
}
