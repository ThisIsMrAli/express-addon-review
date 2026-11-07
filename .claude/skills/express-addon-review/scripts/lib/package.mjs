import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/** Adobe: "Your add-on package file size must not exceed 50 MB." */
export const PACKAGE_LIMIT = 50 * 1024 * 1024;

/**
 * Read a zip with the standard library only. It lists names and sizes from the
 * central directory and unpacks one small file when asked. It does not extract.
 */
export function readZip(file) {
  const buffer = fs.readFileSync(file);
  const eocd = findEnd(buffer);
  if (eocd < 0) throw new Error(`${path.basename(file)} is not a zip file.`);
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressed = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.push({ name, size, compressed, method, local });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return {
    entries,
    bytes: buffer.length,
    read(name) {
      const entry = entries.find((item) => item.name === name);
      if (!entry || entry.size > 2 * 1024 * 1024) return null;
      const header = entry.local;
      const start = header + 30 + buffer.readUInt16LE(header + 26) + buffer.readUInt16LE(header + 28);
      const data = buffer.subarray(start, start + entry.compressed);
      try {
        return (entry.method === 0 ? data : zlib.inflateRawSync(data)).toString("utf8");
      } catch {
        return null;
      }
    }
  };
}

function findEnd(buffer) {
  const lowest = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= lowest; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

/** Zips at the project root. Anything deeper is a build artifact, not the upload. */
export function findPackages(root) {
  let names = [];
  try {
    names = fs.readdirSync(root);
  } catch {
    return [];
  }
  return names
    .filter((name) => /\.zip$/i.test(name))
    .map((name) => path.join(root, name))
    .filter((full) => {
      try {
        return fs.statSync(full).isFile();
      } catch {
        return false;
      }
    });
}

/** What a package check needs from one zip. */
export function describePackage(file) {
  const stat = fs.statSync(file);
  const base = { rel: path.basename(file), file, bytes: stat.size, mtimeMs: stat.mtimeMs };
  try {
    const zip = readZip(file);
    const manifestText = zip.read("manifest.json");
    let manifest = null;
    try {
      manifest = manifestText ? JSON.parse(manifestText) : null;
    } catch {
      manifest = null;
    }
    return { ...base, entries: zip.entries.map((entry) => entry.name), manifest };
  } catch (error) {
    return { ...base, entries: [], manifest: null, unreadable: error.message };
  }
}
