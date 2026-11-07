#!/usr/bin/env node
/**
 * The agent's handle on the review session. Every command prints one JSON
 * object. `--out` is optional: the folder the last review.mjs wrote is used.
 *
 *   mode     --set dashboard|chat
 *   step     --id panel --status running|waiting|done|skipped [--detail "..."] [--doing "Opening the Export dialog"] [--progress 3/12]
 *   note     --text "..." [--id r1] [--screen "Studio"] [--shot file.png]   a visual problem
 *   note     --id n1 --status open|fixed|skipped
 *   shot     --file capture.png --label "Home, light" [--kind panel|listing]
 *   listing  --json listing.json                                       name, summary, description, keywords
 *   ask      --id fix [--image preview.png ...]                        publish a decision on the dashboard
 *   ask      --id x --prompt "..." --option "id:Label:What happens" ...
 *   wait     --id fix [--timeout 25]                                   blocks, then answered or pending
 *   answer   --id fix --value all                                      record an answer given in chat
 *   done     [--summary "..."]
 *   next                                                             what to do now, worked out from the session
 *   secret   --id credentials                                         the test license the user typed (only for a walk by hand)
 *   show
 */
import fs from "node:fs";
import path from "node:path";
import { fixAskFor, lateAsks } from "./lib/ask.mjs";
import { nextAction, reminder } from "./lib/next.mjs";
import { resolveOut } from "./lib/paths.mjs";
import {
  addNote, addShot, answerFromChat, finish, noteDelivered, parseProgress, publishAsk, readMerged, readReport, readServer, readSession, setListing, setMode, setNoteStatus, setStep
} from "./lib/session.mjs";

const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

try {
  const out = resolveOut(args.out);
  if (!command || command === "help") usage();
  if (!readSession(out)) throw new Error(`No session in ${out}. Run review.mjs first.`);
  await run(out);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
  process.exit(1);
}

async function run(out) {
  switch (command) {
    case "mode": {
      if (!["dashboard", "chat"].includes(args.set)) throw new Error("Use --set dashboard or --set chat.");
      setMode(out, args.set);
      return print({ ok: true, mode: args.set }, out);
    }
    case "step": {
      if (!args.id || !args.status) throw new Error("Use --id and --status.");
      const session = setStep(out, args.id, args.status, args.detail, { doing: args.doing, progress: parseProgress(args.progress) });
      return print({ ok: true, step: session.steps.find((step) => step.id === args.id) }, out);
    }
    case "note": {
      if (args.id && args.status && !args.text) {
        setNoteStatus(out, args.id, args.status);
        return print({ ok: true, id: args.id, status: args.status }, out);
      }
      if (!args.text) throw new Error("Use --text for a new note, or --id and --status to change one.");
      let shot = "";
      if (args.shot) shot = addShot(out, { file: args.shot, label: args.screen || "Visual note", kind: "panel" }).shot.file;
      const session = addNote(out, { text: args.text, screen: args.screen, shot, id: args.id, severity: args.severity, rule: args.rule });
      return print({ ok: true, notes: session.notes.length }, out);
    }
    case "shot": {
      if (!args.file) throw new Error("Use --file.");
      const { shot } = addShot(out, { file: args.file, label: args.label, kind: args.kind || "panel" });
      return print({ ok: true, shot }, out);
    }
    case "listing": {
      const listing = args.json ? JSON.parse(fs.readFileSync(path.resolve(args.json), "utf8")) : {
        name: args.name, summary: args.summary, description: args.description, keywords: args.keywords
      };
      if (!listing.name && !listing.summary && !listing.description) throw new Error("Give --json listing.json with name, summary, description, and keywords.");
      setListing(out, listing);
      return print({ ok: true }, out);
    }
    case "ask": return ask(out);
    case "wait": return wait(out);
    case "answer": {
      if (!args.id || !args.value) throw new Error("Use --id and --value.");
      ensureAsk(out);
      const option = answerFromChat(out, args.id, args.value);
      return print({ ok: true, id: args.id, value: option.id, label: option.label, via: "chat" }, out);
    }
    case "done": {
      finish(out, args.summary);
      return print({ ok: true, note: "Stop the dashboard with: node scripts/dashboard.mjs stop", next: "The review is finished. Give the user the closing summary." });
    }
    case "secret": {
      const info = readServer(out);
      if (!info || !args.id) throw new Error("Use --id, and the dashboard must be running.");
      const res = await fetch(`http://127.0.0.1:${info.port}/api/secret?id=${encodeURIComponent(args.id)}`, { headers: { authorization: `Bearer ${info.token}` } });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "No secret.");
      return print({ ok: true, id: body.id, secret: body.secret, note: "Use it, never write it to a file or say it in chat." }, out);
    }
    case "next": {
      const action = nextAction(out, { dashboardUp: dashboardUp(out) });
      return print({ ok: true, ...action, neverStop: action.action === "finished" ? undefined : "A review ends at `done`. Do not end your turn before then. Do not write to the user between commands unless a command tells you to." });
    }
    case "show": {
      const merged = readMerged(out);
      if (!merged) throw new Error(`No session in ${out}.`);
      return print({
        ok: true,
        out,
        mode: merged.mode,
        steps: merged.steps.map((step) => `${step.id}:${step.status}`),
        pending: merged.asks.filter((item) => item.status === "pending").map((item) => item.id),
        answered: merged.asks.filter((item) => item.status === "answered").map((item) => `${item.id}=${item.answer}`),
        notes: merged.notes.map((note) => `${note.id}:${note.status}`)
      });
    }
    default:
      return usage();
  }
}

function ask(out) {
  if (!args.id) throw new Error("Use --id.");
  const definition = definitionFor(out, args.id);
  const session = readSession(out);
  const channel = session.mode === "dashboard" && dashboardUp(out) ? "dashboard" : "chat";

  const images = [];
  for (const file of args.image) images.push(addShot(out, { file, label: path.basename(file), kind: "listing" }).shot.id);
  if (!images.length && args.id === "shots-review") {
    for (const shot of readSession(out).shots) if (shot.kind === "listing") images.push(shot.id);
  }
  publishAsk(out, { ...definition, images });

  if (channel === "dashboard") {
    return print({ ok: true, id: args.id, channel, next: `The question is on the dashboard now. Do NOT write a message to the user: a message with no command ends your turn, and the review would stall. Run \`node scripts/session.mjs wait --id ${args.id}\` immediately, and run it again while status is pending.` });
  }
  return print({
    ok: true,
    id: args.id,
    channel,
    warning: session.mode === "dashboard" ? "The dashboard is not running. Ask this in chat with AskQuestion, then record it with the answer command." : undefined,
    next: "Call AskQuestion with this question, then record the click: node scripts/session.mjs answer --id " + args.id + " --value <option id>"
  });
}

async function wait(out) {
  if (!args.id) throw new Error("Use --id.");
  const seconds = Math.min(Math.max(Number(args.timeout) || 25, 1), 110);
  const session = readSession(out);
  const info = readServer(out);
  if (session.mode === "dashboard") {
    if (!info) return print({ status: "server-down", id: args.id, next: "Ask this in chat with AskQuestion, then record it with the answer command." });
    try {
      const res = await fetch(`http://127.0.0.1:${info.port}/api/wait?id=${encodeURIComponent(args.id)}&timeout=${seconds}`, {
        headers: { authorization: `Bearer ${info.token}` },
        signal: AbortSignal.timeout((seconds + 8) * 1000)
      });
      const body = await res.json();
      if (body.status === "pending") body.next = "Not answered yet. The user has not clicked. Run the same wait command again right now. Do not write to the user.";
      if (body.status === "answered") noteDelivered(out, args.id, body.label, body.via);
      return print(body, body.status === "answered" ? out : undefined);
    } catch {
      return print({ status: "server-down", id: args.id, next: "Ask this in chat with AskQuestion, then record it with the answer command." });
    }
  }
  const end = Date.now() + seconds * 1000;
  for (;;) {
    const ask = readMerged(out)?.asks.find((item) => item.id === args.id);
    if (!ask) return print({ status: "missing", id: args.id });
    if (ask.status === "answered") {
      noteDelivered(out, args.id, ask.answerLabel, ask.via);
      return print({ status: "answered", id: args.id, value: ask.answer, label: ask.answerLabel, via: ask.via }, out);
    }
    if (Date.now() > end) return print({ status: "pending", id: args.id, next: "Not answered yet. Run the same wait command again right now. Do not write to the user." });
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

function ensureAsk(out) {
  const session = readSession(out);
  if (session.asks.some((item) => item.id === args.id)) return;
  publishAsk(out, { ...definitionFor(out, args.id), images: [] });
}

function definitionFor(out, id) {
  if (args.prompt) {
    if (args.option.length < 2) throw new Error("A custom question needs at least two --option values.");
    return {
      id,
      title: args.title || id,
      prompt: args.prompt,
      options: args.option.map((raw) => {
        const [optionId, label, ...detail] = raw.split(":");
        return { id: optionId, label: label || optionId, detail: detail.join(":") };
      })
    };
  }
  if (id === "fix") {
    const report = readReport(out);
    const live = report && fixAskFor(report, readMerged(out)?.notes || []);
    if (live) return live;
  }
  const fromFile = readQuestions(out).find((item) => item.id === id);
  if (fromFile) return fromFile;
  if (lateAsks[id]) return lateAsks[id]();
  throw new Error(`No question named ${id}. Known: ${[...readQuestions(out).map((item) => item.id), ...Object.keys(lateAsks)].join(", ")}.`);
}

function readQuestions(out) {
  try {
    return JSON.parse(fs.readFileSync(path.join(out, "questions.json"), "utf8"));
  } catch {
    return [];
  }
}

function dashboardUp(out) {
  const info = readServer(out);
  if (!info) return false;
  try {
    process.kill(info.pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** With `out`, a last line says what comes next, so no command ever leaves an agent without a next step. */
function print(value, out) {
  const next = () => reminder(out, { dashboardUp: dashboardUp(out) });
  let shown = value;
  if (out && value.status === "answered") shown = { ...value, next: `Answered. ${next()}` };
  // Every status a wait can return has its own `next`. Any other output, a note marked fixed included, gets the session's.
  else if (out && value.next === undefined && value.ok !== false && !["pending", "missing", "server-down"].includes(value.status)) shown = { ...value, next: next() };
  process.stdout.write(`${JSON.stringify(shown)}\n`);
}

function usage() {
  process.stdout.write(`${fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0].replace("#!/usr/bin/env node\n", "")}*/\n`);
  process.exit(0);
}

function parseArgs(argv) {
  const parsed = { image: [], option: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "image" || key === "option") parsed[key].push(argv[++i]);
    else parsed[key] = argv[++i];
  }
  return parsed;
}
