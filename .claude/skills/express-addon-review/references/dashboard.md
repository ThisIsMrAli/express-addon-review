# Dashboard

The dashboard is a page on `127.0.0.1` that follows the review live and takes the user's decisions as clicks. It is a convenience for the person running the review. Adobe's reviewers never see it, and it changes nothing about the marketplace outcome.

Offer it only when you run on the user's own computer. If you run in a cloud agent, over SSH, or in a container, the user's browser cannot reach `127.0.0.1`. Do not offer it. Run `session.mjs mode --set chat` and review in chat.

## Commands

All of these print JSON. `--out` is optional. The review folder `review.mjs` last wrote is used.

```text
dashboard.mjs start [--no-open]   start the server, open Chrome, print { ok, url }
dashboard.mjs status              { running, url }
dashboard.mjs stop

session.mjs mode    --set dashboard|chat
session.mjs step    --id panel --status running|waiting|done|skipped [--detail "..."] [--doing "Opening Export"] [--progress 3/12]
session.mjs note    --text "..." [--id r1] [--screen Export] [--shot file.png]
session.mjs note    --id n1 --status open|fixed|skipped
session.mjs shot    --file capture.png --label "Home, light"
session.mjs listing --json listing.json
session.mjs ask     --id fix [--image preview.png ...]
session.mjs ask     --id x --prompt "..." --option "id:Label:What happens" ...
session.mjs wait    --id fix [--timeout 25]
session.mjs answer  --id fix --value all
session.mjs done    [--summary "..."]
session.mjs next
session.mjs show

audit.mjs [--licensed]            walk the panel, write the results into the session
```

`step` ids are `scan`, `panel`, `access`, `fix`, `design`, `polish`, `listing`, `done`. `--doing` is the one line the page shows in large type for what is happening this second. `--progress 3/12` or `--progress 40%` fills the bar. A step with no progress shows a moving bar instead of a percentage, so a long step never looks frozen. `ask` ids come from `questions.json`, plus `shots-review` and `listing-review`. A custom question needs `--prompt` and at least two `--option` values.

## The wait contract

`ask` publishes a decision. The page shows it as a sheet titled "Your turn", with what each option will do. `wait` blocks for up to `--timeout` seconds (default 25, at most 110) and prints one of:

- `{"status":"answered","value":"all","label":"…","via":"dashboard"}`. Act on `value`.
- `{"status":"pending"}`. Not yet. Run the same `wait` again, immediately. Nothing is lost between calls.
- `{"status":"server-down"}`. The page is gone. Run `dashboard.mjs start` once. If that fails, `mode --set chat`, call AskQuestion with the same question, and record it with `answer`.
- `{"status":"missing"}`. You waited on an id you never published.

**Do not write to the user between `ask` and `wait`, and do not end your turn while `status` is `pending`.** A reply with no command after it ends your turn. The review then stops while the user stares at a page that is waiting on an agent that has gone quiet. This is the most common way a dashboard review fails. Every command's `next` line says what to run now, and `session.mjs next` works it out from the session if you lose your place.

Keep each call short. Do not loop inside one shell command. One `wait` per call keeps every agent's command timeout out of the way and lets the user type in chat at any time. After the user answers in chat, record it with `answer` so the dashboard shows it too.

A choice with a secret field (`credentials` → `provide`) is kept in the dashboard server's memory for the length of the review and is never written to disk. `wait` does not return it. `audit.mjs --licensed` reads it itself from the server, so the license never passes through your output. If a manual walk needs it, `session.mjs secret --id credentials` prints it. Use it in the panel only.

## What the page shows

- **Now.** One card for what is happening this second: the step, the action in large type, a ticking timer, a progress bar (a filled one when the step reports `3/12`, a moving one when it does not), the last few things that happened with how long ago, and whether the agent is active.
- **Agent heartbeat.** Every command you run proves you are alive. While a question waits, an open `wait` proves you are listening. If neither has happened for a while, the page says so in a banner and offers "Copy continue", so the user knows what to type in your chat rather than wait. That banner is the page admitting your chat may have stopped. Your job is to never cause it.
- A rail of the steps with times and the step's own progress bar.
- Four numbers: code errors, warnings, panel bugs still open, steps done.
- "Your turn" with the question, the options, and what each one touches. Screenshot approvals show the images inside the sheet. After the click it shows "Sent", then "The agent has it".
- Tabs: Findings (with a source link for each), Panel bugs (each with its screen, theme, `file:line`, and an outlined capture the user can enlarge), Listing, Activity. The page follows the work and switches tab by itself until the user picks one.
- The 320px captures as they arrive, in a device frame, filterable by light and dark.
- The tab title and icon change with the state: your turn, working with the count, done.
- Light, dark, or the system theme.

The server checks the state files twice a second and pushes any change to the page. The user never reloads.

## What the page shows

- A rail of the seven steps with times, so the user sees what is running now.
- The current step in plain words, and a progress bar of findings fixed since the first scan.
- "Your turn" with the question, the options, and what each one touches. Screenshot approvals show the images inside the sheet.
- Tabs: Findings (with a source link for each), Panel notes, Listing, Activity.
- The 320px captures you recorded with `shot` and `note --shot`, as a strip beside the current step.
- A link to `report.md` and the docs revision the checks came from.

The server checks the state files twice a second and pushes any change to the page. The user never reloads.

## Security

The server is a local tool, not a website. It is written to be unattractive to anything else on the machine or in the browser.

- Binds to `127.0.0.1` only, on a random port.
- A random token in the link. Every request needs it, as `?t=` or as a bearer header. Without it: 401.
- The `Host` header must be the loopback address and port. Otherwise 421. That stops DNS rebinding.
- A POST must come from the page itself: `Origin` must match, the body must be JSON (415 otherwise), and it is at most 64 KB. A foreign site cannot answer for the user: 403.
- An answer must match an option that was published, and a question can be answered once: 400 and 409.
- Files are served only from the review folder, and only `report.md` and images in `shots/`. Anything else is 404, and traversal is refused. Listing previews are copied into `shots/` when you pass them to `ask --image`.
- A strict Content-Security-Policy with no inline script. The page script builds every finding with `textContent`, so a string in the add-on's code cannot become markup.
- The token file `server.json` is mode `0600`.
- The server stops itself after 45 minutes with no request. `done` followed by `dashboard.mjs stop` stops it sooner.

Two writers keep state safe. Only the agent's CLI writes `session.json`. Only the server writes `answers.jsonl`. They are joined by a per-question nonce when the page or `wait` reads them, so a stale click can never answer a newer question.

## Where it runs

It needs a shell on the user's own machine, and a browser there. The page opens in Chrome first and in the default browser if Chrome is missing.

| Agent | Works | Note |
| --- | --- | --- |
| Claude Code | Yes | The shell tool times out at 2 minutes by default. The wait is capped at 110 seconds and defaults to 25. |
| Cursor | Yes | A command still running after about 30 seconds moves to the background. The default 25-second wait stays under it. `audit.mjs` runs longer and may move to the background. Wait for it. It prints a line every few seconds. |
| Codex CLI | Yes | A long command may hand control back before it ends. Run the same `wait` again. |
| Gemini CLI | Yes | The shell tool allows a long idle time. The default wait is far below it. |
| Cloud or remote agent | Chat only | The user's browser cannot reach the agent's `127.0.0.1`. |

Do not rely on this table over what you observe. If a command is cut off, the contract still holds: run `wait` again, or `session.mjs next`.

## Things it will not do

- It does not review for you. Findings come from the scanner and your panel walk.
- It does not submit anything to Adobe, and it does not open Adobe Express.
- It never writes a typed secret to disk. The answers file records only which option was chosen, and whether a secret came with it.
