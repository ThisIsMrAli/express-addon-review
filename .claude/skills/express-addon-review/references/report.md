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

`source.kind` is `adobe`, `review-pattern`, or `tool`. Adobe findings include the page URL. Review patterns do not.

`skipped` lists Adobe checks whose evidence sentence was not in the fresh download. Do not apply those checks from memory.

`ok` is false when any finding has severity `error`.

The markdown groups errors, warnings, review patterns, skipped checks, and the list a person still has to do.
