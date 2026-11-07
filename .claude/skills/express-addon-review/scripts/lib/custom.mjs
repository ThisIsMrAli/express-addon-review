import { attrValue, hasAttr, MARKUP_EXT, openTags, OWN_VALIDATION } from "./source.mjs";

const BRANDS = ["Figma", "Canva", "Notion", "Framer"];

export const CUSTOM_RULES = [
  {
    id: "name-looks-official",
    severity: "warn",
    run: checkName
  },
  {
    id: "paid-state-conflict",
    severity: "warn",
    run: checkPaidState
  },
  {
    id: "third-party-brand",
    severity: "warn",
    run: checkBrands
  },
  {
    id: "export-without-cancel",
    severity: "warn",
    run: checkExportCancel
  },
  {
    id: "export-without-download",
    severity: "warn",
    run: checkExportDownload
  },
  {
    id: "unbounded-number",
    severity: "warn",
    supersededBy: "input-bounds",
    run: checkUnbounded
  },
  {
    id: "placeholder-selectable",
    severity: "warn",
    run: checkPlaceholder
  },
  {
    id: "unpkg-cdn",
    severity: "warn",
    run: checkUnpkg
  }
];

function checkName(ctx) {
  const name = ctx.manifest?.name || "";
  if (/^(Express|Adobe)\b/.test(name) && name !== "Adobe Express") {
    ctx.add("manifest.json", 1, `Reviewers rejected an add-on name that starts with Express or Adobe ("${name}").`, `Rename it so the product comes first, for example "${name.replace(/^(Express|Adobe)\s+/, "")} for Adobe Express".`);
  }
  for (const file of ctx.files.filter((file) => /\.html?$/i.test(file.rel))) {
    file.lines.forEach((line, index) => {
      const title = line.match(/<h1[^>]*>([^<]+)<\/h1>/i) || line.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (!title) return;
      const text = title[1].trim();
      if (/^(Express|Adobe)\b/.test(text) && text !== "Adobe Express") {
        ctx.add(file.rel, index + 1, `Reviewers rejected a title that reads like an official Adobe product ("${text}").`, "Put the product name first, then “for Adobe Express”.");
      }
    });
  }
}

function checkPaidState(ctx) {
  for (const file of ctx.files.filter((entry) => MARKUP_EXT.test(entry.rel))) {
    const unlocked = /unlocked|license activated|licence activated|you are unlocked/i.test(file.code);
    const marker = /\bcrown\b|lock-icon|lock icon|\bPremium\b/i.test(file.code);
    if (unlocked && marker) {
      ctx.add(file.rel, 1, "Reviewers rejected a screen that said the license was active while crown or Premium marks were still on the items.", "Remove the paid marks from unlocked items, or say on each mark that the item is already included.");
    }
  }
}

function checkBrands(ctx) {
  const pattern = new RegExp(`\\b(${BRANDS.join("|")})\\b`);
  for (const image of ctx.images || []) {
    const hit = image.rel.match(pattern);
    if (!hit || /license|permission|authorized/i.test(image.rel)) continue;
    ctx.add(image.rel, 1, `Reviewers rejected a ${hit[1]} mark that implied a relationship the add-on did not have.`, `Remove the ${hit[1]} mark, or keep a written permission note next to it. The browser pass still looks for every other third-party logo.`);
  }
  for (const file of ctx.files) {
    if (!MARKUP_EXT.test(file.rel)) continue;
    const code = /\.(jsx?|tsx?|mjs|cjs|mts|cts)$/i.test(file.rel);
    file.codeLines.forEach((line, index) => {
      if (!line.trim()) return;
      if (code && !/["'`]/.test(line)) return;
      const hit = line.match(pattern);
      if (!hit || /license|permission|authorized/i.test(line)) return;
      ctx.add(file.rel, index + 1, `Reviewers rejected a ${hit[1]} mark that implied a relationship the add-on did not have.`, `Remove the ${hit[1]} mark, or keep a written permission note next to it. The browser pass still looks for every other third-party logo.`);
    });
  }
}

const CANCEL = /cancel|abort|AbortController/i;
const DOWNLOAD = /\b(download|saveAs|createObjectURL)\b/;

// A cancel path or a download may live in another file than the encoder, so both are judged for the project.
function checkExportCancel(ctx) {
  const files = exportFiles(ctx);
  if (!files.length || ctx.files.some((file) => CANCEL.test(file.code))) return;
  ctx.add(files[0].rel, lineOf(files[0], ENCODER), "Reviewers rejected a GIF or video export that could not be cancelled while it was running.", "Add a Cancel control that aborts the encode. If the work cannot be stopped once it has started, say so, and say whether credits are used.");
}

function checkExportDownload(ctx) {
  const files = exportFiles(ctx);
  if (!files.length || ctx.files.some((file) => DOWNLOAD.test(file.code))) return;
  ctx.add(files[0].rel, lineOf(files[0], ENCODER), "Reviewers rejected an export that finished and still had no PNG, GIF, or video file to download.", "When encoding succeeds, start the download or hand the file to the document.");
}

function checkUnbounded(ctx) {
  for (const file of ctx.files.filter((entry) => MARKUP_EXT.test(entry.rel))) {
    for (const tag of openTags(file.code, ["input", "NumberField", "sp-number-field"])) {
      if (tag.name === "input" && attrValue(tag.attrs, "type") !== "number" && !/size/i.test(tag.attrs)) continue;
      if (hasAttr(tag.attrs, ["min", "minValue"]) && hasAttr(tag.attrs, ["max", "maxValue"])) continue;
      if (OWN_VALIDATION.test(tag.attrs)) continue;
      ctx.add(file.rel, tag.line, "Reviewers rejected a size field that kept a value like 4.11e+28.", "Set a minimum and a maximum, and reject scientific notation.");
    }
  }
}

function checkPlaceholder(ctx) {
  for (const file of ctx.files.filter((entry) => /\.(html?|vue|svelte)$/i.test(entry.rel))) {
    if (/user-select:\s*none/.test(file.code)) continue;
    for (const tag of openTags(file.code, ["div", "p", "span"])) {
      if (/(placeholder|hint)/i.test(tag.attrs)) {
        ctx.add(file.rel, tag.line, "Reviewers rejected instructional text that could be selected and pasted.", "Use a placeholder attribute, or set user-select: none on the hint.");
      }
    }
  }
}

const ENCODER = /\bencode(?!URI)\w*|\b(ffmpeg|createObjectURL|downloadBlob|MediaRecorder)\b/i;

function exportFiles(ctx) {
  return ctx.files.filter((file) => {
    if (!/\.(jsx?|tsx?|mjs|cjs|mts|cts|vue|svelte)$/i.test(file.rel)) return false;
    const code = file.code.replace(/\bexport\s+(?:default\s+|async\s+)?(?:function|const|class|type|interface|enum|\{)/g, " ");
    return /\b(gif|mp4|video)\b/i.test(code) && ENCODER.test(code);
  });
}

function lineOf(file, pattern) {
  const index = file.codeLines.findIndex((line) => pattern.test(line.replace(/\bexport\b/g, " ")));
  return index >= 0 ? index + 1 : 1;
}

function checkUnpkg(ctx) {
  for (const file of ctx.files) {
    if (/\.(json|md)$/i.test(file.rel)) continue;
    file.codeLines.forEach((line, index) => {
      if (/unpkg\.com/i.test(line)) {
        ctx.add(file.rel, index + 1, "Reviewers rejected add-ons that opened to a blank panel because a library was loaded from unpkg and that file was removed.", "Bundle the library with the add-on. Do not load it from unpkg.com.");
      }
    });
  }
}
