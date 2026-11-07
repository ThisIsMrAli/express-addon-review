import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { launch } from "./cdp.mjs";
import { skillRoot } from "./paths.mjs";
import { lineAt } from "./source.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PROBE = fs.readFileSync(path.join(skillRoot, "assets", "audit", "probe.js"), "utf8");

/** Things a review must never press: they change data, leave the panel, or cost money. */
const RISKY = /\b(delete|remove|reset|clear|erase|discard|unlink|disconnect|revoke|uninstall|sign ?out|log ?out|cancel (my )?(plan|subscription)|buy now|purchase|checkout)\b/i;
/** Controls that usually open another screen. They are pressed first. */
const OPENS = /\b(upgrade|settings|help|about|export|license|account|menu|more|filter|sort|add|new|open|create|learn|info|details|preview|options|start|continue|next|get started|browse|pack|guide)\b/i;
/** They only lead back to a screen already seen, so exploring them costs a reload and finds nothing. */
const LEADS_BACK = /^\s*(close|cancel|dismiss|back|done|no thanks|not now|×|x|✕)\s*$/i;
/** The button that moves an opening dialog along. */
const FORWARD = /^\s*(next|continue|get started|start( \w+){0,2}|let'?s go|begin|try it|explore|finish|got it)\s*$/i;
const REJECTED = /(invalid|incorrect|not (a )?valid|not recogni[sz]ed|did(n't| not) work|expired|already (been )?used|try again)/i;

// ---- the add-on's address -----------------------------------------------------------------------

function status(url) {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { rejectUnauthorized: false, timeout: 3000 }, (res) => {
      res.resume();
      resolve(res.statusCode || 0);
    });
    req.on("timeout", () => { req.destroy(); resolve(0); });
    req.on("error", () => resolve(0));
  });
}

export async function reachable(url) {
  const code = await status(url);
  return code > 0 && code < 500;
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".map": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".wasm": "application/wasm", ".txt": "text/plain; charset=utf-8", ".mp3": "audio/mpeg", ".mp4": "video/mp4"
};

/** Serves one folder on this computer only. It lists nothing and refuses to leave the folder. */
export function serveFolder(root) {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    let pathname = "/";
    try { pathname = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { /* bad path */ }
    const file = path.resolve(base, `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`);
    if (file !== base && !file.startsWith(base + path.sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
        return;
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" }).end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ port: server.address().port, close: () => server.close() }));
  });
}

const BUILD_DIRS = ["dist", "build", "out"];
const LOGIN_WORDS = /(please|must|need to|required to) (log|sign) ?in|(log ?in|sign ?in) (could not|failed|required|timed? ?out|to continue)|authenticat(e|ion) (failed|required)/i;

function readPackage(project) {
  try {
    return JSON.parse(fs.readFileSync(path.join(project, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

/** What can change a build's output. A picture or a log changing does not make the build stale. */
const BUILD_INPUT = new Set([".tsx", ".jsx", ".ts", ".js", ".mjs", ".cjs", ".html", ".vue", ".svelte", ".css", ".scss", ".less", ".json"]);

/** The newest change to something a build reads, so a build made before it is known to be stale. */
function newestChange(root, skip = "") {
  let newest = 0;
  let seen = 0;
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (seen > 8000) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIR.has(entry.name) && !entry.name.startsWith(".") && full !== skip) walk(full);
      } else if (BUILD_INPUT.has(path.extname(entry.name).toLowerCase()) && entry.name !== "package-lock.json") {
        seen += 1;
        try { newest = Math.max(newest, fs.statSync(full).mtimeMs); } catch { /* gone */ }
      }
    }
  };
  walk(root);
  return newest;
}

function builtFolder(project) {
  for (const name of BUILD_DIRS) {
    const dir = path.join(project, name);
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

function runBuild({ project, log, say }) {
  return new Promise((resolve) => {
    const logFile = fs.openSync(log, "w");
    const child = spawn("npm", ["run", "build"], { cwd: project, stdio: ["ignore", logFile, logFile], shell: process.platform === "win32", env: { ...process.env, BROWSER: "none" } });
    const begun = Date.now();
    const timer = setInterval(() => {
      say(`Building the add-on (${Math.round((Date.now() - begun) / 1000)}s)`);
      if (Date.now() - begun > 480_000) child.kill("SIGTERM");
    }, 3000);
    child.on("exit", (code) => { clearInterval(timer); resolve(code === 0); });
    child.on("error", () => { clearInterval(timer); resolve(false); });
  });
}

async function runDevServer({ project, url, log, say }) {
  const logFile = fs.openSync(log, "w");
  const child = spawn("npm", ["start"], { cwd: project, stdio: ["ignore", logFile, logFile], detached: process.platform !== "win32", shell: process.platform === "win32", env: { ...process.env, BROWSER: "none" } });
  child.unref();
  const stop = () => {
    try {
      if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else process.kill(-child.pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  };
  const begun = Date.now();
  while (Date.now() - begun < 240_000) {
    if (await reachable(url)) {
      await sleep(1500);
      return { ok: true, stop };
    }
    const tail = (() => { try { return fs.readFileSync(log, "utf8").slice(-4000); } catch { return ""; } })();
    if (child.exitCode !== null) {
      stop();
      return { ok: false, reason: LOGIN_WORDS.test(tail) ? "The dev server stopped because it needs an Adobe login." : `The dev server stopped on its own (exit ${child.exitCode}).` };
    }
    if (Date.now() - begun > 90_000 && LOGIN_WORDS.test(tail)) {
      stop();
      return { ok: false, reason: "The dev server is waiting for an Adobe login." };
    }
    say(`Starting the add-on's dev server (${Math.round((Date.now() - begun) / 1000)}s)`);
    await sleep(2000);
  }
  stop();
  return { ok: false, reason: "The dev server did not answer within 4 minutes." };
}

/**
 * Makes sure there is a panel to open, and returns its address with a stop().
 *
 * 1. Something already answers at `url` (the person's own dev server): use it.
 * 2. The add-on has a build script: build it if the build is older than the
 *    source, and serve the result here. This never asks for an Adobe login,
 *    and it is the package a reviewer is given.
 * 3. The add-on is plain files (no build): serve the folder with its manifest.
 * 4. Otherwise run `npm start` and wait, giving up if it waits for a login.
 */
export async function ensureServer({ url, project, addonDir, log, say }) {
  if (await reachable(url)) return { started: false, url, via: "running", stop() {} };

  const pkg = readPackage(project);
  const search = (() => { try { return new URL(url).search; } catch { return ""; } })();
  const buildLog = log.replace(/devserver\.log$/, "build.log");
  const failures = [];

  const serve = async (root, via, detail) => {
    const entry = fs.existsSync(path.join(root, "index.html")) ? "index.html" : "";
    if (!entry) return null;
    const handle = await serveFolder(root);
    say(detail);
    return { started: true, url: `http://127.0.0.1:${handle.port}/${entry}${search}`, via, detail, stop: handle.close };
  };

  if (pkg?.scripts?.build) {
    let folder = builtFolder(project);
    // A build this tool made remembers the newest source it saw when it started. Editing source during the
    // build, or while the agent fixes bugs, then still reads as stale. A build someone else made is judged by its date.
    const reviewDir = path.dirname(log);
    const stampFile = path.join(reviewDir, "build-stamp.txt");
    const sourceNewest = newestChange(project, path.resolve(reviewDir) === path.resolve(project) ? "" : reviewDir);
    const stamp = (() => { try { return JSON.parse(fs.readFileSync(stampFile, "utf8")); } catch { return null; } })();
    const builtAt = folder ? fs.statSync(path.join(folder, "index.html")).mtimeMs : 0;
    const stale = !folder || (stamp && stamp.folder === folder ? sourceNewest > stamp.sourceNewest : sourceNewest > builtAt + 1000);
    if (stale) {
      say("Building the add-on so the panel can be opened without an Adobe login");
      if (await runBuild({ project, log: buildLog, say })) {
        folder = builtFolder(project);
        if (folder) fs.writeFileSync(stampFile, JSON.stringify({ folder, sourceNewest }));
      } else failures.push(`The build failed (log: ${buildLog}).`);
    }
    if (folder) {
      const served = await serve(folder, "build", `Opened the built panel from ${path.basename(folder)}/`);
      if (served) return served;
    }
  }

  if (!pkg?.scripts?.build && addonDir && fs.existsSync(path.join(addonDir, "index.html"))) {
    const served = await serve(addonDir, "files", "Opened the add-on's own files");
    if (served) return served;
  }

  if (pkg?.scripts?.start) {
    say("Starting the add-on's dev server");
    const dev = await runDevServer({ project, url, log, say });
    if (dev.ok) return { started: true, url, via: "dev-server", detail: "Started the add-on's dev server", stop: dev.stop };
    failures.push(`${dev.reason} Its log is ${log}.`);
  }

  throw new Error(failures.length
    ? `The panel could not be opened. ${failures.join(" ")} Start the add-on yourself, then run this again with --url.`
    : `Nothing answers at ${url}, and the add-on has no build or start script. Start it yourself, then run this again with --url.`);
}

// ---- finding the place in the code --------------------------------------------------------------

const SOURCE_EXT = new Set([".tsx", ".jsx", ".ts", ".js", ".mjs", ".html", ".vue", ".svelte"]);
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", "coverage", "review-output"]);

export function readSources(root) {
  const files = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length > 2500) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIR.has(entry.name) && !entry.name.startsWith(".")) walk(full);
      } else if (SOURCE_EXT.has(path.extname(entry.name))) {
        try {
          if (fs.statSync(full).size > 300_000) continue;
          files.push({ rel: path.relative(root, full).split(path.sep).join("/"), text: fs.readFileSync(full, "utf8") });
        } catch {
          // Unreadable file.
        }
      }
    }
  };
  walk(root);
  return files;
}

/**
 * Where in the code a screen's text lives, as `{ file, line }`.
 *
 * A label found in one place names it. A label found in several ("Close") is settled
 * by the rest of the screen's text: the file that holds the most of it wins, and only
 * when it clearly wins. A guess would send the agent to the wrong file, so there is none.
 */
export function whereInSource(files, needles, context = []) {
  const around = [...new Set(context.map((item) => String(item || "").trim()).filter((item) => item.length >= 4))];
  let best = null;
  for (const needle of needles.map((item) => String(item || "").trim()).filter((item) => item.length >= 3)) {
    const hits = [];
    for (const file of files) {
      const at = file.text.indexOf(needle);
      if (at < 0) continue;
      hits.push({ file: file.rel, line: lineAt(file.text, at), score: around.filter((item) => item !== needle && file.text.includes(item)).length });
    }
    if (!hits.length || hits.length > 12) continue;
    hits.sort((a, b) => b.score - a.score);
    const clear = hits.length === 1 || (hits[0].score > 0 && hits[0].score > (hits[1]?.score ?? -1));
    if (!clear) continue;
    if (!best || hits[0].score > best.score) best = hits[0];
    if (best.score > 0) break;
  }
  return best ? { file: best.file, line: best.line } : null;
}

// ---- driving the panel --------------------------------------------------------------------------

/** Waits until the page stops changing, so a screen is measured after it has painted. */
async function settle(page, minMs, maxMs) {
  const begun = Date.now();
  let last = "";
  let stable = 0;
  await sleep(minMs);
  while (Date.now() - begun < maxMs) {
    const now = await page.eval("document.body ? document.body.innerText.length + ':' + document.getElementsByTagName('*').length : ''").catch(() => "");
    if (now && now === last) {
      stable += 1;
      if (stable >= 2) return;
    } else {
      stable = 0;
    }
    last = now;
    await sleep(150);
  }
}

async function enterLicense(page, license) {
  const found = await page.eval("window.__expressReview.licenseField()");
  if (!found) return { present: false };
  const before = await page.eval("document.body.innerText");
  await page.click(found.field.x, found.field.y);
  await page.type(license);
  if (found.button) await page.click(found.button.x, found.button.y);
  else await page.key("Enter", "Enter", 13);
  await settle(page, 900, 7000);
  const after = await page.eval("document.body.innerText");
  const stillThere = await page.eval("Boolean(window.__expressReview.licenseField())");
  const rejected = REJECTED.test(after) && !REJECTED.test(before);
  return { present: true, rejected, unclear: stillThere && !rejected && after === before };
}

/** Loads the panel and presses its way to a screen. False when the way no longer exists. */
async function reach(page, url, trail, license, outcome) {
  await page.forget(new URL(url).origin);
  await page.goto(url);
  await settle(page, 300, 9000);
  for (const step of trail) {
    if (step.type === "license") {
      if (!license) return false;
      const result = await enterLicense(page, license);
      if (result.present && outcome) Object.assign(outcome, result);
      continue;
    }
    const at = await page.eval(`window.__expressReview.locate(${JSON.stringify(step.key)})`);
    if (!at) return false;
    await page.click(at.x, at.y);
    await settle(page, 250, 4500);
    const href = await page.eval("location.href").catch(() => "");
    if (href && new URL(href).origin !== new URL(url).origin) return false;
  }
  return true;
}

/** Going backwards inside an opening dialog only shows the step before. */
const STEPS_BACK = /^\s*(back|previous|prev|‹|<|←)\s*$/i;

/**
 * An opening dialog (a welcome tour, a notice) hides the panel behind it, and its Next, Skip, and
 * Close buttons are the way in. Those are pressed from it, and cost no depth.
 */
function worthPressing(item, tour = false) {
  if (item.type === "file" || item.download) return false;
  if (RISKY.test(item.label)) return false;
  if (tour ? STEPS_BACK.test(item.label) : LEADS_BACK.test(item.label)) return false;
  if (/^https?:/i.test(item.href) || /^mailto:|^tel:/i.test(item.href)) return false;
  if (item.groupSize >= 5 && item.groupIndex > 0) return false;
  return true;
}

function rank(item) {
  if (FORWARD.test(item.label)) return -1;
  if (item.role === "tab") return 0;
  if (OPENS.test(item.label)) return 1;
  if (item.groupSize >= 5) return 3;
  return 2;
}

/**
 * Walks the panel and measures every screen it can reach, in each theme.
 * Light is the discovery pass. Dark replays the screens light found.
 */
export async function walkPanel({ url, themes = ["light", "dark"], maxStates = 28, budgetMs = 300_000, maxDepth = 2, license = "", rootTrail = [], known = new Set(), shotDir, progress = () => {} }) {
  const page = await launch({ width: 320, height: 800, scale: 2 });
  const began = Date.now();
  const states = [];
  const outcome = {};
  const timeLeft = () => budgetMs - (Date.now() - began);
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: PROBE });
    fs.mkdirSync(shotDir, { recursive: true });
    let n = 0;
    const capture = async (state, result, theme) => {
      n += 1;
      const bad = result.findings.length > 0;
      if (bad) {
        const first = result.findings.find((item) => item.scrollY > 0);
        if (first) await page.eval(`window.scrollTo(0, ${Number(first.scrollY) || 0})`);
        await page.eval(`window.__expressReview.mark(${JSON.stringify(result.findings.filter((item) => !item.scrollY || item.scrollY === first?.scrollY).slice(0, 6))})`);
      }
      const file = path.join(shotDir, `audit-${String(n).padStart(2, "0")}-${theme}.png`);
      await page.screenshot(file);
      if (bad) await page.eval("window.__expressReview.clear(); window.scrollTo(0, 0)");
      return file;
    };

    // Light: find the screens.
    const first = themes[0];
    await page.media(first);
    const queue = [{ trail: rootTrail, label: rootTrail.length ? "After the license" : "Home", tour: true }];
    const seen = new Set(known);
    const pressed = new Set();
    // Light finds the screens and dark replays them, so light may use only half the time.
    while (queue.length && states.length < maxStates && Date.now() - began < budgetMs * 0.5) {
      const item = queue.shift();
      // Light does not know yet how many screens there are, so it counts what it has found instead of guessing a total.
      progress({ phase: first, found: states.length, doing: `${cap(first)} · ${item.label}` });
      if (!(await reach(page, url, item.trail, license, outcome).catch(() => false))) continue;
      const result = await page.eval("window.__expressReview.audit()");
      if (seen.has(result.signature)) continue;
      seen.add(result.signature);
      const intro = item.tour && !result.modal && item.trail.length > rootTrail.length;
      const label = intro ? "Home (after the opening dialog)" : item.label;
      const state = { label, trail: item.trail, modal: result.modal, texts: result.texts || [], findings: result.findings.map((finding) => ({ ...finding, theme: first })), signature: result.signature, shots: {} };
      state.shots[first] = await capture(state, result, first);
      states.push(state);

      const clicks = (trail) => trail.filter((step) => step.type === "click" && !step.tour).length;
      const depth = clicks(item.trail) - clicks(rootTrail);
      // A dialog that opens with the panel is not a screen to explore from, it is in the way.
      const inTour = Boolean(item.tour && result.modal);
      const trailHasLicenseField = await page.eval("Boolean(window.__expressReview.licenseField())");
      if (trailHasLicenseField) state.licenseField = true;
      if (depth < maxDepth && (!inTour || item.trail.filter((step) => step.tour).length < 8)) {
        const { list } = await page.eval("window.__expressReview.candidates()");
        // A control that is on every screen (a filter, a tab bar) is pressed once, where it is first met.
        const where = result.modal ? result.modal.selector : "page";
        const fresh = (candidate) => inTour || !pressed.has(`${where}|${candidate.key}`);
        const next = list.filter((candidate) => worthPressing(candidate, inTour) && fresh(candidate)).sort((a, b) => rank(a) - rank(b)).slice(0, inTour ? 6 : depth === 0 ? 12 : 8);
        const base = ["Home", "After the license", "Home (after the opening dialog)"].includes(state.label);
        for (const candidate of next) {
          if (!inTour) pressed.add(`${where}|${candidate.key}`);
          const name = candidate.label || candidate.tag;
          queue.push({
            trail: [...item.trail, { type: "click", key: candidate.key, label: candidate.label, ...(inTour ? { tour: true } : {}) }],
            label: base ? name : `${state.label} › ${name}`,
            tour: inTour
          });
        }
      }
      // A dialog that only closes with Escape is a smaller problem than one with no way out at all.
      if (result.findings.some((finding) => finding.kind === "dialog-no-exit")) {
        await page.key("Escape", "Escape", 27);
        await sleep(350);
        const after = await page.eval("window.__expressReview.audit().modal");
        if (!after) {
          for (const finding of state.findings) {
            if (finding.kind === "dialog-no-exit") {
              finding.severity = "warn";
              finding.message = "This dialog has no visible Close, Cancel, or Back control. It only closes with Escape, and touch users have no Escape key.";
            }
          }
        }
      }
    }

    // Other themes: replay what light found.
    for (const theme of themes.slice(1)) {
      await page.media(theme);
      let done = 0;
      for (const state of states) {
        if (timeLeft() < 5000) break;
        progress({ phase: theme, done, total: states.length, exact: true, doing: `${cap(theme)} · ${state.label}` });
        done += 1;
        if (!(await reach(page, url, state.trail, license).catch(() => false))) continue;
        const result = await page.eval("window.__expressReview.audit()");
        const fresh = result.findings.filter((finding) => !state.findings.some((old) => old.kind === finding.kind && old.selector === finding.selector));
        for (const finding of fresh) state.findings.push({ ...finding, theme });
        if (result.findings.length || state === states[0]) state.shots[theme] = await capture(state, result, theme);
      }
    }
    progress({ phase: "done", done: states.length, total: states.length, exact: true, doing: "Finishing" });
    // Say what ended the walk, so the report can tell the person whether more time or a higher screen limit would help.
    const truncated = queue.length === 0 ? "" : states.length >= maxStates ? "screens" : "time";
    return { states, outcome, seen: page.seen, elapsedMs: Date.now() - began, truncated, left: queue.length };
  } finally {
    await page.close();
  }
}

function cap(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The notes an audit means to leave behind, with the file and line when they can be found.
 * The same problem on several screens (a footer, a tab bar, a dialog with three steps) is one note.
 */
export function toNotes(states, sources, { licensed = false } = {}) {
  const notes = new Map();
  for (const state of states) {
    for (const finding of state.findings) {
      const key = `${finding.kind}|${finding.selector}|${finding.label}`;
      const existing = notes.get(key);
      if (existing) {
        if (!existing.themes.includes(finding.theme)) existing.themes.push(finding.theme);
        if (!existing.screens.includes(state.label)) existing.screens.push(state.label);
        continue;
      }
      const source = whereInSource(sources, [finding.label, state.modal?.label, state.label.split(" › ").at(-1)], state.texts || []);
      notes.set(key, {
        key,
        rule: finding.kind,
        severity: finding.severity,
        screen: `${state.label}${licensed ? " (paid)" : ""}`,
        screens: [state.label],
        text: `${finding.message} Fix: ${finding.fix}`,
        selector: finding.selector,
        themes: [finding.theme],
        shotFile: state.shots[finding.theme] || state.shots.light || Object.values(state.shots)[0] || "",
        ...(source ? { source } : {})
      });
    }
  }
  return [...notes.values()].map(({ screens, ...note }) => {
    if (screens.length < 2) return note;
    const others = screens.slice(1);
    const named = others.slice(0, 3).join(", ");
    return { ...note, text: `${note.text} The same problem shows on ${others.length} other screen${others.length === 1 ? "" : "s"}: ${named}${others.length > 3 ? ", and more" : ""}.` };
  });
}
