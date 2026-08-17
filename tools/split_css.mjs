// Split the one stylesheet into a shared sheet plus one file per app.
//
// The section headings inside app.css do not mark app boundaries — the shared
// vocabulary is scattered through the kitchen's feature blocks, because that is
// the order it was written in. So the split is decided by use, not by heading:
// a rule leaves the shared sheet only when every class it names is used by
// exactly one app and by nothing else.
//
// That condition is also what makes the move safe. A rule that shares no class
// with anything left behind cannot collide with it, so no declaration changes
// which one wins by moving after it in the cascade.
//
// Run: node tools/split_css.mjs [--check]

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const APPS = [
  { key: "kitchen", dirs: ["apps/kitchen"], title: "Кухня", what: "Камера, чек, рецепты, неделя, магазины, трекинг." },
  { key: "things", dirs: ["apps/things"], title: "Вещи", what: "Гарантии, виды, где лежит." },
  { key: "clean", dirs: ["apps/clean"], title: "Уборка", what: "План дома: комнаты как квадраты, поверхности внутри." },
  { key: "places", dirs: ["apps/places"], title: "Места", what: "Строка со звёздами, «зовёт обратно»." },
  { key: "hub", dirs: ["hub"], title: "Пульт", what: "Плитки приложений, ключ, пара, лента «сегодня»." },
];

/* Every app loads these, so a class they use belongs to the shared sheet even
   if only one app's screens happen to show it today. */
const SHARED_SOURCE = ["core"];

function walk(dir, out = []) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|html)$/.test(name)) out.push(p);
  }
  return out;
}

/** Class names this source actually puts on an element. */
function classesUsedIn(dirs) {
  const used = new Set();

  for (const dir of dirs) {
    for (const file of walk(join(ROOT, dir))) {
      const text = readFileSync(file, "utf8");

      for (const m of text.matchAll(/class="([^"]*)"/g)) {
        // A template hole is not a class name; the literals around it still are.
        for (const token of m[1].replace(/\$\{[^}]*\}/g, " ").split(/\s+/)) {
          if (token && /^[a-zA-Z][\w-]*$/.test(token)) used.add(token);
        }
      }

      for (const m of text.matchAll(/classList\.(?:add|remove|toggle)\("([^"]+)"/g)) used.add(m[1]);
      // Class names built in code: `class="row row--${tone}"` leaves "row--" behind,
      // and dataset-driven styling keys off attributes, not classes.
      for (const m of text.matchAll(/\bclassName\s*=\s*"([^"]*)"/g)) {
        for (const token of m[1].split(/\s+/)) if (token) used.add(token);
      }
    }
  }

  return used;
}

/**
 * Top-level pieces of a stylesheet, in order: comments, plain rules, and
 * at-rules with their whole body kept together.
 */
function pieces(css) {
  const out = [];
  let i = 0;

  while (i < css.length) {
    const rest = css.slice(i);
    const ws = rest.match(/^\s+/);
    if (ws) {
      i += ws[0].length;
      continue;
    }

    if (rest.startsWith("/*")) {
      const end = css.indexOf("*/", i);
      const stop = end === -1 ? css.length : end + 2;
      out.push({ kind: "comment", text: css.slice(i, stop) });
      i = stop;
      continue;
    }

    const open = css.indexOf("{", i);
    if (open === -1) {
      const tail = css.slice(i).trim();
      if (tail) out.push({ kind: "comment", text: tail });
      break;
    }

    // A statement at-rule ends at the semicolon, not at a block.
    const semi = css.indexOf(";", i);
    if (css[i] === "@" && semi !== -1 && semi < open) {
      out.push({ kind: "comment", text: css.slice(i, semi + 1) });
      i = semi + 1;
      continue;
    }

    let depth = 0;
    let j = open;
    for (; j < css.length; j += 1) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    const prelude = css.slice(i, open).trim();
    const body = css.slice(open + 1, j);
    out.push({ kind: prelude.startsWith("@") ? "at" : "rule", prelude, body, text: css.slice(i, j + 1) });
    i = j + 1;
  }

  return out;
}

const CLASS_IN_SELECTOR = /\.(-?[_a-zA-Z][\w-]*)/g;

/**
 * Which app owns this selector, or null for the shared sheet.
 *
 * Every class has to point at the same app. A selector that names even one
 * shared class stays shared — that is what keeps a moved rule from ever
 * competing with one left behind.
 */
function ownerOf(prelude, usage) {
  const classes = [...prelude.matchAll(CLASS_IN_SELECTOR)].map((m) => m[1]);
  if (!classes.length) return null;

  let owner = null;

  for (const name of classes) {
    const apps = APPS.filter((a) => usage[a.key].has(name)).map((a) => a.key);
    if (usage.shared.has(name)) return null;
    if (apps.length !== 1) return null;
    if (owner && owner !== apps[0]) return null;
    owner = apps[0];
  }

  return owner;
}

/** An at-rule split into the parts each sheet keeps, wrapper and all. */
function splitAtRule(piece, usage) {
  // Keyframes and font faces have no selectors to classify.
  if (!/^@(media|supports|container)\b/.test(piece.prelude)) return { shared: piece.text, apps: {} };

  const inner = pieces(piece.body);
  const buckets = { shared: [] };
  let moved = false;

  for (const sub of inner) {
    if (sub.kind === "rule") {
      const owner = ownerOf(sub.prelude, usage);
      if (owner) {
        (buckets[owner] ??= []).push(sub.text);
        moved = true;
        continue;
      }
    } else if (sub.kind === "at") {
      const nested = splitAtRule(sub, usage);
      for (const [key, text] of Object.entries(nested.apps)) {
        (buckets[key] ??= []).push(text);
        moved = true;
      }
      if (nested.shared) buckets.shared.push(nested.shared);
      continue;
    }
    buckets.shared.push(sub.text);
  }

  if (!moved) return { shared: piece.text, apps: {} };

  const wrap = (parts) => `${piece.prelude} {\n${indent(parts.join("\n\n"))}\n}`;
  const apps = {};
  for (const [key, parts] of Object.entries(buckets)) {
    if (key === "shared") continue;
    apps[key] = wrap(parts);
  }

  return { shared: buckets.shared.length ? wrap(buckets.shared) : "", apps };
}

const indent = (text) => text.split("\n").map((l) => (l.trim() ? `  ${l}` : l)).join("\n");

/* ---------- run ---------- */

const usage = { shared: classesUsedIn(SHARED_SOURCE) };
for (const a of APPS) usage[a.key] = classesUsedIn(a.dirs);

const source = readFileSync(join(ROOT, "design/app.css"), "utf8");
const out = { shared: [] };

for (const piece of pieces(source)) {
  if (piece.kind === "rule") {
    const owner = ownerOf(piece.prelude, usage);
    if (owner) {
      (out[owner] ??= []).push(piece.text);
      continue;
    }
  } else if (piece.kind === "at") {
    const split = splitAtRule(piece, usage);
    for (const [key, text] of Object.entries(split.apps)) (out[key] ??= []).push(text);
    if (split.shared) out.shared.push(split.shared);
    continue;
  }
  out.shared.push(piece.text);
}

const header = (a) =>
  `/* ${a.title} — то, чего нет больше нигде.\n\n   ${a.what}\n   Собирается tools/split_css.mjs по использованию: сюда попадает правило,\n   все классы которого не встречаются ни в одном другом приложении.\n   Грузится вместе с design/app.css, а не вместо него. */\n\n`;

if (process.argv.includes("--check")) {
  for (const a of APPS) console.log(`${a.key}: ${(out[a.key] ?? []).length} правил`);
  console.log(`общее: ${out.shared.length} кусков`);
} else {
  writeFileSync(join(ROOT, "design/app.css"), out.shared.join("\n\n").trim() + "\n", "utf8");
  for (const a of APPS) {
    const rules = out[a.key] ?? [];
    writeFileSync(join(ROOT, `design/${a.key}.css`), header(a) + rules.join("\n\n").trim() + "\n", "utf8");
    console.log(`design/${a.key}.css — ${rules.length} правил`);
  }
  console.log(`design/app.css — ${out.shared.length} кусков`);
}
