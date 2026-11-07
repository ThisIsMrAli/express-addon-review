/**
 * Checks that come from neither an Adobe sentence nor a review letter. They
 * are about the state of the project itself. The report labels them `tool`.
 */
export const TOOL_RULES = [
  { id: "package-stale", severity: "warn", run: checkStale }
];

/** A zip built before the last edit is the upload that sends the old code. */
const GRACE_MS = 60 * 1000;

function checkStale(ctx) {
  for (const pkg of ctx.packages || []) {
    if (!pkg.entries.length) continue;
    const reasons = [];
    if (ctx.newest?.mtimeMs > pkg.mtimeMs + GRACE_MS) reasons.push(`${ctx.newest.rel} changed after it was built`);
    const built = pkg.manifest?.version;
    const source = ctx.manifest?.version;
    if (built && source && built !== source) reasons.push(`it is version ${built} and manifest.json says ${source}`);
    if (reasons.length) {
      ctx.add(pkg.rel, 1, `${pkg.rel} is out of date: ${reasons.join(", and ")}.`, "Build and package again (npm run package) before you upload.");
    }
  }
}
