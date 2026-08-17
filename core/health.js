// Тишина — не то же самое, что порядок.
//
// Все поломки этого набора выглядят одинаково: экран показывает вчерашнее и
// молчит. Сервер доски не поднялся — снимок не приезжает, но проекты на месте.
// Ключ доступа протух — правки копятся в очереди, а список выглядит обычным.
// Мост не применил правку — галочка стоит «ждёт волта» и ждёт вечно.
//
// Ни один из этих случаев не ошибка, которую можно поймать try/catch: ничего не
// падает, просто перестаёт происходить. Поймать их можно только по возрасту —
// сколько дней назад в последний раз что-то доехало.
//
// Пороги здесь не круглые числа из головы, а из ритма: круг синка ездит сам,
// снимок собирается, пока поднята доска. Два дня без круга — это уже не «я не
// открывал», это «что-то не работает».

const DAY = 86400000;

export const QUIET_SYNC = 2;      // дней без круга синка
export const QUIET_QUEUE = 1;     // дней, что правка лежит неотправленной
export const QUIET_SNAPSHOT = 3;  // дней возрасту снимка доски

const days = (at, now) => (at == null ? null : Math.floor((now - at) / DAY));

/**
 * Что молчит дольше положенного.
 *
 * Возвращает жалобы, а не «здоров/болен»: приложению нужно сказать человеку
 * конкретную вещь — что именно не доехало и сколько дней назад это было
 * в последний раз.
 *
 * @param {object} state  состояние приложения, как оно лежит в хранилище
 * @param {object} opts
 * @param {string} opts.name     имя приложения для фразы
 * @param {boolean} opts.keyed   есть ли ключ доступа: без него молчание законно
 * @param {number} [opts.snapshotAt]  когда собран снимок, если он у приложения есть
 * @param {number} [opts.now]
 */
export function quiet(state, { name = "", keyed = true, snapshotAt = null, now = Date.now() } = {}) {
  const out = [];
  const queue = (state?.queue ?? []).filter((op) => !op.deleted);

  /* Без ключа молчание — это не поломка, а незаконченная настройка, и говорить
     про неё надо один раз и другими словами. */
  if (!keyed) {
    if (queue.length) {
      out.push({
        key: "no-key",
        said: `${name ? name + ": " : ""}${queue.length} ${plural(queue.length, "правка лежит", "правки лежат", "правок лежат")} на этом устройстве — ключа доступа нет`,
        fix: "Ключ вводится на пульте, один раз на все приложения.",
      });
    }
    return out;
  }

  const sinceSync = days(state?.syncedAt ?? null, now);
  if (sinceSync != null && sinceSync >= QUIET_SYNC) {
    out.push({
      key: "sync",
      said: `${name ? name + ": " : ""}круг синка не проходил ${sinceSync} ${plural(sinceSync, "день", "дня", "дней")}`,
      fix: "Проверь ключ на пульте и прогони «Синкнуть все».",
    });
  }

  /* Считаем по самой старой правке, а не по числу: одна, застрявшая на неделю,
     хуже двадцати сегодняшних. */
  const oldest = queue.reduce((min, op) => Math.min(min, op.at ?? now), Infinity);
  const stuck = days(Number.isFinite(oldest) ? oldest : null, now);
  if (stuck != null && stuck >= QUIET_QUEUE) {
    out.push({
      key: "queue",
      said: `${name ? name + ": " : ""}${queue.length} ${plural(queue.length, "правка ждёт", "правки ждут", "правок ждут")} отправки, старшей ${stuck} ${plural(stuck, "день", "дня", "дней")}`,
      fix: "Открой приложение с сетью — круг заберёт их сам.",
    });
  }

  const snap = days(snapshotAt, now);
  if (snap != null && snap >= QUIET_SNAPSHOT) {
    out.push({
      key: "snapshot",
      said: `снимок доски собран ${snap} ${plural(snap, "день", "дня", "дней")} назад`,
      fix: "Снимок собирает компьютер, пока поднята доска: проверь, что она работает.",
    });
  }

  return out;
}

/** Русское число словами — тот же приём, что в приложениях. */
function plural(n, one, few, many) {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
