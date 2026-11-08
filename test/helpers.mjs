import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { ADOBE_RULES } from "../.claude/skills/express-addon-review/scripts/lib/adobe.mjs";
import { scanAddon } from "../.claude/skills/express-addon-review/scripts/lib/scan.mjs";

/** Every rule's evidence sentence, as if the fresh docs still said it. */
export function docs() {
  const pages = {};
  for (const rule of ADOBE_RULES) pages[rule.sourceKey] = `${pages[rule.sourceKey] || ""}\n${rule.evidence}`;
  return pages;
}

export const manifest = {
  name: "Sample",
  version: "1.0.0",
  manifestVersion: 2,
  requirements: { apps: [{ name: "Express", apiVersion: 1 }] },
  entryPoints: [{ type: "panel", id: "panel1", main: "index.html" }]
};

/** A project in a temp folder. Object values are written as JSON. */
export function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "express-fixture-"));
  const all = { "manifest.json": manifest, "index.html": '<body><sp-theme system="express">Adobe Express</sp-theme></body>', ...files };
  for (const [name, body] of Object.entries(all)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  }
  return dir;
}

/** The ids a scan reports for a project. */
export function idsFor(files, options = {}) {
  return scanAddon(project(files), { docs: docs(), ...options }).findings.map((finding) => finding.id);
}

export function findingsFor(files, options = {}) {
  return scanAddon(project(files), { docs: docs(), ...options }).findings;
}

function crc32(buffer) {
  let c = ~0;
  for (const byte of buffer) {
    c ^= byte;
    for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** A zip with stored (uncompressed) entries, enough for the package checks. */
export function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, body] of Object.entries(entries)) {
    const data = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const nameBytes = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(20, 6);
    head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(data.length, 20);
    head.writeUInt32LE(data.length, 24);
    head.writeUInt16LE(nameBytes.length, 28);
    head.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    central.push(head, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/** A flat gray PNG of an exact size. */
export function png(width, height) {
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
