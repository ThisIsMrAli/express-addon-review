# Review patterns

These checks come from repeated Adobe Express marketplace review letters. They are not sentences on an Adobe page. The report labels them `review-pattern`. Do not cite an Adobe URL for them.

An add-on-specific bug stays out. A CORS failure, email that only sends to the developer, or two buttons that export the same file are not general rules.

- `name-looks-official`. The add-on name or an `h1` / `title` starts with "Express" or "Adobe", other than the words "Adobe Express". Reviewers rejected "Express Whiteboard". Put the product name first, then "for Adobe Express".
- `paid-state-conflict`. The same file says the user is unlocked or licensed and also shows a crown, a lock icon, or "Premium". Reviewers rejected crowns that stayed after a license key worked.
- `third-party-brand`. A quoted UI string or an image name includes Figma, Canva, Notion, or Framer without a permission note. Comments are ignored. Reviewers rejected a Figma mark that implied a relationship. Those four names are only a source hint. During the browser pass, look for any third-party logo or wordmark that implies a partnership, and ask whether they have written permission.
- `export-without-cancel`. A file that exports or encodes GIF, video, or MP4 has no cancel or abort path. Reviewers rejected a running export with no Cancel button.
- `export-without-download`. That same export never downloads, saves, or creates an object URL. Reviewers rejected a finished encode with no file.
- `unbounded-number`. A number or size field has no `min` and no `max`. Reviewers rejected a size of `4.11e+28`.
- `placeholder-selectable`. A `div`, `p`, or `span` is marked as a placeholder or hint and the page does not set `user-select: none`. Reviewers rejected hint text that could be copied.
