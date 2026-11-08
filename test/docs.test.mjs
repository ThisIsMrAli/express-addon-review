import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planAll, lateAsks } from "../.claude/skills/express-addon-review/scripts/lib/ask.mjs";
import { ADOBE_RULES } from "../.claude/skills/express-addon-review/scripts/lib/adobe.mjs";
import { CUSTOM_RULES } from "../.claude/skills/express-addon-review/scripts/lib/custom.mjs";
import { TOOL_RULES } from "../.claude/skills/express-addon-review/scripts/lib/tool.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = path.join(root, ".claude/skills/express-addon-review");
const docs = [
  path.join(skill, "SKILL.md"),
  ...fs.readdirSync(path.join(skill, "references")).filter((name) => name.endsWith(".md")).map((name) => path.join(skill, "references", name)),
  path.join(root, "README.md"),
  path.join(root, "AGENT.md")
];
const read = (file) => fs.readFileSync(file, "utf8");
const rel = (file) => path.relative(root, file);

test("SKILL.md has a name that matches its folder and a description that fits", () => {
  const front = read(path.join(skill, "SKILL.md")).match(/^---\n([\s\S]*?)\n---/)[1];
  assert.match(front, /^name: express-addon-review$/m);
  const description = front.match(/description: >-\n([\s\S]*?)\nlicense:/)[1].replace(/\s+/g, " ").trim();
  assert.ok(description.length <= 1024, `description is ${description.length} characters`);
  assert.match(description, /dashboard/);
});

test("every script the docs mention exists", () => {
  for (const file of docs) {
    for (const match of read(file).matchAll(/scripts\/([\w./-]+\.(?:mjs|py))/g)) {
      const name = match[1];
      const repoScript = path.basename(file) === "README.md" && fs.existsSync(path.join(root, "scripts", name));
      assert.ok(repoScript || fs.existsSync(path.join(skill, "scripts", name)), `${rel(file)} mentions scripts/${name}, which does not exist`);
    }
  }
});

test("every markdown link in the docs resolves", () => {
  for (const file of docs) {
    for (const match of read(file).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      const target = match[1];
      if (/^(https?:|mailto:)/.test(target)) continue;
      assert.ok(fs.existsSync(path.resolve(path.dirname(file), target)), `${rel(file)} links to ${target}, which does not exist`);
    }
  }
});

test("no doc still describes the removed static dashboard", () => {
  for (const file of docs) {
    const text = read(file);
    assert.equal(/update-dashboard|dashboard\.html|status\.json/.test(text), false, `${rel(file)} describes the old flow`);
    assert.equal(/review-output\/</.test(text), false, `${rel(file)} writes into review-output`);
  }
});

test("every session.mjs command the docs use is one the CLI handles", () => {
  const cli = read(path.join(skill, "scripts/session.mjs"));
  const known = new Set([...cli.matchAll(/case "(\w+)"/g)].map((match) => match[1]));
  for (const file of docs) {
    for (const match of read(file).matchAll(/session\.mjs\s+(\w+)/g)) {
      assert.ok(known.has(match[1]), `${rel(file)} runs session.mjs ${match[1]}, which the CLI does not handle`);
    }
  }
});

test("every question id the docs name is a real question", () => {
  const known = new Set([...planAll({ findings: [{ id: "a", severity: "error", file: "x", line: 1, source: { kind: "adobe" } }, { id: "b", severity: "warn", file: "x", line: 1, source: { kind: "adobe" } }], access: { needsCredential: true }, views: [{ kind: "document" }] }).map((question) => question.id), ...Object.keys(lateAsks)]);
  const session = read(path.join(skill, "references/session.md"));
  for (const match of session.matchAll(/^- `(\w[\w-]*)` /gm)) {
    assert.ok(known.has(match[1]), `session.md describes a question named ${match[1]}, which does not exist`);
  }
  for (const id of ["mode", "credentials", "fix", "design", "polish", "listing", "shots-review", "listing-review"]) {
    assert.ok(known.has(id), `${id} is documented but not defined`);
    assert.match(session, new RegExp(`\`${id}\``), `${id} is defined but session.md does not explain it`);
  }
});

test("the dashboard doc names every step the session has", async () => {
  const { STEPS } = await import("../.claude/skills/express-addon-review/scripts/lib/session.mjs");
  const text = read(path.join(skill, "references/dashboard.md"));
  for (const step of STEPS) assert.match(text, new RegExp(`\`${step.id}\``), `dashboard.md does not name the ${step.id} step`);
});

test("every rule id the rejection guide names is a rule or a question that exists", () => {
  const known = new Set([...ADOBE_RULES, ...CUSTOM_RULES, ...TOOL_RULES].map((rule) => rule.id));
  for (const id of ["credentials", "fix", "design", "listing", "mode"]) known.add(id);
  const text = read(path.join(skill, "references/rejection.md"));
  const named = [...text.matchAll(/`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g)].map((match) => match[1]);
  assert.ok(named.length > 15, "the guide should map reasons to rule ids");
  for (const id of named) assert.ok(known.has(id), `rejection.md names \`${id}\`, which is not a rule`);
});

test("every rule id the package docs name is a real rule", () => {
  const known = new Set([...ADOBE_RULES, ...CUSTOM_RULES, ...TOOL_RULES].map((rule) => rule.id));
  const text = read(path.join(skill, "references/report.md"));
  for (const match of text.matchAll(/`(package-[a-z]+)`/g)) assert.ok(known.has(match[1]), `report.md names \`${match[1]}\``);
  for (const id of ["package-root", "package-size", "package-hidden", "package-entry", "package-stale"]) assert.ok(text.includes(`\`${id}\``), `report.md should describe ${id}`);
});

test("package.json, skill.json, and the changelog name the same version", () => {
  const version = JSON.parse(read(path.join(root, "package.json"))).version;
  const manifest = JSON.parse(read(path.join(root, "skill.json")));
  assert.equal(manifest.version, version);
  assert.equal(manifest.skillPath, ".claude/skills/express-addon-review");
  assert.ok(fs.existsSync(path.join(root, manifest.skillPath, "SKILL.md")), "skillPath must hold SKILL.md");
  assert.match(read(path.join(root, "CHANGELOG.md")), new RegExp(`^## ${version.replace(/\./g, "\\.")}$`, "m"));
  assert.match(read(path.join(root, "LICENSE")), /^MIT License/);
});

test("SKILL.md puts the never-stop rule before the workflow and names the audit", () => {
  const text = read(path.join(skill, "SKILL.md"));
  assert.ok(text.indexOf("do not stop") > 0 && text.indexOf("do not stop") < text.indexOf("## Workflow"), "the rule comes first");
  assert.match(text, /scripts\/audit\.mjs|node scripts\/audit\.mjs/);
  assert.match(text, /session\.mjs next/);
  assert.equal(/Say in chat once/i.test(text), false, "a chat message between ask and wait is what stalled reviews");
});

test("visual.md names every rule the probe can report, and polish.md exists in the question list", () => {
  const probe = read(path.join(skill, "assets/audit/probe.js"));
  const kinds = [...new Set([...probe.matchAll(/kind: "([a-z-]+)"/g)].map((match) => match[1]))];
  assert.ok(kinds.length >= 10, "the probe reports at least ten kinds of problem");
  const visual = read(path.join(skill, "references/visual.md"));
  for (const kind of kinds) assert.match(visual, new RegExp(`\`${kind}\``), `visual.md does not explain ${kind}`);
  for (const kind of ["script-error", "request-failed"]) assert.match(visual, new RegExp(`\`${kind}\``));
});
