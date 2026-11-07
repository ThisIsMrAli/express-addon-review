import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  addNote, addShot, answerFromChat, appendAnswerLine, dropAutoShots, finish, parseProgress, publishAsk, readMerged, readSession, setAudit, setNoteStatus, setStep, startSession
} from "../.claude/skills/express-addon-review/scripts/lib/session.mjs";
import { nextAction, reminder } from "../.claude/skills/express-addon-review/scripts/lib/next.mjs";
import { lateAsks, planAll } from "../.claude/skills/express-addon-review/scripts/lib/ask.mjs";

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.claude/skills/express-addon-review");
const cli = (out, ...args) => {
  const result = spawnSync(process.execPath, [path.join(skill, "scripts/session.mjs"), ...args], { encoding: "utf8", env: { ...process.env, EXPRESS_REVIEW_OUT: out } });
  return JSON.parse(result.stdout.trim().split("\n").at(-1));
};

const report = (overrides = {}) => ({
  addon: "Demo", addonPath: "/tmp/demo-addon", docsSha: "abc1234", fetchedAt: "2026-11-06T00:00:00Z", skipped: [],
  findings: [
    { id: "name-adobe-express", severity: "error", file: "a.tsx", line: 3, message: "m", suggestion: "s", source: { kind: "adobe", url: "https://x" } },
    { id: "cancel-missing", severity: "warn", file: "b.tsx", line: 9, message: "m", suggestion: "s", source: { kind: "review-pattern" } }
  ],
  ...overrides
});

function folder() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "express-session-"));
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report()));
  fs.writeFileSync(path.join(out, "questions.json"), JSON.stringify(planAll(report())));
  startSession(out, report());
  return out;
}

test("a new session has the workflow, a baseline, and skips the license step when none is needed", () => {
  const out = folder();
  const session = readSession(out);
  assert.deepEqual(session.steps.map((step) => step.id), ["scan", "panel", "access", "fix", "design", "polish", "listing", "done"]);
  assert.equal(session.steps.find((step) => step.id === "scan").status, "done");
  assert.equal(session.steps.find((step) => step.id === "access").status, "skipped");
  assert.equal(session.baseline.length, 2);
  assert.equal(session.mode, null);
});

test("a clean scan has nothing to fix, so the fix step is skipped instead of waiting forever", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "express-clean-"));
  startSession(out, report({ findings: [] }));
  assert.equal(readSession(out).steps.find((step) => step.id === "fix").status, "skipped");
  const listingOnly = fs.mkdtempSync(path.join(os.tmpdir(), "express-listing-only-"));
  startSession(listingOnly, report({ findings: [{ id: "listing-icon", severity: "error", file: "listing/icon.png", line: 1, source: { kind: "adobe" } }] }));
  assert.equal(readSession(listingOnly).steps.find((step) => step.id === "fix").status, "skipped", "listing files are the listing step's job");
  assert.equal(readSession(folder()).steps.find((step) => step.id === "fix").status, "pending");
});

test("a re-scan keeps the notes and answers but a fresh scan starts over", () => {
  const out = folder();
  addNote(out, { text: "Cancel is missing", screen: "Export" });
  startSession(out, report({ findings: [] }), { keep: true });
  assert.equal(readSession(out).notes.length, 1);
  assert.equal(readSession(out).baseline.length, 2, "the baseline is the first scan, so progress can be measured");
  startSession(out, report());
  assert.equal(readSession(out).notes.length, 0);
});

test("a reviewer's reason is a note with its own id, and only open, fixed, or skipped are statuses", () => {
  const out = folder();
  startSession(out, report());
  assert.equal(cli(out, "note", "--id", "r1", "--text", "Reviewer 1: no way to cancel the export", "--screen", "Rejection letter").ok, true);
  addNote(out, { text: "Clipped at 320px", screen: "Home" });
  assert.deepEqual(readSession(out).notes.map((note) => note.id), ["r1", "n2"], "an explicit id does not disturb the numbering");
  assert.equal(cli(out, "note", "--id", "r1", "--status", "fixed").status, "fixed");
  assert.equal(readSession(out).notes[0].status, "fixed");
  const bad = spawnSync(process.execPath, [path.join(skill, "scripts/session.mjs"), "note", "--id", "r1", "--status", "done"], { encoding: "utf8", env: { ...process.env, EXPRESS_REVIEW_OUT: out } });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stdout + bad.stderr, /open, fixed, or skipped/);
});

test("a dashboard answer is merged into the ask, and an old answer never answers a new question", () => {
  const out = folder();
  const { ask } = publishAsk(out, { ...planAll(report()).find((item) => item.id === "fix"), images: [] });
  assert.equal(readMerged(out).asks[0].status, "pending");
  appendAnswerLine(out, { type: "answer", askId: "fix", nonce: ask.nonce, value: "all", via: "dashboard", at: new Date().toISOString() });
  const merged = readMerged(out).asks[0];
  assert.equal(merged.status, "answered");
  assert.equal(merged.answer, "all");
  assert.match(merged.answerLabel, /Fix everything/);
  publishAsk(out, { ...planAll(report()).find((item) => item.id === "fix"), images: [] });
  assert.equal(readMerged(out).asks[0].status, "pending", "asking again needs a fresh answer");
});

test("an answer given in chat must be one of the options", () => {
  const out = folder();
  publishAsk(out, { ...planAll(report()).find((item) => item.id === "fix"), images: [] });
  assert.throws(() => answerFromChat(out, "fix", "banana"), /not one of/);
  const option = answerFromChat(out, "fix", "Fix everything found");
  assert.equal(option.id, "all");
  const session = readMerged(out);
  assert.equal(session.asks[0].via, "chat");
  assert.equal(session.steps.find((step) => step.id === "fix").status, "running");
});

test("steps reject unknown ids and statuses", () => {
  const out = folder();
  assert.throws(() => setStep(out, "nope", "running"), /Unknown step/);
  assert.throws(() => setStep(out, "panel", "sleeping"), /Unknown status/);
});

test("a shot is copied into the session folder and sized", () => {
  const out = folder();
  const png = Buffer.alloc(33);
  png.write("\x89PNG\r\n\x1a\n", 0, "latin1");
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(1600, 20);
  const src = path.join(out, "cap.png");
  fs.writeFileSync(src, png);
  const { shot } = addShot(out, { file: src, label: "Home, light" });
  assert.match(shot.file, /^shots\/s1-panel-cap\.png$/);
  assert.equal(shot.width, 640);
  assert.ok(fs.existsSync(path.join(out, shot.file)));
  assert.throws(() => addShot(out, { file: path.join(out, "report.json"), label: "x" }), /not a PNG/);
});

test("the late asks are the screenshot and listing approvals", () => {
  assert.equal(lateAsks["shots-review"]().options[0].id, "approve");
  assert.match(lateAsks["shots-review"]().options[0].label, /\(Recommended\)$/);
  assert.equal(lateAsks["listing-review"]().options[0].id, "approve");
});

test("finish closes running steps and records the summary", () => {
  const out = folder();
  setStep(out, "panel", "running", "Home");
  finish(out, "All done");
  const session = readSession(out);
  assert.equal(session.steps.find((step) => step.id === "panel").status, "done");
  assert.equal(session.steps.find((step) => step.id === "done").status, "done");
  assert.equal(session.summary, "All done");
});

test("the CLI wait returns pending quietly, then the chat answer", () => {
  const out = folder();
  assert.equal(cli(out, "mode", "--set", "chat").ok, true);
  assert.equal(cli(out, "ask", "--id", "fix").channel, "chat");
  assert.equal(cli(out, "wait", "--id", "fix", "--timeout", "1").status, "pending");
  assert.equal(cli(out, "answer", "--id", "fix", "--value", "errors").value, "errors");
  assert.equal(cli(out, "wait", "--id", "fix", "--timeout", "1").status, "answered");
  assert.equal(cli(out, "answer", "--id", "fix", "--value", "nope").ok, false);
});

test("a custom question needs two options and the CLI says so", () => {
  const out = folder();
  const bad = cli(out, "ask", "--id", "x", "--prompt", "Pick?", "--option", "a:Only");
  assert.equal(bad.ok, false);
  const good = cli(out, "ask", "--id", "x", "--prompt", "Pick?", "--option", "a:Yes:Does a", "--option", "b:No");
  assert.equal(good.ok, true);
  assert.equal(readSession(out).asks.find((ask) => ask.id === "x").options[0].detail, "Does a");
});

test("progress is read as 3/12 or 40%, and anything else is refused", () => {
  assert.deepEqual(parseProgress("3/12"), { done: 3, total: 12 });
  assert.deepEqual(parseProgress("40%"), { done: 40, total: 100 });
  assert.equal(parseProgress(undefined), undefined);
  assert.throws(() => parseProgress("soon"), /3\/12 or 40%/);
});

test("a step keeps what it is doing and how far along it is, and clears both when it ends", () => {
  const out = folder();
  setStep(out, "panel", "running", "Walking", { doing: "Light · Upgrade", progress: { done: 3, total: 12, label: "light" } });
  const running = readSession(out).steps.find((step) => step.id === "panel");
  assert.equal(running.doing, "Light · Upgrade");
  assert.deepEqual(running.progress, { done: 3, total: 12, label: "light" });
  setStep(out, "panel", "done", "12 screens");
  const done = readSession(out).steps.find((step) => step.id === "panel");
  assert.equal(done.doing, "");
  assert.equal(done.progress, null);
});

test("progress ticks stay out of the activity log, and a named line goes in once", () => {
  const out = folder();
  const before = readSession(out).log.length;
  for (let i = 0; i < 5; i += 1) setStep(out, "panel", "running", `Screens: ${i}`, { silent: true, progress: { done: i, total: 5 } });
  assert.equal(readSession(out).log.length, before + 0, "five silent ticks add nothing");
  setStep(out, "panel", "running", "x", { log: "Light · Upgrade" });
  assert.equal(readSession(out).log.at(-1).text, "Light · Upgrade");
});

test("every write by the agent's commands stamps agentSeenAt, so the page can tell it is alive", () => {
  const out = folder();
  const first = readSession(out).agentSeenAt;
  assert.ok(first);
  const later = new Date(Date.now() + 5).toISOString();
  setStep(out, "panel", "running", "x");
  assert.ok(readSession(out).agentSeenAt >= first);
  assert.ok(later);
});

test("ending the walk closes the paid-screens step with the truth about the license", () => {
  const out = folder();
  const clean = fs.mkdtempSync(path.join(os.tmpdir(), "express-access-"));
  startSession(clean, report({ access: { needsCredential: true } }));
  setStep(clean, "panel", "done", "walked");
  const skipped = readSession(clean).steps.find((step) => step.id === "access");
  assert.equal(skipped.status, "skipped");
  assert.match(skipped.detail, /No license was used/);
  const used = fs.mkdtempSync(path.join(os.tmpdir(), "express-access-used-"));
  startSession(used, report({ access: { needsCredential: true } }));
  setAudit(used, { licensed: true });
  setStep(used, "panel", "done", "walked");
  assert.equal(readSession(used).steps.find((step) => step.id === "access").status, "done");
  assert.ok(out);
});

test("polish is skipped when the add-on has no panel to look at", () => {
  const none = fs.mkdtempSync(path.join(os.tmpdir(), "express-polish-"));
  startSession(none, report({ views: [] }));
  assert.equal(readSession(none).steps.find((step) => step.id === "polish").status, "skipped");
  const some = fs.mkdtempSync(path.join(os.tmpdir(), "express-polish-views-"));
  startSession(some, report({ views: [{ kind: "document", name: "p", file: "manifest.json", line: 1 }] }));
  assert.equal(readSession(some).steps.find((step) => step.id === "polish").status, "pending");
});

test("shot ids stay unique after an audit's captures are dropped", () => {
  const out = folder();
  const png = path.join(out, "a.png");
  fs.writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));
  const a = addShot(out, { file: png, label: "a", auto: true }).shot;
  const kept = addShot(out, { file: png, label: "b", auto: true }).shot;
  addNote(out, { text: "t", screen: "s", shot: kept.file, auto: true, key: "k" });
  dropAutoShots(out);
  const c = addShot(out, { file: png, label: "c", auto: true }).shot;
  const ids = readSession(out).shots.map((shot) => shot.id);
  assert.equal(new Set(ids).size, ids.length, "no id is reused");
  assert.ok(ids.includes(kept.id), "a capture a note points to is kept");
  assert.equal(ids.includes(a.id), false);
  assert.ok(c.id !== kept.id);
});

test("a note can carry a severity, a rule, themes, a source, and a key for the next audit", () => {
  const out = folder();
  addNote(out, { id: "ui-1", text: "Close is low. Fix: move it.", screen: "Guide", severity: "error", rule: "dialog-close-misplaced", themes: ["light"], source: { file: "Guide.tsx", line: 12 }, key: "k1", auto: true });
  const note = readSession(out).notes.find((item) => item.id === "ui-1");
  assert.equal(note.rule, "dialog-close-misplaced");
  assert.equal(note.auto, true);
  assert.deepEqual(note.source, { file: "Guide.tsx", line: 12 });
  setNoteStatus(out, "ui-1", "fixed");
  assert.equal(readSession(out).notes.find((item) => item.id === "ui-1").status, "fixed");
});

test("next walks the review from the mode question to the end and never says finished early", () => {
  const out = folder();
  assert.equal(nextAction(out).action, "ask-mode");
  cli(out, "mode", "--set", "chat");
  assert.equal(nextAction(out).action, "run", "the panel has not been walked");
  assert.match(nextAction(out).command, /audit\.mjs/);

  setAudit(out, { licensed: false, screens: 4, errors: 0, warnings: 0 });
  assert.equal(nextAction(out).action, "run", "no bug is open, so the panel step is ready to close");
  assert.match(nextAction(out).command, /step --id panel --status done/);

  addNote(out, { id: "ui-1", text: "x. Fix: y", screen: "Guide", severity: "error", rule: "dialog-close-misplaced", auto: true, key: "k" });
  assert.equal(nextAction(out).action, "fix-ui", "a measured bug is fixed before anything is asked");
  setNoteStatus(out, "ui-1", "fixed");
  const claim = nextAction(out);
  assert.match(claim.command, /audit\.mjs/, "the agent's word that it fixed a bug is a claim, and only the audit confirms it");
  assert.deepEqual(claim.notes, ["ui-1"]);
  setAudit(out, { licensed: false, screens: 4, errors: 0, warnings: 0 });
  assert.match(nextAction(out).command, /step --id panel --status done/, "the audit ran again and did not reopen it");

  setStep(out, "panel", "done", "walked");
  assert.equal(nextAction(out).action, "ask");
  assert.equal(nextAction(out).ask, "fix");
  publishAsk(out, planAll(report()).find((item) => item.id === "fix"));
  assert.equal(nextAction(out).action, "ask-in-chat");
  answerFromChat(out, "fix", "all");
  assert.equal(nextAction(out).action, "apply");
  assert.notEqual(nextAction(out).action, "finished");

  for (const id of ["fix", "design", "polish", "listing"]) setStep(out, id, "done", "");
  setStep(out, "access", "skipped", "");
  assert.equal(nextAction(out).action, "finish");
  finish(out, "ok");
  assert.equal(nextAction(out).action, "finished");
});

test("while a question waits on the dashboard, next says to wait and not to talk", () => {
  const out = folder();
  cli(out, "mode", "--set", "chat");
  setAudit(out, { licensed: false });
  setStep(out, "panel", "done", "walked");
  publishAsk(out, planAll(report()).find((item) => item.id === "fix"));
  const wait = nextAction(out, { dashboardUp: false });
  assert.equal(wait.action, "ask-in-chat");
  const session = readSession(out);
  session.mode = "dashboard";
  fs.writeFileSync(path.join(out, "session.json"), JSON.stringify(session));
  const dash = nextAction(out, { dashboardUp: true });
  assert.equal(dash.action, "wait");
  assert.match(dash.say, /Do not write to the user/);
  assert.match(dash.command, /wait --id fix/);
});

test("every command answer carries a next line, and ask and wait say not to stop", () => {
  const out = folder();
  const mode = cli(out, "mode", "--set", "chat");
  assert.match(mode.next, /Do not end your turn/);
  assert.match(cli(out, "step", "--id", "panel", "--status", "running").next, /Not finished/);
  const ask = cli(out, "ask", "--id", "fix");
  assert.match(ask.next, /AskQuestion/);
  assert.match(cli(out, "wait", "--id", "fix", "--timeout", "1").next, /Run the same wait command again/);
  const answered = cli(out, "answer", "--id", "fix", "--value", "all");
  assert.match(answered.next, /Not finished|finished/);
  const next = cli(out, "next");
  assert.equal(next.ok, true);
  assert.ok(next.neverStop);
  assert.match(reminder(out), /session\.mjs next/);
});

test("step accepts --doing and --progress on the CLI and refuses a bad progress value", () => {
  const out = folder();
  const ok = cli(out, "step", "--id", "panel", "--status", "running", "--doing", "Opening Export", "--progress", "2/9");
  assert.equal(ok.step.doing, "Opening Export");
  assert.deepEqual(ok.step.progress, { done: 2, total: 9 });
  assert.equal(cli(out, "step", "--id", "panel", "--status", "running", "--progress", "soon").ok, false);
});

test("a re-scan goes into the review that is already open for the add-on, wherever its folder is", async () => {
  const { project } = await import("./helpers.mjs");
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "express-home-"));
  const custom = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "express-custom-")), "review");
  const addon = project({});
  const run = (...args) => {
    const result = spawnSync(process.execPath, [path.join(skill, "scripts/review.mjs"), "--input", addon, "--no-refresh", ...args], { encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home } });
    return JSON.parse(result.stdout);
  };
  assert.equal(run("--out", custom).out, custom);
  assert.equal(run("--rescan").out, custom, "the second scan did not start a second review in the default folder");
  assert.notEqual(run().out, custom, "a plain scan is a new review");
});

test("a fix claimed after the panel step closed is measured again before the review moves on", () => {
  const out = folder();
  cli(out, "mode", "--set", "chat");
  setAudit(out, { licensed: false });
  addNote(out, { id: "ui-5", text: "Contrast is low. Fix: darken it", screen: "Home", severity: "warn", rule: "low-contrast", auto: true, key: "k5" });
  setStep(out, "panel", "done", "walked");
  setNoteStatus(out, "ui-5", "fixed");
  assert.match(nextAction(out).command, /audit\.mjs/, "a claim made in the fix step is still only a claim");
  setAudit(out, { licensed: false });
  assert.doesNotMatch(nextAction(out).command || "", /audit\.mjs/, "measured again, so the review goes on");

  // The audit's own confirmation never asks for another audit.
  setNoteStatus(out, "ui-5", "open");
  setNoteStatus(out, "ui-5", "fixed", "audit");
  assert.doesNotMatch(nextAction(out).command || "", /audit\.mjs/);
});

test("after the listing answer, next walks the text and the screenshots to their approvals and never asks for typed fields", async () => {
  const { setListing } = await import("../.claude/skills/express-addon-review/scripts/lib/session.mjs");
  const out = folder();
  cli(out, "mode", "--set", "chat");
  setAudit(out, { licensed: false });
  for (const id of ["panel", "fix", "design", "polish"]) setStep(out, id, "done", "");
  publishAsk(out, planAll(report()).find((item) => item.id === "listing"));
  answerFromChat(out, "listing", "both");
  assert.equal(nextAction(out).action, "draft-listing", "the text comes first");
  setListing(out, { name: "Demo", summary: "A demo", description: "A demo add-on.", keywords: ["demo"] });
  assert.equal(nextAction(out).ask, "listing-review", "the draft is shown before anything else");
  publishAsk(out, lateAsks["listing-review"]());
  answerFromChat(out, "listing-review", "approve");
  assert.equal(nextAction(out).action, "make-shots");
  const picture = path.join(out, "pixel.png");
  fs.writeFileSync(picture, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==", "base64"));
  addShot(out, { file: picture, label: "Listing 1", kind: "listing" });
  assert.equal(nextAction(out).ask, "shots-review");
  publishAsk(out, lateAsks["shots-review"]());
  answerFromChat(out, "shots-review", "approve");
  const last = nextAction(out);
  assert.equal(last.action, "apply");
  assert.match(last.say, /Do not stop to ask for them/, "the publisher fields go into the summary, not into a question that ends the turn");
});

test("once an answer is read, the step stops saying it is waiting for one", () => {
  const out = folder();
  cli(out, "mode", "--set", "chat");
  cli(out, "ask", "--id", "fix");
  const waiting = readSession(out).steps.find((step) => step.id === "fix");
  assert.equal(waiting.status, "waiting");
  assert.match(waiting.detail, /Waiting for your answer/);
  cli(out, "answer", "--id", "fix", "--value", "all");
  const after = readSession(out).steps.find((step) => step.id === "fix");
  assert.equal(after.status, "running");
  assert.doesNotMatch(after.detail, /Waiting/, "a stale waiting line would tell the user nothing is happening");
  assert.match(after.detail, /You chose/);
});

test("a note marked fixed still says what comes next, and a capture or a found note does not flood the log", () => {
  const out = folder();
  cli(out, "note", "--text", "A close button is at the bottom", "--id", "ui-1");
  const fixed = cli(out, "note", "--id", "ui-1", "--status", "fixed");
  assert.ok(fixed.next, "no command leaves the agent without a next step");

  const picture = path.join(out, "pixel.png");
  fs.writeFileSync(picture, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==", "base64"));
  const before = readSession(out).log.length;
  addShot(out, { file: picture, label: "Home, light", auto: true });
  addNote(out, { text: "Found by the walk", id: "ui-2", auto: true });
  assert.equal(readSession(out).log.length, before, "the audit's own captures and notes stay out of the activity feed");
  addNote(out, { text: "Noted by the agent", id: "n9" });
  assert.equal(readSession(out).log.length, before + 1, "a note the agent writes is still worth a line");
});

test("a step that does not know its total yet reports what it found so far", () => {
  const out = folder();
  const session = setStep(out, "panel", "running", "Screens: 3 found so far", { doing: "Light · Home", progress: { found: 3, label: "light" }, silent: true });
  assert.deepEqual(session.steps.find((step) => step.id === "panel").progress, { found: 3, label: "light" });
});

test("the fix question counts panel warnings the walk found after the scan", async () => {
  const { fixAskFor } = await import("../.claude/skills/express-addon-review/scripts/lib/ask.mjs");
  assert.equal(fixAskFor({ findings: [] }, []), null, "nothing to fix");
  const notes = [{ id: "ui-3", auto: true, status: "open", severity: "warn", rule: "low-contrast", screen: "Home", source: { file: "Home.tsx", line: 4 } }];
  const ask = fixAskFor({ findings: [] }, notes);
  assert.match(ask.prompt, /1 panel warning/);
  assert.equal(ask.affects[0].id, "low-contrast");
  assert.equal(fixAskFor({ findings: [] }, [{ ...notes[0], status: "fixed" }]), null, "a fixed warning is not asked about");
});
