#!/usr/bin/env node
/**
 * Fits one 1920×1280 capture to the 1360×800 listing size.
 * `render-listing.mjs` calls this for every page. Run it by hand only to refit one image.
 */
import path from "node:path";
import { fitImage } from "./lib/fit.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.input || !args.out) {
  process.stderr.write("Usage: node scripts/fit-listing-shot.mjs --input <1920x1280.png> --out <final/01-name.png> [--engine auto|sips|chrome]\n");
  process.exit(1);
}

try {
  const input = path.resolve(args.input);
  const out = path.resolve(args.out);
  const fitted = fitImage({ input, out, engine: args.engine });
  process.stdout.write(`${out} ${fitted.width}x${fitted.height}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--input") parsed.input = argv[++i];
    else if (argv[i] === "--out") parsed.out = argv[++i];
    else if (argv[i] === "--engine") parsed.engine = argv[++i];
  }
  return parsed;
}
