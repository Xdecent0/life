// Проекты: правила доски, слово в слово, и жизнь правки между телефоном и волтом.
//
// Ничего своего здесь не придумано. Статусы, разделы, пространства, циклы, виды
// проектов, пороги подсказок — всё это уже решено доской и стандартом проекта;
// повторить их иначе значило бы завести второй ответ на один вопрос.
//
// Что действительно принадлежит телефону — это очередь. На компьютере доска
// правит заметку и перечитывает волт: увиденное всегда равно тому, что лежит в
// файлах. Отсюда волт недостижим, поэтому правка ложится в очередь и рисуется
// поверх снимка — с честной пометкой, что она ещё в пути.

export const DAY = 86400000;

/** Форма состояния, в котором ещё ничего не приезжало. */
export const blank = () => ({ version: 1, board: null, edits: [], queue: [], syncedAt: null });

/* ---------- словарь доски ---------- */

/** Ровно те состояния, что бывают у карточки в волте. */
export const GROUPS = ["беклог", "в работе", "на паузе"];
export const ARCHIVED = ["готово", "закрыт"];

/** Группа на доске ↔ статус в шапке заметки. Перенос всегда идёт через заметку. */
export const TO_VAULT = {
  "беклог": "идея",
  "в работе": "активно",
  "на паузе": "пауза",
  "готово": "готово",
  "закрыт": "закрыт",
};

export const NO_SECTION = "Без раздела";
export const NO_AREA = "без категории";

/** Здоровье волт считает сам по дате правки карточки — здесь только перевод. */
const HEALTH = { "🟢": "ok", "🟡": "warn", "🔴": "bad", "⏸": "idle", "✅": "done" };
export const healthOf = (p) => HEALTH[(p.здоровье ?? "").trim()] ?? "none";

/** Порядок беспокойства: сначала то, что горит. */
const RANK = { bad: 0, warn: 1, ok: 2, done: 3, idle: 4, none: 5 };

/* ---------- чтение снимка ---------- */

export const boardOf = (state) => state.board ?? null;
export const cycleOf = (state) => state.board?.цикл ?? null;
export const sectionsOf = (state) => state.board?.разделы ?? [];
export const spacesOf = (state) => (state.board?.пространства ?? []).map((w) => w.имя);

export const projects = (state) => withPending(state).проекты ?? [];

export const live = (state) => projects(state).filter((p) => !ARCHIVED.includes(p.статус));
export const archived = (state) => projects(state).filter((p) => ARCHIVED.includes(p.статус));

export const find = (state, path) => projects(state).find((p) => p.путь === path) ?? null;

export const groupOf = (p) =>
  Object.entries(TO_VAULT).find(([, vault]) => vault === p.статус)?.[0] ?? p.статус;

export const areaOf = (p) => (p.области ?? [])[0] || NO_AREA;

export const milestonesOf = (p) => p.вехи ?? [];
export const doneCount = (p) => milestonesOf(p).filter((m) => m.закрыта).length;

/* Снимок везёт больше, чем показывала первая версия экрана. Всё это уже лежит
   в доска.json — не показывать его значило выбрасывать работу, которую волт уже
   сделал, и заставлять открывать Obsidian ради строчки в шапке. */
export const subOf = (p) => p.подпроекты ?? [];
export const activityOf = (p) => p.активность ?? [];
export const inboxOf = (state) => state.board?.входящее ?? [];
export const spaceCards = (state) => state.board?.пространства ?? [];
export const alertsOf = (state) => state.board?.алерты ?? [];

/** Шапка карточки: то, что видно, но не правится галочкой. */
export const FACTS = [
  ["Аппетит", (p) => p.аппетит],
  ["Цикл", (p) => p.цикл],
  ["Раздел", (p) => p.раздел],
  ["Область", (p) => (p.области ?? []).join(", ")],
  ["Пространство", (p) => p.пространство],
  ["Владелец", (p) => p.владелец],
  ["Участники", (p) => p.участники],
  ["Гейт", (p) => p.гейт],
  ["Дом", (p) => p.дом],
  ["Заметка правилась", (p) => p.обновлено],
];

/* Ровно тот белый список полей, что у сервера доски: поле, которого там нет,
   мост отобьёт, и предлагать его здесь значило бы врать кнопкой. */
export const EDITABLE = [
  { key: "цель", label: "Цель", long: true },
  { key: "аппетит", label: "Аппетит", hint: "6 недель · выходные · пара вечеров" },
  { key: "цикл", label: "Цикл", hint: "2026-C3" },
  { key: "раздел", label: "Раздел", hint: "Главное сейчас" },
  { key: "область", label: "Область", hint: "Обучение" },
];

export const STATUSES = ["идея", "активно", "пауза", "готово", "закрыт"];

/**
 * Чем меряется этот проект.
 *
 * Вид объявлен в шапке карточки, и меры у видов разные: вехи считаются штуками,
 * число — долей от цели, серия — днями. Одна общая фраза на все виды соврала бы
 * трём из четырёх.
 */
export function progressOf(p) {
  const pc = percent(p);

  if (p.вид === "число") {
    return { said: `${p.число?.текущее ?? 0} из ${p.число?.цель ?? "?"}`, pc, вид: "число" };
  }
  if (p.вид === "серия") {
    const days = (p.серия?.дни ?? []).length;
    return { said: `${days} из ${p.серия?.цель ?? "?"} ${plural(p.серия?.цель ?? 0, "дня", "дней", "дней")}`, pc, вид: "серия" };
  }
  if (p.вид === "ожидание") {
    return { said: (p.ждёт ?? []).join(" · ") || "ждёт своей очереди", pc: null, вид: "ожидание" };
  }

  const all = milestonesOf(p).length;
  return { said: all ? `${doneCount(p)} из ${all} ${plural(all, "вехи", "вех", "вех")}` : "вех в заметке нет", pc, вид: "вехи" };
}

/**
 * Доля сделанного. У каждого вида своя мера: вехи считаются штуками, число —
 * долей от цели, серия — днями. У «ожидания» процента нет вовсе: показать ноль
 * значило бы соврать, будто ничего не делается.
 */
export function percent(p) {
  if (p.вид === "число") return p.число?.цель ? clamp(100 * (p.число.текущее ?? 0) / p.число.цель) : 0;
  if (p.вид === "серия") return p.серия?.цель ? clamp(100 * (p.серия.дни ?? []).length / p.серия.цель) : 0;
  if (p.вид === "ожидание") return null;
  const all = milestonesOf(p);
  return all.length ? Math.round(100 * doneCount(p) / all.length) : (p.процент ?? 0);
}

const clamp = (v) => Math.min(100, Math.round(v));

/* ---------- дела ---------- */

export const deeds = (state) => withPending(state).дела ?? [];
export const openDeeds = (state) => deeds(state).filter((d) => !d.сделано);

/** Дела проекта: волт связывает их именем карточки, а не путём. */
export const deedsOf = (state, p) => deeds(state).filter((d) => d.проект && p.имя.includes(d.проект));

export function overdue(deed, now = today()) {
  if (!deed.срок || deed.сделано) return false;
  return Date.parse(deed.срок) <= now;
}

export function today(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/* ---------- подсказки ---------- */

/* Те же две подсказки и те же пороги, что даёт доска: проект без движения
   дольше трёх недель и проект, где осталась одна веха. */
export const STALE_DAYS = 21;

export const stalled = (state) =>
  live(state).filter((p) => p.статус === "активно" && (p.дней_без_движения ?? 0) >= STALE_DAYS);

export const almostDone = (state) =>
  live(state).filter((p) => p.статус === "активно" && p.вехи_всего > 1 && p.вехи_всего - p.вехи_закрыто === 1);

/* ---------- разрезы и порядок ---------- */

export const CUTS = [
  { key: "раздел", label: "Разделы" },
  { key: "состояние", label: "Состояние" },
  { key: "область", label: "Область" },
];

/* `short` — то, что стоит в панели: четыре подписи вида «по беспокойству»
   занимают полстроки и читаются как предложение, а не как переключатель. */
export const SORTS = [
  { key: "состояние", label: "по беспокойству", short: "тревога", of: (p) => RANK[healthOf(p)] ?? 9 },
  { key: "имя", label: "по названию", short: "имя", of: (p) => String(p.имя).toLowerCase() },
  { key: "процент", label: "по прогрессу", short: "прогресс", of: (p) => -(percent(p) ?? -1) },
  { key: "стоит", label: "по простою", short: "простой", of: (p) => -(p.дней_без_движения ?? 0) },
];

export const sortBy = (rows, key) => {
  const of = SORTS.find((s) => s.key === key)?.of ?? SORTS[0].of;
  return [...rows].sort((a, b) => {
    const x = of(a);
    const y = of(b);
    return x < y ? -1 : x > y ? 1 : String(a.имя).localeCompare(String(b.имя), "ru");
  });
};

/**
 * Группы доски. Раздел — своё слово из шапки карточки, и секция существует
 * ровно пока в ней кто-то лежит; заводить её отдельно негде и незачем. Порядок
 * берётся из индекса папки: алфавит не догадается, что «Главное сейчас» выше
 * «Фона».
 */
export function groups(state, { cut = "раздел", sort = "состояние", rows = null } = {}) {
  const pool = rows ?? live(state);
  const buckets = new Map();

  for (const p of pool) {
    const name = cut === "раздел" ? (p.раздел || "").trim() || NO_SECTION
      : cut === "область" ? areaOf(p)
        : groupOf(p);
    if (!buckets.has(name)) buckets.set(name, []);
    buckets.get(name).push(p);
  }

  const declared = cut === "раздел" ? sectionsOf(state) : cut === "состояние" ? GROUPS : [];
  const rank = (name) => {
    const at = declared.indexOf(name);
    if (at !== -1) return at;
    return name === NO_SECTION || name === NO_AREA ? 998 : 500;
  };

  const out = [...buckets.entries()]
    .map(([name, items]) => ({ name, items: sortBy(items, sort) }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, "ru"));

  /* Состояние — единственный разрез с заранее известным списком групп, и пустую
     из них показать честнее, чем спрятать: «в работе — пусто» это ответ. */
  if (cut === "состояние") {
    for (const name of GROUPS) if (!buckets.has(name)) out.push({ name, items: [] });
    out.sort((a, b) => GROUPS.indexOf(a.name) - GROUPS.indexOf(b.name));
  }

  return out;
}

/** Фильтры, которые действуют разом на всё: пространство, цикл, поиск. */
export function filter(rows, { space = "все", cycle = "все", query = "", cycleName = "" } = {}) {
  const needle = query.trim().toLowerCase();

  return rows.filter((p) => {
    if (space !== "все" && (p.пространство || "Личное") !== space) return false;
    if (cycle === "в цикле" && p.цикл !== cycleName) return false;
    if (cycle === "вне" && p.цикл) return false;
    if (!needle) return true;
    return [p.имя, p.цель, p.аппетит, p.раздел, ...(p.области ?? [])]
      .some((v) => String(v ?? "").toLowerCase().includes(needle));
  });
}

/**
 * Что уже закрыто, свежее сверху.
 *
 * Список вех отвечает «что осталось». Ответа на «а что я вообще сделал» не было
 * нигде, хотя даты закрытия лежат в тех же строках заметки — и это тот ответ, за
 * которым возвращаются к проекту, который долго стоит.
 *
 * Вехи без даты в ленту не идут: «когда-то» — не событие, а строка без времени
 * встала бы либо первой, либо последней, и оба места соврали бы.
 */
export function done(p) {
  return milestonesOf(p)
    .filter((m) => m.закрыта && m.дата)
    .sort((a, b) => String(b.дата).localeCompare(String(a.дата)));
}

/* ---------- ритуал цикла ---------- */

/**
 * Решения закрытия цикла: слово в итог и статус в заметку из одного места.
 *
 * «Везём дальше» статуса не имеет намеренно: продолжать — это не событие, и
 * трогать ради него шапку карточки значило бы записать в историю пустое.
 */
export const CALLS = [
  { key: "везём", label: "везём дальше", said: "продолжаем", status: null },
  { key: "готово", label: "готово", said: "закрыт как сделанный", status: "готово" },
  { key: "пауза", label: "на паузу", said: "отложен", status: "пауза" },
  { key: "режем", label: "режем", said: "закрыт нерешённым", status: "закрыт" },
];

/**
 * Текст итога из решений — то же, что человек написал бы сам, но без «вспомни».
 *
 * Нерешённые проекты попадают в итог отдельным списком, а не выпадают из него:
 * «до этого не дошли руки» — тоже результат цикла, и следующий цикл начнётся
 * именно с них.
 */
export function cycleSummary(rows, calls) {
  const parts = [];

  for (const call of CALLS) {
    const group = rows.filter((p) => calls.get(p.путь) === call.key);
    if (!group.length) continue;
    const head = call.said.charAt(0).toUpperCase() + call.said.slice(1);
    parts.push(`## ${head}\n\n${group.map((p) => `- **${p.имя}** — ${progressOf(p).said}`).join("\n")}`);
  }

  const untouched = rows.filter((p) => !calls.has(p.путь));
  if (untouched.length) parts.push(`## Без решения\n\n${untouched.map((p) => `- ${p.имя}`).join("\n")}`);

  return parts.join("\n\n");
}

/* ---------- правки ---------- */

export const alive = (rows = []) => rows.filter((r) => !r.deleted);
export const waiting = (state) => alive(state.edits).filter((e) => e.применено === null);
export const refused = (state) => alive(state.edits).filter((e) => e.применено === false);

/* Правки, заводящие новое: поверх снимка они не рисуются — у них ещё нет ни
   строки, ни пути, которые придумает волт. Значит, их надо показать отдельно,
   иначе заведённый проект исчезает до следующего снимка. */
const MAKES = {
  "проект+": (e) => `проект «${e.имя}»`,
  "из входящего": (e) => `${e.имя || e.из} → в проекты`,
  "пространство+": (e) => `пространство «${e.имя}»`,
  "итог+": (e) => `итог цикла ${e.цикл}`,
  "веха+": (e) => `веха «${e.текст}»`,
  "дело+": (e) => `дело «${e.текст}»`,
};

export const creations = (state) =>
  waiting(state).filter((e) => MAKES[e.что]).map((e) => ({ id: e.id, said: MAKES[e.что](e) }));

let counter = 0;

/**
 * Новая правка. `что` — имя операции из белого списка доски, остальное её поля:
 * мост отдаёт запись прямо в `board_server.OPS`, ничего не переводя.
 */
export function change(kind, fields, now = Date.now()) {
  counter += 1;
  return { id: `e${now.toString(36)}${counter.toString(36)}`, что: kind, ...fields, применено: null, ответ: "", at: now };
}

/**
 * Снимок с наложенными правками, которые ещё в пути.
 *
 * Наложение — копия: сам снимок остаётся тем, что приехало из волта, и когда
 * придёт следующий, экран честно вернётся к нему.
 */
export function withPending(state) {
  const board = state.board;
  if (!board) return {};

  const queue = waiting(state);
  if (!queue.length) return board;

  const next = structuredClone(board);

  for (const edit of queue) {
    if (edit.что === "веха") {
      const p = next.проекты?.find((x) => x.путь === edit.проект);
      const m = p?.вехи?.find((v) => v.строка === edit.строка);
      if (m) {
        m.закрыта = Boolean(edit.закрыта);
        m.ждёт = true;
      }
      continue;
    }

    if (edit.что === "дело") {
      const d = next.дела?.find((x) => x.ид === edit.ид);
      if (d && "сделано" in edit) {
        d.сделано = Boolean(edit.сделано);
        d.ждёт = true;
      }
      continue;
    }

    if (edit.что === "поле") {
      const p = next.проекты?.find((x) => x.путь === edit.проект);
      if (p) {
        p[edit.ключ] = edit.значение;
        p.ждёт = true;
      }
    }

    /* Операции, заводящие новое — проект, дело, веху, — поверх снимка не
       рисуются: у них ещё нет ни строки, ни ид, которые придумает волт. */
  }

  // Счётчики пересчитываются здесь же: иначе строка покажет новую галочку и
  // старое «3 из 11» одновременно.
  for (const p of next.проекты ?? []) {
    if (!p.вехи?.length) continue;
    p.вехи_закрыто = p.вехи.filter((m) => m.закрыта).length;
    p.вехи_всего = p.вехи.length;
  }

  return next;
}

/** Правки, которых волт ещё не видел, по этому проекту. */
export const pendingFor = (state, p) =>
  waiting(state).filter((e) => e.проект === p.путь).length;

/**
 * Ответ приехал — запись отслужила. Через месяц она становится обычным
 * надгробием, чтобы файл правок не рос историей всех галочек за год.
 */
export function foldAnswered(entries, days = 30, now = Date.now()) {
  const cutoff = now - days * DAY;

  return entries.map((e) => {
    if (e.применено === null || e.deleted) return e;
    const at = e.at ?? 0;
    if (at > cutoff) return e;
    return { id: e.id, deleted: true, deletedAt: at, at };
  });
}

/** Как давно собран снимок — чтобы экран не притворялся живым. */
export function snapshotAge(state, now = Date.now()) {
  const at = Date.parse(state.board?.собрано ?? "");
  return Number.isFinite(at) ? Math.max(0, Math.floor((now - at) / DAY)) : null;
}

/* ---------- каналы наружу ---------- */

/**
 * Куда система ходит наружу — единственный список в снимке, который до сих пор
 * никто не открывал.
 *
 * Реестр каналов лежит в волте с самого начала, снимок везёт его вместе с
 * проектами, и приложение не читало из него ни строчки. Это не срочное — алерты
 * и так кричат, когда проверка падает, — а инвентарь: что вообще подключено,
 * чем это меряется и где оно живёт.
 */
export const channels = (state) => state.board?.каналы ?? [];

/**
 * Состояние канала в четыре тона.
 *
 * «Не меряется» — не зелёное. Канал без проверки не может попасть в алерты по
 * построению: некому поднять руку. Такой канал молчит одинаково и когда всё
 * хорошо, и когда он умер полгода назад, и потому здесь он отдельный тон, а не
 * серая строчка в конце списка.
 */
export function channelState(c) {
  const said = String(c?.состояние ?? "").toLowerCase();

  if (["crit", "critical", "error"].includes(said)) return { tone: "bad", said: "не отвечает" };
  if (said === "warn") return { tone: "warn", said: "просит внимания" };
  if (["ok", "info"].includes(said)) return { tone: "ok", said: "в порядке" };
  if (said.startsWith("нет данных")) return { tone: "warn", said: "проверка не отчиталась" };
  return { tone: "none", said: "никто не проверяет" };
}

const CHANNEL_ORDER = { bad: 0, warn: 1, none: 2, ok: 3 };

export const channelRows = (state) =>
  channels(state)
    .map((c) => ({ ...c, ...channelState(c) }))
    .sort((a, b) => CHANNEL_ORDER[a.tone] - CHANNEL_ORDER[b.tone] || String(a.имя).localeCompare(String(b.имя), "ru"));

/** Каналы, за которыми не следит никто, — та же тишина, только про интеграции. */
export const unwatched = (state) => channelRows(state).filter((c) => c.tone === "none");

export function plural(n, one, few, many) {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/* ---------- дела по дням ---------- */

/** Понедельник недели, в которую попал день: неделя начинается с него. */
export function weekStart(at = today()) {
  const d = new Date(at);
  const shift = (d.getUTCDay() + 6) % 7;
  return at - shift * DAY;
}

/**
 * Календарь дел на несколько недель вперёд.
 *
 * Список отвечает «что не сделано», и на нём срок — это подпись сбоку. Вопрос,
 * ради которого сроки вообще ставят, другой: не завалена ли следующая среда.
 * На него отвечает только сетка, где видно и пустые дни тоже.
 *
 * Просроченное в сетку не идёт: у него уже нет своего места в будущем, и
 * рисовать его на прошлой неделе значит прятать. Оно собирается отдельной
 * кучей перед календарём — как и дела без срока после него.
 */
export function calendar(state, { weeks = 4, now = today() } = {}) {
  const open = openDeeds(state);
  const at = (d) => (d.срок ? Date.parse(d.срок) : null);

  const start = weekStart(now);
  const days = Array.from({ length: weeks * 7 }, (_, i) => {
    const day = start + i * DAY;
    return {
      at: day,
      today: day === now,
      past: day < now,
      /* Просроченное живёт в своей стопке и только там. Неделя начинается с
         понедельника, поэтому первые дни сетки — уже прошедшие, и вчерашнее
         дело попадало и в клетку, и в «Просрочено»: одно дело, посчитанное
         дважды, читается как два. */
      deeds: day < now ? [] : open.filter((d) => at(d) === day),
    };
  });

  const last = start + weeks * 7 * DAY;

  return {
    days,
    overdue: open.filter((d) => at(d) != null && at(d) < now),
    later: open.filter((d) => at(d) != null && at(d) >= last),
    noDate: open.filter((d) => at(d) == null),
  };
}

/** День словами — короткой подписью в клетке. */
export const dayNum = (at) => new Date(at).getUTCDate();

export const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
