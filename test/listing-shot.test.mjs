import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { imageSize } from "../.claude/skills/express-addon-review/scripts/lib/images.mjs";

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
