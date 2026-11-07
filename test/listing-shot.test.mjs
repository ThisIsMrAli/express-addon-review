import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { png } from "./helpers.mjs";
import { imageSize } from "../.claude/skills/express-addon-review/scripts/lib/images.mjs";

test("a wide capture is fitted to 1360x800", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "listing-shot-"));
  const input = path.join(dir, "raw.png");
  const out = path.join(dir, "01-cover.png");
  fs.writeFileSync(input, png(400, 300));
  const result = spawnSync(process.execPath, [path.resolve(".claude/skills/express-addon-review/scripts/fit-listing-shot.mjs"), "--input", input, "--out", out], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(imageSize(fs.readFileSync(out)), { width: 1360, height: 800 });
});

test("a capture that is too short is rejected", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "listing-shot-"));
  const input = path.join(dir, "raw.png");
  const out = path.join(dir, "01-cover.png");
  fs.writeFileSync(input, png(1360, 100));
  const result = spawnSync(process.execPath, [path.resolve(".claude/skills/express-addon-review/scripts/fit-listing-shot.mjs"), "--input", input, "--out", out], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /shorter than 800/);
});
