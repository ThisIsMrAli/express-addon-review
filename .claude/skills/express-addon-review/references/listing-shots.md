# Marketplace screenshots

Ask this, then wait. Do not start until the user says yes:

> Do you want marketplace screenshots you can upload as-is? I will make 1360×800 PNGs from the real panel. I will not paint a banner, and I will not make the 144 icon unless you ask.

If they say no, stop. Do not create `thumbnails/`.

These files fill `screenshot-details` on the public listing. The rule is the fresh [public distribution](https://developer.adobe.com/express/add-ons/docs/guides/build/distribute/public-dist) page: one screenshot required, five maximum, each exactly **1360×800**, JPEG or PNG. This procedure writes PNG. The **144×144** icon is a different upload. Adobe resizes it. Do not make 36 or 64 copies.

The look is the same for every add-on. Type on the left. Real panels on the right. Soft off-white field, cyan-teal accent, white cards with a shadow and a slight turn. What changes is the add-on’s own words and its own screens.

## Words, taken from the add-on

Do not write a slogan. Collect the lines, then place them.

Read, and quote:

- `manifest.json` `name`
- `package.json` `description`
- `index.html` title and meta description
- Visible UI after the panel is open: placeholders, button labels, headings, guide titles, guide sentences, material names, pack names, export kinds

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

## Build the page

Copy [listing-shot.html](listing-shot.html) and [listing-shot.css](listing-shot.css) once per screenshot. Set `data-shot`:

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

Screenshot the HTML at **1920×1280**, device scale **1**, no scrollbars.

```bash
chrome --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1920,1280 --default-background-color=FFF8F9FA --screenshot=review-output/listing/01-raw.png file:///absolute/path/to/shot.html
```

On macOS the binary is often `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. If the shot is not 1920×1280, retake it. Do not stretch it.

```bash
node scripts/fit-listing-shot.mjs --input review-output/listing/01-raw.png --out /absolute/path/to/addon/thumbnails/01-cover.png
```

The script scales to width 1360, then center-crops the height to 800. `sips` takes the crop offset as vertical, then horizontal. The script already does that. Width must be 1360 and height must be 800.

Write `thumbnails/01-….png` through `05-….png` in the add-on project. Make three. Stop at five.

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

## Words that get a listing rejected

The monetization page is https://developer.adobe.com/express/add-ons/docs/guides/build/distribute/guidelines/monetization

- The word **Premium**. Say Paid, Upgrade, or Plus.
- A crown. That mark is only for Adobe Express Premium. For the add-on’s own unpaid state, use the plus badge, and only in a shot that is meant to show that state. A licensed user gets no badge.
- A lock icon.
- Another company’s logo, including Figma, unless this add-on is that integration and the team has permission.
- “Adobe Express Premium,” an Adobe logo, or anything that implies Adobe ships or endorses the add-on.
- A fake panel.
