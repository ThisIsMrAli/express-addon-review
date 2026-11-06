import fs from "node:fs";
import { planQuestions } from "./lib/ask.mjs";

const file = process.argv[2];
if (!file) {
  process.stderr.write("Usage: node scripts/ask.mjs <report.json>\n");
  process.exit(1);
}
process.stdout.write(planQuestions(JSON.parse(fs.readFileSync(file, "utf8"))));
