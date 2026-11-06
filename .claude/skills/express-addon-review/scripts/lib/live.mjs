import fs from "node:fs";
import path from "node:path";
import { liveDir } from "./paths.mjs";

const TEXT = new Set([".md", ".txt"]);

export function loadLive(dir = liveDir) {
  const docs = {};
  if (!fs.existsSync(dir)) return docs;
  walk(dir, (file) => {
    if (!TEXT.has(path.extname(file))) return;
    docs[path.relative(dir, file)] = fs.readFileSync(file, "utf8");
  });
  return docs;
}

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else visit(full);
  }
}
