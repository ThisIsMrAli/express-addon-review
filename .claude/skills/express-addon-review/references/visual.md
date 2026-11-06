# Simulate the panel

Open the panel as part of the review. Do not ask first.

Do not open `express.adobe.com`. Do not sign in. Adobe draws the title bar. The page you review is the add-on document, at the width Express gives it: **320px** wide and full height. The body padding on that page is **24px**, and the gap between elements is **16px**. Those numbers are in the fresh `visual-elements.md`. If that file no longer says them, do not keep enforcing them.

`review.mjs` writes `views.json`. It does not launch a browser. You do.

## 1. Start the document

From the project root, the folder that contains `package.json`:

```bash
npm start
```

Use that script when it calls `ccweb-add-on-scripts`. The server is `https://localhost:5241`. `https://localhost:5241/` is a JSON manifest. It is not the panel.

The panel URL is in `views.json` on the `document` entry. The CLI serves the entry file at:

```text
https://localhost:5241/<testId>/<main>
```

`testId` and `main` come from `manifest.json`. Example: `main` is `index.html` and `testId` is `abc`, so the document is `https://localhost:5241/abc/index.html`.

If the source stubs the host behind `?preview=1`, the `document` URL already includes that query. Open it. Preview mode is what makes buttons work in a normal browser. Without that stub, the Adobe SDK script expects to run inside Express and the page can stay blank. Say so. Do not invent a host stub unless the user asked you to add one.

Accept the local certificate warning if the browser shows one. That certificate belongs to the CLI.

If `npm start` is missing, serve the built folder and open `index.html` directly. Say the official CLI was not used.

## 2. Size the browser

Set the viewport to **320×800** before the first screenshot. 320 is the panel width. 800 is tall enough to scroll the body. Do not review a full desktop window and call it the panel.

Check light, then dark. Dark is `prefers-color-scheme: dark`, plus the add-on's own theme control when it has one.

## 3. Browse every screen

`views.json` has three kinds:

- `document` is the URL to open first. The first paint is the home screen. Screenshot it before clicking.
- `screen` is a component the shell mounts behind a condition (`studio ? <StudioView>`, `guideOpen && <Guide>`). Read that line and the JSX around it. Click the control that sets the condition. The control's visible name or `aria-label` is the `control` entry, or the text in the handler just above the screen.
- `control` is a button or `aria-label` on one line. Open the ones that change the screen, a tab, a menu, or a dialog. Skip a control that only calls the network, starts a download, or needs a real license.

Order:

1. Home, untouched.
2. Each `screen`, one at a time. Go back between them.
3. Inside a screen, each tab and each dialog that screen renders.
4. Empty, error, and locked states when the source has them. Use the preview stub's test value when the source documents one, such as a prompt answer. Do not type a real password.
5. Light, then the same path in dark.

After each click, read the page. A screenshot alone is not the check. Confirm the click changed the screen.

Save images under `review-output/<addon-name>/`. Name them `<screen>-<light|dark>.png`.

## 4. What a mistake looks like

Record a mistake only when you can see it on that screen:

- The main region is empty, or a control sits on top of another.
- Text is clipped at 320px, or it overflows the body.
- Body padding is not 24px, or stacked elements are not 16px apart, and the fresh visual-elements page still says those sizes.
- A third-party logo or wordmark implies a partnership. Ask whether they have written permission. Do not limit this to four brand names.
- A crown, a lock icon, or the word "Premium" is on a paid item, including after the preview license state.
- A long export or encode has no Cancel, or Cancel does not stop it.
- Success or error text cannot be read in light or in dark.
- Spelling is "addon" or "plugin" where the UI page requires "add-on", or "Express" is used without "Adobe" in front of it.

Keep the 320px captures. They are the panel images inside a listing screenshot. They are not the upload. Do not ask about the 1360×800 files here. That question is the Listing phase, after the fixes.

## 5. Fix, then look again

Each thing you saw is its own question: "Fix this?" Wait. Do not edit until they say yes to that one.

When they do:

1. Fix one mistake. The edit is the suggestion already in the report, or the smallest source change that removes what you saw on the screen.
2. Let the dev server rebuild. Reload only that screen.
3. Confirm the mistake is gone in light and dark at 320px. If it is still there, the fix is not done.
4. Run the scanner again. A fix that clears the screen and adds a new source error is not done.
5. Stop `npm start` when the walk is finished. Do not leave port 5241 occupied.

If the server or the build fails, keep the source report and say which command failed.
