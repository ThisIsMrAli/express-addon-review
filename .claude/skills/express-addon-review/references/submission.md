# Publisher form

These fields are rules. They were taken from the in-app form sections and from the public-distribution page. Check a `listing/` file when the repo has one. Ask the user for a value that is not in the repo. Do not wait for those answers before the browser walk, and do not invent them.

The in-app form is one page with these sections:

- `listing-details`
- `screenshot-details`
- `version-details`
- `ai-usage-details`
- `monetization-details`
- `publisher-details`
- `submit-details`

The section names come from that form. The fields and limits come from the fresh [public distribution](https://developer.adobe.com/express/add-ons/docs/guides/build/distribute/public-dist) page, `references/live/src/pages/guides/build/distribute/public-dist.md`. If that file and this list disagree, ask from the file.

A `*` field is required before submit. A draft can be saved without it.

## Ask when the repo does not contain the value

1. If the tree has more than one `manifest.json`, which add-on should be reviewed?
2. Listing (`listing-details`). Read the fresh page for the current limits. Last fetch:
   - Add-on name, 25, required, unique
   - Summary, 50, required
   - Full description, 1000, required
   - Help URL, 1000, required
   - Support email, 1000, required. End users do not see it
   - Privacy notice URL, 1000
   - EULA URL, 1000
   - Keywords, 100, comma-separated
   - Trader information is required to sell in the EU. The fields are on the [listing page](https://developer.adobe.com/express/add-ons/docs/guides/build/distribute/guidelines/general/listing)
3. Screenshots (`screenshot-details`):
   - Ask if they want files generated that can be uploaded as-is. If yes, follow [listing-shots.md](listing-shots.md). If no, do not generate them
   - One screenshot is required. Up to five total
   - Each screenshot is 1360×800 JPEG or PNG
   - Icon is 144×144 JPEG or PNG. Adobe resizes that upload to 36 and 64. Do not ask the user for separate 36 and 64 files. Do not make the icon unless they ask
   - If `listing/` or `thumbnails/` contains an icon or a screenshot, the scanner already measures a `listing/` image. Still ask when those folders are missing
4. Version (`version-details`):
   - Release notes, 1000
   - Supported languages
   - The package is a zip of the built files, not a zip of the folder. Manifest sits at the root of the zip. The zip must be 50 MB or smaller, use relative paths, and omit hidden files. `npm run package` does this
5. AI usage (`ai-usage-details`). Ask whether the add-on uses generative AI. If it does, read the fresh [generative AI requirements](https://developer.adobe.com/express/add-ons/docs/guides/build/distribute/guidelines/genai/requirements) and ask only the questions that page still lists. The form changes with the kind of output. Do not invent certification questions.
6. Monetization (`monetization-details`). A model is required:
   - Free
   - Free and paid plans available
   - Free trial
   - Paid
   - When it is not Free, the payment option is one-time payment, recurring subscription, or micro-transactions
   - Optional payment details, 250 characters, such as a price or trial length
   - The listing must say checkout is outside Adobe Express and the add-on is not part of an Adobe plan
7. Publisher (`publisher-details`). First submission only, unless they are editing it:
   - Publisher name, description, and website. The domain must not contain an Adobe trademark
   - Publisher logo, 250×250 JPEG or PNG, original, no Adobe logo
   - EU availability. If yes, the trader details on the listing page are required
8. Submit (`submit-details`):
   - Notes to the reviewer
   - Test credentials or a coupon when the add-on logs in or has a paid feature

Do not say the listing is ready until they have answered, or they have said to skip the form.
