import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Chromium-family browsers, best first. Any of them takes the same flags. */
export function chromeCandidates(platform = process.platform, env = process.env) {
  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
    ];
  }
  if (platform === "win32") {
    const roots = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter(Boolean);
    const relative = [
      "Google\\Chrome\\Application\\chrome.exe",
      "Microsoft\\Edge\\Application\\msedge.exe",
      "Chromium\\Application\\chrome.exe"
    ];
    return roots.flatMap((root) => relative.map((name) => path.win32.join(root, name)));
  }
  const names = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "microsoft-edge-stable"];
  const dirs = String(env.PATH || "/usr/local/bin:/usr/bin:/bin:/snap/bin").split(path.delimiter).filter(Boolean);
  return dirs.flatMap((dir) => names.map((name) => path.join(dir, name)));
}

/** `CHROME_PATH` wins. Returns null when nothing is installed. */
export function findChrome({ platform = process.platform, env = process.env, exists = fs.existsSync } = {}) {
  if (env.CHROME_PATH && exists(env.CHROME_PATH)) return env.CHROME_PATH;
  return chromeCandidates(platform, env).find((candidate) => exists(candidate)) || null;
}

export const NO_CHROME =
  "No Chrome, Edge, or Chromium was found. Install one, or set CHROME_PATH to its executable.";

/** Photographs `url` at an exact viewport. Throws when no file comes out. */
export function shoot({ chrome, url, out, width, height, scale = 1, background = "FFFFFFFF" }) {
  // A fresh profile stops a running Chrome from swallowing the command.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "express-addon-review-chrome-"));
  fs.rmSync(out, { force: true });
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profile}`,
    `--force-device-scale-factor=${scale}`,
    `--window-size=${width},${height}`,
    `--default-background-color=${background}`,
    `--screenshot=${out}`,
    url
  ];
  // Linux CI containers run as root, where Chrome refuses to start with its sandbox.
  if (process.platform === "linux" && typeof process.getuid === "function" && process.getuid() === 0) args.unshift("--no-sandbox");
  try {
    spawnSync(chrome, args, { encoding: "utf8", timeout: 60_000, stdio: ["ignore", "ignore", "ignore"] });
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
  if (!fs.existsSync(out)) throw new Error(`Chrome did not write ${out}. Run it by hand to see why: ${chrome} --headless=new --screenshot=...`);
}
