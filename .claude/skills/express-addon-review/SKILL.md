---
name: express-addon-review
description: >-
  Reviews an Adobe Express add-on against the current manifest, brand, UI,
  and marketplace rules. Fetches Adobe's Express docs from the docs
  repository, reports each miss with a concrete edit, and never invents a
  rule that is not on those pages. Asks before making 1360×800 listing
  screenshots from the real panel. Use when the user mentions an Adobe
  Express add-on, marketplace review, Express branding, publishing an
  Express add-on, or listing screenshots.
license: MIT
compatibility: Requires Node.js 18 or newer. Uses the Node standard library. pdftotext extracts the brand PDF when it is installed.
---

# Express add-on review

Review one Adobe Express add-on directory. Do not modify it unless the user asks you to apply the suggestions.

The skill root is the directory that contains this file. Run the tools from that directory.

Adobe's sentences are not copied into this file. The links are the rules. Fetch them, then scan. A check whose sentence is missing from that download is skipped.

Review patterns from marketplace letters are the exception. They are written in [references/custom-rules.md](references/custom-rules.md) and they always run.

## Do not auto-choose

Do not open Adobe Express. The panel is the add-on's own document. Simulate it in a browser at 320px wide, then walk every screen in `views.json`. The steps are [references/visual.md](references/visual.md).

Do not invent listing copy. The publisher form is [references/submission.md](references/submission.md). Ask only for a value the source and the browser cannot show.

Do not generate marketplace screenshots unless the user says yes. The procedure is [references/listing-shots.md](references/listing-shots.md). A painted banner is not an upload file.

Do not edit the add-on until the user asks you to fix the review. Then fix one mistake, reload that screen, and confirm it is gone.

## Workflow

1. Refresh the current docs:

```bash
node scripts/refresh-docs.mjs
```

Read `references/live/summary.json`. The `sha` is the docs revision. If a page failed, say which URL failed and continue with the pages that saved. Do not fill the gap from memory.

The fetch list is [scripts/lib/sources.mjs](scripts/lib/sources.mjs). It is the markdown in [AdobeDocs/express-add-ons-docs](https://github.com/AdobeDocs/express-add-ons-docs) under the guideline, UX, and review-process folders, plus the brand PDF, the manifest reference, the premium-content how-to, and the May 2026 rejection post.

2. Find the add-on. `manifest.json` may sit at the folder the user named or in `src/manifest.json`. If more than one manifest is in the tree, ask which add-on to review. Do not merge them.

3. Scan:

```bash
node scripts/scan.mjs --input /absolute/path/to/addon
```

Or write the report, including the view list:

```bash
node scripts/review.mjs --input /absolute/path/to/addon --no-refresh
```

Use `--no-refresh` only when this same session already refreshed. The default `review.mjs` refreshes first. Point `--input` at the project root. The scanner uses `src/` when that is where the manifest lives.

4. Show the source findings. Group errors, then warnings, then review patterns. For each Adobe finding, show the file, the line, the suggestion, and the URL. For each skipped check, say the fresh page no longer contains the sentence. Show the `document` URL and the screen list from `views.json`.

5. Simulate the panel and browse every screen. Follow [references/visual.md](references/visual.md). Do not open Adobe Express. Look for any third-party logo, not only the four names in the source check.

6. Ask, and wait, whether they want marketplace screenshots they can upload as-is. The question and the recipe are in [references/listing-shots.md](references/listing-shots.md). Yes means follow that file: quote the add-on’s own lines, capture `#root` at 320px, and build the template with type on the left and the real panels on the right. No means do not create `thumbnails/`.

7. Ask the other listing questions the browser cannot answer. They are in [references/submission.md](references/submission.md). Read the fresh `public-dist.md` first. If a limit in that file differs from the skill, use the file.

8. Read the fresh files for anything the scanner did not decide. If the live text and a remembered rule disagree, follow the live text.

9. When the user asks you to fix the review, edit one mistake at a time. Reload that screen at 320px and confirm the mistake is gone. Then scan again.

## Read next

- [references/sources.md](references/sources.md) for the links
- [references/submission.md](references/submission.md) for the questions and the publisher form
- [references/custom-rules.md](references/custom-rules.md) for review patterns
- [references/report.md](references/report.md) for the report shape
- [references/human-checks.md](references/human-checks.md) for what a person still has to do
- [references/visual.md](references/visual.md) for the browser simulation
- [references/listing-shots.md](references/listing-shots.md) for upload-ready 1360×800 screenshots
