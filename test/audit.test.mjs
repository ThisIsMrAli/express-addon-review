import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findChrome } from "../.claude/skills/express-addon-review/scripts/lib/chrome.mjs";
import { launch } from "../.claude/skills/express-addon-review/scripts/lib/cdp.mjs";
import { readSession, startSession } from "../.claude/skills/express-addon-review/scripts/lib/session.mjs";
import { ensureServer, loadsSdkAsScript, readSources, sdkStandIn, walkPanel, whereInSource } from "../.claude/skills/express-addon-review/scripts/lib/audit.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = path.join(root, ".claude/skills/express-addon-review");
const fixtures = path.join(root, "test/fixtures/audit");
const browser = findChrome() && !process.env.SKIP_BROWSER_TESTS ? {} : { skip: "No Chrome, Edge, or Chromium here, or SKIP_BROWSER_TESTS is set." };

test("source lookup names the file and line of a label, and refuses a label that is everywhere", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "express-source-"));
  fs.mkdirSync(path.join(dir, "node_modules"));
  fs.writeFileSync(path.join(dir, "Guide.tsx"), 'export const a = 1;\nexport const g = <Dialog aria-label="Welcome guide">Close</Dialog>;\n');
  fs.writeFileSync(path.join(dir, "Other.tsx"), "export const b = <button>Close</button>;\n");
  fs.writeFileSync(path.join(dir, "Third.tsx"), "export const c = <button>Close</button>;\n");
  fs.writeFileSync(path.join(dir, "Fourth.tsx"), "export const d = <button>Close</button>;\n");
  fs.writeFileSync(path.join(dir, "Fifth.tsx"), "export const e = <button>Close</button>;\n");
  fs.writeFileSync(path.join(dir, "node_modules", "Skip.tsx"), "Welcome guide");
  const files = readSources(dir);
  assert.equal(files.some((file) => file.rel.startsWith("node_modules")), false);
  assert.deepEqual(whereInSource(files, ["Welcome guide"]), { file: "Guide.tsx", line: 2 });
  assert.deepEqual(whereInSource(files, ["Close", "Welcome guide"]), { file: "Guide.tsx", line: 2 }, "five hits for Close is no lead, so the next needle is used");
  assert.equal(whereInSource(files, ["nothing like this", "ab"]), null);

  // Two places and nothing to tell them apart is a coin toss, and a wrong file costs the agent a detour.
  const pair = fs.mkdtempSync(path.join(os.tmpdir(), "express-source-pair-"));
  fs.writeFileSync(path.join(pair, "Left.tsx"), 'export const l = <button>Save changes</button>;\nexport const t = "Brand colors";\n');
  fs.writeFileSync(path.join(pair, "Right.tsx"), "export const r = <button>Save changes</button>;\n");
  assert.equal(whereInSource(readSources(pair), ["Save changes"]), null, "two hits and no tie-break is no lead");
  assert.deepEqual(whereInSource(readSources(pair), ["Save changes"], ["Brand colors"]), { file: "Left.tsx", line: 1 }, "the rest of the screen's text settles it");
});

// What the probe must say about each page. The Auto Icon bug is dialog-close-bottom.
const EXPECTED = {
  "blank.html": ["panel-blank"],
  "broken-image.html": ["image-broken"],
  "clean.html": [],
  "clipped-ok.html": [],
  "covered.html": ["control-covered"],
  "dialog-close-bottom.html": ["dialog-close-misplaced"],
  "dialog-gap.html": ["dialog-empty-space"],
  "dialog-no-exit.html": ["dialog-no-exit"],
  "dialog-ok.html": [],
  "font-off.html": ["font-off"],
  "footer-covers.html": ["control-covered"],
  "invisible-dialog.html": ["invisible-cover"],
  "layer-ok.html": [],
  "overlays-ok.html": [],
  "shadow-close.html": ["dialog-close-misplaced"],
  "sideways.html": ["scrolls-sideways"],
  "small-and-faint.html": ["click-without-keyboard", "low-contrast", "small-target", "small-type", "text-clipped"]
};

test("a panel that waits for Adobe's SDK still draws, because the audit answers that one request", browser, async () => {
  const page = await launch({ width: 320, height: 800, scale: 1 });
  try {
    await page.intercept("*add-on-sdk*", sdkStandIn("module"));
    await page.goto(`file://${path.join(fixtures, "sdk-module.html")}`);
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.match(await page.eval("document.body.innerText"), /Ready in (light|dark)/);
  } finally {
    await page.close();
  }
  const plain = await launch({ width: 320, height: 800, scale: 1 });
  try {
    await plain.intercept("*add-on-sdk*", sdkStandIn("script"));
    await plain.goto(`file://${path.join(fixtures, "sdk-script.html")}`);
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.match(await plain.eval("document.body.innerText"), /Ready by script/);
  } finally {
    await plain.close();
  }
  const files = [{ rel: "index.html", text: '<script src="https://new.express.adobe.com/static/add-on-sdk/sdk.js"></script>' }];
  assert.equal(loadsSdkAsScript(files), true);
  assert.equal(loadsSdkAsScript([{ rel: "index.html", text: '<script type="module" src="/static/add-on-sdk/sdk.js"></script>' }]), false);
  assert.equal(loadsSdkAsScript([{ rel: "index.html", text: '<div id="root"></div>' }]), false);
});

test("the probe finds each class of bug on its page, and nothing on a good one", browser, async () => {
  const page = await launch({ width: 320, height: 800, scale: 1 });
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: fs.readFileSync(path.join(skill, "assets/audit/probe.js"), "utf8") });
    for (const [name, kinds] of Object.entries(EXPECTED)) {
      await page.goto(`file://${path.join(fixtures, name)}`);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const result = await page.eval("window.__expressReview.audit()");
      assert.deepEqual([...new Set(result.findings.map((finding) => finding.kind))].sort(), kinds, name);
    }
  } finally {
    await page.close();
  }
});

test("the close button at the bottom of a dialog is an error that says where it is and how to fix it", browser, async () => {
  const page = await launch({ width: 320, height: 800, scale: 1 });
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: fs.readFileSync(path.join(skill, "assets/audit/probe.js"), "utf8") });
    await page.goto(`file://${path.join(fixtures, "dialog-close-bottom.html")}`);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const { findings, modal } = await page.eval("window.__expressReview.audit()");
    const bug = findings.find((finding) => finding.kind === "dialog-close-misplaced");
    assert.equal(bug.severity, "error");
    assert.match(bug.message, /bottom of the dialog \(\d+% down\)/);
    assert.match(bug.fix, /header, top right/);
    assert.equal(modal.label, "Welcome to Auto Icon");
  } finally {
    await page.close();
  }
});

// ---- the whole audit, on a small add-on served from here ---------------------------------------

function serve(state) {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    if (req.url.startsWith("/app.html")) {
      let html = fs.readFileSync(path.join(fixtures, "app.html"), "utf8");
      if (state.fixed) html = html.replace('params.get("fixed") === "1"', "true");
      res.writeHead(200, { "content-type": "text/html" });
      res.end(html);
      return;
    }
    res.writeHead(200);
    res.end("ok");
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, requests, port: server.address().port })));
}

function audit(out, args = [], env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(skill, "scripts/audit.mjs"), "--out", out, ...args], { env: { ...process.env, ...env } });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.on("close", () => {
      const last = stdout.trim().split("\n").at(-1);
      resolve({ stdout, result: JSON.parse(last) });
    });
  });
}

test("the audit walks a real panel: finds both dialogs' bugs, never presses Delete, and confirms a fix on the next run", { ...browser, timeout: 280_000 }, async () => {
  const state = { fixed: false };
  const { server, requests, port } = await serve(state);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "express-audit-out-"));
  const src = fs.mkdtempSync(path.join(os.tmpdir(), "express-audit-src-"));
  fs.writeFileSync(path.join(src, "Guide.tsx"), 'export const x = <Dialog aria-label="Welcome guide">Close</Dialog>;\n');
  const report = {
    ok: true, findings: [], addon: "Fixture", addonDir: src, projectPath: src, access: { needsCredential: true },
    views: [{ kind: "document", name: "panel", file: "manifest.json", line: 1, url: `http://127.0.0.1:${port}/app.html` }]
  };
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report));
  fs.writeFileSync(path.join(out, "views.json"), JSON.stringify(report.views));
  startSession(out, report);

  try {
    // First pass, no license.
    const first = await audit(out);
    assert.equal(first.result.ok, true, first.stdout);
    assert.equal(first.result.pass, "unlicensed");
    assert.ok(first.result.screens >= 3, `walked ${first.result.screens} screens`);
    assert.equal(requests.includes("/deleted"), false, "a control named Delete everything must never be pressed");
    assert.equal(first.result.needsLicense, true, "the Upgrade dialog has a license field");
    const bugs = first.result.bugs.filter((bug) => bug.rule === "dialog-close-misplaced");
    assert.ok(bugs.length >= 2, "both dialogs have their close button at the bottom");
    assert.ok(bugs.some((bug) => bug.screen === "Open guide" && bug.where === "Guide.tsx:1"), "the guide dialog points at its source");

    let session = readSession(out);
    const contrast = session.notes.find((note) => note.rule === "low-contrast");
    assert.ok(contrast, "muted text fails only in dark");
    assert.deepEqual(contrast.themes, ["dark"]);
    assert.equal(contrast.severity, "warn");
    assert.ok(session.shots.some((shot) => shot.theme === "dark") && session.shots.some((shot) => shot.theme === "light"));
    assert.ok(session.notes.every((note) => !note.shot || session.shots.some((shot) => shot.file === note.shot)), "every note's capture is in the session");
    const panel = session.steps.find((step) => step.id === "panel");
    assert.equal(panel.status, "running", "the agent closes the step after it fixes the bugs");
    assert.equal(session.audit.errors, bugs.length);
    assert.equal(session.audit.licensed, false);
    assert.ok(session.log.some((entry) => /Light/.test(entry.text)), "each screen is named in the activity feed");
    assert.ok(fs.existsSync(path.join(out, "audit.json")));
    assert.equal(fs.readFileSync(path.join(out, "audit.json"), "utf8").includes("GOOD-KEY"), false);

    // A license the add-on refuses.
    const refused = await audit(out, ["--licensed"], { EXPRESS_REVIEW_SECRET: "BAD-KEY" });
    assert.match(refused.result.license, /did not accept/);
    session = readSession(out);
    assert.equal(session.steps.find((step) => step.id === "access").status, "skipped");
    assert.equal(JSON.stringify(session).includes("BAD-KEY"), false);

    // A license it takes: the paid screen is walked and its problems found.
    const accepted = await audit(out, ["--licensed"], { EXPRESS_REVIEW_SECRET: "GOOD-KEY" });
    assert.match(accepted.result.license, /accepted/);
    session = readSession(out);
    assert.equal(session.steps.find((step) => step.id === "access").status, "done");
    assert.ok(session.notes.some((note) => note.rule === "small-target" && /paid/.test(note.screen)), "the paid screen's tiny buttons are found");
    for (const name of fs.readdirSync(out)) {
      const full = path.join(out, name);
      if (fs.statSync(full).isFile()) assert.equal(fs.readFileSync(full, "utf8").includes("GOOD-KEY"), false, `${name} must not hold the license`);
    }

    // The developer fixes the dialogs. The next run says so, and only for what is truly gone.
    state.fixed = true;
    const again = await audit(out);
    assert.equal(again.result.confirmedFixed, bugs.length);
    assert.deepEqual(again.result.bugs, []);
    session = readSession(out);
    assert.ok(session.notes.filter((note) => note.rule === "dialog-close-misplaced").every((note) => note.status === "fixed"));
    assert.equal(session.notes.find((note) => note.rule === "low-contrast").status, "open", "the contrast problem was not fixed, so it stays open");
    assert.equal(session.steps.find((step) => step.id === "fix").status, "pending", "panel warnings are something to ask about");
  } finally {
    server.close();
  }
});

test("when nothing answers and there is no start script, the audit says what to do and keeps the review going", browser, async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "express-audit-down-"));
  const report = { ok: true, findings: [], addon: "Fixture", projectPath: out, views: [{ kind: "document", name: "p", file: "manifest.json", line: 1, url: "http://127.0.0.1:9/x" }] };
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report));
  fs.writeFileSync(path.join(out, "views.json"), JSON.stringify(report.views));
  startSession(out, report);
  const run = await audit(out);
  assert.equal(run.result.ok, false);
  assert.match(run.result.error, /Nothing answers/);
  assert.match(run.result.next, /Do not end your turn/);
});

test("a second audit in the same review is refused while the first still runs, and a dead lock is ignored", browser, async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "express-audit-lock-"));
  const report = { ok: true, findings: [], addon: "Fixture", projectPath: out, views: [{ kind: "document", name: "p", file: "manifest.json", line: 1, url: "http://127.0.0.1:9/x" }] };
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report));
  fs.writeFileSync(path.join(out, "views.json"), JSON.stringify(report.views));
  startSession(out, report);

  // This test process is alive, so its pid in the lock stands for a running audit.
  fs.writeFileSync(path.join(out, "audit.lock"), String(process.pid));
  const refused = await audit(out);
  assert.equal(refused.result.ok, false);
  assert.equal(refused.result.reason, "already-running");
  assert.match(refused.result.next, /Do not start a second one/);
  assert.equal(fs.existsSync(path.join(out, "audit.lock")), true, "the running audit keeps its lock");

  // A pid nothing owns is left over from a crash.
  fs.writeFileSync(path.join(out, "audit.lock"), "999999");
  const crashed = await audit(out);
  assert.match(crashed.result.error, /Nothing answers/, "it ran, and got as far as looking for the panel");
  assert.equal(fs.existsSync(path.join(out, "audit.lock")), false, "it let go of the lock when it ended");
});

// ---- a panel behind a welcome tour -------------------------------------------------------------

function serveFixture(name) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(fs.readFileSync(path.join(fixtures, name), "utf8"));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}

test("a welcome tour is stepped through for free, and the panel behind it is walked", { ...browser, timeout: 240_000 }, async () => {
  const { server, url } = await serveFixture("tour.html");
  try {
    // Light only: each screen is reached by replaying its way from a fresh load, which is what this proves.
    const result = await walkPanel({ url, themes: ["light"], shotDir: fs.mkdtempSync(path.join(os.tmpdir(), "express-tour-")), maxDepth: 1 });
    const labels = result.states.map((state) => state.label);
    assert.ok(labels.includes("Home (after the opening dialog)"), labels.join(" | "));
    assert.ok(labels.includes("Settings"), `the tour is free, so Settings is one click from home: ${labels.join(" | ")}`);
    assert.ok(labels.includes("Help"), labels.join(" | "));
    const after = result.states.find((state) => state.label === "Settings");
    assert.equal(after.trail.filter((step) => step.tour).length, 3, "three tour steps, then the real click");
    assert.ok(after.trail.at(-1).tour === undefined, "the click on Settings costs depth");

    // A recheck opens the screens it is given, in order, and explores nothing else.
    const again = await walkPanel({ url, themes: ["light"], shotDir: fs.mkdtempSync(path.join(os.tmpdir(), "express-recheck-")), only: [{ label: after.label, trail: after.trail }] });
    assert.deepEqual(again.states.map((state) => state.label), ["Settings"], "only the named screen is measured");
    assert.equal(again.left, 0, "nothing was queued from it");
  } finally {
    server.close();
  }
});

// ---- opening the panel without signing in ------------------------------------------------------

test("with nothing running, the panel is built and served from here, and a stale build is rebuilt", { timeout: 60_000 }, async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "express-build-"));
  fs.mkdirSync(path.join(project, "src"));
  fs.writeFileSync(path.join(project, "src", "main.js"), "// v1\n");
  fs.writeFileSync(path.join(project, "build.mjs"), 'import fs from "node:fs"; fs.mkdirSync("dist", { recursive: true }); fs.writeFileSync("dist/index.html", "<title>built " + fs.readFileSync("src/main.js", "utf8").trim() + " @" + Date.now() + "</title>");\n');
  fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ scripts: { build: "node build.mjs", start: "node -e \"process.exit(1)\"" } }));
  const say = [];
  const first = await ensureServer({ url: "http://127.0.0.1:9/app/index.html?preview=1", project, log: path.join(project, "devserver.log"), say: (text) => say.push(text) });
  try {
    assert.equal(first.started, true);
    assert.match(first.url, /^http:\/\/127\.0\.0\.1:\d+\/index\.html\?preview=1$/, "the query the scan asked for is kept");
    const body = await (await fetch(first.url)).text();
    assert.match(body, /built \/\/ v1/);
    assert.ok(say.some((text) => /without an Adobe login/i.test(text)), say.join(" | "));
  } finally {
    first.stop();
  }

  // The source changes. The next walk must not measure the old build.
  await new Promise((resolve) => setTimeout(resolve, 1200));
  fs.writeFileSync(path.join(project, "src", "main.js"), "// v2\n");
  const second = await ensureServer({ url: "http://127.0.0.1:9/app/index.html", project, log: path.join(project, "devserver.log"), say: () => {} });
  let secondBody = "";
  try {
    secondBody = await (await fetch(second.url)).text();
    assert.match(secondBody, /built \/\/ v2/);
  } finally {
    second.stop();
  }

  // A picture or a log is not something a build reads, so it does not make the build stale.
  await new Promise((resolve) => setTimeout(resolve, 1200));
  fs.writeFileSync(path.join(project, "src", "logo.png"), "not really a png");
  fs.writeFileSync(path.join(project, "notes.log"), "a log line");
  const third = await ensureServer({ url: "http://127.0.0.1:9/app/index.html", project, log: path.join(project, "devserver.log"), say: () => {} });
  try {
    assert.equal(await (await fetch(third.url)).text(), secondBody, "the build was reused, not rebuilt");
  } finally {
    third.stop();
  }
});

test("the build server serves only its own folder", { timeout: 30_000 }, async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "express-serve-"));
  fs.mkdirSync(path.join(project, "dist"));
  fs.writeFileSync(path.join(project, "dist", "index.html"), "<title>ok</title>");
  fs.writeFileSync(path.join(project, "secret.txt"), "do not serve");
  fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ scripts: { build: "node -e 0" } }));
  const handle = await ensureServer({ url: "http://127.0.0.1:9/x", project, log: path.join(project, "d.log"), say: () => {} });
  try {
    const base = new URL(handle.url).origin;
    const escape = await fetch(`${base}/..%2Fsecret.txt`);
    assert.notEqual(escape.status, 200);
    assert.equal((await escape.text()).includes("do not serve"), false);
    assert.equal((await fetch(`${base}/index.html`)).status, 200);
  } finally {
    handle.stop();
  }
});
