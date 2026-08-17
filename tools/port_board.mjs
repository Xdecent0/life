// Перенести доску проектов из волта в приложение — той же страницей, а не пересказом.
//
// Доска (`AI/board/index.html` в волте) — один файл без зависимостей: свои
// токены, своя сетка, свои группы, разделы, пространства, вехи. Написать «то же
// самое, только для телефона» значит получить похожий экран и вторую вёрстку,
// которую придётся чинить дважды. Поэтому переносится сам файл.
//
// Наружу доска ходит через четыре адреса — `/api/board`, `/api/do`, `/api/rev`,
// `/api/find`. Это и есть вся дверь, и подменяется только она: на компьютере за
// ней сервер и волт, на телефоне — снимок в репозитории и очередь правок.
//
// Правок в самой странице ровно две, и обе — про то, кто её запускает:
// добавлена шапка PWA и отложен `boot()`, чтобы дверь успела встать до первого
// запроса. Ни одна строка разметки, стилей или логики не тронута.
//
// Запуск (после любой правки доски):
//   node tools/port_board.mjs [путь-к-index.html-доски]

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(process.argv[2] ?? join(ROOT, "..", "LifeOS", "AI", "board", "index.html"));
const TARGET = join(ROOT, "apps", "projects", "index.html");

const HEAD = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0E1117">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="icon" href="../kitchen/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../kitchen/icons/icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Проекты">`;

const NOTE = `<!-- Эта страница перенесена из волта: AI/board/index.html.
     Править её здесь нельзя — правь доску и прогони tools/port_board.mjs,
     иначе следующий перенос сотрёт написанное. -->`;

const source = readFileSync(SOURCE, "utf8");

/* Заголовок страницы — первая строка доски. Шапка PWA встаёт сразу за ним, до
   стилей: manifest и theme-color должны быть в head, а head здесь неявный. */
const titled = source.replace(/^<title>[^<]*<\/title>\r?\n/, (m) => `${NOTE}\n${m}${HEAD}\n`);
if (titled === source) throw new Error("не нашёл <title> первой строкой — доска изменилась, проверь перенос");

/* Дверь наружу — модуль, а он отложенный, и к моменту его запуска inline-скрипт
   доски уже отработал бы boot() поверх ещё не подменённого fetch. Поэтому
   запуск откладывается на одну строку, и его делает дверь. */
const deferred = titled.replace(/\nboot\(\);\n<\/script>\s*$/, `
/* Перенос в телефон: запуск делает ./app.js, когда дверь наружу встала на место.
   На компьютере доски этой строки нет — там boot() вызывается сразу. */
window.__ЗАПУСК = boot;
</script>
<script type="module" src="./app.js"></script>
`);
if (deferred === titled) throw new Error("не нашёл boot(); в конце — доска изменилась, проверь перенос");

writeFileSync(TARGET, deferred, "utf8");

const lines = deferred.split("\n").length;
console.log(`apps/projects/index.html — перенесено ${lines} строк из ${SOURCE}`);
