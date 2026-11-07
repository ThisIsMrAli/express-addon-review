import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { findChrome, NO_CHROME, shoot } from "./chrome.mjs";
import { imageSize } from "./images.mjs";

export const TARGET_W = 1360;
export const TARGET_H = 800;

/** Scale to the target width, then cut the height equally from top and bottom. */
export function planFit(width, height) {
  const scaledH = Math.round(height * TARGET_W / width);
  if (scaledH < TARGET_H) {
    throw new Error(`Scaling to width ${TARGET_W} makes the height ${scaledH}, which is shorter than ${TARGET_H}. Retake the page at 1920×1280.`);
  }
  return { scaledH, offsetY: Math.round((scaledH - TARGET_H) / 2) };
}

/** The macOS `sips` tool is quick and needs no browser. Everywhere else a browser does the same job. */
export function pickEngine(requested = "auto", platform = process.platform) {
  if (requested === "sips" || requested === "chrome") return requested;
  return platform === "darwin" && fs.existsSync("/usr/bin/sips") ? "sips" : "chrome";
}

export function fitImage({ input, out, engine = "auto" }) {
  const source = imageSize(fs.readFileSync(input));
  if (!source) throw new Error("The capture is not a PNG or JPEG.");
  const { scaledH, offsetY } = planFit(source.width, source.height);
  fs.mkdirSync(path.dirname(out), { recursive: true });

  if (pickEngine(engine) === "sips") fitWithSips(input, out, scaledH, offsetY);
  else fitWithChrome(input, out, scaledH, offsetY);

  const fitted = imageSize(fs.readFileSync(out));
  if (!fitted || fitted.width !== TARGET_W || fitted.height !== TARGET_H) {
    throw new Error(`Expected ${TARGET_W}×${TARGET_H}, got ${fitted ? `${fitted.width}×${fitted.height}` : "an unreadable file"}.`);
  }
  return fitted;
}

function fitWithSips(input, out, scaledH, offsetY) {
  const tmp = path.join(os.tmpdir(), `listing-shot-${process.pid}.png`);
  try {
    runSips(["-z", String(scaledH), String(TARGET_W), input, "--out", tmp]);
    runSips(["--cropOffset", String(offsetY), "0", "-c", String(TARGET_H), String(TARGET_W), tmp, "--out", out]);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function runSips(args) {
  const result = spawnSync("sips", args, { encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(result.stderr || result.stdout || "sips failed.");
}

function fitWithChrome(input, out, scaledH, offsetY) {
  const chrome = findChrome();
  if (!chrome) throw new Error(NO_CHROME);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "express-addon-review-fit-"));
  try {
    const page = path.join(dir, "fit.html");
    // Explicit boxes. A negative margin on the image left a band at the bottom in headless Chrome.
    fs.writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${TARGET_W}px;height:${TARGET_H}px;overflow:hidden;background:#f8f9fa}.crop{position:absolute;left:0;top:0;width:${TARGET_W}px;height:${TARGET_H}px;overflow:hidden}img{position:absolute;left:0;top:-${offsetY}px;width:${TARGET_W}px;height:${scaledH}px}</style><div class="crop"><img src="${pathToFileURL(input).href}"></div>`);
    shoot({ chrome, url: pathToFileURL(page).href, out, width: TARGET_W, height: TARGET_H, scale: 1 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
