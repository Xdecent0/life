// Local state on disk. Single source of truth in the browser; the GitHub layer
// syncs it later. The shape of the state belongs to the app; keeping it, sizing
// it and complaining when it will not fit belongs here.

import * as log from "./log.js";
import { app } from "./app.js";

/* localStorage gives about 5 MB per origin and every save rewrites the whole
   state, so both numbers matter: how big it is, and how long writing it takes.
   Guessing at either is how an app gets slow without anyone noticing when. */
const BIG_STATE = 1_500_000;
const SLOW_SAVE = 16;

let lastSize = 0;
let warnedBig = false;

/** Bytes the saved state currently occupies — shown in settings, not guessed at. */
export const size = () => lastSize;

const blank = () => structuredClone(app().empty);

/** Storage can be absent entirely — private mode, a locked-down browser, a test run. */
const hasStorage = () => typeof localStorage !== "undefined";

/** True only when this browser has never saved state — not merely when it is empty. */
export function isFresh() {
  try {
    return localStorage.getItem(app().storageKey) === null;
  } catch {
    return true;
  }
}

export function load() {
  if (!hasStorage()) return blank();
  const { storageKey, onLoad } = app();

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return blank();

    lastSize = raw.length;
    const state = { ...blank(), ...JSON.parse(raw) };
    onLoad?.(state);
    log.info("хранилище", `загружено ${Math.round(lastSize / 1024)} КБ`);
    return state;
  } catch (err) {
    // Unreadable saved state is the worst silent failure there is: the app opens
    // looking brand new and the person assumes their data is gone. Say so.
    log.fail("хранилище", "сохранённое состояние не читается — начинаю с пустого", err?.message);
    return blank();
  }
}

export function save(state) {
  if (!hasStorage()) return false;
  const stop = log.time("хранилище", "запись состояния", { warnAfter: SLOW_SAVE });

  try {
    const text = JSON.stringify(state);
    localStorage.setItem(app().storageKey, text);
    lastSize = text.length;
    stop({ bytes: lastSize });

    if (lastSize > BIG_STATE && !warnedBig) {
      warnedBig = true;
      log.warn("хранилище", `состояние выросло до ${Math.round(lastSize / 1024)} КБ`);
    }
    return true;
  } catch (err) {
    log.fail("хранилище", "запись не прошла — место кончилось", err?.name);
    return false;
  }
}

export function reset() {
  localStorage.removeItem(app().storageKey);
}
