import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDashboardServer } from "../.claude/skills/express-addon-review/scripts/lib/server.mjs";
import { planAll } from "../.claude/skills/express-addon-review/scripts/lib/ask.mjs";
import { publishAsk, setMode, startSession } from "../.claude/skills/express-addon-review/scripts/lib/session.mjs";

const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.claude/skills/express-addon-review/assets/dashboard");

const report = {
  addon: "Demo", addonPath: "/tmp/demo", docsSha: "abc", fetchedAt: "", skipped: [],
  access: { needsCredential: true, file: "lic.ts" },
  findings: [{ id: "x", severity: "error", file: "a.tsx", line: 1, message: "m", suggestion: "s", source: { kind: "adobe", url: "https://x" } }]
};

async function boot() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "express-server-"));
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report));
  fs.writeFileSync(path.join(out, "report.md"), "# Report\n");
  fs.writeFileSync(path.join(out, "questions.json"), JSON.stringify(planAll(report)));
  startSession(out, report);
  setMode(out, "dashboard");
  const dash = createDashboardServer({ out, assets });
  const info = await dash.listen(0);
  const base = `http://127.0.0.1:${info.port}`;
  const get = (p, headers = {}) => fetch(`${base}${p}`, { headers });
  const post = (body, headers = {}) => fetch(`${base}/api/answer?t=${info.token}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, ...headers },
    body: JSON.stringify(body)
  });
  return { out, dash, info, base, get, post, t: `?t=${info.token}` };
}

function raw(port, requestPath, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: requestPath, headers }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
    req.end();
  });
}

test("no token, wrong token, and a foreign Host are all refused", async () => {
  const s = await boot();
  try {
    assert.equal((await s.get("/api/state")).status, 401);
    assert.equal((await s.get("/api/state?t=wrong")).status, 401);
    assert.equal((await s.get(`/api/state${s.t}`)).status, 200);
    assert.equal(await raw(s.info.port, `/api/state${s.t}`, { host: `evil.example:${s.info.port}` }), 421);
    assert.equal((await s.get("/")).status, 401);
    assert.equal((await s.get(`/${s.t}`)).status, 200);
    assert.equal((await s.get(`/api/state`, { authorization: `Bearer ${s.info.token}` })).status, 200);
  } finally {
    await s.dash.close();
  }
});

test("a cross-site or origin-less POST cannot answer for the user", async () => {
  const s = await boot();
  try {
    publishAsk(s.out, planAll(report).find((item) => item.id === "fix") || { id: "fix", prompt: "?", options: [{ id: "all", label: "All" }, { id: "skip", label: "Skip" }] });
    assert.equal((await s.post({ id: "fix", value: "all" }, { origin: "https://evil.example" })).status, 403);
    const noOrigin = await fetch(`${s.base}/api/answer${s.t}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "fix", value: "all" }) });
    assert.equal(noOrigin.status, 403);
    const notJson = await fetch(`${s.base}/api/answer${s.t}`, { method: "POST", headers: { "content-type": "text/plain", origin: s.base }, body: "{}" });
    assert.equal(notJson.status, 415);
    assert.equal((await s.post({ id: "fix", value: "banana" })).status, 400);
    assert.equal((await s.post({ id: "nothing", value: "all" })).status, 409);
  } finally {
    await s.dash.close();
  }
});

test("a click wakes a waiting agent, and a second answer is refused", async () => {
  const s = await boot();
  try {
    publishAsk(s.out, { id: "fix", title: "Fix", prompt: "?", options: [{ id: "all", label: "Fix all (Recommended)" }, { id: "skip", label: "Skip" }] });
    const waiting = s.get(`/api/wait${s.t}&id=fix&timeout=10`).then((res) => res.json());
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal((await s.post({ id: "fix", value: "all" })).status, 200);
    const result = await waiting;
    assert.equal(result.status, "answered");
    assert.equal(result.value, "all");
    assert.equal(result.via, "dashboard");
    assert.equal((await s.post({ id: "fix", value: "skip" })).status, 409, "an answered question cannot be answered again");
    const quiet = await (await s.get(`/api/wait${s.t}&id=ghost&timeout=1`)).json();
    assert.equal(quiet.status, "missing");
  } finally {
    await s.dash.close();
  }
});

test("an unanswered question waits, then reports pending when the time is up", async () => {
  const s = await boot();
  try {
    publishAsk(s.out, { id: "design", prompt: "?", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] });
    const result = await (await s.get(`/api/wait${s.t}&id=design&timeout=1`)).json();
    assert.equal(result.status, "pending");
  } finally {
    await s.dash.close();
  }
});

test("a typed secret stays in the server's memory, reaches only a caller with the token and no Origin, and never touches disk", async () => {
  const s = await boot();
  try {
    publishAsk(s.out, planAll(report).find((item) => item.id === "credentials"));
    assert.equal((await s.post({ id: "credentials", value: "provide" })).status, 400, "the secret is required for that choice");
    assert.equal((await s.post({ id: "credentials", value: "provide", secret: "TOP-SECRET-KEY" })).status, 200);

    const waited = await (await s.get(`/api/wait${s.t}&id=credentials&timeout=2`)).json();
    assert.equal(waited.status, "answered");
    assert.equal(waited.secretHeld, true);
    assert.equal(JSON.stringify(waited).includes("TOP-SECRET-KEY"), false, "wait never carries the secret");

    const auth = { authorization: `Bearer ${s.info.token}` };
    for (let i = 0; i < 2; i += 1) {
      const got = await (await s.get("/api/secret?id=credentials", auth)).json();
      assert.equal(got.secret, "TOP-SECRET-KEY", "the audit can fetch it again if a call was lost");
    }
    assert.equal((await s.get(`/api/secret${s.t}&id=credentials`)).status, 403, "a token in the URL is not enough");
    assert.equal((await s.get("/api/secret?id=credentials", { ...auth, origin: s.base })).status, 403, "a web page cannot ask for it");
    assert.equal((await s.get("/api/secret?id=nothing", auth)).status, 404);

    for (const name of fs.readdirSync(s.out)) {
      const full = path.join(s.out, name);
      if (fs.statSync(full).isFile()) assert.equal(fs.readFileSync(full, "utf8").includes("TOP-SECRET-KEY"), false, `${name} must not hold the secret`);
    }
    const state = await (await s.get(`/api/state${s.t}`)).json();
    assert.equal(JSON.stringify(state).includes("TOP-SECRET-KEY"), false);
  } finally {
    await s.dash.close();
  }
});

test("the state says whether the agent is listening: an open wait is proof", async () => {
  const s = await boot();
  try {
    publishAsk(s.out, { id: "design", prompt: "?", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] });
    const quiet = await (await s.get(`/api/state${s.t}`)).json();
    assert.equal(quiet.agent.waiting, 0);
    assert.equal(quiet.agent.lastPollAt, "");
    assert.ok(quiet.agent.seenAt, "the session was written by the agent's commands");

    const pending = s.get(`/api/wait${s.t}&id=design&timeout=2`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const listening = await (await s.get(`/api/state${s.t}`)).json();
    assert.equal(listening.agent.waiting, 1);
    assert.ok(listening.agent.lastPollAt);
    await pending;
  } finally {
    await s.dash.close();
  }
});

test("the theme script and the dashboard assets are served, and nothing else under the root", async () => {
  const s = await boot();
  try {
    for (const name of ["app.js", "app.css", "theme.js"]) assert.equal((await s.get(`/${name}${s.t}`)).status, 200, name);
    assert.equal((await s.get(`/probe.js${s.t}`)).status, 404);
  } finally {
    await s.dash.close();
  }
});

test("only report.md and shots are served, and nothing outside the folder", async () => {
  const s = await boot();
  try {
    fs.mkdirSync(path.join(s.out, "shots"));
    fs.writeFileSync(path.join(s.out, "shots", "a.png"), "png");
    fs.writeFileSync(path.join(s.out, "server.json"), "{}");
    assert.equal((await s.get(`/files/report.md${s.t}`)).status, 200);
    assert.equal((await s.get(`/files/shots/a.png${s.t}`)).headers.get("content-type"), "image/png");
    for (const bad of ["server.json", "answers.jsonl", "session.json", "shots/../server.json", "shots/a.svg", "..%2fserver.json", "%2e%2e/server.json"]) {
      const status = await raw(s.info.port, `/files/${bad}${s.t}`, { host: `127.0.0.1:${s.info.port}` });
      assert.ok([400, 404].includes(status), `${bad} gave ${status}`);
    }
  } finally {
    await s.dash.close();
  }
});

test("pages carry a strict content security policy and never cache", async () => {
  const s = await boot();
  try {
    const res = await s.get(`/${s.t}`);
    const csp = res.headers.get("content-security-policy");
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /script-src 'self'/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const html = await res.text();
    assert.match(html, new RegExp(`app\\.js\\?t=${s.info.token}`));
    assert.equal(html.includes("%%TOKEN%%"), false);
  } finally {
    await s.dash.close();
  }
});

test("the page script builds findings with textContent, never innerHTML", () => {
  const source = fs.readFileSync(path.join(assets, "app.js"), "utf8").replace(/\/\/.*$/gm, "");
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(source), false);
});

test("the page never calls replaceChildren directly, because a null argument would print the word null", () => {
  const source = fs.readFileSync(path.join(assets, "app.js"), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const calls = source.match(/replaceChildren\(/g) || [];
  assert.equal(calls.length, 1, "only the fill helper may call it");
});
