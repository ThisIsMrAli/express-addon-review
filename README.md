# Express add-on review

An agent skill that checks an Adobe Express add-on folder against the current marketplace rules. Each miss includes an edit. Adobe's sentences stay on Adobe's pages: the refresh command downloads the docs repository, and a check is skipped when that download no longer contains the sentence.

It does not replace the marketplace review, and it does not open Adobe Express. The scanner reads the source, then the skill opens the panel at 320px and walks the screens. `index.html` keywords are not the listing.

Invoke it in Cursor with `/express-addon-review`.

## How a review goes

1. The agent scans the code and writes the report.
2. It asks once where to follow along: a **live dashboard in Chrome**, or **chat**.
3. It opens the panel in headless Chrome at 320px, light and dark, and clicks through it (`audit.mjs`). Real layout bugs, such as a dialog whose close button sits at the bottom, are fixed at once and checked again.
4. It asks only the big choices: a test license when a screen is locked, **fix everything found**, an optional polish pass, design, and the marketplace listing. Never one question per finding.
5. Screenshots and listing text are shown for approval before anything is written into the add-on.

The agent keeps going until the review is done. If you answer in the dashboard, it picks the answer up and continues. It does not wait for you to type in chat.

If the add-on was already rejected, paste the letter. Each reason becomes a tracked note, is mapped to a check, and is verified on its own, and the skill ends with the notes to paste into the resubmission ([`references/rejection.md`](.claude/skills/express-addon-review/references/rejection.md)).

## What it checks

- **The code.** More than forty checks. Most are tied to a sentence in Adobe's current docs, and a few are review patterns taken from real marketplace letters. Comments are ignored, markup is read tag by tag, and a project-wide rule (Cancel, logout, validation) looks at the whole project, so a finding is a real one.
- **The upload.** A zip in the project root is read in memory: manifest at its root, 50 MB, no hidden files, the files the manifest names, and not older than the source.
- **The running panel.** At 320px in light and dark, with real clicks, on a throttled and offline network, and by keyboard. It finds a dialog whose close button is out of place or that has no way out, a control covered by another, clipped or overflowing text, broken images, small tap targets, low contrast, controls a keyboard cannot reach, and script or network errors. Each comes with a screenshot and a guess at the source line. It never presses Delete, Reset, Buy, or Sign out.
- **The listing.** Screenshots from one locked template, 1360×800, using only words that are already in the add-on, rendered by `render-listing.mjs`.
- **What a person must do.** Browsers, the publisher site, and test credentials for the reviewer are listed, not guessed.

With the dashboard, the page shows what is happening now with a live timer and a progress bar, whether the agent is working, waiting for you, or quiet, the findings with their Adobe source, the 320px captures, and the decisions as buttons. The agent waits for the click and carries on. With chat, the same decisions use the agent's own question box. If the dashboard cannot start, or the agent is not on your computer, the review continues in chat.

The dashboard is for the person running the review. Adobe's reviewers never see it. See [`references/dashboard.md`](.claude/skills/express-addon-review/references/dashboard.md) for the commands, the security model, and what works in which agent.

Reviews are written to `~/.express-addon-review/<slug>/`, not into the add-on and not into this repo.

## Install

Node.js 18 or newer. `pdftotext` is used for the brand PDF when it is installed. The panel audit and the listing screenshots need Chrome, Edge, or Chromium on the same computer (set `CHROME_PATH` to choose one). Without one, the audit says so and the review continues by hand. They work on macOS, Windows, and Linux.

```bash
npx skills add <owner>/express-addon-review --skill express-addon-review -a cursor
```

This clone links the skill into Cursor, Claude, Codex, and the other agent folders:

```bash
node install-agents.mjs
node install-agents.mjs --global
```

## Use it

Agents follow [`.claude/skills/express-addon-review/SKILL.md`](.claude/skills/express-addon-review/SKILL.md). To try the pieces by hand:

```bash
npm run refresh                                   # download the current Adobe docs once
npm run scan -- --input /path/to/addon            # print the findings as JSON
npm run review -- --input /path/to/addon          # write the report and start a session
npm run dashboard -- start                        # open the live dashboard in Chrome
node .claude/skills/express-addon-review/scripts/audit.mjs   # walk the running panel at 320px
npm run session -- show                           # steps, pending questions, answers
npm run dashboard -- stop
npm run render-listing                            # fit the prepared listing pages to 1360×800
npm test
```

The report has Adobe findings with a URL, review patterns from marketplace letters, checks that were skipped because the fresh page changed, and the list a person still has to do.

## License

MIT
