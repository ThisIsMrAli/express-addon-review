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
    run: checkUnbounded
  },
  {
    id: "placeholder-selectable",
    severity: "warn",
    run: checkPlaceholder
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
  for (const file of ctx.files.filter((file) => !/\.json$/i.test(file.rel))) {
    const unlocked = /unlocked|license activated|licence activated|you are unlocked/i.test(file.text);
    const marker = /\bcrown\b|lock-icon|lock icon|\bPremium\b/i.test(file.text);
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
    if (!/\.(html?|jsx?|tsx?)$/i.test(file.rel)) continue;
    file.lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("<!--")) return;
      if (/\.(jsx?|tsx?)$/i.test(file.rel) && !/["'`]/.test(line)) return;
      const hit = line.match(pattern);
      if (!hit || /license|permission|authorized/i.test(line)) return;
      ctx.add(file.rel, index + 1, `Reviewers rejected a ${hit[1]} mark that implied a relationship the add-on did not have.`, `Remove the ${hit[1]} mark, or keep a written permission note next to it. The browser pass still looks for every other third-party logo.`);
    });
  }
}

function checkExportCancel(ctx) {
  for (const file of exportFiles(ctx)) {
    if (/cancel|abort|AbortController/i.test(file.text)) continue;
    ctx.add(file.rel, lineOf(file, /\b(gif|mp4|encode|export)\b/i), "Reviewers rejected a GIF or video export that could not be cancelled while it was running.", "Add a Cancel control that aborts the encode.");
  }
}

function checkExportDownload(ctx) {
  for (const file of exportFiles(ctx)) {
    if (/\b(download|saveAs|createObjectURL)\b/.test(file.text)) continue;
    ctx.add(file.rel, lineOf(file, /\b(gif|mp4|encode|export)\b/i), "Reviewers rejected an export that finished and still had no PNG, GIF, or video file to download.", "When encoding succeeds, start the download or hand the file to the document.");
  }
}

function checkUnbounded(ctx) {
  for (const file of ctx.files) {
    file.lines.forEach((line, index) => {
      const numberField = /<input\b/i.test(line) && (/type=["']number["']/i.test(line) || /size/i.test(line));
      if (!numberField || /\bmin=/.test(line) || /\bmax=/.test(line)) return;
      ctx.add(file.rel, index + 1, "Reviewers rejected a size field that kept a value like 4.11e+28.", "Set a minimum and a maximum, and reject scientific notation.");
    });
  }
}

function checkPlaceholder(ctx) {
  for (const file of ctx.files.filter((file) => /\.html?$/i.test(file.rel))) {
    if (/user-select:\s*none/.test(file.text)) continue;
    file.lines.forEach((line, index) => {
      if (/<(div|p|span)\b[^>]*(placeholder|hint)/i.test(line)) {
        ctx.add(file.rel, index + 1, "Reviewers rejected instructional text that could be selected and pasted.", "Use a placeholder attribute, or set user-select: none on the hint.");
      }
    });
  }
}

function exportFiles(ctx) {
  return ctx.files.filter((file) => /\b(gif|mp4|video)\b/i.test(file.text) && /\b(export|encode|render)\b/i.test(file.text));
}

function lineOf(file, pattern) {
  const index = file.lines.findIndex((line) => pattern.test(line));
  return index >= 0 ? index + 1 : 1;
}
