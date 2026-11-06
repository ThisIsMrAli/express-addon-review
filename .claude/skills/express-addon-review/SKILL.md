---
name: express-addon-review
description: >-
  Reviews an Adobe Express add-on. Shows the code findings, opens the panel
  at 320px, and walks the screens. Then calls AskQuestion: one selection
  box, recommended option first. Fix a finding, apply the design guidelines,
  or write the listing and 1360×800 screenshots. Uses the docs already on
  disk. index.html keywords are code, not the listing. Use when the user
  mentions an Adobe Express add-on, marketplace review, Express branding,
  publishing an Express add-on, or listing screenshots.
license: MIT
compatibility: Requires Node.js 18 or newer. Uses the Node standard library. pdftotext extracts the brand PDF when it is installed.
---

# Express add-on review

Review one Adobe Express add-on directory. Do not modify it unless the user asks you to apply the suggestions.

The skill root is the directory that contains this file. Run the tools from that directory.

Adobe's sentences are not copied into this file. The links are the rules. Use the pages already in `references/live/`. Scan. A check whose sentence is missing from that download is skipped. Do not fetch the docs again when `references/live/summary.json` exists.

Review patterns from marketplace letters are the exception. They are written in [references/custom-rules.md](references/custom-rules.md) and they always run.

## Do not auto-choose

Scan. Show the code findings. Open the panel and walk the screens. Then call AskQuestion.

Do not ask permission to open the panel. Do not open Adobe Express. The steps are [references/visual.md](references/visual.md).

Do not type the next step as a paragraph. A reply that ends with a question mark and does not call AskQuestion is incomplete.

Every fixed choice uses the AskQuestion tool. One question in that turn. If the tool is missing, ask the same choices in one sentence.

`questions.json` holds the code, license, design, and listing selections. Pass one object's `prompt` and `options` through unchanged. `title` is `Next step`. The first option is the suggestion and already ends with `(Recommended)`.

When a license field, a login, or a lock appears, call AskQuestion with the `credentials` object before you open that paid screen. If they choose "I will type the test license or login", their next message is the secret. Use it only in the panel. Do not write it into the repo, the report, or a commit. If they skip, do not open the paid screens.

After the walk, a problem you saw is also an AskQuestion, before the design question. The options are only:

- `yes`: Fix this (Recommended)
- `skip`: Skip this one
- `stop`: Stop

The prompt is one sentence naming the control and the fix. Do not write that sentence as the only question in the chat.

Do not refresh the docs when `references/live/summary.json` exists. Use that revision. Run `refresh-docs.mjs` only when that file is missing, or when the user asks for a refresh.

If they change their mind, follow the new answer. The order is [references/session.md](references/session.md).

Do not invent listing copy, and do not read it from `index.html`. The publisher form is [references/submission.md](references/submission.md). Screenshots follow [references/listing-shots.md](references/listing-shots.md). A painted banner is not an upload file.

## Workflow

1. Find the add-on. `manifest.json` may sit at the folder the user named or in `src/manifest.json`. Ask which add-on to review only when the tree has two JSON objects that are both Express add-on manifests (`manifestVersion` and an Express app requirement). A file that is only named `manifest.json`, such as a caption list, is not an add-on. Do not ask about it, and do not merge it.

2. Scan. Do not refresh first:

```bash
node scripts/review.mjs --input /absolute/path/to/addon --no-refresh
```

`review.mjs` refreshes only when `references/live/summary.json` is missing, or when you pass `--refresh`. Point `--input` at the project root. The scanner uses `src/` when that is where the manifest lives.

3. Show errors, warnings, and review patterns. For each one, show the file, the line, the suggestion, and the URL. Name the docs `sha`. If a section is empty, say none. Do not paste the skipped checks or the person checklist.

4. Open the panel and walk the screens in `views.json`. Follow [references/visual.md](references/visual.md). Do not ask first. Do not open Adobe Express.

5. The first time a screen is locked or asks for a license or login, call AskQuestion with the `credentials` object. Wait. Then continue or skip the paid screens as they chose.

6. After the walk, call AskQuestion once. A visual problem uses Fix this (Recommended), Skip this one, and Stop. Otherwise use the first unanswered object in `questions.json`. Do not type the question as a paragraph.

7. Follow [references/session.md](references/session.md) for the selected option.

- **Fix this** or **Fix all remaining code errors**: edit that suggestion, scan again with `--no-refresh`, and reload that screen. Continue only when it is gone, then call AskQuestion with the next object.
- **Go through them**: one finding, then the next, each as its own AskQuestion with Fix this (Recommended), Skip this one, and Stop.
- **Move**, **Review**, or **Add**: follow [references/spectrum.md](references/spectrum.md). Do not restyle until this selection.
- **Leave the UI as it is**: do not restyle.
- **Write the listing text and the screenshots**: [references/submission.md](references/submission.md) one section at a time, and [references/listing-shots.md](references/listing-shots.md). Do not copy `index.html` keywords.
- **Screenshots only** or **Listing text only**: do that part.
- **Skip**, **Not now**, or **Stop**: leave that item open.

7. If the live text and a remembered rule disagree, follow the live text.

8. Close with the lines in [references/session.md](references/session.md). A finished session is not marketplace approval.

## Read next

- [references/session.md](references/session.md) for the questions and when to stop
- [references/sources.md](references/sources.md) for the links
- [references/submission.md](references/submission.md) for the questions and the publisher form
- [references/custom-rules.md](references/custom-rules.md) for review patterns
- [references/report.md](references/report.md) for the report shape
- [references/human-checks.md](references/human-checks.md) for what a person still has to do
- [references/spectrum.md](references/spectrum.md) for Spectrum controls and the Express theme
- [references/visual.md](references/visual.md) for the browser simulation
- [references/listing-shots.md](references/listing-shots.md) for upload-ready 1360×800 screenshots
