#!/usr/bin/env node
/**
 * Builds the GitHub Pages output.
 *
 * The root is an empty "Not found" page. The project page and the install zip
 * are written only under PAGES_SHARE_TOKEN, and only while PAGES_SHARE_EXPIRES
 * is empty or still in the future. The token is never printed.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "site-dist");
const token = String(process.env.PAGES_SHARE_TOKEN || "").trim();
const expires = String(process.env.PAGES_SHARE_EXPIRES || "").trim();

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const blank = fs.readFileSync(path.join(root, "site", "blank.html"));
fs.writeFileSync(path.join(dist, "index.html"), blank);
fs.writeFileSync(path.join(dist, "404.html"), blank);
fs.writeFileSync(path.join(dist, "robots.txt"), "User-agent: *\nDisallow: /\n");
fs.writeFileSync(path.join(dist, ".nojekyll"), "");

if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
  process.stdout.write("No share token set. Published the empty page only.\n");
  process.exit(0);
}
const expiry = Number(expires);
if (expires && (!Number.isFinite(expiry) || expiry < Date.now() / 1000)) {
  process.stdout.write("The share link has expired. Published the empty page only.\n");
  process.exit(0);
}

const page = path.resolve(dist, token);
if (page !== path.join(dist, token)) {
  process.stderr.write("The share token is not a single folder name.\n");
  process.exit(1);
}
fs.mkdirSync(page, { recursive: true });
fs.copyFileSync(path.join(root, "site", "page.html"), path.join(page, "index.html"));
fs.copyFileSync(path.join(root, "site", "site.css"), path.join(page, "site.css"));

const zip = path.join(page, "express-addon-review.zip");
const archived = spawnSync("git", ["archive", "--format=zip", `--output=${zip}`, "HEAD"], { cwd: root, stdio: "inherit" });
if (archived.status !== 0) process.exit(archived.status || 1);
process.stdout.write("Published the preview under the share path.\n");
