#!/usr/bin/env node
/**
 * Copies the locked listing-shot template into a review listing folder.
 * Agents edit words and image paths only. Do not invent HTML or CSS.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveOut } from "./lib/paths.mjs";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateHtml = path.join(skillRoot, "references", "listing-shot.html");
const templateCss = path.join(skillRoot, "references", "listing-shot.css");

const args = parseArgs(process.argv.slice(2));
let out = args.out || args._[0];
if (!out) {
  // The listing folder lives in the review folder, so there is nothing to type.
  try {
    out = path.join(resolveOut(), "listing");
  } catch {
    process.stderr.write("Usage: node scripts/prepare-listing.mjs [--out <folder>]. Without --out, the last review's listing/ folder is used.\n");
    process.exit(1);
  }
}

const outDir = path.resolve(out);
fs.mkdirSync(outDir, { recursive: true });

const css = fs.readFileSync(templateCss, "utf8");
const html = fs.readFileSync(templateHtml, "utf8");
fs.writeFileSync(path.join(outDir, "listing-shot.css"), css);

const shots = [
  { file: "01-cover.html", shot: "cover", title: "Cover" },
  { file: "02-feature.html", shot: "feature", title: "Feature" },
  { file: "03-path.html", shot: "path", title: "Path" }
];

for (const shot of shots) {
  let page = html
    .replace("<title>Listing shot</title>", `<title>${shot.title}</title>`)
    .replace('data-shot="cover"', `data-shot="${shot.shot}"`);
  fs.writeFileSync(path.join(outDir, shot.file), page);
}

// Remove known freelanced stylesheets that diverge from the locked look.
for (const stray of ["shot.css", "banner.css", "cover.css"]) {
  const strayPath = path.join(outDir, stray);
  if (fs.existsSync(strayPath)) fs.unlinkSync(strayPath);
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  out: outDir,
  files: ["listing-shot.css", ...shots.map((s) => s.file)],
  rule: "Edit kicker, h1, sentence, pills, and img src only. Do not change layout classes or invent CSS."
}, null, 2)}\n`);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--out") args.out = argv[++i];
    else args._.push(token);
  }
  return args;
}
