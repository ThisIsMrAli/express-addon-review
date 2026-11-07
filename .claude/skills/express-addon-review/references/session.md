# Session

Scan with the docs already on disk. Show the findings. Open the panel. Then use a selection box only for the big choices.

Do not ask permission to open the panel. Walk the screens in `views.json` at 320px. Do not open Adobe Express. The steps are [visual.md](visual.md).

Show errors, warnings, and review patterns with the file and the edit so the user can see what is open. If a section is empty, say none.

`questions.json` is the selection list. Call AskQuestion with one object. `title` is `Next step`. Pass `prompt` and `options` through unchanged. The first option is the suggestion. Wait for the click. Then take the next object.

Do not ask one box per bug. One finding list, then one Fix step that can clear all of them.

Do not run `refresh-docs.mjs` when `references/live/summary.json` exists. Say the `sha` and the date. Refresh only when the file is missing, or when the user asks.

`index.html` keywords, the meta description, and the document title are code. Do not copy them into the listing.

When a license field, a login, or a lock appears, call AskQuestion with the `credentials` object before opening that paid screen. If they will type the key, their next message is the secret. Use it only in the panel. Do not write it into the repo, the report, or a commit. If they skip, leave the paid screens closed.

## What the selection means

- **I will type the test license or login.** Wait for the next message. Use that secret only to unlock the panel. Do not save it.
- **Skip the paid screens.** Do not open them.
- **There is no license.** Continue without one.
- **Fix everything in this step.** Apply every open code finding and every open panel issue listed in that turn. Scan again with `--no-refresh`. Reload the screens that changed. The step is done when those ids are gone.
- **Fix only the code errors.** Apply the errors only. Leave warnings and review patterns open.
- **Leave the findings for later.** Do not edit yet.
- **Fix all panel issues.** Apply every visual problem named in that turn. Do not ask once per control.
- **Move**, **Review**, or **Add.** Follow [spectrum.md](spectrum.md).
- **Leave the UI as it is.** Do not restyle.
- **Write the listing text and the screenshots.** [submission.md](submission.md) one section at a time, and [listing-shots.md](listing-shots.md). Copy the skill template. Do not invent a layout.
- **Screenshots only** or **Listing text only.** Do that part.
- **Skip**, **Not now**, or **Stop.** Leave it open.

If they change an answer later, follow the new one.

## Done

Done is not approval. Say what was fixed, what they skipped, what the panel showed, whether the listing was written, and what a reviewer can still reject.

Do not say the add-on will pass review.
