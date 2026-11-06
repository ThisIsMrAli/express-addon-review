import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { ADOBE_RULES } from "../.claude/skills/express-addon-review/scripts/lib/adobe.mjs";
import { imageSize } from "../.claude/skills/express-addon-review/scripts/lib/images.mjs";
import { renderMarkdown } from "../.claude/skills/express-addon-review/scripts/lib/report.mjs";
import { scanAddon } from "../.claude/skills/express-addon-review/scripts/lib/scan.mjs";

function docs() {
  const pages = {};
  for (const rule of ADOBE_RULES) pages[rule.sourceKey] = `${pages[rule.sourceKey] || ""}\n${rule.evidence}`;
  return pages;
}

function addon(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "express-addon-"));
  for (const [name, body] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return dir;
}

function png(width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  const chunk = (type, data) => {
    const name = Buffer.from(type);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0);
    return Buffer.concat([len, name, data, crc]);
  };
  const rows = [];
  for (let y = 0; y < height; y += 1) rows.push(Buffer.concat([Buffer.from([0]), Buffer.alloc(width)]));
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c;
}

const manifest = {
  name: "Sample",
  version: "1.0.0",
  manifestVersion: 2,
  requirements: { apps: [{ name: "Express", apiVersion: 1 }] },
  entryPoints: [{ type: "panel", id: "panel1", main: "index.html" }]
};

test("a vendor bundle and a compiled sandbox are not source errors", () => {
  const dir = addon({
    "manifest.json": JSON.stringify({
      ...manifest,
      entryPoints: [{ type: "panel", id: "panel1", main: "index.html", documentSandbox: "code.js" }]
    }),
    "index.html": "<body><sp-theme>Adobe Express add-on</sp-theme></body>",
    "sandbox/code.ts": "export function start(){ return true; }\n",
    "public/ffmpeg-core.js": `var Module=${"x".repeat(3000)}; this.plugin = 1; fetch("https://example.com");\n`
  });
  const report = scanAddon(dir, { docs: docs() });
  const ids = report.findings.map((finding) => finding.id);
  assert.equal(ids.includes("sandbox-file"), false);
  assert.equal(ids.includes("spelling-add-on"), false);
  assert.equal(ids.includes("cancel-missing"), false);
});

test("a clean Express add-on passes when the fresh pages still state the rules", () => {
  const dir = addon({
    "manifest.json": JSON.stringify(manifest),
    "index.html": "<body><p>Make a poster in Adobe Express</p><sp-theme>Hi</sp-theme></body>"
  });
  const report = scanAddon(dir, { docs: docs() });
  assert.equal(report.ok, true, JSON.stringify(report.findings, null, 2));
  assert.equal(report.findings.length, 0);
  assert.equal(report.skipped.length, 0);
});

test("brand, theme, and cancel gaps are reported with an edit", () => {
  const dir = addon({
    "manifest.json": JSON.stringify({ ...manifest, requirements: { ...manifest.requirements, experimentalApis: true } }),
    "index.html": "<body><h1>Welcome to Express</h1><button onclick=\"alert('done')\">Go</button></body>",
    "src/api.js": "export async function encodeVideo(){ return fetch('https://example.com/encode'); }\n"
  });
  const report = scanAddon(dir, { docs: docs() });
  const ids = report.findings.map((item) => item.id);
  for (const id of ["name-adobe-express", "experimental-apis", "theme-missing", "modal-interrupt", "cancel-missing"]) {
    assert.ok(ids.includes(id), ids.join(","));
  }
  const name = report.findings.find((item) => item.id === "name-adobe-express");
  assert.match(name.suggestion, /Adobe Express/);
  assert.equal(name.line, 1);
  assert.equal(report.findings.find((item) => item.id === "cancel-missing").file, "src/api.js");
});

test("a missing manifest is an error before any Adobe page is required", () => {
  const dir = addon({ "index.html": "<p>Adobe Express</p>" });
  fs.rmSync(path.join(dir, "manifest.json"), { force: true });
  const report = scanAddon(dir, { docs: {} });
  assert.equal(report.ok, false);
  assert.equal(report.findings[0].id, "manifest-missing");
});

test("an Adobe check is skipped when the fresh page lost its sentence", () => {
  const dir = addon({
    "manifest.json": JSON.stringify(manifest),
    "index.html": "<body><h1>Welcome to Express</h1><sp-theme></sp-theme></body>"
  });
  const report = scanAddon(dir, { docs: {} });
  assert.equal(report.findings.some((item) => item.id === "name-adobe-express"), false);
  assert.ok(report.skipped.some((item) => item.id === "name-adobe-express"));
});

test("review patterns still run when no Adobe page was fetched", () => {
  const dir = addon({
    "manifest.json": JSON.stringify({ ...manifest, name: "Express Whiteboard" }),
    "index.html": "<body><div class=\"placeholder\">Drag a file</div><img alt=\"Figma mark\" src=\"figma.svg\"><p>You are unlocked</p><span class=\"crown\"></span></body>",
    "src/export.js": "export function encode(){ return renderGif(video); }\n"
  });
  const report = scanAddon(dir, { docs: {} });
  const ids = report.findings.map((item) => item.id);
  for (const id of ["name-looks-official", "paid-state-conflict", "third-party-brand", "export-without-cancel", "export-without-download", "placeholder-selectable"]) {
    assert.ok(ids.includes(id), ids.join(","));
  }
  assert.ok(report.findings.every((item) => item.source.kind === "review-pattern" || item.source.kind === "tool"));
});

test("the brand guide rejects Adobe Express add-on, and unpkg is a review pattern", () => {
  const dir = addon({
    "manifest.json": JSON.stringify(manifest),
    "index.html": "<body><p>Particle Pro Adobe Express Add-on</p><sp-theme>Adobe Express</sp-theme></body>",
    "src/boot.js": "import x from 'https://unpkg.com/some-lib';\n"
  });
  const report = scanAddon(dir, { docs: docs() });
  const order = report.findings.find((item) => item.id === "offering-name-order");
  assert.ok(order, report.findings.map((item) => item.id).join(","));
  assert.match(order.suggestion, /add-on for Adobe Express/);
  assert.equal(report.findings.some((item) => item.id === "unpkg-cdn"), true);
});

test("class names, preview dialogs, and help text are not code errors", () => {
  const dir = addon({
    "manifest.json": JSON.stringify(manifest),
    "index.html": "<body><p>Make a poster in Adobe Express</p><sp-theme></sp-theme></body>",
    "src/boot.tsx": "if (preview) document.documentElement.classList.add(\"addon-preview\");\nconst card = <div className=\"addon plugin\" id=\"addon\" />;\n",
    "src/preview.tsx": "function previewModal(){ return window.confirm(\"Continue\"); }\nconst preview = new URLSearchParams(location.search).get(\"preview\") === \"1\";\n",
    "src/catalog.ts": "export function loadCatalog(){ return fetch(\"/catalog.json\"); }\n",
    "src/Guide.tsx": "export function Guide(){ return \"download a transparent GIF or video\"; }\n",
    "src/license.ts": "export function verify(){ return fetch(\"/license\"); }\nconst copy = \"animations as a still, GIF, or video\";\n"
  });
  const report = scanAddon(dir, { docs: docs() });
  const ids = report.findings.map((item) => item.id);
  for (const id of ["spelling-add-on", "modal-interrupt", "cancel-missing", "export-without-cancel", "export-without-download"]) {
    assert.equal(ids.includes(id), false, ids.join(","));
  }
});

test("a visible addon label is still a spelling error", () => {
  const dir = addon({
    "manifest.json": JSON.stringify(manifest),
    "index.html": "<body><button>Save addon</button><sp-theme>Adobe Express</sp-theme></body>"
  });
  const report = scanAddon(dir, { docs: docs() });
  assert.equal(report.findings.some((item) => item.id === "spelling-add-on"), true);
});

test("index.html keywords are not listing copy", () => {
  const dir = addon({
    "manifest.json": JSON.stringify(manifest),
    "index.html": "<head><title>Get Started</title><meta name=\"keywords\" content=\"Adobe, Express, Add-On\"><meta name=\"description\" content=\"Adobe Express Add-on\"></head><body><p>Make a poster in Adobe Express</p><sp-theme></sp-theme></body>"
  });
  const report = scanAddon(dir, { docs: docs() });
  const ids = report.findings.map((item) => item.id);
  assert.equal(ids.includes("name-adobe-express"), false, ids.join(","));
  assert.equal(ids.includes("spelling-add-on"), false, ids.join(","));
  assert.equal(ids.includes("offering-name-order"), false, ids.join(","));
});

test("listing images are measured from the file header", () => {
  const dir = addon({
    "manifest.json": JSON.stringify(manifest),
    "index.html": "<body><sp-theme>Adobe Express</sp-theme></body>",
    "listing/icon.png": png(144, 144),
    "listing/screenshot.png": png(100, 50),
    "listing/adobe-logo.png": png(64, 64)
  });
  const report = scanAddon(dir, { docs: docs() });
  const ids = report.findings.map((item) => item.id);
  assert.ok(ids.includes("listing-screenshot"));
  assert.ok(ids.includes("adobe-logo-file"));
  assert.equal(ids.includes("listing-icon"), false);
  assert.deepEqual(imageSize(png(36, 36)), { width: 36, height: 36 });
});

test("a project-root thumbnail must be 1360 by 800", () => {
  const dir = addon({
    "src/manifest.json": JSON.stringify(manifest),
    "src/index.html": "<body><sp-theme>Adobe Express</sp-theme></body>",
    "thumbnails/01-cover.png": png(100, 50)
  });
  const report = scanAddon(dir, { docs: docs() });
  const shot = report.findings.find((item) => item.id === "listing-screenshot");
  assert.equal(shot?.file, "thumbnails/01-cover.png");
});

test("the walk list names the dev-server document and the shell screens", () => {
  const dir = addon({
    "manifest.json": JSON.stringify({ ...manifest, testId: "abc" }),
    "index.html": "<body><div id=\"root\"></div></body>",
    "src/ui.tsx": "const preview = new URLSearchParams(location.search).get(\"preview\") === \"1\";\nexport function App(){ return <Shell />; }\n",
    "src/Shell.tsx": [
      "import { Packs } from './Packs';",
      "import { Studio } from './Studio';",
      "export function Shell(){",
      "  return <main>{",
      "    open ? (",
      "      <Studio />",
      "    ) : <Packs />",
      "  }</main>;",
      "}"
    ].join("\n")
  });
  const report = scanAddon(dir, { docs: docs() });
  const document = report.views.find((view) => view.kind === "document");
  assert.equal(document.url, "https://localhost:5241/abc/index.html?preview=1");
  assert.ok(report.views.some((view) => view.kind === "screen" && view.name === "Studio"));
  const routed = addon({
    "manifest.json": JSON.stringify(manifest),
    "index.html": "<body><div id=\"root\"></div></body>",
    "src/App.tsx": "const routes = [{ path: \"/home\", element: <Home /> }, { path: \"/edit\", element: <Editor /> }];\n"
  });
  const routeReport = scanAddon(routed, { docs: docs() });
  assert.ok(routeReport.views.some((view) => view.kind === "screen" && view.name === "Home"));
  assert.ok(routeReport.views.some((view) => view.kind === "screen" && view.name === "Editor"));
});

test("a manifest in src/ is the add-on root", () => {
  const dir = addon({
    "package.json": JSON.stringify({ name: "demo" }),
    "src/manifest.json": JSON.stringify(manifest),
    "src/index.html": "<body><sp-theme></sp-theme><h1>Icons</h1></body>",
    "src/assets/data/catalog.json": JSON.stringify({ icons: ["crown-plus", "sherlock-icon", "doubleclick"] }),
    "src/export.tsx": "export function onCancel(){ return encodeGif(video); }\n"
  });
  const report = scanAddon(dir, { docs: docs() });
  const ids = report.findings.map((item) => item.id);
  assert.equal(ids.includes("manifest-missing"), false);
  assert.equal(ids.includes("crown-icon"), false);
  assert.equal(ids.includes("lock-icon"), false);
  assert.equal(ids.includes("third-party-ads"), false);
  assert.equal(ids.includes("export-without-cancel"), false);
  assert.equal(report.addonDir, path.join(dir, "src"));
  assert.equal(report.access.needsCredential, false);
});

test("a license key in source asks for a test credential", () => {
  const dir = addon({
    "manifest.json": JSON.stringify(manifest),
    "index.html": "<body><sp-theme>Adobe Express</sp-theme></body>",
    "src/license.ts": "export function verify(license_key){ return fetch('https://api.gumroad.com/v2/licenses/verify'); }\n"
  });
  const report = scanAddon(dir, { docs: docs() });
  assert.equal(report.access.needsCredential, true);
  assert.equal(report.access.file, "src/license.ts");
});

test("the markdown report separates Adobe findings from review patterns", () => {
  const markdown = renderMarkdown({
    addon: "Sample",
    findings: [
      { id: "crown-icon", severity: "error", file: "a.html", line: 2, message: "Crown", suggestion: "Remove it", source: { kind: "adobe", url: "https://developer.adobe.com/express/add-ons/docs/guides/build/distribute/guidelines/monetization" } },
      { id: "third-party-brand", severity: "warn", file: "a.html", line: 3, message: "Figma", suggestion: "Remove it", source: { kind: "review-pattern" } }
    ],
    skipped: [],
    humanChecks: [{ message: "Open the add-on." }],
    views: []
  });
  assert.match(markdown, /## Errors[\s\S]*crown-icon/);
  assert.match(markdown, /## Review patterns[\s\S]*third-party-brand/);
  assert.match(markdown, /https:\/\/developer\.adobe\.com\/express/);
});
