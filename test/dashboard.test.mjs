import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { planAll } from "../.claude/skills/express-addon-review/scripts/lib/ask.mjs";
import { setMode, startSession } from "../.claude/skills/express-addon-review/scripts/lib/session.mjs";

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.claude/skills/express-addon-review");
const script = (name) => path.join(skill, "scripts", name);
const run = (file, args, env = {}) => spawnSync(process.execPath, [script(file), ...args], { encoding: "utf8", env: { ...process.env, EXPRESS_REVIEW_NO_OPEN: "1", ...env } });

test("start prints a private link, a second start reuses it, stop leaves no server", async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "express-cli-"));
  const report = { addon: "Demo", addonPath: "/tmp/demo", docsSha: "abc", skipped: [], findings: [] };
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report));
  fs.writeFileSync(path.join(out, "questions.json"), JSON.stringify(planAll(report)));
  startSession(out, report);
  setMode(out, "dashboard");
  try {
    const started = run("dashboard.mjs", ["start", "--out", out, "--no-open"]);
    assert.equal(started.status, 0, started.stderr);
    const info = JSON.parse(started.stdout);
    assert.equal(info.ok, true);
    assert.equal(info.opened, false);
    assert.match(info.url, /^http:\/\/127\.0\.0\.1:\d+\/\?t=[\w-]{20,}$/);

    const page = await fetch(info.url);
    assert.equal(page.status, 200);
    assert.equal((await fetch(info.url.split("?")[0])).status, 401);

    const again = JSON.parse(run("dashboard.mjs", ["start", "--out", out, "--no-open"]).stdout);
    assert.equal(again.reused, true);
    assert.equal(again.url, info.url);

    const mode = fs.statSync(path.join(out, "server.json")).mode & 0o777;
    if (process.platform !== "win32") assert.equal(mode, 0o600, "the token file is private");

    const stopped = JSON.parse(run("dashboard.mjs", ["stop", "--out", out]).stdout);
    assert.equal(stopped.running, false);
    assert.equal(fs.existsSync(path.join(out, "server.json")), false);
    await assert.rejects(fetch(info.url, { signal: AbortSignal.timeout(1000) }));
  } finally {
    run("dashboard.mjs", ["stop", "--out", out]);
  }
});

test("start without a session fails loudly, and a stale server record is replaced", async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "express-cli-none-"));
  const refused = run("dashboard.mjs", ["start", "--out", empty, "--no-open"]);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /No session/);

  const out = fs.mkdtempSync(path.join(os.tmpdir(), "express-cli-stale-"));
  const report = { addon: "Demo", addonPath: "/tmp/demo", skipped: [], findings: [] };
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report));
  startSession(out, report);
  fs.writeFileSync(path.join(out, "server.json"), JSON.stringify({ pid: 2 ** 22 - 3, port: 1, token: "dead-token-dead-token-dead", url: "http://127.0.0.1:1/?t=dead" }));
  try {
    const started = JSON.parse(run("dashboard.mjs", ["start", "--out", out, "--no-open"]).stdout);
    assert.equal(started.ok, true);
    assert.equal(started.reused, false);
    assert.notEqual(started.port, 1);
    assert.equal((await fetch(started.url)).status, 200);
  } finally {
    run("dashboard.mjs", ["stop", "--out", out]);
  }
});

test("session.mjs refuses to run without a review folder", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "express-empty-"));
  const result = run("session.mjs", ["show", "--out", empty]);
  assert.notEqual(result.status, 0);
  assert.equal(JSON.parse(result.stdout).ok, false);
});

test("prepare-listing writes the locked templates and removes stray css", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "express-listing-"));
  fs.writeFileSync(path.join(dir, "shot.css"), "body{color:red}");
  const result = run("prepare-listing.mjs", ["--out", dir]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(dir, "shot.css")), false);
  const css = fs.readFileSync(path.join(dir, "listing-shot.css"), "utf8");
  assert.match(css, /listing-shot\.css v3/);
  assert.match(css, /type LEFT, panels RIGHT/);
  const cover = fs.readFileSync(path.join(dir, "01-cover.html"), "utf8");
  assert.match(cover, /data-shot="cover"/);
  assert.match(cover, /class="kicker"/);
  assert.ok(cover.indexOf('class="copy"') < cover.indexOf('class="stage"'), "type comes before the panels, so it sits on the left");
  assert.equal(cover.includes("eyebrow"), false);
  assert.match(fs.readFileSync(path.join(dir, "02-feature.html"), "utf8"), /data-shot="feature"/);
  assert.match(fs.readFileSync(path.join(dir, "03-path.html"), "utf8"), /data-shot="path"/);
});

test("the locked cards are big enough to be the picture and short enough for the stage", () => {
  const css = fs.readFileSync(path.join(skill, "references/listing-shot.css"), "utf8");
  const widths = [...css.matchAll(/img \{[^}]*?width: (\d+)px/g)].map((match) => Number(match[1]));
  assert.ok(widths.length >= 3);
  for (const width of widths) {
    assert.ok(width >= 360, `a ${width}px card is too small to read in the final shot`);
    assert.ok(width * 2.5 + 20 <= 1088, `a ${width}px card is taller than the 1088px stage`);
  }
});
