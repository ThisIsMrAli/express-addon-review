import path from "node:path";
import { scanAddon } from "./lib/scan.mjs";

const args = parseArgs(process.argv.slice(2));
const input = args.input || args._[0];
if (!input) {
  process.stderr.write("Usage: node scripts/scan.mjs --input <addon-folder>\n");
  process.exit(1);
}
const report = scanAddon(path.resolve(input), { liveDir: args.live });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.ok ? 0 : 1);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input") args.input = argv[++i];
    else if (token === "--live") args.live = argv[++i];
    else args._.push(token);
  }
  return args;
}
