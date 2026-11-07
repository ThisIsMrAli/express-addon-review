# Session

The order is fixed: scan, ask where to follow (`mode`), walk the panel and fix what it measured, decide, apply, polish, listing, close. A review is not over until `session.mjs done`. If you lose your place, `session.mjs next` says what is next. The commands are in [SKILL.md](../SKILL.md) and [dashboard.md](dashboard.md). This page says what each choice means.

`questions.json` is the big-choice list only: `mode`, then `credentials` when needed, `fix`, `design`, `polish`, `listing`. `fix` is built again when you ask it, so it counts the panel warnings the walk found since the scan. Two more are asked later, by name, only after the thing exists: `shots-review` and `listing-review`. Pass `prompt` and each option's `id` and `label` to AskQuestion unchanged. `title` is `Next step`. The first option is the suggestion and already ends with `(Recommended)`. The `detail`, `affects`, and `secret` fields are for the dashboard. Do not send them to AskQuestion.

Steps, with their ids for `session.mjs step`: `scan`, `panel`, `access`, `fix`, `design`, `polish`, `listing`, `done`. Publishing a question sets its step to `waiting`. A recorded answer sets it back to `running`. You set `done` or `skipped` when the work is finished. Never leave a step `running` when you move on.

Do not run `refresh-docs.mjs` when `references/live/summary.json` exists. Say the `sha` and the date. Refresh only when the file is missing, or when the user asks.

`index.html` keywords, the meta description, and the document title are code. Do not copy them into the listing.

## What each choice means

- `mode` **Live dashboard** or **Stay in chat.** Decides where every later question appears. If the dashboard cannot start, say why in one sentence and continue in chat.
- `credentials` **I will type the test license or login.** Use the secret only to open the paid screens. Do not save it. **Skip the paid screens.** Do not open them, and say so in the summary. **There is no license.** Continue without one.
- `fix` **Fix everything found.** Apply every product finding and every panel warning already recorded. Scan again with `--rescan` and run `audit.mjs` again. Then the next question. Bugs the walk measured as errors were fixed before this question and are not part of it. **Fix code errors only.** Apply code errors only. Leave warnings, review patterns, and panel warnings open. **Skip fixes and continue.** Change nothing. **Stop.** End the review and close it.
- `polish` **Apply the polish.** Follow [polish.md](polish.md): small, measured edits, one at a time, each confirmed by `audit.mjs`. Nothing is redesigned. **List what I would change.** Print each item with its screen and the exact edit, and change nothing. **Skip polish.** Do nothing.
- `design` **Move**, **Review**, or **Add.** Follow [spectrum.md](spectrum.md). Do not restyle before this choice. **Leave the UI as it is.** Do not restyle.
- `listing` **Write the listing text and the screenshots.** [submission.md](submission.md), then [listing-shots.md](listing-shots.md). **Screenshots only** or **Listing text only.** Do that part. **Not now.** Create nothing.
- `listing-review` **Keep this text.** Save it in the review folder and put it in the summary. Nothing is submitted for the user. **Rewrite it.** Draft it again from the same sources. **Discard the draft.**
- `shots-review` **Use these screenshots.** Copy the three files into the add-on's `thumbnails/`. **Rebuild them.** Start again from the locked template. **Do not write screenshots.** Leave `thumbnails/` alone.

## When to stop

Stop and say so when the add-on cannot be found, the scan fails, the dev server will not start, or the user chooses **Stop**. Keep the report. Say which command failed. Run `dashboard.mjs stop`.

## Done

Run `session.mjs done --summary "..."`, then `dashboard.mjs stop`. Done is not approval. Say what was fixed, what they skipped, what the panel showed, whether the listing was written, and what a reviewer can still reject. Name the review folder, so they can open `report.md`.

Do not say the add-on will pass review.
