import fs from "node:fs";
import path from "node:path";
import { planAll, planQuestions } from "./lib/ask.mjs";
import { defaultOut, liveDir, rememberedOut, rememberOut } from "./lib/paths.mjs";
import { renderMarkdown } from "./lib/report.mjs";
import { scanAddon } from "./lib/scan.mjs";
import { startSession } from "./lib/session.mjs";
import { refreshDocs } from "./refresh-docs.mjs";

const args = parseArgs(process.argv.slice(2));
const input = args.input || args._[0];
if (!input) {
  process.stderr.write("Usage: node scripts/review.mjs --input <addon-folder> [--zip upload.zip] [--no-refresh] [--refresh] [--rescan] [--out dir]\n");
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
const scan = scanAddon(addonDir, { liveDir: live, zips: args.zip });
const codeDir = scan.addonDir || addonDir;
let name = path.basename(codeDir);
try {
  name = JSON.parse(fs.readFileSync(path.join(codeDir, "manifest.json"), "utf8")).name || name;
} catch {
  name = path.basename(addonDir);
}
const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "addon";
let out = path.resolve(args.out || defaultOut(slug));
// A re-scan belongs to the review already open for this add-on, wherever that review's folder is.
if (!args.out && args.rescan) {
  const last = rememberedOut();
  try {
    if (last && JSON.parse(fs.readFileSync(path.join(last, "report.json"), "utf8")).addonPath === codeDir) out = last;
  } catch {
    // The remembered folder holds no report. The default folder is right.
  }
}
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
fs.writeFileSync(path.join(out, "questions.json"), `${JSON.stringify(planAll(report), null, 2)}\n`);
startSession(out, report, { keep: Boolean(args.rescan) });
rememberOut(out);

const count = (test) => report.findings.filter(test).length;
process.stdout.write(`${JSON.stringify({
  ok: report.ok,
  out,
  addon: name,
  errors: count((finding) => finding.severity === "error" && finding.source?.kind !== "review-pattern"),
  warnings: count((finding) => finding.severity === "warn" && finding.source?.kind !== "review-pattern"),
  patterns: count((finding) => finding.source?.kind === "review-pattern"),
  skipped: report.skipped.length,
  docsSha: report.docsSha,
  next: args.rescan
    ? "Re-scanned. The session kept its steps, notes, and answers. Run `node scripts/session.mjs next` and do what it says."
    : "Ask the first question in questions.json (mode) with AskQuestion, then `node scripts/session.mjs mode --set dashboard|chat`. Do not end your turn: the review runs to `session.mjs done`."
}, null, 2)}\n`);
process.exit(report.ok ? 0 : 1);

function parseArgs(argv) {
  const args = { _: [], zip: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input") args.input = argv[++i];
    else if (token === "--out") args.out = argv[++i];
    else if (token === "--zip") args.zip.push(argv[++i]);
    else if (token === "--live") args.live = argv[++i];
    else if (token === "--no-refresh") args.noRefresh = true;
    else if (token === "--refresh") args.refresh = true;
    else if (token === "--rescan") args.rescan = true;
    else args._.push(token);
  }
  return args;
}
