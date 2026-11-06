import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { imageSize } from "./lib/images.mjs";

const TARGET_W = 1360;
const TARGET_H = 800;

const args = parseArgs(process.argv.slice(2));
if (!args.input || !args.out) {
  process.stderr.write("Usage: node scripts/fit-listing-shot.mjs --input <1920x1280.png> --out <thumbnails/01-name.png>\n");
  process.exit(1);
}

const input = path.resolve(args.input);
const out = path.resolve(args.out);
const source = imageSize(fs.readFileSync(input));
if (!source) {
  process.stderr.write("The capture is not a PNG or JPEG.\n");
  process.exit(1);
}

const scaledH = Math.round(source.height * TARGET_W / source.width);
if (scaledH < TARGET_H) {
  process.stderr.write(`Scaling to width ${TARGET_W} makes the height ${scaledH}, which is shorter than ${TARGET_H}. Retake the page at 1920×1280.\n`);
  process.exit(1);
}

const offsetY = Math.round((scaledH - TARGET_H) / 2);
const tmp = path.join(os.tmpdir(), `listing-shot-${process.pid}.png`);
fs.mkdirSync(path.dirname(out), { recursive: true });
runSips(["-z", String(scaledH), String(TARGET_W), input, "--out", tmp]);
runSips(["--cropOffset", String(offsetY), "0", "-c", String(TARGET_H), String(TARGET_W), tmp, "--out", out]);
fs.rmSync(tmp, { force: true });

const fitted = imageSize(fs.readFileSync(out));
if (!fitted || fitted.width !== TARGET_W || fitted.height !== TARGET_H) {
  process.stderr.write(`Expected ${TARGET_W}×${TARGET_H}, got ${fitted ? `${fitted.width}×${fitted.height}` : "an unreadable file"}.\n`);
  process.exit(1);
}
process.stdout.write(`${out} ${fitted.width}x${fitted.height}\n`);

function runSips(sipsArgs) {
  const result = spawnSync("sips", sipsArgs, { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "sips failed. The fit step needs the macOS sips tool.\n");
    process.exit(1);
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--input") parsed.input = argv[++i];
    else if (argv[i] === "--out") parsed.out = argv[++i];
  }
  return parsed;
}
