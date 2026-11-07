import test from "node:test";
import assert from "node:assert/strict";
import { planAsks } from "../.claude/skills/express-addon-review/scripts/lib/ask.mjs";

test("findings become one fix step, not one question per bug", () => {
  const questions = planAsks({
    findings: [
      { id: "name-adobe-express", severity: "error", file: "src/Panel.tsx", line: 6, suggestion: "Write Adobe Express.", source: { kind: "adobe" } },
      { id: "cancel-missing", severity: "warn", file: "src/a.js", line: 2, suggestion: "Add Cancel.", source: { kind: "adobe" } },
      { id: "export-without-cancel", severity: "warn", file: "src/b.js", line: 3, suggestion: "Add Cancel.", source: { kind: "review-pattern" } },
      { id: "listing-screenshot", severity: "error", file: "thumbnails/01.png", line: 1, suggestion: "Export at 1360×800.", source: { kind: "adobe" } }
    ]
  });
  assert.equal(questions[0].id, "fix");
  assert.equal(questions[0].options[0].label, "Fix everything in this step (Recommended)");
  assert.ok(questions[0].options.some((option) => option.id === "errors"));
  assert.match(questions[0].prompt, /1 code error/);
  assert.match(questions[0].prompt, /1 warning/);
  assert.match(questions[0].prompt, /1 review pattern/);
  assert.equal(questions.filter((question) => question.id.startsWith("fix-")).length, 0);
  assert.equal(questions.at(-1).id, "listing");
});

test("a paid add-on asks for a test license before the fix step", () => {
  const questions = planAsks({
    findings: [
      { id: "name-adobe-express", severity: "error", file: "src/Panel.tsx", line: 6, suggestion: "Write Adobe Express.", source: { kind: "adobe" } }
    ],
    access: { needsCredential: true, file: "src/license.ts" }
  });
  assert.equal(questions[0].id, "credentials");
  assert.equal(questions[1].id, "fix");
  assert.equal(questions[2].id, "design");
});

test("a clean report starts with the design selection", () => {
  const questions = planAsks({ findings: [] });
  assert.equal(questions[0].id, "design");
  assert.match(questions[0].options[0].label, /\(Recommended\)$/);
  assert.equal(questions[1].id, "listing");
  assert.ok(questions[1].options.some((option) => option.id === "shots"));
});
