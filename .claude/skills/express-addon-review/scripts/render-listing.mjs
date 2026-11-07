#!/usr/bin/env node
/**
 * Renders the prepared listing pages to final 1360×800 PNGs.
 * It refuses a page that left the locked template, and it works on macOS, Windows, and Linux.
 *
 *   node scripts/render-listing.mjs [--dir <listing>] [--only 01-cover] [--input <add-on>] [--engine auto|sips|chrome]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findChrome, NO_CHROME, shoot } from "./lib/chrome.mjs";
import { fitImage } from "./lib/fit.mjs";
import { imageSize } from "./lib/images.mjs";
import { addonCorpus, lintPage, unquotedPhrases } from "./lib/listing.mjs";
import { resolveOut } from "./lib/paths.mjs";
import { readSession } from "./lib/session.mjs";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateCss = fs.readFileSync(path.join(skillRoot, "references", "listing-shot.css"), "utf8");
const PAGE = /^\d\d-[\w-]+\.html$/;

const args = parseArgs(process.argv.slice(2));
try {
  process.exitCode = main();
} catch (error) {
  process.exitCode = fail([error.message]);
}

function main() {
  const dir = path.resolve(args.dir || path.join(resolveOut(), "listing"));
  if (!fs.existsSync(dir)) return fail([`${dir} does not exist. Run prepare-listing.mjs first.`]);

  const pages = fs.readdirSync(dir).filter((name) => PAGE.test(name) && (!args.only || name.startsWith(args.only))).sort();
  if (!pages.length) return fail([`No pages like 01-cover.html in ${dir}. Run prepare-listing.mjs first.`]);
  if (pages.length > 5) return fail([`${pages.length} pages. The listing takes five screenshots at most.`]);

  const css = fs.existsSync(path.join(dir, "listing-shot.css")) ? fs.readFileSync(path.join(dir, "listing-shot.css"), "utf8") : null;
  const addon = addonFolder(dir);
  const corpus = addon ? addonCorpus(addon) : null;

  const problems = [];
  const warnings = [];
  for (const name of pages) {
    const html = fs.readFileSync(path.join(dir, name), "utf8");
    for (const problem of lintPage({ html, css, templateCss, dir })) problems.push(`${name}: ${problem}`);
    if (corpus) for (const phrase of unquotedPhrases(html, corpus)) warnings.push(`${name}: "${phrase}" is not in the add-on's source`);
  }
  if (problems.length) return fail(problems);

  const chrome = findChrome();
  if (!chrome) return fail([NO_CHROME]);

  const finalDir = path.join(dir, "final");
  const shots = [];
  for (const name of pages) {
    const stem = name.replace(/\.html$/, "");
    const raw = path.join(dir, `${stem}-raw.png`);
    shoot({ chrome, url: pathToFileURL(path.join(dir, name)).href, out: raw, width: 1920, height: 1280, scale: 1, background: "FFF8F9FA" });
    const size = imageSize(fs.readFileSync(raw));
    if (!size || size.width !== 1920 || size.height !== 1280) {
      return fail([`${name} rendered ${size ? `${size.width}×${size.height}` : "an unreadable file"}, not 1920×1280. Do not stretch it. Run it again, and check that Chrome is not zoomed.`]);
    }
    const out = path.join(finalDir, `${stem}.png`);
    const fitted = fitImage({ input: raw, out, engine: args.engine });
    shots.push({ page: name, file: out, width: fitted.width, height: fitted.height });
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    out: finalDir,
    shots,
    warnings,
    next: warnings.length
      ? "Each warning is a phrase that is not in the add-on's source. A count you worked out from the data is fine when you can say how. Replace anything else, then render again."
      : "Open every PNG and look at it before you show the user."
  }, null, 2)}\n`);
  return 0;
}

/** The add-on folder the review recorded, unless `--input` says otherwise. */
function addonFolder(dir) {
  if (args.input) return path.resolve(args.input);
  try {
    const session = readSession(path.dirname(dir));
    return session?.addon?.path || null;
  } catch {
    return null;
  }
}

function fail(problems) {
  process.stdout.write(`${JSON.stringify({ ok: false, problems }, null, 2)}\n`);
  return 1;
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dir") parsed.dir = argv[++i];
    else if (argv[i] === "--only") parsed.only = argv[++i];
    else if (argv[i] === "--input") parsed.input = argv[++i];
    else if (argv[i] === "--engine") parsed.engine = argv[++i];
  }
  return parsed;
}
