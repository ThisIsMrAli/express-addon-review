# Report

`scan.mjs` prints JSON. `review.mjs` writes `report.json`, `report.md`, and `views.json`.

Each finding:

```json
{
  "id": "crown-icon",
  "severity": "error",
  "file": "index.html",
  "line": 4,
  "message": "Why this failed",
  "suggestion": "The edit",
  "source": {
    "kind": "adobe",
    "url": "https://developer.adobe.com/express/add-ons/docs/guides/build/distribute/guidelines/monetization",
    "sourceKey": "src/pages/guides/build/distribute/guidelines/monetization.md"
  }
}
```

`source.kind` is `adobe`, `review-pattern`, or `tool`. Adobe findings include the page URL. Review patterns do not. A `tool` finding is something only this skill can see, such as an upload zip that is older than the source.

## The upload package

`review.mjs` looks for a `.zip` in the project root and checks it the way Adobe's upload does. It is the file the user is about to submit, so a mistake here is rejected before any reviewer opens the add-on.

- `package-root`. The zip has no `manifest.json` at its top level, or it is inside a folder.
- `package-size`. The zip is over 50 MB.
- `package-hidden`. The zip holds hidden files or folders, such as `.git`, `.env`, `.DS_Store`, or `__MACOSX`.
- `package-entry`. A file the manifest names, `main` or `documentSandbox`, is not in the zip.
- `package-stale`. The source changed after the zip was made, or the manifest version in the zip differs from the source. The user would submit the old build.

Pass `--zip path/to/upload.zip` to check a zip kept elsewhere. It can be repeated. The zip is read in memory and nothing is unpacked or written.

`skipped` lists Adobe checks whose evidence sentence was not in the fresh download. Do not apply those checks from memory.

`ok` is false when any finding has severity `error`.

The markdown groups errors, warnings, review patterns, skipped checks, and the list a person still has to do.
