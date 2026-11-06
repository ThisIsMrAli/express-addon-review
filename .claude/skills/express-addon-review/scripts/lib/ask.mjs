const LISTING_IDS = new Set(["listing-icon", "listing-screenshot"]);

export function planAsks(report) {
  const findings = report.findings || [];
  const listing = findings.filter((finding) => LISTING_IDS.has(finding.id));
  const product = findings.filter((finding) => !LISTING_IDS.has(finding.id));
  const errors = product.filter((finding) => finding.severity === "error" && finding.source?.kind !== "review-pattern");
  const warnings = product.filter((finding) => finding.severity === "warn" && finding.source?.kind !== "review-pattern");
  const patterns = product.filter((finding) => finding.source?.kind === "review-pattern");
  const questions = [];
  errors.forEach((finding, index) => {
    const options = [
      { id: "yes", label: "Fix this (Recommended)" },
      { id: "skip", label: "Skip this one" }
    ];
    if (errors.length > 1 && index === 0) options.push({ id: "all", label: "Fix all remaining code errors" });
    options.push({ id: "stop", label: "Stop" });
    questions.push({
      id: `fix-${finding.id}-${finding.line}`,
      prompt: `Fix \`${finding.id}\` in ${finding.file}:${finding.line}? ${brief(finding.suggestion)}`,
      options
    });
  });
  if (warnings.length) {
    questions.push({
      id: "warnings",
      prompt: `Go through the ${warnings.length} warning${warnings.length === 1 ? "" : "s"} one by one?`,
      options: [
        { id: "yes", label: "Go through them (Recommended)" },
        { id: "skip", label: "Skip the warnings" },
        { id: "stop", label: "Stop" }
      ]
    });
  }
  if (patterns.length) {
    questions.push({
      id: "patterns",
      prompt: `Go through the ${patterns.length} review pattern${patterns.length === 1 ? "" : "s"}? These are marketplace letters, not Adobe sentences.`,
      options: [
        { id: "yes", label: "Go through them (Recommended)" },
        { id: "skip", label: "Skip the review patterns" },
        { id: "stop", label: "Stop" }
      ]
    });
  }
  if (report.access?.needsCredential) questions.push(credentialAsk(report.access));
  questions.push(designAsk(report.design));
  questions.push(listingAsk(listing));
  return questions;
}

export function planQuestions(report) {
  const questions = planAsks(report);
  const lines = [
    "Open the panel at 320px and walk the screens before the first question. Do not ask permission.",
    "Then call AskQuestion with the first object below. One call. Do not type the question as a paragraph.",
    "The first option is the suggestion. Pass the options through unchanged.",
    ""
  ];
  questions.forEach((question, index) => {
    lines.push(`${index + 1}. ${question.prompt}`);
    for (const option of question.options) lines.push(`   - ${option.id}: ${option.label}`);
    lines.push("");
  });
  return lines.join("\n");
}

function credentialAsk(access) {
  const where = access?.file ? ` Seen in ${access.file}.` : "";
  return {
    id: "credentials",
    prompt: `This add-on locks part of the product behind a license or a login.${where} A test key lets me open those screens. I will use it only in this session and I will not save it.`,
    options: [
      { id: "provide", label: "I will type the test license or login (Recommended)" },
      { id: "skip", label: "Skip the paid screens" },
      { id: "none", label: "There is no license" }
    ]
  };
}

function designAsk(design) {
  const libraries = design?.libraries || [];
  const theme = design?.expressTheme ? "The Express theme is already in the project." : "The Express theme was not found.";
  const tailwind = design?.tailwind ? " Tailwind is also installed. Leave it unless they pick a control to replace." : "";
  const leave = { id: "leave", label: "Leave the UI as it is" };
  if (libraries.includes("swc-react") && libraries.includes("react-spectrum")) {
    return {
      id: "design",
      prompt: `This add-on uses both swc-react and React Spectrum. ${theme} The fresh implementation guide prefers swc-react for React. I will not restyle anything until you say yes.${tailwind}`,
      options: [
        { id: "move", label: "Move the React Spectrum controls to swc-react (Recommended)" },
        { id: "review", label: "Review the controls and leave both libraries" },
        leave
      ]
    };
  }
  if (libraries.includes("swc-react") || libraries.includes("spectrum-web-components")) {
    return {
      id: "design",
      prompt: `This add-on already uses ${libraries.join(" and ") || "Spectrum"}. ${theme} I will not restyle anything until you say yes.${tailwind}`,
      options: [
        { id: "review", label: "Review the controls against the Express design guidelines (Recommended)" },
        leave
      ]
    };
  }
  if (libraries.includes("react-spectrum")) {
    return {
      id: "design",
      prompt: `This add-on uses React Spectrum. ${theme} The fresh implementation guide prefers swc-react for a React add-on. I will not switch libraries until you say yes.${tailwind}`,
      options: [
        { id: "move", label: "Move the controls to swc-react (Recommended)" },
        { id: "review", label: "Review the current controls against the design guidelines" },
        leave
      ]
    };
  }
  return {
    id: "design",
    prompt: `Apply Spectrum Web Components with the Express theme, and the Express design guidelines? ${theme} I will not restyle the panel until you say yes.${tailwind}`,
    options: [
      { id: "add", label: "Add Spectrum Web Components with the Express theme (Recommended)" },
      leave
    ]
  };
}

function listingAsk(listing) {
  const wrong = listing.length ? ` ${listing.length} listing file${listing.length === 1 ? " is" : "s are"} the wrong size.` : "";
  return {
    id: "listing",
    prompt: `Write the marketplace listing? I will draft the name, summary, description, and keywords from the manifest, the package description, and the visible panel, and I can make the 1360×800 screenshots. I will not copy index.html keywords.${wrong}`,
    options: [
      { id: "both", label: "Write the listing text and the screenshots (Recommended)" },
      { id: "shots", label: "Screenshots only" },
      { id: "text", label: "Listing text only" },
      { id: "skip", label: "Not now" }
    ]
  };
}

function brief(text) {
  const line = String(text || "").replace(/\s+/g, " ").trim();
  return line.length > 180 ? `${line.slice(0, 177)}...` : line;
}
