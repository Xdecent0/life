// What was bought and never eaten.
//
// The app has recorded this from the first week: closing a product out asks
// whether it was eaten or thrown away, and the answer is kept on the record. It
// was read exactly once — to tighten the shelf-life table for that one product —
// and never added up. So the one number in the kitchen that is pure loss was the
// only one nobody was shown.
//
// Nothing here asks for new input. Everything is derived from records that are
// already lying in the state: the outcome, the day it closed, the day it was
// bought, and the last price a receipt saw for that name.

import * as M from "./model.js";
import { priceHistory } from "./planning.js";

/**
 * Beyond this the records are folded into plain tombstones by `foldClosed`, so
 * a report over a longer window would quietly count fewer and fewer throws the
 * further back it looked — and print a falling line as if things were improving.
 */
export const KEEP_DAYS = 90;

/** A single throw is an accident; the second one is a habit worth naming. */
const HABIT = 2;

/** Below this a share is arithmetic, not a fact about how the person shops. */
const SHARE_FLOOR = 5;

const key = (s) => String(s ?? "").toLowerCase().trim();

/** Last price a receipt saw for this name, whatever store it came from. */
function priceOf(receipts, product) {
  const rows = priceHistory(receipts, product);
  return rows.length ? rows[rows.length - 1].price : null;
}

function median(nums) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Records closed out with an explicit answer, inside the window.
 *
 * A position emptied by setting its level to «кончился» carries no outcome — the
 * person said the jar is empty, not what became of the contents. Those stay out
 * of both piles rather than being guessed into the eaten one.
 */
export function closings(stock, { days = 30, now = M.today() } = {}) {
  const since = now - (days - 1) * M.DAY;
  const threw = [];
  const used = [];

  for (const entry of stock) {
    if (!entry.outcome) continue;
    const closedAt = entry.closedAt ?? null;
    if (closedAt == null || closedAt < since) continue;
    (entry.outcome === "threw" ? threw : used).push(entry);
  }

  return { threw, used };
}

/**
 * How long a thrown record actually lived, when both ends are known.
 *
 * This is the number that separates the two different mistakes: something that
 * ran the whole shelf life and still was not eaten was bought in too large a
 * quantity, and something that went off early was stored wrong or the table
 * was too generous about it.
 */
function livedOf(entry) {
  if (!entry.boughtAt || !entry.closedAt) return null;
  const lived = M.daysBetween(entry.boughtAt, entry.closedAt);
  return lived >= 0 ? lived : null;
}

/**
 * One sentence about a product, or nothing at all.
 *
 * Silence is the right answer for a single throw: the app would be inventing a
 * pattern out of one bad week, and a person who is told off for one forgotten
 * cucumber stops reading everything else it says.
 */
export function verdict(row) {
  if (row.times < HABIT) return null;
  if (row.lived != null && row.shelfDays != null) {
    return row.lived >= row.shelfDays
      ? "доживает до конца срока и всё равно не съедается — бери меньше"
      : "портится раньше срока — другая зона хранения или меньшая упаковка";
  }
  return "выбрасываешь не в первый раз — бери меньше или реже";
}

/**
 * The whole report.
 *
 * Money is a sum of what is known, with the unpriced rows counted separately
 * rather than skipped in silence — «380 ₴» over half the throws is a different
 * statement from «380 ₴» over all of them, and the screen has to be able to say
 * which one it is showing.
 */
export function losses(state, { days = 30, now = M.today() } = {}) {
  const window_ = Math.min(days, KEEP_DAYS);
  const { threw, used } = closings(state.stock ?? [], { days: window_, now });

  const byProduct = new Map();
  for (const entry of threw) {
    const k = key(entry.product);
    if (!byProduct.has(k)) byProduct.set(k, { product: entry.product, entries: [] });
    byProduct.get(k).entries.push(entry);
  }

  let money = 0;
  let priced = 0;

  const rows = [...byProduct.values()].map((group) => {
    const price = priceOf(state.receipts ?? [], group.product);
    if (price != null) {
      money += price * group.entries.length;
      priced += group.entries.length;
    }

    const lived = median(group.entries.map(livedOf).filter((d) => d != null));
    const shelf = group.entries.map((e) => e.shelfDays).filter((d) => d != null);

    const row = {
      product: group.product,
      times: group.entries.length,
      money: price == null ? null : Math.round(price * group.entries.length),
      lived,
      shelfDays: shelf.length ? Math.max(...shelf) : null,
      lastAt: Math.max(...group.entries.map((e) => e.closedAt)),
    };

    return { ...row, verdict: verdict(row) };
  });

  rows.sort((a, b) => (b.money ?? 0) - (a.money ?? 0) || b.times - a.times || a.product.localeCompare(b.product, "ru"));

  const closed = threw.length + used.length;

  return {
    days: window_,
    clipped: days > KEEP_DAYS,
    thrown: threw.length,
    eaten: used.length,
    closed,
    // Of everything that got a straight answer — not of everything owned.
    share: closed >= SHARE_FLOOR ? threw.length / closed : null,
    money: priced ? Math.round(money) : null,
    priced,
    unpriced: threw.length - priced,
    rows,
  };
}

/**
 * How many times this name has been thrown away lately.
 *
 * Read at the moment of buying rather than in a monthly report: a number seen
 * while adding the third carton of cream to the list can still change what
 * happens, and the same number in a summary at the end of the month cannot.
 */
export function tossCount(stock, product, { days = KEEP_DAYS, now = M.today() } = {}) {
  const since = now - (days - 1) * M.DAY;
  const k = key(product);
  let times = 0;

  for (const entry of stock ?? []) {
    if (entry.outcome !== "threw") continue;
    if ((entry.closedAt ?? -Infinity) < since) continue;
    if (key(entry.product) !== k) continue;
    times += 1;
  }

  return times;
}

/** The full row for one product — what the inspector shows when a line is focused. */
export function lossOf(state, product, { days = KEEP_DAYS, now = M.today() } = {}) {
  const k = key(product);
  return losses(state, { days, now }).rows.find((row) => key(row.product) === k) ?? null;
}

/** The warning that goes on a list row, or nothing when there is no habit yet. */
export function tossNote(stock, product, opts = {}) {
  const times = tossCount(stock, product, opts);
  if (times < HABIT) return "";
  return `выбрасывал ${times} ${M.plural(times, "раз", "раза", "раз")} — бери меньше`;
}
