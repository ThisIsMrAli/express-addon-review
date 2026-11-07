# Marketplace screenshots

The `listing` question asks this. Do not start before the answer is yes, and do not ask it during Review or Fix:

> Write the marketplace listing? I will draft the name, summary, description, and keywords from the manifest, the package description, and the visible panel, and I can make the 1360×800 screenshots from the skill template. I will not copy index.html keywords.

The shots are built in the review folder first. Nothing is written into the add-on until the user approves them (`shots-review`). If they say no to the whole listing, do not create `thumbnails/`.

These files fill `screenshot-details` on the public listing. The rule is the fresh [public distribution](https://developer.adobe.com/express/add-ons/docs/guides/build/distribute/public-dist) page: one screenshot required, five maximum, each exactly **1360×800**, JPEG or PNG. This procedure writes PNG. The **144×144** icon is a different upload. Adobe resizes it. Do not make 36 or 64 copies.

## Locked look

The look is the same for every add-on. Type on the **left**. Real panels on the **right**. Soft off-white field, cyan-teal accent, white cards with a shadow and a slight turn. What changes is the add-on’s own words and its own screens.

Do not invent a layout. Do not write a new stylesheet. Do not revive an old `shot.css`, type-right layout, `eyebrow` / `accent` / `names` freestyle, or an image-model banner. Those are the bad screenshots.

## Prepare the folder first

Always start from the skill templates:

```bash
node scripts/prepare-listing.mjs
```

It works in the review folder's `listing/` directory. That command copies `listing-shot.css` and writes `01-cover.html`, `02-feature.html`, and `03-path.html` from [listing-shot.html](listing-shot.html). It deletes stray freelanced stylesheets in that folder.

You may edit only:

- the kicker text
- the `h1` text
- the sentence
- the pills
- each `img` `src`
- whether the optional `.float-star` image stays or is removed

You may not:

- change the DOM structure or class names
- move type to the right or panels to the left
- replace `listing-shot.css`
- add `eyebrow`, `line`, `accent`, `names`, or other freelanced classes
- send a full banner prompt to an image model

If a previous run left bad HTML in the listing folder, run `prepare-listing.mjs` again and start over from the locked files.

## Words, taken from the add-on

Do not write a slogan. Collect the lines, then place them.

Read, and quote:

- `manifest.json` `name`
- `package.json` `description`
- Visible UI after the panel is open: placeholders, button labels, headings, guide titles, guide sentences, material names, pack names, export kinds

Do not quote `index.html` keywords, the meta description, or the document title. Those lines are the page template, not the listing.

Use this shape. Every piece must be a phrase that already appears in those sources. You may change case. You may not add a word.

- Kicker. A short UI phrase. The template uppercases it.
- Huge accent. One real count, or one real feature name. A count may keep its comma. Do not invent a round number such as “+446K” unless that spelling is already in the add-on.
- Sentence. One sentence from the description or the guide. Two lines at most.
- Three pills. Each pill is a few words and must fit on one line. Drop a pill that wraps onto its own line.

Skip the word Premium, a crown, and a lock icon even when the source uses them. Use the source’s own Paid, Upgrade, Plus, or Unlock line instead.

## Capture the panel

Do not open Adobe Express. Open the `document` URL from `views.json`. That page is the add-on.

1. Set the viewport to **320×800** with device scale **2**. A window screenshot is wrong. It includes the empty gray area beside the panel.
2. Screenshot the element `#root` only. The file should be about **640×1600**. If it is a wide desktop picture, you captured the window. Retake `#root`.
3. Save one file per screen you will show. Home, the feature screen, and the path screen are the usual three. Dismiss a dialog only when it covers the screen you need.
4. Never redraw the panel, and never paint over a wrong name. Retake it.

## Fill the prepared pages

Open the files `prepare-listing.mjs` wrote. Each already has its `data-shot` set:

- `cover`. Two cards, back and front. The main screen behind, a second real screen in front.
- `feature`. One card, the screen that is hard to see from home.
- `path`. Three cards in a row: find something, use it, get a result.

Point each card image at a `#root` capture. `height: auto` keeps the whole panel. Do not crop the capture with `object-fit`.

The page is **1920×1280**. The fit step cuts about 76px off the top and bottom. Keep the kicker, the huge accent, the sentence, the pills, and the cards inside `.safe`.

One floating object may sit in the gap between the type and the panels. Generate it alone, on a plain gray field, then cut the field out:

```bash
python3 scripts/key_float.py star.jpg star.png
```

The script needs Pillow. Open the cutout on a flat color. If a gray rectangle remains, or the object is only a hollow rim, leave it out. Do not pin an object to the page corner. The crop will cut it.

Gold heart: “A single high-gloss 3D extruded heart, luxury gold metal, soft studio light, realistic soft shadow, centered, plain light gray background, no text, no logo, no frame, no plugin window.”

Chrome rocket: “A single high-gloss 3D extruded rocket, mirror chrome, dynamic perspective as if launching, soft studio light, realistic soft shadow, centered, plain light gray background, no text, no logo, no frame, no plugin window.”

Glass star: “A single high-gloss 3D extruded five-point star, holographic iridescent frosted glass with a soft cyan edge, translucent, soft studio light, realistic soft shadow, centered, plain light gray background, no text, no logo, no frame, no plugin window.”

These prompts are for the object only. Do not send a banner prompt to an image model. A painted panel is the wrong file.

## Render and fit

All of this happens in the review folder's `listing/` directory. `node scripts/session.mjs show` prints the review folder.

One command renders every prepared page and fits it:

```bash
node scripts/render-listing.mjs
```

It works on macOS, Windows, and Linux. It finds Chrome, Edge, or Chromium on its own (set `CHROME_PATH` to use another), renders each page at **1920×1280**, then scales to width 1360 and center-crops the height to 800. On macOS the crop uses `sips`. Elsewhere Chrome does it. Pass `--only 01-cover` to redo one page and `--engine chrome` to force the browser crop.

Before it starts a browser, it checks each page against the locked template and stops with a list of problems when any of these is true. Fix them and run it again.

- `listing-shot.css` is missing or was changed.
- The page has a `<style>` tag, a `style` attribute, a script, or another stylesheet.
- A class is used that the stylesheet does not define.
- `.copy` comes after `.stage`, so the type is not on the left.
- The kicker, headline, sentence, or a pill still says what the template said ("Short phrase from the UI", "Fact").
- An `img` is not a local file, or the file does not exist. Remove a card you do not use.

It then compares the kicker, headline, sentence, and each pill with the add-on's source (`--input <add-on>` if the review did not record it). A phrase it cannot find comes back as a `warnings` entry. A count you worked out from the data is fine when you can say how. Replace anything else.

Do not run Chrome by hand. Do not stretch a page that comes out the wrong size. The command fails instead.

Make `final/01-cover.png`, `final/02-feature.png`, `final/03-path.png`. Stop at five.

1. Cover. The main screen, plus one more screen, and the promise. Adobe shows this one largest.
2. The feature that is hard to see in one panel shot.
3. The path: find something, use it, get a result.
4. Optional. A second feature, only if it is real.
5. Optional. Packs, export, or settings, only if it is real.

## Open the PNG before you finish

Rebuild it when any of these are true:

- The kicker, the huge accent, or the sentence is cut by the frame.
- A pill wraps onto its own line.
- A panel is the browser window, or the UI is painted.
- A word on the image is not in the add-on.
- An object still has a gray rectangle, or it covers a word or a button.
- The file is not 1360×800.
- The type is on the right, or the HTML/CSS was freelanced instead of prepared from the skill template.

## Show them, then write

Open every final PNG yourself first, and rebuild any that fail the list above. Then ask the user.

Dashboard mode. The images appear inside the decision, at full width, with their sizes:

```bash
node scripts/session.mjs ask --id shots-review --image <listing>/final/01-cover.png --image <listing>/final/02-feature.png --image <listing>/final/03-path.png
node scripts/session.mjs wait --id shots-review
```

Chat mode. Show each PNG in chat as an image, then call AskQuestion with the `shots-review` object and record the click with `session.mjs answer --id shots-review --value <option id>`.

- `approve`. Copy the files from `<listing>/final/` into the add-on's `thumbnails/` folder, keeping the names. Create the folder if it is missing. Run `review.mjs --rescan` and confirm `listing-screenshot` does not fire.
- `redo`. Run `prepare-listing.mjs` again and start over from the locked files. Do not patch the old HTML.
- `skip`. Write nothing. The previews stay in the review folder.

The listing text has the same shape. Put the draft on the session with `session.mjs listing --json listing.json`, ask `listing-review`, and save it only after `approve`. Nothing is ever submitted to Adobe for the user.

## Words that get a listing rejected

The monetization page is https://developer.adobe.com/express/add-ons/docs/guides/build/distribute/guidelines/monetization

- The word **Premium**. Say Paid, Upgrade, or Plus.
- A crown. That mark is only for Adobe Express Premium. For the add-on’s own unpaid state, use the plus badge, and only in a shot that is meant to show that state. A licensed user gets no badge.
- A lock icon.
- Another company’s logo, including Figma, unless this add-on is that integration and the team has permission.
- “Adobe Express Premium,” an Adobe logo, or anything that implies Adobe ships or endorses the add-on.
- A fake panel.
