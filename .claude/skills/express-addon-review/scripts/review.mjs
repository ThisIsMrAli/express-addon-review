import fs from "node:fs";
import path from "node:path";
import { planAsks, planQuestions } from "./lib/ask.mjs";
import { liveDir } from "./lib/paths.mjs";
import { renderMarkdown } from "./lib/report.mjs";
import { scanAddon } from "./lib/scan.mjs";
import { refreshDocs } from "./refresh-docs.mjs";

const args = parseArgs(process.argv.slice(2));
const input = args.input || args._[0];
if (!input) {
  process.stderr.write("Usage: node scripts/review.mjs --input <addon-folder> [--out dir] [--refresh]\n");
  process.exit(1);
}

const addonDir = path.resolve(input);
const live = args.live || liveDir;
const summaryPath = path.join(live, "summary.json");
const haveCache = fs.existsSync(summaryPath);
let summary = null;
if (args.refresh || (!args.noRefresh && !haveCache)) summary = await refreshDocs(live);
else if (haveCache) {
  try {
    summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  } catch {
    summary = null;
  }
}
const scan = scanAddon(addonDir, { liveDir: live });
const codeDir = scan.addonDir || addonDir;
let name = path.basename(codeDir);
try {
  name = JSON.parse(fs.readFileSync(path.join(codeDir, "manifest.json"), "utf8")).name || name;
} catch {
  name = path.basename(addonDir);
}
const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "addon";
const out = path.resolve(args.out || path.join(process.cwd(), "review-output", slug));
fs.mkdirSync(out, { recursive: true });
const report = {
  ...scan,
  addon: name,
  addonPath: codeDir,
  projectPath: addonDir,
  docsSha: summary?.sha || "",
  fetchedAt: summary?.fetchedAt || ""
};
fs.writeFileSync(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(out, "report.md"), renderMarkdown(report));
fs.writeFileSync(path.join(out, "views.json"), `${JSON.stringify(scan.views, null, 2)}\n`);
fs.writeFileSync(path.join(out, "questions.md"), planQuestions(report));
fs.writeFileSync(path.join(out, "questions.json"), `${JSON.stringify(planAsks(report), null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ok: report.ok, out, errors: report.findings.filter((finding) => finding.severity === "error").length, warnings: report.findings.filter((finding) => finding.severity === "warn").length, skipped: report.skipped.length }, null, 2)}\n`);
process.exit(report.ok ? 0 : 1);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input") args.input = argv[++i];
    else if (token === "--out") args.out = argv[++i];
    else if (token === "--live") args.live = argv[++i];
    else if (token === "--no-refresh") args.noRefresh = true;
    else if (token === "--refresh") args.refresh = true;
    else args._.push(token);
  }
  return args;
}
