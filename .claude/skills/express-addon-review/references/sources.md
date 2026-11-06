# Sources

Do not copy Adobe's sentences into the skill. `scripts/lib/sources.mjs` is the fetch list. `node scripts/refresh-docs.mjs` downloads the current files into `references/live/` and records the git SHA.

Repository: https://github.com/AdobeDocs/express-add-ons-docs

Markdown prefixes:

- `src/pages/guides/build/distribute/guidelines/`
- `src/pages/guides/build/design/ux-guidelines/`
- `src/pages/guides/build/distribute/review-process/`

Single files:

- `src/pages/guides/build/distribute/rejections.md`
- `src/pages/guides/build/distribute/public-dist.md`
- `static/pdf/Adobe_Express_Developer_Program_brand_guide_100625.pdf`

Pages outside that tree:

- https://developer.adobe.com/express/add-ons/docs/references/manifest/
- https://developer.adobe.com/express/add-ons/docs/guides/learn/how-to/premium-content
- https://blog.developer.adobe.com/en/publish/2026/05/how-to-get-your-adobe-express-add-on-approved-avoiding-the-most-common-rejections

The premium-content page is about Adobe Express document content. It is not the add-on's own paid tier. The monetization page covers that.

Published pages are rendered from the markdown. Prefer the downloaded markdown when they disagree.
