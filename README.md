# Express add-on review

An agent skill that checks an Adobe Express add-on folder against the current marketplace rules. Each miss includes an edit. Adobe's sentences stay on Adobe's pages: the refresh command downloads the docs repository, and a check is skipped when that download no longer contains the sentence.

It does not replace the marketplace review, and it does not open Adobe Express. The scanner reads the source and writes the panel URL plus the screen list. The skill then opens that URL at 320px and walks each screen. Listing fields that are not in the repo are asked, not invented.

Invoke it in Cursor with `/express-addon-review`.

## Install

Node.js 18 or newer. `pdftotext` is used for the brand PDF when it is installed.

```bash
npx skills add <owner>/express-addon-review --skill express-addon-review -a cursor
```

This clone links the skill into Cursor, Claude, Codex, and the other agent folders:

```bash
node install-agents.mjs
node install-agents.mjs --global
```

## Use it

```bash
node .claude/skills/express-addon-review/scripts/refresh-docs.mjs
node .claude/skills/express-addon-review/scripts/scan.mjs --input /path/to/addon
node .claude/skills/express-addon-review/scripts/review.mjs --input /path/to/addon
npm test
```

The report has Adobe findings with a URL, review patterns from marketplace letters, checks that were skipped because the fresh page changed, and the list a person still has to do.

Agents follow [`.claude/skills/express-addon-review/SKILL.md`](.claude/skills/express-addon-review/SKILL.md).

## License

MIT
