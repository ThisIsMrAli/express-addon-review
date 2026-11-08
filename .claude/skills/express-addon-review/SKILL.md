---
name: express-addon-review
description: >-
  Reviews an Adobe Express add-on against Adobe's current docs and finds the
  real UI bugs a reviewer hits: it opens the panel at 320px in light and dark,
  presses every screen and dialog, and measures what it sees (a close button at
  the bottom of a dialog, controls under other controls, cut-off text, no way
  out). Measured bugs are fixed without asking. It asks once whether to follow
  on a live dashboard or in chat, then only the big choices: test license, fix
  the rest, design, small UI polish, listing. It runs to the end without
  stopping. Use when the user mentions an Adobe Express add-on, marketplace
  review, Express branding, publishing an Express add-on, or listing screenshots.
license: MIT
compatibility: Requires Node.js 18 or newer. The panel walk and the listing screenshots need Chrome, Edge, or Chromium (set CHROME_PATH to choose one). The dashboard needs a browser on the same computer and falls back to chat when it cannot start. pdftotext extracts the brand PDF when it is installed.
---

# Add-on Preflight

Review one Adobe Express add-on directory. Change it only for what this page says to change.

The skill root is the directory that contains this file. Run the scripts from there. Reviews are written outside the skill and outside the add-on, in `~/.express-addon-review/<slug>/`. The scripts remember that folder, so `--out` is never needed.

## The one rule: do not stop

A review ends at `session.mjs done`. Until then you are in the middle of a task.

- Every command prints a `next` line. Do what it says.
- Never end your turn with a message while the review is open. A message with no command after it ends your turn, and the review stalls with the user waiting on a page that will never move.
- Between `ask` and `wait`, write nothing to the user. The question is already on the dashboard.
- Long commands (`audit.mjs`, a build) print progress lines. If your shell moves one to the background, wait for it to finish. Do not stop to report on it. Never start a second `audit.mjs` while one runs: it refuses, and the first one is still working.
- Edits take minutes and the dashboard cannot see your editor. Before each file you change for the `fix` or `polish` step, report it: `node scripts/session.mjs step --id fix --status running --doing "Editing Guide.tsx (2 of 5)" --progress 2/5`. One short command per file keeps the page moving, so the user can tell you are working and not stuck.
- If you lose your place, or the user types "continue", run `node scripts/session.mjs next`. It works out the next action from the session alone.

Do not read every reference up front. Read the one for the step you are on.

## What a review is

Adobe's sentences are not copied here. The links are the rules. Use the pages already in `references/live/`. A check whose sentence is missing from that download is skipped. Do not fetch the docs again when `references/live/summary.json` exists. Review patterns from marketplace letters always run: [references/custom-rules.md](references/custom-rules.md).

Two places a review can happen. The user picks once.

- **Dashboard.** A page in Chrome on this computer. It shows what is happening now (a progress bar, a timer, the latest activity), the findings, the 320px captures, and every decision as a button. You publish a decision with `session.mjs ask` and run `session.mjs wait` until they click. You do not also call AskQuestion for it.
- **Chat.** Nothing opens. You call AskQuestion for each decision and record the click with `session.mjs answer`.

The only questions are the big ones. Never ask once per finding, per note, or per fix. Do not ask permission to open the panel or to fix a bug the audit measured. Do not open Adobe Express.

If the user types an answer in chat while the dashboard is waiting, record it with `answer` and stop waiting.

## Workflow

0. **A rejection letter.** If the user pasted one, or says the add-on was rejected, read [references/rejection.md](references/rejection.md) first. It turns each reason into a tracked note.

1. **Find the add-on.** `manifest.json` may sit at the folder the user named or in `src/manifest.json`. Ask which add-on only when the tree has two JSON objects that are both Express add-on manifests (`manifestVersion` and an Express app requirement). A file that is only named `manifest.json` is not an add-on.

2. **Scan.**

```bash
node scripts/review.mjs --input /absolute/path/to/addon --no-refresh
```

   Point `--input` at the project root. A zip in the project root is checked as the upload. Pass `--zip path/to/upload.zip` for one stored elsewhere. It writes `report.json`, `report.md`, `questions.json`, and `session.json` to the review folder and prints that path.

3. **Ask where to follow the review.** If you run on another machine than the user's (a cloud agent, SSH, a container), skip the question, run `node scripts/session.mjs mode --set chat`, and continue in chat. Otherwise call AskQuestion with the first object in `questions.json` (`mode`). Title is `Next step`. Pass `prompt` and each option's `id` and `label` through unchanged.

   - `dashboard`: `node scripts/session.mjs mode --set dashboard`, then `node scripts/dashboard.mjs start`. It opens Chrome and prints `{ ok, url }`. Say the link once, in one line, and carry on in the same turn. If `ok` is false, say the reason in one sentence, run `session.mjs mode --set chat`, and continue in chat.
   - `chat`: `node scripts/session.mjs mode --set chat`. Give a short summary of errors, warnings, and review patterns. Name the docs `sha`.

   Commands, limits, and what the page shows: [references/dashboard.md](references/dashboard.md).

4. **Walk the panel.** One command does it:

```bash
node scripts/audit.mjs
```

   When nothing runs at the panel's address it builds the add-on and serves the build from this computer, so it never needs an Adobe sign-in. It then opens the panel at 320px in a private headless Chrome, presses every screen and dialog it can reach (never anything that deletes, buys, or leaves the panel), repeats in dark, and measures each one. It writes the results into the session, so the dashboard shows the bar move and the captures appear. Typical time is one to three minutes, plus the build the first time.

   Its output lists each **bug** with the screen and `file:line`. These are measured, not opinions: a close button at the bottom of a dialog, a control covered by another, a dialog that does not fit or has no way out, a sideways scroll, an image that did not load, a blank panel. **Fix every bug now, without asking**, then run `node scripts/audit.mjs` again. It marks a bug `fixed` only when it no longer measures it. Repeat until no bug is open. Warnings (contrast, small tap targets, cut-off text, console errors) wait for the `fix` question.

   The audit sets the `panel` step to `done` itself when no bug is open. If the code mentions a license but the walk found no field to type one in, it skips the `access` step and says so. Do not ask for a license then.

   If `needsLicense` is true, ask the `credentials` question and wait for it. On **provide**, run `node scripts/audit.mjs --licensed`. The script reads the license from the dashboard itself, so it never passes through you. Never write it into the repo, the report, or a commit. On **skip** or **none**, go on.

   If `audit.mjs` cannot run (no Chrome, a dev server that will not start), say so in one sentence and walk the panel by hand as [references/visual.md](references/visual.md) describes. Then carry on. After a walk by hand, set the `panel` step to `done` yourself.

5. **Decide.** Ask the objects in `questions.json` in this order, one at a time: `fix`, `design`, `polish`, `listing`. Skip an object that is not there. Apply each answer before the next question.

   Dashboard: `node scripts/session.mjs ask --id fix`, then `node scripts/session.mjs wait --id fix`. `wait` returns in 25 seconds. While `status` is `pending`, run it again, and keep running it. Stop when it is `answered`.

   Chat: call AskQuestion with the object, then `node scripts/session.mjs answer --id fix --value <option id>`.

   If `wait` prints `server-down`, run `dashboard.mjs start` once. If that fails, `session.mjs mode --set chat` and ask the same question with AskQuestion.

6. **Apply the answer.** What each option means is in [references/session.md](references/session.md). After the fixes, scan again with `node scripts/review.mjs --input /absolute/path/to/addon --no-refresh --rescan`, run `node scripts/audit.mjs` again, and set the step to `done`.

7. **Polish.** Only on **apply**. [references/polish.md](references/polish.md) lists the small, measurable fixes. Do those, run the audit again, and show nothing redesigned. On **review**, list each item with its screen and the exact edit, and change nothing.

8. **Listing.** Only on a yes. Text: [references/submission.md](references/submission.md). Screenshots: [references/listing-shots.md](references/listing-shots.md). Start with `prepare-listing.mjs`, and finish with `render-listing.mjs`, which refuses a page that left the locked template. Show the draft text and the finished screenshots with `listing-review` and `shots-review` before anything is written into the add-on. A painted banner is not an upload file.

9. **Close.** `node scripts/session.mjs done --summary "..."`, then `node scripts/dashboard.mjs stop`. Closing lines are in [references/session.md](references/session.md). A finished session is not marketplace approval.

If the live text and a remembered rule disagree, follow the live text. If the user changes an answer later, follow the new one.

## Read next

- [references/rejection.md](references/rejection.md) for a pasted rejection letter
- [references/dashboard.md](references/dashboard.md) for the commands, the wait contract, security, and what the page shows
- [references/session.md](references/session.md) for what each option means and when to stop
- [references/visual.md](references/visual.md) for what the audit measures and the manual walk when it cannot run
- [references/polish.md](references/polish.md) for the small polish pass
- [references/listing-shots.md](references/listing-shots.md) for upload-ready 1360×800 screenshots
- [references/submission.md](references/submission.md) for the publisher form
- [references/sources.md](references/sources.md) for the links
- [references/custom-rules.md](references/custom-rules.md) for review patterns
- [references/report.md](references/report.md) for the report shape
- [references/human-checks.md](references/human-checks.md) for what a person still has to do
- [references/spectrum.md](references/spectrum.md) for Spectrum controls and the Express theme
