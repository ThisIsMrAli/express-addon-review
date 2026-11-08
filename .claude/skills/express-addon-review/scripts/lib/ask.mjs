/**
 * The big decisions in a review. Everything else is reported, not asked.
 *
 * `id`, `label`, `prompt`, and `options` go to the AskQuestion tool unchanged.
 * `title`, `detail`, and `affects` are for the dashboard only: they say what
 * will happen if an option is chosen.
 */

const LISTING_IDS = new Set(["listing-icon", "listing-screenshot"]);

export function modeAsk() {
  return {
    id: "mode",
    title: "How to follow this review",
    prompt: "How do you want to follow this review? The dashboard opens in Chrome on this computer, shows each step as it happens, and lets you approve decisions there. Chat keeps everything in this conversation.",
    options: [
      { id: "dashboard", label: "Live dashboard in Chrome (Recommended)", detail: "Opens a page on this computer only. Progress, findings, panel captures, and every decision are there." },
      { id: "chat", label: "Stay in chat", detail: "No page opens. Progress and questions stay in this conversation." }
    ]
  };
}

function classify(report) {
  const findings = report.findings || [];
  const listing = findings.filter((finding) => LISTING_IDS.has(finding.id));
  const product = findings.filter((finding) => !LISTING_IDS.has(finding.id));
  return {
    listing,
    errors: product.filter((finding) => finding.severity === "error" && finding.source?.kind !== "review-pattern"),
    warnings: product.filter((finding) => finding.severity === "warn" && finding.source?.kind !== "review-pattern"),
    patterns: product.filter((finding) => finding.source?.kind === "review-pattern")
  };
}

/**
 * The `fix` question as it stands now: the code scan plus any panel warnings the
 * audit measured since. Null when there is nothing to fix.
 */
export function fixAskFor(report, notes = []) {
  const { errors, warnings, patterns } = classify(report);
  const panel = notes.filter((note) => note.auto && note.status === "open" && note.severity === "warn");
  return errors.length + warnings.length + patterns.length + panel.length ? fixAsk({ errors, warnings, patterns, panel }) : null;
}

/** The decisions that follow the scan, in order. */
export function planAsks(report) {
  const { listing, errors, warnings, patterns } = classify(report);
  const questions = [];

  if (report.access?.needsCredential) questions.push(credentialAsk(report.access));
  if (errors.length + warnings.length + patterns.length > 0) questions.push(fixAsk({ errors, warnings, patterns }));
  questions.push(designAsk(report.design));
  if ((report.views || []).length) questions.push(polishAsk());
  questions.push(listingAsk(listing));
  return questions;
}

/** What `questions.json` holds: the mode question, then the decisions. */
export function planAll(report) {
  return [modeAsk(), ...planAsks(report)];
}

/** Asked only after the screenshots or the text exist. */
export const lateAsks = {
  "shots-review": shotsAsk,
  "listing-review": listingTextAsk
};

export function shotsAsk() {
  return {
    id: "shots-review",
    title: "Approve the screenshots",
    prompt: "These screenshots were built from the locked template at 1360×800. Copy them into thumbnails/?",
    options: [
      { id: "approve", label: "Use these screenshots (Recommended)", detail: "Copies each file into the add-on's thumbnails/ folder. Nothing else changes." },
      { id: "redo", label: "Rebuild them", detail: "Starts again from the locked template and rechecks every word and capture against the add-on." },
      { id: "skip", label: "Do not write screenshots", detail: "Leaves thumbnails/ alone. The previews stay in the review folder." }
    ]
  };
}

export function listingTextAsk() {
  return {
    id: "listing-review",
    title: "Approve the listing text",
    prompt: "This is the listing draft, written from the manifest, the package description, and the visible panel. Keep it?",
    options: [
      { id: "approve", label: "Keep this text (Recommended)", detail: "Saves it as the final draft in the review folder and the summary. Nothing is submitted for you." },
      { id: "redo", label: "Rewrite it", detail: "Drafts it again from the same sources." },
      { id: "skip", label: "Discard the draft", detail: "Leaves the listing text empty." }
    ]
  };
}

export function planQuestions(report) {
  const questions = planAll(report);
  const lines = [
    "Ask the first question, `mode`, in chat with AskQuestion. It decides where the rest happens.",
    "If the answer is `dashboard`: start the dashboard and publish each later question with the session ask command, then wait for the click. Do not also call AskQuestion for it.",
    "If the answer is `chat`: call AskQuestion for each later question, one call at a time, then record the answer with the session answer command.",
    "Pass prompt and options (id and label only) to AskQuestion unchanged. Title is Next step. The first option is the suggestion.",
    "Never ask one question per finding.",
    ""
  ];
  questions.forEach((question, index) => {
    lines.push(`${index + 1}. [${question.id}] ${question.prompt}`);
    for (const option of question.options) lines.push(`   - ${option.id}: ${option.label}`);
    lines.push("");
  });
  return lines.join("\n");
}

function fixAsk({ errors, warnings, patterns, panel = [] }) {
  const all = [...errors, ...warnings, ...patterns];
  const parts = [];
  if (errors.length) parts.push(`${errors.length} code error${errors.length === 1 ? "" : "s"}`);
  if (warnings.length) parts.push(`${warnings.length} warning${warnings.length === 1 ? "" : "s"}`);
  if (patterns.length) parts.push(`${patterns.length} review pattern${patterns.length === 1 ? "" : "s"}`);
  if (panel.length) parts.push(`${panel.length} panel warning${panel.length === 1 ? "" : "s"} measured at 320px`);
  const named = [...all.map((finding) => finding.id), ...panel.map((note) => note.rule)].slice(0, 6).join(", ");
  const more = all.length + panel.length > 6 ? ", and more" : "";
  const options = [
    {
      id: "all",
      label: "Fix everything found (Recommended)",
      detail: "Edits every file listed, fixes each panel warning from the walk, then scans and walks the panel again to confirm. Nothing outside those findings changes."
    }
  ];
  if (errors.length && (warnings.length || patterns.length || panel.length)) {
    options.push({ id: "errors", label: "Fix code errors only", detail: "Edits only the code errors. Warnings, review patterns, and panel warnings stay open." });
  }
  options.push(
    { id: "skip", label: "Skip fixes and continue", detail: "Changes nothing. Open findings go in the final summary." },
    { id: "stop", label: "Stop", detail: "Ends the review here." }
  );
  return {
    id: "fix",
    title: "Fix the findings",
    prompt: `The review found ${parts.join(", ")} (${named}${more}). They are listed in the review. Bugs the panel walk measured are already fixed. How should we handle these?`,
    options,
    affects: [
      ...all.slice(0, 40).map((finding) => ({
        id: finding.id,
        file: finding.file,
        line: finding.line,
        severity: finding.source?.kind === "review-pattern" ? "pattern" : finding.severity
      })),
      ...panel.slice(0, 20).map((note) => ({ id: note.rule, file: note.source?.file || note.screen, line: note.source?.line, severity: "warn" }))
    ]
  };
}

function credentialAsk(access) {
  const where = access?.file ? ` Seen in ${access.file}.` : "";
  return {
    id: "credentials",
    title: "Test license or login",
    prompt: `This add-on locks part of the product behind a license or a login.${where} A test key lets me open those screens. I will use it only in this session and I will not save it.`,
    options: [
      { id: "provide", label: "I will type the test license or login (Recommended)", detail: "Used only to open the paid screens in the browser. It is never written to a file or the report.", secret: "Test license or login" },
      { id: "skip", label: "Skip the paid screens", detail: "Those screens are not opened or reviewed. The summary says so." },
      { id: "none", label: "There is no license", detail: "Continues without one." }
    ]
  };
}

function designAsk(design) {
  const libraries = design?.libraries || [];
  const theme = design?.expressTheme ? "The Express theme is already in the project." : "The Express theme was not found.";
  const tailwind = design?.tailwind ? " Tailwind is also installed. Leave it unless they pick a control to replace." : "";
  const leave = { id: "leave", label: "Leave the UI as it is", detail: "No control or style is changed." };
  if (libraries.includes("swc-react") && libraries.includes("react-spectrum")) {
    return {
      id: "design",
      title: "Design",
      prompt: `This add-on uses both swc-react and React Spectrum. ${theme} The fresh implementation guide prefers swc-react for React. I will not restyle anything until you say yes.${tailwind}`,
      options: [
        { id: "move", label: "Move the React Spectrum controls to swc-react (Recommended)", detail: "Replaces each React Spectrum control with its swc-react equivalent, then reloads the screens." },
        { id: "review", label: "Review the controls and leave both libraries", detail: "Reads each control against the design guidelines and reports. Changes nothing." },
        leave
      ]
    };
  }
  if (libraries.includes("swc-react") || libraries.includes("spectrum-web-components")) {
    return {
      id: "design",
      title: "Design",
      prompt: `This add-on already uses ${libraries.join(" and ") || "Spectrum"}. ${theme} I will not restyle anything until you say yes.${tailwind}`,
      options: [
        { id: "review", label: "Review the controls against the Express design guidelines (Recommended)", detail: "Reads each control against the guidelines and fixes the ones that miss." },
        leave
      ]
    };
  }
  if (libraries.includes("react-spectrum")) {
    return {
      id: "design",
      title: "Design",
      prompt: `This add-on uses React Spectrum. ${theme} The fresh implementation guide prefers swc-react for a React add-on. I will not switch libraries until you say yes.${tailwind}`,
      options: [
        { id: "move", label: "Move the controls to swc-react (Recommended)", detail: "Replaces each React Spectrum control with its swc-react equivalent, then reloads the screens." },
        { id: "review", label: "Review the current controls against the design guidelines", detail: "Reads each control against the guidelines and reports. Changes nothing." },
        leave
      ]
    };
  }
  return {
    id: "design",
    title: "Design",
    prompt: `Apply Spectrum Web Components with the Express theme, and the Express design guidelines? ${theme} I will not restyle the panel until you say yes.${tailwind}`,
    options: [
      { id: "add", label: "Add Spectrum Web Components with the Express theme (Recommended)", detail: "Installs the packages, wraps the app in the Express theme, and replaces plain controls that Spectrum Web Components ships. A color input stays. Reloads each screen." },
      leave
    ]
  };
}

function polishAsk() {
  return {
    id: "polish",
    title: "Polish the UI",
    prompt: "The bugs the walk measured are already fixed. Do you also want a small, measured polish pass? It follows a short checklist (spacing, type size, tap targets, focus rings, motion, empty and loading states). Colors, layout, and copy stay as they are.",
    options: [
      { id: "apply", label: "Apply the polish (Recommended)", detail: "Fixes only what the checklist measures and can name, one edit at a time, then reloads each screen in light and dark. No redesign." },
      { id: "review", label: "List what I would change, and change nothing", detail: "Shows each item with the screen, the measurement, and the exact edit." },
      { id: "skip", label: "Skip polish", detail: "No UI changes beyond the bugs already fixed." }
    ]
  };
}

function listingAsk(listing) {
  const wrong = listing.length ? ` ${listing.length} listing file${listing.length === 1 ? " is" : "s are"} the wrong size.` : "";
  return {
    id: "listing",
    title: "Marketplace listing",
    prompt: `Write the marketplace listing? I will draft the name, summary, description, and keywords from the manifest, the package description, and the visible panel, and I can make the 1360×800 screenshots from the skill template. I will not copy index.html keywords.${wrong}`,
    options: [
      { id: "both", label: "Write the listing text and the screenshots (Recommended)", detail: "Drafts the text and builds three screenshots from the locked template. You approve each before anything is written to the add-on." },
      { id: "shots", label: "Screenshots only", detail: "Builds the screenshots. You approve them before they go into thumbnails/." },
      { id: "text", label: "Listing text only", detail: "Drafts the name, summary, description, and keywords. You approve the draft." },
      { id: "skip", label: "Not now", detail: "No listing work. Nothing is created." }
    ]
  };
}
