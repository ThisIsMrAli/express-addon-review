import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { findingsFor, idsFor, manifest, project, zip, docs } from "./helpers.mjs";
import { scanAddon } from "../.claude/skills/express-addon-review/scripts/lib/scan.mjs";
import { readZip } from "../.claude/skills/express-addon-review/scripts/lib/package.mjs";

const built = { "manifest.json": JSON.stringify(manifest), "index.html": "<html></html>" };
const ids = (files, options) => idsFor(files, options).filter((id) => id.startsWith("package-"));

test("a good package has no findings", () => {
  assert.deepEqual(ids({ "dist.zip": zip(built) }), []);
});

test("zipping the folder instead of its contents is the MANIFEST_NOT_FOUND_ERROR upload", () => {
  const found = findingsFor({ "dist.zip": zip({ "dist/manifest.json": "{}", "dist/index.html": "" }) }).find((item) => item.id === "package-root");
  assert.ok(found);
  assert.match(found.message, /folder "dist\/"/);
  assert.match(found.message, /MANIFEST_NOT_FOUND_ERROR/);
  assert.match(found.suggestion, /npm run package/);
  assert.ok(ids({ "dist.zip": zip({ "index.html": "" }) }).includes("package-root"));
});

test("hidden files in the zip are named", () => {
  const found = findingsFor({ "dist.zip": zip({ ...built, ".DS_Store": "x", "__MACOSX/._a": "x", "assets/.env": "x" }) }).find((item) => item.id === "package-hidden");
  assert.ok(found);
  assert.match(found.message, /\.DS_Store/);
  assert.match(found.suggestion, /-x '\*\*\/\.\*'/);
  assert.deepEqual(ids({ "dist.zip": zip({ ...built, "assets/logo.png": "x", "static/.well-known": "" }) }), ["package-hidden"], "only .well-known style names count as hidden");
});

test("a package over 50 MB is refused, and one just under is not", () => {
  const big = zip({ ...built, "assets/video.bin": Buffer.alloc(51 * 1024 * 1024) });
  const found = findingsFor({ "dist.zip": big }).find((item) => item.id === "package-size");
  assert.ok(found);
  assert.match(found.message, /51\.\d MB/);
  assert.deepEqual(ids({ "dist.zip": zip({ ...built, "assets/video.bin": Buffer.alloc(49 * 1024 * 1024) }) }), []);
});

test("an entry file the manifest names must be inside the zip", () => {
  const manifestText = JSON.stringify({ ...manifest, entryPoints: [{ type: "panel", id: "p", main: "index.html", documentSandbox: "code.js" }] });
  assert.deepEqual(ids({ "dist.zip": zip({ "manifest.json": manifestText, "index.html": "" }) }), ["package-entry"]);
  assert.deepEqual(ids({ "dist.zip": zip({ "manifest.json": manifestText, "index.html": "", "code.js": "" }) }), []);
});

test("a package older than the source, or of another version, is stale", () => {
  const dir = project({ "dist.zip": zip(built), "src/App.tsx": "export const A = 1;\n" });
  const old = new Date(Date.now() - 3600 * 1000);
  fs.utimesSync(path.join(dir, "dist.zip"), old, old);
  const stale = scanAddon(dir, { docs: docs() }).findings.find((item) => item.id === "package-stale");
  assert.ok(stale);
  assert.match(stale.message, /src\/App\.tsx changed after it was built/);
  assert.equal(stale.source.kind, "tool");

  const versioned = project({ "dist.zip": zip({ ...built, "manifest.json": JSON.stringify({ ...manifest, version: "0.9.0" }) }) });
  const mismatch = scanAddon(versioned, { docs: docs() }).findings.find((item) => item.id === "package-stale");
  assert.match(mismatch.message, /version 0\.9\.0 and manifest\.json says 1\.0\.0/);

  const fresh = project({ "dist.zip": zip(built), "src/App.tsx": "export const A = 1;\n" });
  const past = new Date(Date.now() - 3600 * 1000);
  fs.utimesSync(path.join(fresh, "src/App.tsx"), past, past);
  assert.equal(scanAddon(fresh, { docs: docs() }).findings.some((item) => item.id === "package-stale"), false);
});

test("a file that is not a zip is reported, not a crash", () => {
  const found = findingsFor({ "dist.zip": "this is not a zip" }).find((item) => item.id === "package-root");
  assert.match(found.message, /could not be read as a zip/);
});

test("a zip passed by path is checked too", () => {
  const dir = project({});
  const elsewhere = path.join(fs.mkdtempSync(path.join(path.dirname(dir), "out-")), "upload.zip");
  fs.writeFileSync(elsewhere, zip({ "dist/manifest.json": "{}" }));
  const report = scanAddon(dir, { docs: docs(), zips: [elsewhere] });
  assert.ok(report.findings.some((item) => item.id === "package-root" && item.file === "upload.zip"));
});

test("the reader lists entries and unpacks a deflated manifest", async () => {
  const zlib = await import("node:zlib");
  const file = path.join(project({}), "plain.zip");
  fs.writeFileSync(file, zip({ "manifest.json": "{\"a\":1}", "x/y.txt": "hi" }));
  const reader = readZip(file);
  assert.deepEqual(reader.entries.map((entry) => entry.name), ["manifest.json", "x/y.txt"]);
  assert.equal(reader.read("manifest.json"), "{\"a\":1}");
  assert.equal(reader.read("missing"), null);
  assert.equal(typeof zlib.deflateRawSync, "function");
});
