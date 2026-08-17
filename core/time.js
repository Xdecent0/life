// Dates, and how much of something is left.
//
// A shelf life and a warranty are the same computation wearing different words:
// a date, the days between now and it, and a tone for how worried to look. The
// kitchen had this first; it stopped being the kitchen's the moment a second app
// needed to know when a guarantee runs out.

export const DAY = 86400000;

/** Midnight UTC of the local day — the unit everything here counts in. */
export function today(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(from, to) {
  return Math.round((to - from) / DAY);
}

export function plural(n, one, few, many) {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/**
 * When this thing runs out.
 *
 * An explicit date wins: it was read off a packet or a receipt, and no table
 * beats that. Otherwise it is the day it arrived plus however long its kind
 * lasts — and if neither is known, nothing is, which is an answer too.
 */
export function expiryOf(item) {
  if (item.expires) return item.expires;
  if (!item.boughtAt || item.shelfDays == null) return null;
  return item.boughtAt + item.shelfDays * DAY;
}

/**
 * The full run the meter measures against.
 *
 * Usually the reference figure. But a date set by hand can exist without one, so
 * the span from purchase to that date stands in — otherwise a hand-set date
 * would show its days and no bar.
 */
function span(item) {
  if (item.shelfDays) return item.shelfDays;
  if (item.expires && item.boughtAt) return Math.max(1, daysBetween(item.boughtAt, item.expires));
  return null;
}

/**
 * What is left as a 0..1 share, plus the tone the interface paints it in.
 *
 * The days and the bar are two different questions. A warranty entered without a
 * purchase date has a perfectly good answer to "how long left" and none at all
 * to "how far along" — tying the first to the second made such a record report
 * an unknown date while simultaneously counting as running out.
 */
export function freshness(item, now = today()) {
  const expires = expiryOf(item);
  if (expires == null) return { left: null, share: null, tone: "calm" };

  const left = daysBetween(now, expires);
  const total = span(item);
  const share = total ? Math.max(0, Math.min(1, left / total)) : null;
  const tone = left <= 1 ? "bad" : left <= 3 ? "warn" : "calm";
  return { left, share, tone };
}

export function isBurning(item, now = today()) {
  const { left } = freshness(item, now);
  return left != null && left <= 1;
}

/**
 * How long is left, in words.
 *
 * The words are the caller's because the same number means different things:
 * milk going off tomorrow is an emergency, a guarantee ending tomorrow is a
 * reason to make a phone call. `long` rounds to months and years, which reads
 * better for a warranty and worse for a carton — 325 дней is a real answer for
 * rice, «11 месяцев» is a shrug.
 */
export function expiryLabel(item, now = today(), words = {}) {
  const {
    unknown = "срок неизвестен",
    gone = "просрочено",
    zero = "сегодня последний день",
    one = "до завтра",
    long = false,
  } = words;

  const { left } = freshness(item, now);
  if (left == null) return unknown;
  if (left < 0) return gone;
  if (left === 0) return zero;
  if (left === 1) return one;
  if (!long || left < 60) return `${left} ${plural(left, "день", "дня", "дней")}`;

  const months = Math.round(left / 30);
  if (months < 24) return `${months} ${plural(months, "месяц", "месяца", "месяцев")}`;

  const years = Math.round(left / 365);
  return `${years} ${plural(years, "год", "года", "лет")}`;
}

/**
 * Soonest first, and anything without a date after everything that has one.
 *
 * Two records with no date at all are ordered by whatever the app calls a name,
 * so a list of things that never expire is still in a stable, readable order.
 */
export function sortByUrgency(items, now = today(), nameOf = (i) => i.product ?? i.name ?? "") {
  return [...items].sort((a, b) => {
    const la = freshness(a, now).left;
    const lb = freshness(b, now).left;
    if (la == null && lb == null) return String(nameOf(a)).localeCompare(String(nameOf(b)), "ru");
    if (la == null) return 1;
    if (lb == null) return -1;
    return la - lb;
  });
}
