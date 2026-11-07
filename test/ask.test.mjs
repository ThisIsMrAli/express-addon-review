import test from "node:test";
import assert from "node:assert/strict";
import { lateAsks, modeAsk, planAll, planAsks, planQuestions } from "../.claude/skills/express-addon-review/scripts/lib/ask.mjs";

test("one fix choice covers all findings, with Fix everything first", () => {
  const questions = planAsks({
    findings: [
      { id: "name-adobe-express", severity: "error", file: "src/Panel.tsx", line: 6, suggestion: "Write Adobe Express.", source: { kind: "adobe" } },
      { id: "spacing", severity: "warn", file: "src/a.js", line: 2, suggestion: "Use 16px gap.", source: { kind: "adobe" } },
      { id: "cancel-missing", severity: "warn", file: "src/a.js", line: 2, suggestion: "Add Cancel.", source: { kind: "review-pattern" } },
      { id: "listing-screenshot", severity: "error", file: "thumbnails/01.png", line: 1, suggestion: "Export at 1360×800.", source: { kind: "adobe" } }
    ]
  });
  assert.equal(questions[0].id, "fix");
  assert.equal(questions[0].options[0].label, "Fix everything found (Recommended)");
  assert.ok(questions[0].options.some((option) => option.id === "errors"));
  assert.match(questions[0].prompt, /name-adobe-express/);
  assert.match(questions[0].prompt, /listed in the review/);
  assert.equal(questions[0].affects.length, 3, "the dashboard lists what a fix touches, listing files excluded");
  assert.equal(questions.some((question) => question.id.startsWith("fix-")), false);
  assert.equal(questions.at(-1).id, "listing");
  assert.equal(questions.at(-1).options[0].label, "Write the listing text and the screenshots (Recommended)");
  assert.equal(questions.some((question) => /Open the panel/.test(question.prompt)), false);
});

test("a paid add-on asks for a test license before the fix choice", () => {
  const questions = planAsks({
    findings: [
      { id: "name-adobe-express", severity: "error", file: "src/Panel.tsx", line: 6, suggestion: "Write Adobe Express.", source: { kind: "adobe" } }
    ],
    access: { needsCredential: true, file: "src/license.ts" }
  });
  assert.equal(questions[0].id, "credentials");
  assert.equal(questions[0].options[0].id, "provide");
  assert.match(questions[0].prompt, /src\/license\.ts/);
  assert.match(questions[0].prompt, /will not save it/);
  assert.equal(questions[1].id, "fix");
  assert.equal(questions[2].id, "design");
});

test("a clean report starts with the design selection", () => {
  const questions = planAsks({ findings: [] });
  assert.equal(questions[0].id, "design");
  assert.match(questions[0].options[0].label, /\(Recommended\)$/);
  assert.equal(questions[1].id, "listing");
  assert.ok(questions[1].options.some((option) => option.id === "shots"));
  assert.ok(questions[1].options.some((option) => option.id === "skip"));
});

test("errors-only option appears only when there is more than code errors", () => {
  const onlyErrors = planAsks({
    findings: [
      { id: "name-adobe-express", severity: "error", file: "src/Panel.tsx", line: 6, suggestion: "Write Adobe Express.", source: { kind: "adobe" } }
    ]
  });
  assert.equal(onlyErrors[0].options.some((option) => option.id === "errors"), false);

  const mixed = planAsks({
    findings: [
      { id: "name-adobe-express", severity: "error", file: "src/Panel.tsx", line: 6, suggestion: "Write Adobe Express.", source: { kind: "adobe" } },
      { id: "cancel-missing", severity: "warn", file: "src/a.js", line: 2, suggestion: "Add Cancel.", source: { kind: "review-pattern" } }
    ]
  });
  assert.equal(mixed[0].options.some((option) => option.id === "errors"), true);
});

test("the mode question comes first, so the user picks where the review happens before anything else", () => {
  const all = planAll({ findings: [], access: { needsCredential: true, file: "src/license.ts" } });
  assert.equal(all[0].id, "mode");
  assert.deepEqual(all[0].options.map((option) => option.id), ["dashboard", "chat"]);
  assert.match(all[0].options[0].label, /\(Recommended\)$/);
  assert.deepEqual(all.slice(1).map((question) => question.id), ["credentials", "design", "listing"]);
});

test("every option says what it will do, and only one option per question is the suggestion", () => {
  const questions = [
    ...planAll({ findings: [{ id: "a", severity: "error", file: "x", line: 1, source: { kind: "adobe" } }, { id: "b", severity: "warn", file: "x", line: 2, source: { kind: "adobe" } }], access: { needsCredential: true } }),
    lateAsks["shots-review"](),
    lateAsks["listing-review"]()
  ];
  for (const question of questions) {
    assert.ok(question.options.length >= 2 && question.options.length <= 5, `${question.id} has ${question.options.length} options`);
    assert.equal(question.options.filter((option) => /\(Recommended\)$/.test(option.label)).length, 1, `${question.id} has one suggestion`);
    assert.match(question.options[0].label, /\(Recommended\)$/, `${question.id} lists the suggestion first`);
    for (const option of question.options) assert.ok(option.detail && option.detail.length > 12, `${question.id}/${option.id} needs a detail line`);
  }
});

test("only the credentials question carries a secret field, and the prompt promises not to save it", () => {
  const withSecret = planAll({ findings: [], access: { needsCredential: true } }).flatMap((question) => question.options.map((option) => [question.id, option]))
    .filter(([, option]) => option.secret);
  assert.deepEqual(withSecret.map(([id, option]) => `${id}/${option.id}`), ["credentials/provide"]);
});

test("the mode question never offers more than the two places the review can happen", () => {
  assert.equal(modeAsk().options.length, 2);
});

test("questions.md tells the agent to ask mode in chat and never ask per finding", () => {
  const text = planQuestions({ findings: [{ id: "a", severity: "error", file: "x", line: 1, source: { kind: "adobe" } }] });
  assert.match(text, /\[mode\]/);
  assert.match(text, /Never ask one question per finding/);
  assert.match(text, /Do not also call AskQuestion/);
});
