# Express Add-on Review

The check you run on an Adobe Express add-on before you submit it. Point it at the add-on folder. It checks the source against Adobe’s current docs, walks the panel at 320px in light and dark, fixes the layout bugs it measures, and prepares the marketplace listing.

It does not open Adobe Express, it does not submit the add-on, and a finished review is not marketplace approval. Adobe’s sentences stay on Adobe’s pages. The refresh command downloads the docs, and a check is skipped when that download no longer contains the sentence it depends on.

## Requirements

- Node.js 18 or newer
- Chrome, Edge, or Chromium on the same computer, for the panel walk and the listing screenshots. Set `CHROME_PATH` to choose one. Without a browser, the review says so and continues by hand
- `pdftotext`, optional, for the brand PDF

macOS, Windows, and Linux.

## Install

From this folder:

```bash
node install-agents.mjs --global
```

That links the skill into the agent folders on this machine, including Claude, Cursor, Codex, Gemini, and Windsurf. Use `node install-agents.mjs` without `--global` to link it only inside this project.

If you were sent the preview address instead of the repository, download the project from that page. The repository itself is private.

## Run a review

On this computer, after the install above, open Cursor in any folder and ask it to run Express Add-on Review on the add-on path. You can also type `/express-addon-review`. The agent follows [`.claude/skills/express-addon-review/SKILL.md`](.claude/skills/express-addon-review/SKILL.md). The review stays on this machine: the dashboard is a localhost page, and the panel is built and served here. It does not need an Adobe sign-in.

To run the pieces yourself:

```bash
npm run refresh                                   # download the current Adobe docs once
npm run review -- --input /path/to/addon          # write the report and start a session
npm run dashboard -- start                        # open the local dashboard in Chrome
node .claude/skills/express-addon-review/scripts/audit.mjs
npm run session -- show
npm run dashboard -- stop
npm test
```

Reports are written to `~/.express-addon-review/<slug>/`, not into the add-on and not into this repository.

## What a review covers

**Source.** Checks tied to Adobe’s current docs, plus review patterns taken from marketplace letters. Comments are ignored, markup is read tag by tag, and a project-wide rule looks at the whole project. `index.html` keywords, the meta description, and the document title are not the listing.

**Upload.** A zip in the project root is read in memory: the manifest at its root, the 50 MB limit, no hidden files, the files the manifest names, and whether the zip is older than the source.

**Panel.** The panel is built and served on this computer when nothing is already running, so the walk does not need an Adobe sign-in. It opens at 320px in light and dark and presses every screen it can reach. It does not press Delete, Reset, Buy, or Sign out. Measured bugs, such as a close button at the bottom of a dialog, are fixed and checked again. Warnings wait for one decision.

**Listing.** Text is drafted from the manifest, the package description, and the visible panel. Screenshots are rendered at 1360×800 from one locked template, using only words that are already in the add-on. Both are shown for approval before anything is written into the add-on.

**A person.** Other browsers, a slow network, the publisher website, and test credentials are listed for you. They are not guessed. If the add-on was rejected, paste the letter. Each reason becomes a note, is checked, and is returned as text for the resubmission.

The local dashboard shows the current step, a progress bar, the findings, and the 320px captures. It listens on this computer only. Adobe’s reviewers never see it. If it cannot start, the same decisions continue in chat.

## What it will not do

- Submit the add-on, or claim that Adobe will approve it
- Open Adobe Express or sign in
- Invent listing text, publisher details, or test credentials
- Ask once per finding

## Share a private preview

The source repository stays private. It does not appear on a public GitHub profile, and nobody can clone it without being given access.

GitHub Pages has no signature check. A private repository hides the source. It does not hide a Pages site. The preview address is an unguessable path, with an optional expiry, which is as close as Pages can come to a presigned URL:

- The site root says “Not found” and does not name the project.
- The page and the install zip exist only under that path.
- Anyone with the address can open it until you rotate the path, or until the date passes and the next deploy removes it.
- A daily deploy drops expired paths. `noindex` asks search engines not to list the site. That is not access control.

Do not put secrets on the page, and do not post the address in public. Publishing Pages from a private repository needs GitHub Pro, Team, or Enterprise. This project is not published from a public repository.

```bash
node scripts/share-link.mjs                 # print the address and store it in Actions secrets
node scripts/share-link.mjs --days 30       # the same, and remove the path 30 days later
node scripts/share-link.mjs --rotate        # invalidate the current address
node scripts/share-link.mjs --publish       # also start a deploy
```

The address is written to `.share/link.json` on this computer and to Actions secrets. `.share/` is not committed. The command refuses to continue when the repository is not private.

## License

[MIT](LICENSE)
