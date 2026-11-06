import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { htmlToText } from "./lib/docs.mjs";
import { liveDir } from "./lib/paths.mjs";
import { BRANCH, BRAND_PDF, BRAND_TEXT, EXTRA_PAGES, REPO, TREE_FILES, TREE_PREFIXES, rawUrl } from "./lib/sources.mjs";

export async function refreshDocs(target = liveDir) {
  fs.mkdirSync(target, { recursive: true });
  const pages = [];
  let sha = "";
  try {
    const commit = await getJson(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`);
    sha = commit.sha || "";
    const tree = await getJson(`https://api.github.com/repos/${REPO}/git/trees/${sha || BRANCH}?recursive=1`);
    const wanted = (tree.tree || [])
      .filter((entry) => entry.type === "blob")
      .map((entry) => entry.path)
      .filter(wantedPath);
    for (const repoPath of wanted) {
      pages.push(await saveRepoFile(target, repoPath));
    }
  } catch (error) {
    pages.push({ id: "git-tree", url: `https://github.com/${REPO}`, ok: false, error: error.message });
  }
  for (const page of EXTRA_PAGES) {
    pages.push(await saveHtml(target, page.key, page.url));
  }
  const summary = {
    fetchedAt: new Date().toISOString(),
    repo: REPO,
    branch: BRANCH,
    sha,
    pages
  };
  fs.writeFileSync(path.join(target, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

function wantedPath(repoPath) {
  if (TREE_FILES.includes(repoPath)) return true;
  if (!repoPath.endsWith(".md")) return false;
  return TREE_PREFIXES.some((prefix) => repoPath.startsWith(prefix));
}

async function saveRepoFile(target, repoPath) {
  const url = rawUrl(repoPath);
  try {
    const response = await fetch(url, { headers: { "user-agent": "express-addon-review" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (repoPath === BRAND_PDF) {
      const text = pdfToText(bytes);
      if (!text) throw new Error("The brand PDF downloaded, but its text was not extracted. Install pdftotext.");
      fs.mkdirSync(path.dirname(path.join(target, BRAND_TEXT)), { recursive: true });
      fs.writeFileSync(path.join(target, BRAND_TEXT), text);
      return { id: BRAND_TEXT, url, ok: true };
    }
    const dest = path.join(target, repoPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, bytes);
    return { id: repoPath, url, ok: true };
  } catch (error) {
    return { id: repoPath, url, ok: false, error: error.message };
  }
}

async function saveHtml(target, key, url) {
  try {
    const response = await fetch(url, { headers: { accept: "text/html", "user-agent": "express-addon-review" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const dest = path.join(target, key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, htmlToText(await response.text()));
    return { id: key, url, ok: true };
  } catch (error) {
    return { id: key, url, ok: false, error: error.message };
  }
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/vnd.github+json", "user-agent": "express-addon-review" }
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

function pdfToText(bytes) {
  const result = spawnSync("pdftotext", ["-", "-"], { input: bytes, encoding: "buffer", maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0 || !result.stdout) return "";
  return result.stdout.toString("utf8");
}

const ranDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (ranDirectly) {
  const summary = await refreshDocs();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.pages.some((page) => page.ok)) process.exitCode = 1;
}
