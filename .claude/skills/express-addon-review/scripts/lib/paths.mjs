import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const skillRoot = path.resolve(here, "../..");
export const liveDir = path.join(skillRoot, "references", "live");
export const assetsDir = path.join(skillRoot, "assets", "dashboard");

/** Reviews live outside the skill and outside the add-on, so neither folder collects output. */
export const homeDir = path.join(os.homedir(), ".express-addon-review");
const pointer = path.join(homeDir, "current.json");

export function defaultOut(slug) {
  return path.join(homeDir, slug);
}

export function rememberOut(out) {
  fs.mkdirSync(homeDir, { recursive: true });
  fs.writeFileSync(pointer, `${JSON.stringify({ out, at: new Date().toISOString() })}\n`);
}

/** The folder the last review wrote, or null before any review has run. */
export function rememberedOut() {
  try {
    const last = JSON.parse(fs.readFileSync(pointer, "utf8")).out;
    return last && fs.existsSync(last) ? last : null;
  } catch {
    return null;
  }
}

/** `--out`, then EXPRESS_REVIEW_OUT, then the folder the last review wrote. */
export function resolveOut(explicit) {
  if (explicit) return path.resolve(explicit);
  if (process.env.EXPRESS_REVIEW_OUT) return path.resolve(process.env.EXPRESS_REVIEW_OUT);
  try {
    const last = JSON.parse(fs.readFileSync(pointer, "utf8")).out;
    if (last && fs.existsSync(last)) return last;
  } catch {
    // No review has run yet.
  }
  throw new Error("No review folder. Run review.mjs first, or pass --out.");
}
