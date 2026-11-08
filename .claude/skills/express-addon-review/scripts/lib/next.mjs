import { readMerged, readReport } from "./session.mjs";

const OPEN = new Set(["pending", "running", "waiting"]);

/**
 * What the agent should do now, worked out from the session alone.
 * It is the way back in for an agent that lost its place, and it is the one place that says
 * a review is not over until `done`. It never changes anything.
 */
export function nextAction(out, { dashboardUp = false } = {}) {
  const session = readMerged(out);
  if (!session) return { action: "start", say: "No review yet. Run review.mjs first." };
  const report = readReport(out) || {};
  const step = (id) => session.steps.find((item) => item.id === id);
  const dashboard = session.mode === "dashboard" && dashboardUp;

  if (step("done")?.status === "done") {
    return { action: "finished", say: "The review is finished. Give the user the summary. Run `node scripts/dashboard.mjs stop` if the dashboard is still up." };
  }
  if (!session.mode) {
    return { action: "ask-mode", say: "Ask the `mode` question in questions.json with AskQuestion, then `session.mjs mode --set dashboard|chat`." };
  }
  if (session.mode === "dashboard" && !dashboardUp) {
    return { action: "start-dashboard", command: "node scripts/dashboard.mjs start", say: "The dashboard is not running. Start it. If it fails, `session.mjs mode --set chat` and continue in chat." };
  }

  const pending = session.asks.find((ask) => ask.status === "pending");
  if (pending) {
    return dashboard
      ? { action: "wait", ask: pending.id, command: `node scripts/session.mjs wait --id ${pending.id}`, say: `The question "${pending.title || pending.id}" is on the dashboard. Do not write to the user. Run the wait command now, and run it again while status is pending.` }
      : { action: "ask-in-chat", ask: pending.id, say: `Ask "${pending.title || pending.id}" with AskQuestion, then record the click with \`session.mjs answer --id ${pending.id} --value <option id>\`.` };
  }

  const answered = (id) => session.asks.find((ask) => ask.id === id && ask.status === "answered");
  const audit = session.audit || null;
  const open = (id) => OPEN.has(step(id)?.status);
  const openNotes = (session.notes || []).filter((note) => note.status === "open");
  const uiErrors = openNotes.filter((note) => note.severity === "error" && note.rule);
  // The agent's "fixed" is a claim. Only an audit that measures the panel again confirms it.
  const claimed = audit ? (session.notes || []).filter((note) => note.auto && note.status === "fixed" && note.fixedBy === "agent" && note.fixedRev > (audit.rev || 0)) : [];
  const confirm = {
    action: "run",
    command: "node scripts/audit.mjs --recheck",
    notes: claimed.map((note) => note.id),
    say: `You marked ${claimed.map((note) => note.id).join(", ")} fixed since the last audit. Run the recheck now: it opens only the screens those notes came from, so it takes seconds. It counts a bug fixed only when it no longer measures it, and it reopens the note if it does. Edit every open note first, then recheck once.`
  };
  // A recheck looks at some screens. Edits made after the last full walk (a design swap, polish) can move things on screens it never opened.
  const editedAfterFullWalk = audit && ["fix", "design", "polish"].some((id) => {
    const item = step(id);
    return item?.status === "done" && item.endedAt && item.endedAt > (audit.fullAt || audit.at || "");
  });

  if (open("panel")) {
    if (!audit) {
      return { action: "run", command: "node scripts/audit.mjs", say: "Walk the panel. This one command makes the panel available (it builds the add-on if nothing is running), opens every screen and dialog at 320px in light and dark, and records what it measures. It takes about a minute. Run it now." };
    }
    if (report.access?.needsCredential && !audit.licensed && step("access")?.status !== "skipped") {
      const credentials = answered("credentials");
      if (!credentials) return { action: "ask", ask: "credentials", command: "node scripts/session.mjs ask --id credentials", say: "The paid screens need a test license. Ask the `credentials` question, then wait for it." };
      if (credentials.answer === "provide") {
        return { action: "run", command: "node scripts/audit.mjs --licensed", say: "Run the licensed pass now. It reads the license from the dashboard by itself. Do not paste it anywhere." };
      }
    }
    if (uiErrors.length) {
      return { action: "fix-ui", notes: uiErrors.map((note) => note.id), say: `Fix these ${uiErrors.length} measured UI bug${uiErrors.length === 1 ? "" : "s"} now, without asking. The note text is the evidence, so do not open screenshots to see them. Each note has the file and line. Change only the element a note names. Mark each \`session.mjs note --id <id> --status fixed\`, then run \`node scripts/audit.mjs --recheck\` once to confirm.` };
    }
    if (claimed.length) return confirm;
    return { action: "run", command: 'node scripts/session.mjs step --id panel --status done --detail "<what was covered>"', say: "The walk is finished and no measured bug is open. Mark the panel step done, then ask the next question." };
  }

  // Not even a fix made later, in the fix or polish step, is done until the audit has measured it again.
  if (claimed.length) return confirm;

  // Once the edits are over, walk every screen again, once, before the listing and the close.
  if (editedAfterFullWalk && !["fix", "design", "polish"].some((id) => open(id)) && (open("listing") || open("done") || !step("done"))) {
    return { action: "run", command: "node scripts/audit.mjs", say: "The edits are finished. Walk every screen once more, in light and dark, to catch anything the edits moved on a screen the rechecks did not open. Run it now." };
  }

  for (const id of ["fix", "design", "polish", "listing"]) {
    if (!open(id)) continue;
    const ask = answered(id);
    const published = session.asks.some((item) => item.id === id);
    if (!ask && !published) {
      return { action: "ask", ask: id, command: `node scripts/session.mjs ask --id ${id}`, say: `Ask the \`${id}\` question.` };
    }
    if (ask && id === "listing" && ask.answer !== "skip") {
      const step = listingStep(session, ask.answer, answered);
      if (step) return step;
    }
    if (ask) {
      const listingNote = id === "listing" && ask.answer !== "skip"
        ? " The publisher fields only the user knows (website, logo, release notes, AI usage, monetization, notes to the reviewer) go into the closing summary as a checklist. Do not stop to ask for them: a chat message with no command ends the review."
        : "";
      return { action: "apply", ask: id, answer: ask.answer, say: `Apply the answer "${ask.answerLabel}" for \`${id}\` as references/session.md says, then \`session.mjs step --id ${id} --status done\`.${listingNote}` };
    }
  }

  if (open("scan") || open("access") || open("fix") || open("design") || open("polish") || open("listing")) {
    const left = ["scan", "access", "fix", "design", "polish", "listing"].filter((id) => open(id));
    return { action: "close-steps", steps: left, say: `Steps still open: ${left.join(", ")}. Mark each done or skipped with \`session.mjs step\`, then finish.` };
  }
  return { action: "finish", command: 'node scripts/session.mjs done --summary "<one short paragraph>"', say: "Everything is done. Run the done command, then stop the dashboard." };
}

/**
 * Where the listing work stands after the `listing` answer: draft the text, show it, make the screenshots, show them.
 * Null when every part the user asked for is drafted and approved, so only the closing remains.
 */
function listingStep(session, choice, answered) {
  const wantsText = choice === "both" || choice === "text";
  const wantsShots = choice === "both" || choice === "shots";
  const published = (id) => session.asks.some((item) => item.id === id);
  const approved = (id) => answered(id)?.answer;
  if (wantsText) {
    if (!session.listing || approved("listing-review") === "redo") {
      return { action: "draft-listing", say: "Draft the listing text from the manifest, the package description, and the visible panel (references/submission.md). Save it: `node scripts/session.mjs listing --json <file>`. Then ask `listing-review`." };
    }
    if (!published("listing-review")) {
      return { action: "ask", ask: "listing-review", command: "node scripts/session.mjs ask --id listing-review", say: "The draft is saved. Show it with the `listing-review` question, then wait for the answer." };
    }
  }
  if (wantsShots) {
    const made = session.shots.some((shot) => shot.kind === "listing");
    if (!made || approved("shots-review") === "redo") {
      return { action: "make-shots", say: "Make the screenshots as references/listing-shots.md says: `prepare-listing.mjs`, then `render-listing.mjs`. Then ask `shots-review`." };
    }
    if (!published("shots-review")) {
      return { action: "ask", ask: "shots-review", command: "node scripts/session.mjs ask --id shots-review", say: "The screenshots are made. Show them with the `shots-review` question, then wait for the answer." };
    }
  }
  return null;
}

/** One sentence that rides along on every CLI answer, so no command ever ends without saying what comes next. */
export function reminder(out, options) {
  const next = nextAction(out, options);
  if (next.action === "finished") return "The review is finished.";
  return `Not finished. Next: ${next.say} Do not end your turn until \`session.mjs next\` says finished.`;
}
