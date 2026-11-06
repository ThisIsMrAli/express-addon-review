import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectDesign } from "../.claude/skills/express-addon-review/scripts/lib/design.mjs";
import { planQuestions } from "../.claude/skills/express-addon-review/scripts/lib/ask.mjs";

test("a mixed React add-on is asked to move React Spectrum, not restyle first", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "express-design-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
    dependencies: {
      "@swc-react/button": "0.39.4",
      "@adobe/react-spectrum": "3.38.1",
      "@react-spectrum/theme-express": "3.0.0-alpha.16",
      tailwindcss: "3.4.13"
    }
  }));
  const design = detectDesign(dir, dir, []);
  assert.deepEqual(design.libraries, ["swc-react", "react-spectrum"]);
  assert.equal(design.expressTheme, true);
  assert.equal(design.tailwind, true);
  const text = planQuestions({ findings: [], design });
  assert.match(text, /uses both swc-react and React Spectrum/);
  assert.match(text, /Move the React Spectrum controls to swc-react \(Recommended\)/);
  assert.match(text, /will not restyle anything until you say yes/);
  assert.match(text, /Tailwind is also installed/);
});
