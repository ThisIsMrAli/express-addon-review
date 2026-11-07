# Sources

Do not copy Adobe's sentences into the skill. `scripts/lib/sources.mjs` is the fetch list. `node scripts/refresh-docs.mjs` downloads the current files into `references/live/` and records the git SHA.

Repository: https://github.com/AdobeDocs/express-add-ons-docs

The published guide index is https://developer.adobe.com/express/add-ons/docs/guides/. The sidebar on that page is the list. Every guide URL in that sidebar has a markdown file under `src/pages/guides/`, and the fetch downloads that whole folder.

Checked against the live sidebar on November 6, 2026: 95 guide URLs, and every one is in the repository. These published pages are not in the sidebar, and they still return a page, so they are downloaded with the rest of the folder:

- [Fonts](https://developer.adobe.com/express/add-ons/docs/guides/build/design/fonts)
- [Mobile UX](https://developer.adobe.com/express/add-ons/docs/guides/build/design/ux-guidelines/mobile-ux)
- [Planning](https://developer.adobe.com/express/add-ons/docs/guides/build/distribute/guidelines/general/planning)
- [Listing guide](https://developer.adobe.com/express/add-ons/docs/guides/build/distribute/listing-guide)
- [Submission checklist](https://developer.adobe.com/express/add-ons/docs/guides/build/distribute/review-process/submission-checklist)
- [Markdown parser tutorial](https://developer.adobe.com/express/add-ons/docs/guides/learn/how-to/tutorials/markdown-parser-text-api)

`getting-started/local-development` has no published index page. Its child pages, including known issues, are in the sidebar and are downloaded.

The SDK References section in the same header is the class reference. It is not a guide page. The manifest reference is still fetched, because the scanner cites it:

- https://developer.adobe.com/express/add-ons/docs/references/manifest/
- https://blog.developer.adobe.com/en/publish/2026/05/how-to-get-your-adobe-express-add-on-approved-avoiding-the-most-common-rejections

The brand PDF is `static/pdf/Adobe_Express_Developer_Program_brand_guide_100625.pdf`.

The premium-content page is about Adobe Express document content. It is not the add-on's own paid tier. The monetization page covers that.

`listing-guide.md` is older than `public-dist.md`. When they disagree, use `public-dist.md`.

`best-practices.md` still says only the light theme exists. `theme-locale.md` is the theme rule.

Published pages are rendered from the markdown. Prefer the downloaded markdown when they disagree.

The upload checks (`package-root`, `package-size`, `package-hidden`, `package-entry`) come from the public distribution page, and each is gated on its sentence being in the fresh download like the rest. `package-stale` is not an Adobe rule. It compares the zip with the source on disk.
