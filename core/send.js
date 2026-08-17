// Getting text out of the app: the system sheet when there is one, the clipboard
// when there is not, and a Telegram link as the fallback that always exists.
// Nothing here knows what the text says.

import * as log from "./log.js";

export const canShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

/**
 * Hand the text to the platform. The share sheet reaches Telegram and every
 * other installed app in one step; without it we fall back to the clipboard,
 * which is what a desktop actually wants anyway.
 */
export async function share(text, { title = "Список покупок" } = {}) {
  if (canShare()) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      if (err?.name === "AbortError") return "cancelled";
      /* fall through to the clipboard */
    }
  }

  return copy(text);
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Telegram's own share endpoint — works on desktop where there is no share sheet. */
export function telegramLink(text) {
  return `https://t.me/share/url?url=${encodeURIComponent("")}&text=${encodeURIComponent(text)}`;
}
