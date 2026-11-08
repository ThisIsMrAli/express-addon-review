# Walk the panel

Open the panel as part of the review. Do not ask first. Do not open `express.adobe.com`. Do not sign in.

The page you review is the add-on document at the width Express gives it: **320px** wide and full height. The body padding there is **24px** and the gap between elements is **16px**. Those numbers come from the fresh `visual-elements.md`. If that file no longer says them, do not keep enforcing them.

## Run the audit

```bash
node scripts/audit.mjs
```

It finds the panel URL in `views.json` (the `document` entry). It needs the panel to answer somewhere, and it never signs in to Adobe to get that. In order: something already runs at that URL (the person's own dev server); or the project has a build script, so it builds the add-on when the build is older than the source and serves the build from this computer; or the project is plain files, which it serves as they are; or, last, it runs `npm start` and gives up if that waits for a sign-in. It stops what it started when the walk ends.

It opens a private headless Chrome that does not touch the user's browser or profile, sized 320×800 at 2×, with software WebGL so a 3D view draws. Every visit starts like a first visit, with no saved state. It then presses its way through the panel: every control that opens a screen, a tab, a menu, or a dialog, two levels deep, up to 28 screens. A welcome tour or notice that opens with the panel is stepped through (Next, Skip, Close), and it costs no depth, so the panel behind it is walked too. A control that is on every screen, such as a filter or a tab bar, is pressed once. A grid of look-alike buttons counts as one control.

The same problem on several screens is one note, with the other screens listed in it. A menu or popover that covers a control on purpose, a control scrolled out of sight, and a sticky bar that content scrolls under are not reported as covered. A sticky bar is reported only when the person cannot scroll the control out from under it.

It will not press anything that looks like delete, reset, sign out, buy, or checkout, a download, a file picker, or a link that leaves the panel. A page that tries to open a new tab or an alert is stopped.

Adobe's `sdk.js` waits for a message from Express before `ready` resolves, and a panel opened on its own never gets it. A panel that renders after `await addOnUISdk.ready` would stay blank. The audit answers that one request itself, from this computer, with a stand-in that lets the panel draw and the controls be pressed. Do not edit the add-on to make it render outside Express: no preview mode, no fake host, no change to the SDK import. The stand-in accepts any method name, so a misspelled call such as `addImag` is not found by the walk. The source scan finds it as `sdk-method-unknown`.

It repeats every screen it found in dark (`prefers-color-scheme: dark`) with reduced motion, so a screen that only breaks in dark is caught.

It writes each screen's capture, with the bugs outlined in pink and numbered, into the session. The dashboard shows them as they arrive. It also looks up where each bug is in the add-on's source, from the visible label, and gives a `file:line`. That is a lead, not proof. Open the file and check.

Run it again after every fix. It matches bugs across runs: one that is gone is marked `fixed`, one that is still there stays `open`, a new one is added.

## What it measures

| Rule | What it means | Handling |
| --- | --- | --- |
| `dialog-close-misplaced` | The close control is in the lower half of the dialog. People look top right. | Fix now |
| `dialog-no-exit` | A dialog has no visible Close, Cancel, or Back. | Fix now. Only a warning when Escape closes it. |
| `dialog-overflows` | The dialog does not fit the panel and does not scroll. | Fix now. A warning when it does scroll. |
| `control-covered` | A control is under another element, so a click lands on the wrong thing. | Fix now |
| `invisible-cover` | Something at opacity 0 sits over the panel and takes the clicks meant for its controls. Often a dialog or scrim whose animation ends invisible when reduced motion is on. | Fix now |
| `control-offscreen` | A control sits outside the 320px panel, so it cannot be reached. | Fix now |
| `scrolls-sideways` | The content is wider than the panel. | Fix now |
| `image-broken` | An image did not load. | Fix now |
| `panel-blank` | Nothing on the screen: no text, no control, no image. | Fix now |
| `small-target` | A control is under 24×24px with another control within 24px. | Asked in `fix` |
| `text-clipped` | Text is cut off. | Asked in `fix` |
| `small-type` | Text is under 11px. | Asked in `fix` |
| `dialog-empty-space` | A dialog has an empty band taller than 96px and 30% of its height between its content above and below. Usually a fixed height or a stretched flex column. | Asked in `fix` |
| `font-off` | Text renders in a typeface that is not Adobe Clean, a system stack, or a code font. One note per typeface. | Asked in `fix` |
| `low-contrast` | Text is under 4.5:1 against its background. The note names the theme. | Asked in `fix` |
| `click-without-keyboard` | Something clickable is not a button, a link, or focusable. | Asked in `fix` |
| `script-error` | The page threw an uncaught error while it was walked. | Asked in `fix` |
| `screen-lost` | A screen the earlier full walk reached cannot be reached now. After an edit that usually means a replaced control no longer fires the handler that opened it (a tab bar that emits `change` instead of `onClick`, a prop that became an attribute). | Asked in `fix` |
| `request-failed` | A file from the add-on itself failed to load. | Asked in `fix` |

**Fix now** means: fix it without asking, run the audit again, and repeat until none is open. These are measurements, not opinions, and no user wants them left. A bug that cannot be fixed without changing the design goes in the closing summary with the reason.

The probe follows [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): a small target that stands alone, with no other control within 24px, is not flagged.

## What it does not measure

Look at the captures yourself for these, and add a note with `session.mjs note` when you see one on a screen:

- A third-party logo or wordmark that implies a partnership. Ask whether they have written permission.
- A crown, a lock, or the word "Premium" on a paid item, including after the license state.
- A long export or encode with no Cancel, or a Cancel that does not stop it. Or a Cancel that is shown after the request has gone to a server, with no word that credits are still used.
- A license field that accepts an empty key, or shows no message when Upgrade is pressed with nothing typed.
- Spelling "addon" or "plugin" where the UI page requires "add-on", or "Express" without "Adobe" in front of it.
- A blank panel or an endless spinner on a slow or missing network. Adobe's reviewers test on real networks.

Keep the 320px captures. They are the panel images inside a listing screenshot. They are not the upload. The 1360×800 files are the Listing step, after the fixes.

## The paid screens

When `audit.mjs` prints `needsLicense: true`, the first pass found a license field. Ask the `credentials` question. On **provide**, `node scripts/audit.mjs --licensed` replays the way to that field, types the license, presses its button, and measures the screens that open. The license comes from the dashboard's memory or from `EXPRESS_REVIEW_SECRET`. It is never printed, written to a file, or put in `audit.json`.

The output says what happened: accepted, not accepted (the `access` step is then skipped with that reason), or entered with nothing changing. If the license is not accepted, say so in the summary. Do not keep trying keys.

## When the audit cannot run

If there is no Chrome, Edge, or Chromium (set `CHROME_PATH`), or the panel can neither be found nor built, `audit.mjs` says why and exits. Say it in one sentence and walk the panel by hand:

1. From the project root run `npm start`. The server is `https://localhost:5241`. `https://localhost:5241/` is a JSON manifest, not the panel. The panel is the `document` URL in `views.json`, which already carries `?preview=1` when the source stubs the host. Accept the local certificate warning. Do not invent a host stub unless asked.
2. Set the viewport to 320×800 before the first screenshot. Check light, then dark.
3. Open the home screen untouched, then each `screen` in `views.json`, then each tab and dialog inside it, then the empty, error, and locked states the source has.
4. After each click, read the page. A screenshot alone is not the check. Press Tab through each screen: every control reachable, the focused one visible.
5. Look for what the table above lists, and record each with `session.mjs note --text "..." --screen "..." --shot file.png`. Fix the ones the table marks **Fix now**, then rescan.

Stop `npm start` when the walk ends. Do not leave port 5241 occupied. Set the `panel` step to `done` with a detail such as `5 screens, light and dark`.
