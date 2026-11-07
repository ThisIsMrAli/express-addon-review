# Build brief

The skill that agents follow is [`.claude/skills/express-addon-review/SKILL.md`](.claude/skills/express-addon-review/SKILL.md).

Adobe rules are links. `scripts/lib/sources.mjs` lists them, and `scripts/refresh-docs.mjs` downloads the current docs. Review patterns live in `references/custom-rules.md` because they are not Adobe sentences.

One shot means refresh, scan, write the report, and open every view the report lists. A guaranteed marketplace approval is not possible. The report says which checks ran and which still need a person.

## Session and dashboard

A review has one folder, `~/.express-addon-review/<slug>/`, remembered in `current.json`. Two writers keep its state safe: the agent's CLI writes `session.json`, and the dashboard server writes `answers.jsonl`. They are joined by a per-question nonce. Do not make one process write both.

The dashboard is optional. Every flow must work in chat, and `dashboard.mjs start` must fail soft (`ok: false`) so the agent can continue there. A typed secret lives in server memory for the review and is never written to disk and never returned by `wait`. `audit.mjs --licensed` reads it from `GET /api/secret` with the token. The page script uses `textContent`, never `innerHTML`, and `test/server.test.mjs` checks both.

`wait` must stay a short, repeatable call (25 seconds by default, 110 at most) so no agent's shell timeout is hit.

## The agent must not stop

A turn that ends with text while the dashboard is waiting stops the whole review, because nothing wakes the agent again. So every `session.mjs` and `audit.mjs` output carries a `next` line, `session.mjs next` computes the next action from the state, and each write stamps `agentSeenAt` so the dashboard can say when the agent has gone quiet. Keep all three when you change a command. `references/session.md` has the loop.

## The panel audit

`scripts/audit.mjs` drives headless Chrome through its own small CDP client (`lib/cdp.mjs`, `lib/ws.mjs`, no dependencies) and the page probe in `assets/audit/probe.js`. A rule belongs in the probe only if it is a measured fact about layout, and its `error` severity is for bugs a person would never defend (a close button at the bottom of a dialog, a control covered by another). Anything that is taste is a `polish` item, and polish only happens when the person approves it. `test/audit.test.mjs` runs the whole thing against `test/fixtures/audit/`.
