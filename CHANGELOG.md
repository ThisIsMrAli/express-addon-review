# Changelog

## 0.4.0

- **The agent no longer stops while it waits.** A chat that ended its turn after you pasted a license code in the dashboard was the bug. Now the first rule in `SKILL.md` is to keep going until `session.mjs done`, every command ends with a `next` line that says what to run, `session.mjs next` answers "what now?" at any point, and the dashboard shows an "agent quiet" banner with a one-click "Copy continue" if a chat ever does go quiet.
- **A real UI check.** `audit.mjs` opens the panel in headless Chrome at 320px, in light and dark, with reduced motion, and clicks through it like a person (never Delete, Reset, Buy, or Sign out). It finds what the code scan cannot: a dialog whose close button sits at the bottom, a dialog with no way out, a control covered by another, text clipped or overflowing, broken images, unreadable contrast, controls a keyboard cannot reach, and script or network errors. Each finding has an annotated screenshot and a guess at the source line.
- **Confirmed UI bugs are fixed first, without a question.** Warnings go into the one "fix everything" question. The audit runs again afterwards and marks what is really gone.
- **An optional polish step, only on approval.** `references/polish.md` is a short, measured set of spacing, type, and state rules, so the panel looks finished without being redesigned.
- **Paid screens without the secret passing through the agent.** A license typed in the dashboard stays in the dashboard's memory for that review. `audit.mjs --licensed` fetches it from the loopback server with the token, uses it, and never writes it down.
- **A new dashboard.** A "Now" card with a live timer and a progress bar, an agent pill that says whether the agent is working, waiting for you, or quiet, steps with a reason and a duration, findings by severity with screenshots, and the decisions as buttons. Status never relies on color alone. Light and dark, reduced motion respected, system fonts only.
- **No Adobe login to walk the panel.** When nothing runs at the panel's address, the audit builds the add-on and serves the build from this computer, rebuilding when a source file the build reads has changed since. It steps through a welcome tour, then explores the screens behind it.
- **Fewer false alarms, more real ones.** A sheet or scrim laid over many controls on purpose, a menu that is open, and a control scrolled out of view are not bugs. Something you cannot see (opacity 0) that takes the clicks meant for the controls under it is, and it is reported as `invisible-cover`. A source line is named only when one place holds the label or the rest of the screen settles it.
- **A walk that says where it is.** While light finds screens it counts them ("5 screens found so far") and the dark replay shows "3 of 12". Each screen is named in the activity feed. A walk that stops early says whether the time or the screen limit ended it. A second audit in the same review is refused while the first runs.
- **No stale waiting line.** Once your answer is read, the step shows "You chose …" instead of "Waiting for your answer". The agent is told to report each file it edits during the fix and polish steps, so the page keeps moving.
- Tests cover the audit against fixture panels in real Chrome, including the close-at-bottom dialog, a refused and an accepted license, a re-run that confirms a fix, and the dashboard's wait, answer, and secret paths.

## 0.3.0

- A live dashboard in Chrome, offered once at the start, with chat as the fallback. Every approval is a click there. It listens on this computer only, behind a token, and Adobe's reviewers never see it.
- The scanner reads code the way a person does. Comments are ignored, markup is read tag by tag (multi-line JSX, spread props, Spectrum and React Spectrum controls), and a rule that needs a project-wide answer, such as Cancel, logout, or validation, looks at the whole project.
- Upload package check. A zip in the project root is read in memory and checked for the manifest at its root, the 50 MB limit, hidden files, the files the manifest names, and whether it is older than the source. `--zip` checks one stored elsewhere.
- A rejection letter workflow. Each reason becomes a tracked note, is mapped to a check, and is verified by itself. The skill ends with the notes to paste into the resubmission.
- New checks drawn from Adobe's list of common rejections: no way back out of a screen, an honest Cancel, credits and test credentials for the reviewer, and the panel on a slow or offline network.
- Listing screenshots render with one command, `render-listing.mjs`, on macOS, Windows, and Linux. It refuses a page that left the locked template and flags any phrase that is not in the add-on's source.
- CI runs the tests on Node 18, 20, and 22, on macOS, Windows, and Linux.

## 0.2.0

- Reviews are written to `~/.express-addon-review/<slug>/`, not into the add-on.
- Screenshots use the locked template: type on the left, panels on the right.
