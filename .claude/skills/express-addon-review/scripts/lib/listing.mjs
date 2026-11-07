import fs from "node:fs";
import path from "node:path";

export const SHOT_KINDS = ["cover", "feature", "path"];

/** The words the template ships with. A page that still has them was never filled. */
export const PLACEHOLDERS = [
  "short phrase from the ui",
  "real count or feature",
  "one sentence already written in the add-on.",
  "fact"
];

const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, "");

/** Class names the locked stylesheet defines. A class outside this list does nothing and means the page was freelanced. */
export function cssClasses(css) {
  const found = new Set();
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.([A-Za-z_][\w-]*)/g)) found.add(match[1]);
  return found;
}

/**
 * Checks one prepared page against the locked template.
 * Returns the problems. An empty list means the page may be rendered.
 */
export function lintPage({ html, css, templateCss, dir }) {
  const problems = [];
  const page = stripComments(html);

  if (css == null) problems.push("listing-shot.css is missing. Run prepare-listing.mjs again.");
  else if (css !== templateCss) problems.push("listing-shot.css was changed. Run prepare-listing.mjs again. The stylesheet is locked.");

  const kind = page.match(/<body[^>]*\sdata-shot="([^"]*)"/i)?.[1];
  if (!SHOT_KINDS.includes(kind)) problems.push(`data-shot must be one of ${SHOT_KINDS.join(", ")}.`);

  if (/<style\b/i.test(page) || /\sstyle\s*=/i.test(page)) problems.push("The page has its own CSS (a <style> tag or a style attribute). Remove it. Only the locked stylesheet is allowed.");
  if (/<script\b/i.test(page)) problems.push("The page has a script. Remove it.");
  if (/@import/i.test(page)) problems.push("The page imports a stylesheet. Remove it.");
  for (const link of page.matchAll(/<link\b[^>]*>/gi)) {
    if (!/href="listing-shot\.css"/i.test(link[0])) problems.push(`Unknown stylesheet: ${link[0]}`);
  }

  if (templateCss) {
    const allowed = cssClasses(templateCss);
    const unknown = new Set();
    for (const match of page.matchAll(/\sclass="([^"]*)"/gi)) {
      for (const name of match[1].split(/\s+/).filter(Boolean)) if (!allowed.has(name)) unknown.add(name);
    }
    if (unknown.size) problems.push(`Classes the template does not have: ${[...unknown].join(", ")}. Do not invent layout.`);
  }

  const copyAt = page.search(/class="copy"/);
  const stageAt = page.search(/class="stage"/);
  if (copyAt < 0 || stageAt < 0) problems.push("The page needs a .copy block and a .stage block.");
  else if (copyAt > stageAt) problems.push("Type must stay on the left. Put .copy before .stage.");

  const left = [...new Set(copyPieces(page).filter((text) => PLACEHOLDERS.includes(normalize(text))))];
  if (left.length) problems.push(`Template text left in place: ${left.map((text) => `"${text}"`).join(", ")}. Replace each with a phrase from the add-on.`);

  const missing = [];
  const remote = [];
  for (const match of page.matchAll(/<img\b[^>]*\ssrc="([^"]*)"/gi)) {
    const src = match[1];
    if (/^(https?:|data:|\/\/)/i.test(src)) remote.push(src.slice(0, 60));
    else if (!fs.existsSync(path.resolve(dir, decodeURI(src.split(/[?#]/)[0])))) missing.push(src);
  }
  if (remote.length) problems.push(`Images that are not local files: ${[...new Set(remote)].join(", ")}.`);
  if (missing.length) problems.push(`Images not found: ${[...new Set(missing)].join(", ")}. Capture each one, or remove its <img>.`);
  return problems;
}

/** The visible words in .copy: kicker, h1, sentence, and each pill. */
export function copyPieces(html) {
  const page = stripComments(html);
  const start = page.search(/<[a-z][^>]*class="copy"/i);
  if (start < 0) return [];
  const stage = page.search(/<[a-z][^>]*class="stage"/i);
  const block = page.slice(start, stage > start ? stage : undefined);
  return decode(block.replace(/<[^>]+>/g, "\n"))
    .split("\n")
    .map((piece) => piece.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function decode(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Case, whitespace, curly quotes, and the HTML-escaped forms are not different words. */
export function normalize(text) {
  return decode(String(text))
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "thumbnails", ".next", "coverage"]);
const CORPUS_EXT = /\.(html?|jsx?|tsx?|mjs|cjs|vue|svelte|json|txt)$/i;

/** Everything the add-on could say, lowercased. Lock files and the markdown docs are not add-on copy. */
export function addonCorpus(root, { maxFiles = 600, maxBytes = 1_500_000 } = {}) {
  const parts = [];
  let seen = 0;
  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (seen >= maxFiles) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) walk(full);
      } else if (CORPUS_EXT.test(entry.name) && !/lock\.json$|^package-lock/i.test(entry.name)) {
        try {
          if (fs.statSync(full).size > maxBytes) continue;
          parts.push(normalize(fs.readFileSync(full, "utf8")));
          seen += 1;
        } catch {
          // An unreadable file adds nothing to the corpus.
        }
      }
    }
  };
  walk(root);
  return parts.join("\n");
}

/** Phrases in .copy that appear nowhere in the add-on's source. Each one is a word the user did not write. */
export function unquotedPhrases(html, corpus) {
  return copyPieces(html).filter((piece) => !PLACEHOLDERS.includes(normalize(piece)) && !corpus.includes(normalize(piece)));
}
