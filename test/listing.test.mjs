import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { png } from "./helpers.mjs";
import { chromeCandidates, findChrome } from "../.claude/skills/express-addon-review/scripts/lib/chrome.mjs";
import { planFit, pickEngine } from "../.claude/skills/express-addon-review/scripts/lib/fit.mjs";
import { addonCorpus, copyPieces, lintPage, unquotedPhrases } from "../.claude/skills/express-addon-review/scripts/lib/listing.mjs";
import { imageSize } from "../.claude/skills/express-addon-review/scripts/lib/images.mjs";

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.claude/skills/express-addon-review");
const scripts = path.join(skill, "scripts");
const templateCss = fs.readFileSync(path.join(skill, "references/listing-shot.css"), "utf8");
const templateHtml = fs.readFileSync(path.join(skill, "references/listing-shot.html"), "utf8");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "listing-"));

/** The template with every word and image replaced the way the skill asks. */
function filled(dir, edit = (html) => html) {
  fs.writeFileSync(path.join(dir, "panel-back.png"), png(640, 1600));
  fs.writeFileSync(path.join(dir, "panel-front.png"), png(640, 1600));
  let html = templateHtml
    .replace("Short phrase from the UI", "Find any icon")
    .replace("Real count or feature", "446,000 icons")
    .replace("One sentence already written in the add-on.", "Search 446,000 icons and place one on the page.")
    .replace(/<span>Fact<\/span>/g, "<span>Add to page</span>")
    .replace(/\s*<img class="float float-star"[^>]*\/>/, "")
    .replace(/\s*<div class="card (mid|third)">.*?<\/div>/g, "");
  return edit(html);
}

const lint = (html, dir, css = templateCss) => lintPage({ html, css, templateCss, dir });

test("the untouched template is refused, with each kind of leftover grouped on one line", () => {
  const problems = lint(templateHtml, tmp());
  assert.equal(problems.length, 2);
  assert.match(problems[0], /Template text left in place/);
  assert.match(problems[1], /Images not found/);
});

test("a filled page passes", () => {
  const dir = tmp();
  assert.deepEqual(lint(filled(dir), dir), []);
});

test("a page that invents a class, adds CSS, or moves the type to the right is refused", () => {
  const dir = tmp();
  assert.match(lint(filled(dir).replace('class="kicker"', 'class="eyebrow"'), dir).join(" "), /eyebrow/);
  assert.match(lint(filled(dir).replace("</head>", "<style>.copy{float:right}</style></head>"), dir).join(" "), /its own CSS/);
  assert.match(lint(filled(dir).replace('<h1>', '<h1 style="color:red">'), dir).join(" "), /its own CSS/);
  const swapped = filled(dir).replace(/(<div class="copy">[\s\S]*?<\/div>\s*<\/div>)([\s\S]*?)(<div class="stage">[\s\S]*<\/div>)(\s*<\/div>\s*<\/body>)/, "$3$1$4");
  assert.match(lint(swapped, dir).join(" "), /Type must stay on the left/);
});

test("an edited or missing stylesheet is refused", () => {
  const dir = tmp();
  assert.match(lint(filled(dir), dir, `${templateCss}\n.copy{color:red}`).join(" "), /listing-shot.css was changed/);
  assert.match(lint(filled(dir), dir, null).join(" "), /listing-shot.css is missing/);
});

test("a remote image and an unknown data-shot are refused", () => {
  const dir = tmp();
  assert.match(lint(filled(dir).replace("panel-front.png", "https://example.com/a.png"), dir).join(" "), /not local files/);
  assert.match(lint(filled(dir).replace('data-shot="cover"', 'data-shot="banner"'), dir).join(" "), /data-shot/);
});

test("comments in the page are not read as markup", () => {
  const dir = tmp();
  assert.deepEqual(lint(filled(dir).replace("<body", '<!-- <style>.x{}</style> <img src="gone.png"> -->\n<body'), dir), []);
});

test("copyPieces returns the kicker, headline, sentence, and each pill", () => {
  const dir = tmp();
  assert.deepEqual(copyPieces(filled(dir)), ["Find any icon", "446,000 icons", "Search 446,000 icons and place one on the page.", "Add to page", "Add to page", "Add to page"]);
});

test("words that are not in the add-on's source are reported, and case and curly quotes do not count", () => {
  const addon = tmp();
  fs.writeFileSync(path.join(addon, "package.json"), JSON.stringify({ name: "icons", description: "Search 446,000 icons and place one on the page." }));
  fs.writeFileSync(path.join(addon, "index.html"), "<button>Add to page</button><h2>Don’t guess</h2><p>Find any Icon</p>");
  fs.mkdirSync(path.join(addon, "node_modules"));
  fs.writeFileSync(path.join(addon, "node_modules", "dep.js"), "const x = 'Totally invented pill'");
  fs.writeFileSync(path.join(addon, "README.md"), "Totally invented pill");
  const corpus = addonCorpus(addon);
  const dir = tmp();
  const html = filled(dir).replace("446,000 icons</h1>", "Don't guess</h1>").replace("<span>Add to page</span>", "<span>Totally invented pill</span>");
  assert.deepEqual(unquotedPhrases(html, corpus), ["Totally invented pill"]);
});

test("planFit centers the crop and rejects a page that is too short", () => {
  assert.deepEqual(planFit(1920, 1280), { scaledH: 907, offsetY: 54 });
  assert.deepEqual(planFit(1360, 800), { scaledH: 800, offsetY: 0 });
  assert.throws(() => planFit(1360, 700), /shorter than 800/);
});

test("the fit engine is sips only on macOS", () => {
  assert.equal(pickEngine("chrome", "darwin"), "chrome");
  assert.equal(pickEngine("sips", "linux"), "sips");
  assert.equal(pickEngine("auto", "win32"), "chrome");
  assert.equal(pickEngine("auto", "linux"), "chrome");
});

test("a browser is found on each platform, and CHROME_PATH wins", () => {
  const win = { PROGRAMFILES: "C:\\Program Files", "PROGRAMFILES(X86)": "C:\\Program Files (x86)", LOCALAPPDATA: "C:\\Users\\a\\AppData\\Local" };
  const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  assert.equal(findChrome({ platform: "win32", env: win, exists: (file) => file === edge }), edge);
  assert.match(chromeCandidates("win32", win)[0], /Google\\Chrome\\Application\\chrome\.exe$/);
  assert.equal(findChrome({ platform: "darwin", env: {}, exists: (file) => file.includes("Google Chrome.app") }), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  assert.equal(findChrome({ platform: "linux", env: { PATH: "/opt/bin:/usr/bin" }, exists: (file) => file === "/usr/bin/chromium" }), "/usr/bin/chromium");
  assert.equal(findChrome({ platform: "linux", env: { PATH: "/usr/bin", CHROME_PATH: "/x/chrome" }, exists: () => true }), "/x/chrome");
  assert.equal(findChrome({ platform: "linux", env: { PATH: "/usr/bin" }, exists: () => false }), null);
});

const render = (...args) => spawnSync(process.execPath, [path.join(scripts, "render-listing.mjs"), ...args], { encoding: "utf8" });

test("render-listing refuses a page that never left the template, before it starts a browser", () => {
  const dir = tmp();
  const prepared = spawnSync(process.execPath, [path.join(scripts, "prepare-listing.mjs"), "--out", dir], { encoding: "utf8" });
  assert.equal(prepared.status, 0, prepared.stderr);
  const result = render("--dir", dir);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.ok(report.problems.some((line) => /01-cover\.html: Template text left in place/.test(line)));
});

test("render-listing reports an empty folder", () => {
  const result = render("--dir", tmp());
  assert.equal(result.status, 1);
  assert.match(JSON.parse(result.stdout).problems[0], /No pages like 01-cover\.html/);
});

const chrome = findChrome();
for (const engine of ["chrome", "sips"]) {
  const usable = chrome && (engine === "chrome" || (process.platform === "darwin" && fs.existsSync("/usr/bin/sips")));
  test(`render-listing makes a 1360x800 PNG with the ${engine} fit`, { skip: !usable && `${engine} is not available here` }, () => {
    const dir = tmp();
    const prepared = spawnSync(process.execPath, [path.join(scripts, "prepare-listing.mjs"), "--out", dir], { encoding: "utf8" });
    assert.equal(prepared.status, 0, prepared.stderr);
    for (const name of ["02-feature.html", "03-path.html"]) fs.rmSync(path.join(dir, name));
    fs.writeFileSync(path.join(dir, "01-cover.html"), filled(dir));
    const result = render("--dir", dir, "--engine", engine);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, true);
    assert.deepEqual(imageSize(fs.readFileSync(path.join(dir, "final/01-cover.png"))), { width: 1360, height: 800 });
    assert.deepEqual(imageSize(fs.readFileSync(path.join(dir, "01-cover-raw.png"))), { width: 1920, height: 1280 });
  });
}
