import fs from "node:fs";
import path from "node:path";
import { ADOBE_RULES, adobeActive } from "./adobe.mjs";
import { CUSTOM_RULES } from "./custom.mjs";
import { TOOL_RULES } from "./tool.mjs";
import { detectDesign } from "./design.mjs";
import { HUMAN_CHECKS } from "./human.mjs";
import { imageSize } from "./images.mjs";
import { loadLive } from "./live.mjs";
import { describePackage, findPackages } from "./package.mjs";
import { blankComments, MARKUP_EXT } from "./source.mjs";

const TEXT_EXT = new Set([".html", ".htm", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts", ".md", ".json", ".css", ".vue", ".svelte"]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg"]);
const SKIP = new Set(["node_modules", ".git", "dist", "build", "coverage", "review-output"]);

export function scanAddon(root, options = {}) {
  const given = path.resolve(root);
  const dir = resolveAddonDir(given);
  const docs = options.docs ?? loadLive(options.liveDir);
  const findings = [];
  const skipped = [];
  const files = [];
  const images = [];
  const newest = { rel: "", mtimeMs: 0 };
  if (fs.existsSync(dir)) walk(dir, dir, files, images, newest);
  if (dir !== given) {
    for (const folder of ["listing", "thumbnails"]) {
      const extra = path.join(given, folder);
      if (fs.existsSync(extra)) walk(extra, given, files, images, newest);
    }
  }

  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    findings.push(item("manifest-missing", "error", "manifest.json", 1, "An Express add-on needs manifest.json at the project root or in src/.", "Add a version 2 manifest with requirements.apps name Express and at least one panel entry. The Adobe CLI puts that file in src/.", { kind: "tool" }));
    return finish(findings, skipped, false);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    findings.push(item("manifest-json", "error", "manifest.json", 1, `manifest.json did not parse: ${error.message}`, "Fix the JSON syntax.", { kind: "tool" }));
    return finish(findings, skipped, false);
  }

  const zips = [...new Set([...findPackages(given), ...(options.zips || []).map((zip) => path.resolve(zip))])];
  const ctx = {
    manifest,
    files,
    images,
    packages: zips.map(describePackage),
    newest,
    exists: (rel) => fs.existsSync(path.join(dir, rel)),
    entryHtml: () => (manifest.entryPoints || []).find((entry) => entry.main)?.main || "index.html"
  };

  for (const rule of ADOBE_RULES) {
    if (!adobeActive(rule, docs)) {
      skipped.push({ id: rule.id, sourceKey: rule.sourceKey, url: rule.url, reason: "The fresh page does not contain the evidence sentence, so this check was not applied." });
      continue;
    }
    rule.run(bind(ctx, findings, rule, "adobe"));
  }
  for (const rule of CUSTOM_RULES) {
    rule.run(bind(ctx, findings, rule, "review-pattern"));
  }

  for (const rule of TOOL_RULES) {
    rule.run(bind(ctx, findings, rule, "tool"));
  }
  dropSuperseded(findings, CUSTOM_RULES);

  const humanChecks = HUMAN_CHECKS.map((check) => ({ ...check }));
  if (!images.some((image) => /(^|\/)(listing|assets)\//.test(image.rel)) && !files.some((file) => /(^|\/)(listing|assets)\//.test(file.rel))) {
    humanChecks.push({
      id: "listing-assets",
      message: "No listing/ or assets/ folder was found. A public listing still needs a 144×144 icon, a 1360×800 screenshot, and release notes. This is not a failure."
    });
  }
  return {
    ...finish(findings, skipped, true, humanChecks, collectViews(files, manifest)),
    addonDir: dir,
    design: detectDesign(given, dir, files),
    access: detectAccess(files)
  };
}

/** A custom rule may name a stricter Adobe rule that already covers the same line. */
function dropSuperseded(findings, customRules) {
  const superseded = new Map(customRules.filter((rule) => rule.supersededBy).map((rule) => [rule.id, rule.supersededBy]));
  if (!superseded.size) return;
  for (let i = findings.length - 1; i >= 0; i -= 1) {
    const by = superseded.get(findings[i].id);
    if (by && findings.some((other) => other.id === by && other.file === findings[i].file && other.line === findings[i].line)) findings.splice(i, 1);
  }
}

function detectAccess(files) {
  const file = files.find((entry) => MARKUP_EXT.test(entry.rel) && /license[_-]?key|gumroad|purchaseCode|\bsignIn\b|sign-in|\blogIn\b|I have a key|Get a license/i.test(entry.code));
  return { needsCredential: Boolean(file), file: file?.rel || "" };
}

function resolveAddonDir(given) {
  if (fs.existsSync(path.join(given, "manifest.json"))) return given;
  if (fs.existsSync(path.join(given, "src", "manifest.json"))) return path.join(given, "src");
  return given;
}

function bind(ctx, findings, rule, kind) {
  return {
    ...ctx,
    add(file, line, message, suggestion) {
      findings.push(item(rule.id, rule.severity, file, line, message, suggestion, {
        kind,
        url: rule.url || "",
        sourceKey: rule.sourceKey || rule.id
      }));
    }
  };
}

function finish(findings, skipped, scanned, humanChecks = HUMAN_CHECKS, views = []) {
  return {
    ok: scanned && findings.every((finding) => finding.severity !== "error"),
    findings,
    skipped,
    humanChecks,
    views
  };
}

function item(id, severity, file, line, message, suggestion, source) {
  return { id, severity, file, line, message, suggestion, source };
}

const SCREEN_SKIP = new Set(["Suspense", "Fragment", "StrictMode", "Provider"]);

function collectViews(files, manifest) {
  const views = [];
  const testId = manifest?.testId ? String(manifest.testId) : "";
  const preview = files.some((file) => /preview=1|["'`]preview["'`]\s*\)\s*===\s*["'`]1["'`]/.test(file.text));
  const query = preview ? "?preview=1" : "";
  for (const entry of manifest?.entryPoints || []) {
    if (!entry?.main) continue;
    const pathPart = testId ? `${testId}/${entry.main}` : entry.main;
    views.push({
      kind: "document",
      name: entry.id || entry.main,
      file: "manifest.json",
      line: 1,
      url: `https://localhost:5241/${pathPart}${query}`
    });
  }
  const shell = pickShell(files);
  if (shell) {
    const local = localComponents(shell);
    const seen = new Set();
    shell.lines.forEach((line, index) => {
      if (!/(?:&&|\?)/.test(line)) return;
      const chunk = shell.lines.slice(index, index + 8).join(" ");
      const start = chunk.search(/&&|\?/);
      const name = [...chunk.slice(start).matchAll(/<([A-Z][A-Za-z0-9]+)/g)].map((hit) => hit[1]).find((tag) => local.has(tag) && !SCREEN_SKIP.has(tag) && !/Hint$|Mark$|Toast$/.test(tag));
      if (!name || seen.has(name)) return;
      seen.add(name);
      views.push({ kind: "screen", name, file: shell.rel, line: index + 1 });
    });
  }
  const routed = new Set();
  for (const file of files) {
    if (!/\.(jsx|tsx)$/i.test(file.rel)) continue;
    file.lines.forEach((line, index) => {
      for (const match of line.matchAll(/element:\s*<([A-Z][A-Za-z0-9]+)/g)) {
        const name = match[1];
        if (name === "Navigate" || routed.has(name)) continue;
        routed.add(name);
        views.push({ kind: "screen", name, file: file.rel, line: index + 1 });
      }
    });
  }
  let controls = 0;
  for (const file of files) {
    if (!/\.(html?|jsx|tsx)$/i.test(file.rel)) continue;
    file.lines.forEach((line, index) => {
      if (controls >= 40) return;
      const label = line.match(/aria-label=["']([^"']+)["']/) || line.match(/<button\b[^>]*>([^<]+)</i);
      const name = label?.[1]?.trim();
      if (!name) return;
      views.push({ kind: "control", name, file: file.rel, line: index + 1 });
      controls += 1;
    });
  }
  return views;
}

function localComponents(file) {
  const names = new Set();
  for (const match of file.text.matchAll(/import\s+(?:([A-Z][A-Za-z0-9]+)|\{([^}]+)\})\s+from\s+["']\.\/[^"']+["']/g)) {
    if (match[1]) names.add(match[1]);
    if (match[2]) {
      for (const part of match[2].split(",")) {
        const name = part.trim().split(/\s+as\s+/).pop().trim();
        if (/^[A-Z]/.test(name)) names.add(name);
      }
    }
  }
  for (const match of file.text.matchAll(/const\s+([A-Z][A-Za-z0-9]+)\s*=\s*lazy\s*\(/g)) names.add(match[1]);
  return names;
}

function pickShell(files) {
  const candidates = files.filter((file) => /\.(jsx|tsx)$/i.test(file.rel));
  let best = null;
  let score = 0;
  for (const file of candidates) {
    const local = file.text.match(/from\s+["']\.\/[^"']+["']/g)?.length || 0;
    if (local > score) {
      best = file;
      score = local;
    }
  }
  return score > 0 ? best : null;
}

function generatedSource(rel, text) {
  if (/ffmpeg|h264-mp4-encoder/i.test(rel)) return true;
  const first = text.slice(0, 8000);
  const line = first.split("\n", 1)[0];
  return line.length > 2000;
}

const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

/** One unreadable folder or file must not stop a review. It is skipped, and the rest is still read. */
function walk(dir, root, files, images, newest) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink() || SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, root, files, images, newest);
      continue;
    }
    const rel = path.relative(root, full).split(path.sep).join("/");
    const ext = path.extname(entry.name).toLowerCase();
    try {
      const stat = fs.statSync(full);
      if (TEXT_EXT.has(ext)) {
        if (stat.size > MAX_TEXT_BYTES) continue;
        const text = fs.readFileSync(full, "utf8");
        if (generatedSource(rel, text)) continue;
        const code = blankComments(text);
        files.push({ rel, text, lines: text.split("\n"), code, codeLines: code.split("\n") });
        if ((MARKUP_EXT.test(rel) || /\.css$/i.test(rel) || /(^|\/)manifest\.json$/.test(rel)) && stat.mtimeMs > newest.mtimeMs) {
          Object.assign(newest, { rel, mtimeMs: stat.mtimeMs });
        }
      } else if (IMAGE_EXT.has(ext)) {
        if (stat.size > MAX_IMAGE_BYTES) continue;
        images.push({ rel, size: imageSize(fs.readFileSync(full)) });
      }
    } catch {
      // Unreadable or removed while scanning.
    }
  }
}
