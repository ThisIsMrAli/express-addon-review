import test from "node:test";
import assert from "node:assert/strict";
import { planAsks } from "../.claude/skills/express-addon-review/scripts/lib/ask.mjs";

test("the first selection is the code fix, with the suggestion marked", () => {
  const questions = planAsks({
    findings: [
      { id: "name-adobe-express", severity: "error", file: "src/Panel.tsx", line: 6, suggestion: "Write Adobe Express.", source: { kind: "adobe" } },
      { id: "cancel-missing", severity: "warn", file: "src/a.js", line: 2, suggestion: "Add Cancel.", source: { kind: "review-pattern" } },
      { id: "listing-screenshot", severity: "error", file: "thumbnails/01.png", line: 1, suggestion: "Export at 1360×800.", source: { kind: "adobe" } }
    ]
  });
  assert.equal(questions[0].options[0].label, "Fix this (Recommended)");
  assert.match(questions[0].prompt, /name-adobe-express/);
  assert.equal(questions[1].id, "patterns");
  assert.equal(questions.at(-1).id, "listing");
  assert.equal(questions.at(-1).options[0].label, "Write the listing text and the screenshots (Recommended)");
  assert.equal(questions.some((question) => /Open the panel/.test(question.prompt)), false);
});

test("a paid add-on asks for a test license before the design choice", () => {
  const questions = planAsks({ findings: [], access: { needsCredential: true, file: "src/license.ts" } });
  assert.equal(questions[0].id, "credentials");
  assert.equal(questions[0].options[0].id, "provide");
  assert.match(questions[0].prompt, /src\/license\.ts/);
  assert.match(questions[0].prompt, /will not save it/);
  assert.equal(questions[1].id, "design");
});

test("a clean report starts with the design selection", () => {
  const questions = planAsks({ findings: [] });
  assert.equal(questions[0].id, "design");
  assert.match(questions[0].options[0].label, /\(Recommended\)$/);
  assert.equal(questions[1].id, "listing");
  assert.ok(questions[1].options.some((option) => option.id === "shots"));
  assert.ok(questions[1].options.some((option) => option.id === "skip"));
});
