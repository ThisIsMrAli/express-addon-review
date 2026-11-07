#!/usr/bin/env node
/**
 * Walks the add-on's panel at 320px in a private headless Chrome and measures
 * what a person would hit: a close button at the bottom of a dialog, a control
 * under another, text cut off, a sideways scroll, a dialog with no way out.
 * It opens every screen and dialog it can reach, in light and dark, and leaves
 * the results in the review session so the dashboard shows them live.
 *
 *   node scripts/audit.mjs [--out dir] [--url https://localhost:5241/...]
 *   node scripts/audit.mjs --licensed        second pass with the license the user gave
 *
 * When nothing answers at the panel's address it builds the add-on and serves the build from
 * this computer (no Adobe sign-in), or starts the add-on's own `npm start`, and stops it after.
 * It never opens Adobe Express, never logs in, and never writes the license anywhere.
 */
import fs from "node:fs";
import path from "node:path";
import { ensureServer, readSources, toNotes, walkPanel } from "./lib/audit.mjs";
import { findChrome, NO_CHROME } from "./lib/chrome.mjs";
import { reminder } from "./lib/next.mjs";
import { resolveOut } from "./lib/paths.mjs";
import {
  addNote, addShot, dropAutoShots, readMerged, readReport, readServer, setAudit, setNoteStatus, setStep
} from "./lib/session.mjs";

const args = parseArgs(process.argv.slice(2));
let stopServer = () => {};
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopServer();
    process.exit(130);
  });
}

try {
  await main();
} catch (error) {
  fail(error.message);
}

async function main() {
  const out = resolveOut(args.out);
  const session = readMerged(out);
  const report = readReport(out);
  if (!session || !report) throw new Error(`No review in ${out}. Run review.mjs first.`);
  if (!findChrome()) return failure(out, "no-chrome", NO_CHROME, "Walk the panel by hand as references/visual.md describes, then carry on.");

  // Two audits in one review would race on the same session, the same screenshots, and the same dev server.
  const holder = takeLock(out);
  if (holder) {
    process.stdout.write(`${JSON.stringify({ ok: false, reason: "already-running", error: `Another audit is already running for this review (process ${holder}).`, next: "Do not start a second one. Wait for it, then run `node scripts/session.mjs next`. The dashboard shows its progress." })}\n`);
    return;
  }

  const url = args.url || documentUrl(out);
  if (!url) return failure(out, "no-url", "The scan did not find a URL for the panel.", "Pass --url with the address the add-on runs at.");
  const project = report.projectPath || path.dirname(report.addonDir || out);
  const licensed = Boolean(args.licensed);
  const previous = readAuditFile(out);
  if (licensed && !previous?.licenseTrail) {
    return failure(out, "no-license-screen", "The first pass did not find a license field, so there is nowhere to enter the license.", "Skip the paid screens: `session.mjs step --id access --status skipped --detail \"No license field found\"`.");
  }

  const license = licensed ? await getLicense(out) : "";
  if (licensed && !license) throw new Error("The license is not available. Ask the `credentials` question again, or skip the paid screens.");

  const began = Date.now();
  let last = 0;
  const say = (doing, { quiet = false } = {}) => {
    line(doing);
    setStep(out, "panel", "running", `Looking at the panel${licensed ? " with the license" : ""}`, { doing, ...(quiet ? { silent: true } : { log: doing }) });
  };
  const progress = ({ phase, done, total, found, exact, doing }) => {
    if (Date.now() - last < 1200 && phase !== "done") return;
    last = Date.now();
    const screens = licensed ? "Paid screens" : "Screens";
    // The first theme is still looking for screens, so it counts them. The replay knows its total.
    const counted = total ? `${done} of ${exact ? total : `about ${total}`}` : `${found} found so far`;
    line(`${doing} (${counted})`);
    // Each screen is named in the activity feed, so the page shows where the walk is. Captures and notes are not logged, only this.
    setStep(out, "panel", "running", `${screens}: ${counted}`, { doing, log: phase === "done" ? undefined : doing, silent: phase === "done", progress: total ? { done, total, exact: Boolean(exact), label: phase === "done" ? "" : phase } : { found, label: phase } });
  };

  say("Starting the browser");
  const server = await ensureServer({ url, project, addonDir: report.addonDir, log: path.join(out, "devserver.log"), say: (text) => say(text, { quiet: true }) });
  stopServer = server.stop;
  const target = server.url;
  if (server.started) line(`${server.detail || "Started the panel"}; it will be stopped when this ends.`);

  let result;
  try {
    say(licensed ? "Opening the paid screens" : "Opening the panel at 320px");
    result = await walkPanel({
      url: target,
      themes: (args.themes || "light,dark").split(",").filter(Boolean),
      maxStates: Number(args["max-states"]) || 28,
      license,
      rootTrail: licensed ? [...previous.licenseTrail, { type: "license" }] : [],
      known: new Set(licensed ? previous.signatures : []),
      shotDir: path.join(out, "audit-shots"),
      progress
    });
  } finally {
    stopServer();
    stopServer = () => {};
  }

  // Say what happened to the license before anything else.
  let licenseNote = "";
  if (licensed) {
    if (result.outcome.rejected) {
      licenseNote = "The add-on did not accept the license.";
      setStep(out, "access", "skipped", licenseNote);
    } else if (!result.outcome.present) {
      licenseNote = "The license field was no longer there, so the paid screens could not be unlocked.";
      setStep(out, "access", "skipped", licenseNote);
    } else {
      licenseNote = result.outcome.unclear ? "The license was entered but the screen did not change." : "The license was accepted.";
      setStep(out, "access", "done", `${licenseNote} ${result.states.length} paid screen${result.states.length === 1 ? "" : "s"} measured.`);
    }
  }

  say("Working out where in the code each problem is");
  const sources = readSources(report.addonDir || project);
  const found = toNotes(result.states, sources, { licensed });
  addConsoleNotes(found, result.seen, target);

  dropAutoShots(out);
  const shotFor = new Map();
  for (const state of result.states) {
    for (const [theme, file] of Object.entries(state.shots)) {
      if (!fs.existsSync(file)) continue;
      const entry = addShot(out, { file, label: `${state.label}${licensed ? " (paid)" : ""}, ${theme}`, kind: "panel", auto: true, theme }).shot;
      shotFor.set(file, entry.file);
    }
  }

  const reconciled = reconcile(out, found, shotFor, licensed);

  const audited = readMerged(out);
  const ui = audited.notes.filter((note) => note.auto);
  const errors = ui.filter((note) => note.status === "open" && note.severity === "error");
  const warnings = ui.filter((note) => note.status === "open" && note.severity === "warn");
  // The code scan may have had nothing to fix. Panel warnings are something to ask about.
  if (warnings.length && audited.steps.find((step) => step.id === "fix")?.status === "skipped") {
    setStep(out, "fix", "pending", `${warnings.length} panel warning${warnings.length === 1 ? "" : "s"} to fix`);
  }
  const previousStates = licensed ? previous.states : [];
  fs.writeFileSync(path.join(out, "audit.json"), `${JSON.stringify({
    at: new Date().toISOString(),
    url: target,
    licensed,
    elapsedSeconds: Math.round((Date.now() - began) / 1000),
    truncated: result.truncated || false,
    licenseOutcome: licensed ? result.outcome : previous?.licenseOutcome,
    licenseTrail: licensed ? previous.licenseTrail : result.states.find((state) => state.licenseField)?.trail,
    signatures: [...new Set([...(licensed ? previous.signatures : []), ...result.states.map((state) => state.signature)])],
    states: [...previousStates, ...result.states.map((state) => ({ label: state.label, trail: state.trail, findings: state.findings.length, shots: state.shots }))],
    console: { exceptions: result.seen.exceptions.slice(0, 10), errors: result.seen.console.slice(0, 10), failed: result.seen.failed.slice(0, 10) }
  }, null, 2)}\n`);

  setAudit(out, {
    licensed: licensed || Boolean(audited.audit?.licensed),
    passes: [...new Set([...(audited.audit?.passes || []), licensed ? "licensed" : "unlicensed"])],
    screens: (audited.audit?.screens || 0) * (licensed ? 1 : 0) + result.states.length,
    errors: errors.length,
    warnings: warnings.length
  });
  // Is there a place to type a license? Without one, asking for it would lead nowhere.
  const wantsLicense = !licensed && Boolean(readReport(out)?.access?.needsCredential);
  const needsLicense = wantsLicense && result.states.some((state) => state.licenseField);
  if (wantsLicense && !needsLicense && !["done", "skipped"].includes(audited.steps.find((step) => step.id === "access")?.status)) {
    licenseNote = `The code mentions a license, but none of the ${result.states.length} screens the walk could open has a field to type one in, so there is nothing to unlock.`;
    setStep(out, "access", "skipped", licenseNote);
  }

  const count = `${result.states.length} screen${result.states.length === 1 ? "" : "s"} measured`;
  const finished = errors.length === 0 && !needsLicense;
  setStep(out, "panel", finished ? "done" : "running", `${count}${errors.length ? `, ${errors.length} bug${errors.length === 1 ? "" : "s"} to fix` : ", no bug found"}`, {
    doing: errors.length ? "Waiting for the fixes" : needsLicense ? "Waiting for the test license" : "",
    log: `Walked ${result.states.length} screen${result.states.length === 1 ? "" : "s"}: ${errors.length ? `${errors.length} bug${errors.length === 1 ? "" : "s"} to fix` : "no bug found"}.`
  });

  const summary = {
    ok: true,
    pass: licensed ? "licensed" : "unlicensed",
    screens: result.states.length,
    themes: (args.themes || "light,dark").split(",").filter(Boolean),
    seconds: Math.round((Date.now() - began) / 1000),
    ...(licenseNote ? { license: licenseNote } : {}),
    ...(result.truncated ? { truncated: result.truncated === "screens" ? `The walk stopped at its limit of ${Number(args["max-states"]) || 28} screens, with about ${result.left} more still queued. Run again with --max-states 50 to see them.` : `The walk ran out of time with about ${result.left} screens still queued. They were not measured.` } : {}),
    bugs: errors.map((note) => ({ id: note.id, rule: note.rule, screen: note.screen, text: note.text, ...(note.source ? { where: `${note.source.file}:${note.source.line}` } : {}) })),
    warnings: warnings.length,
    newNotes: reconciled.added,
    confirmedFixed: reconciled.fixed,
    needsLicense,
    next: errors.length
      ? `Fix the ${errors.length} bug${errors.length === 1 ? "" : "s"} above now, without asking. Mark each with \`session.mjs note --id <id> --status fixed\`, then run \`node scripts/audit.mjs\` again to confirm. ${reminder(out, { dashboardUp: Boolean(readServer(out)) })}`
      : reminder(out, { dashboardUp: Boolean(readServer(out)) })
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

// ---- helpers ------------------------------------------------------------------------------------

/** Takes `audit.lock`. Returns the pid of a live audit that already holds it, or 0 when the lock is now ours. */
function takeLock(out) {
  const file = path.join(out, "audit.lock");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fs.writeFileSync(file, String(process.pid), { flag: "wx" });
      process.on("exit", () => {
        try {
          if (fs.readFileSync(file, "utf8") === String(process.pid)) fs.unlinkSync(file);
        } catch {
          // already gone
        }
      });
      return 0;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const pid = Number(fs.readFileSync(file, "utf8")) || 0;
      if (pid && pid !== process.pid && isAlive(pid)) return pid;
      fs.rmSync(file, { force: true });
    }
  }
  return 0;
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function documentUrl(out) {
  try {
    const views = JSON.parse(fs.readFileSync(path.join(out, "views.json"), "utf8"));
    return views.find((view) => view.kind === "document" && view.url)?.url || "";
  } catch {
    return "";
  }
}

function readAuditFile(out) {
  try {
    return JSON.parse(fs.readFileSync(path.join(out, "audit.json"), "utf8"));
  } catch {
    return null;
  }
}

async function getLicense(out) {
  if (process.env.EXPRESS_REVIEW_SECRET) return process.env.EXPRESS_REVIEW_SECRET;
  const info = readServer(out);
  if (!info) return "";
  try {
    const res = await fetch(`http://127.0.0.1:${info.port}/api/secret?id=credentials`, { headers: { authorization: `Bearer ${info.token}` }, signal: AbortSignal.timeout(5000) });
    return res.ok ? (await res.json()).secret || "" : "";
  } catch {
    return "";
  }
}

function addConsoleNotes(found, seen, url) {
  const origin = new URL(url).origin;
  if (seen.exceptions.length) {
    const unique = [...new Set(seen.exceptions)].slice(0, 3);
    found.push({
      key: "script-error",
      rule: "script-error",
      severity: "warn",
      screen: "Whole panel",
      text: `The panel threw ${seen.exceptions.length} script error${seen.exceptions.length === 1 ? "" : "s"} while it was walked: ${unique.join(" | ")}. Fix: open the console on that screen and fix the first error.`,
      themes: [],
      shotFile: ""
    });
  }
  const failed = seen.failed.filter((item) => item.url.startsWith(origin) && !/favicon|\.map(\?|$)|hot-update|sockjs|\/ws$/i.test(item.url));
  if (failed.length) {
    found.push({
      key: "request-failed",
      rule: "request-failed",
      severity: "warn",
      screen: "Whole panel",
      text: `${failed.length} file${failed.length === 1 ? "" : "s"} from the add-on itself failed to load, such as ${failed[0].url.replace(origin, "")}. Fix: check the path and that the build includes it.`,
      themes: [],
      shotFile: ""
    });
  }
}

/** Keeps note ids stable across runs: found again stays, gone becomes fixed, new is added. */
function reconcile(out, found, shotFor, licensed) {
  const session = readMerged(out);
  const inScope = (note) => note.auto && (Boolean(note.screen?.endsWith("(paid)")) === licensed || note.screen === "Whole panel");
  const existing = session.notes.filter(inScope);
  const byKey = new Map(existing.map((note) => [note.key, note]));
  const foundKeys = new Set(found.map((note) => note.key));
  let added = 0;
  let fixed = 0;
  for (const note of existing) {
    if (!foundKeys.has(note.key) && note.status === "open") {
      setNoteStatus(out, note.id, "fixed", "audit");
      fixed += 1;
    }
  }
  let counter = Math.max(0, ...session.notes.map((note) => Number(String(note.id).replace(/^ui-/, "")) || 0));
  for (const note of found) {
    const old = byKey.get(note.key);
    if (old) {
      if (old.status === "fixed") setNoteStatus(out, old.id, "open");
      continue;
    }
    counter += 1;
    addNote(out, {
      id: `ui-${counter}`,
      text: note.text,
      screen: note.screen,
      shot: shotFor.get(note.shotFile) || "",
      severity: note.severity,
      rule: note.rule,
      themes: note.themes,
      source: note.source,
      selector: note.selector,
      key: note.key,
      auto: true
    });
    added += 1;
  }
  return { added, fixed };
}

function line(text) {
  process.stdout.write(`[audit] ${text}\n`);
}

function failure(out, reason, message, next) {
  setStep(out, "panel", "running", message, { doing: "Walking the panel by hand" });
  process.stdout.write(`${JSON.stringify({ ok: false, reason, error: message, next })}\n`);
}

function fail(message) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: message, next: "Say nothing to the user yet. Fix what the error says, or fall back to the manual walk in references/visual.md. Do not end your turn." })}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
