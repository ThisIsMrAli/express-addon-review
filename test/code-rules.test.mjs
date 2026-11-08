import assert from "node:assert/strict";
import test from "node:test";
import { docs, findingsFor, idsFor, project } from "./helpers.mjs";
import { scanAddon } from "../.claude/skills/express-addon-review/scripts/lib/scan.mjs";

const has = (files, id) => idsFor(files).includes(id);

test("a font that is not Adobe Clean is flagged, and !important is named", () => {
  const found = findingsFor({ "src/app.css": 'body { font-family: "Comic Sans MS", cursive !important; }' }).filter((f) => f.id === "font-not-adobe-clean");
  assert.equal(found.length, 1);
  assert.equal(found[0].file, "src/app.css");
  assert.match(found[0].message, /!important/);
});

test("Adobe Clean, a theme variable, a system stack, and a code font are not flagged", () => {
  for (const css of [
    "body { font-family: adobe-clean, sans-serif; }",
    'body { font-family: "Adobe Clean", "Source Sans Pro", sans-serif; }',
    "body { font-family: var(--spectrum-sans-font-family-stack); }",
    "body { font-family: system-ui, -apple-system, sans-serif; }",
    "code { font-family: ui-monospace, Menlo, monospace; }",
    "@font-face { font-family: 'Brand'; src: url(brand.woff2); }",
    "body { font-family: inherit; }"
  ]) assert.equal(has({ "a.css": css }, "font-not-adobe-clean"), false, css);
});

test("a font set from script is read too", () => {
  assert.ok(has({ "src/Card.tsx": 'export const s = { fontFamily: "Georgia, serif" };' }, "font-not-adobe-clean"));
});

test("plain controls are flagged once per file with a count", () => {
  const found = findingsFor({
    "src/Panel.tsx": "export const P = () => (<div><button onClick={go}>Go</button><input type=\"range\" /><input type=\"file\" hidden /></div>);"
  }).filter((f) => f.id === "control-not-spectrum");
  assert.equal(found.length, 1);
  assert.match(found[0].message, /2 plain controls/);
});

test("Spectrum controls and Spectrum-classed elements are not flagged as plain", () => {
  assert.equal(has({ "src/P.tsx": "export const P = () => <sp-button>Go</sp-button>;" }, "control-not-spectrum"), false);
  assert.equal(has({ "src/P.tsx": 'export const P = () => <button className="spectrum-Button">Go</button>;' }, "control-not-spectrum"), false);
});

test("Spectrum without the express system is flagged, with it is not", () => {
  const without = { "index.html": "<sp-theme><sp-button>Go</sp-button></sp-theme>" };
  assert.ok(has(without, "spectrum-not-express"));
  assert.equal(has({ "index.html": '<sp-theme system="express"><sp-button>Go</sp-button></sp-theme>' }, "spectrum-not-express"), false);
  assert.equal(has({ "index.html": "<body>No Spectrum at all</body>" }, "spectrum-not-express"), false);
});

test("a handler with an empty body that is wired to a control is an error", () => {
  const files = {
    "src/Shuffle.tsx": "export const Shuffle = ({ onClick }) => <sp-button onClick={onClick}>Shuffle</sp-button>;",
    "src/Blob.tsx": "const handleShuffleClick = () => {};\nexport const B = () => <Shuffle onClick={handleShuffleClick} />;"
  };
  const found = findingsFor(files).find((f) => f.id === "handler-does-nothing");
  assert.ok(found);
  assert.equal(found.severity, "error");
  assert.equal(found.file, "src/Blob.tsx");
  assert.match(found.message, /handleShuffleClick/);
});

test("inline empty and console-only handlers are errors; real ones and unused empties are not", () => {
  assert.ok(has({ "src/A.tsx": "export const A = () => <sp-button onClick={() => {}}>Go</sp-button>;" }, "handler-does-nothing"));
  assert.ok(has({ "src/A.tsx": "const go = () => { console.log('go'); };\nexport const A = () => <sp-button onClick={go}>Go</sp-button>;" }, "handler-does-nothing"));
  assert.equal(has({ "src/A.tsx": "const go = () => { save(); };\nexport const A = () => <sp-button onClick={go}>Go</sp-button>;" }, "handler-does-nothing"), false);
  assert.equal(has({ "src/A.tsx": "const unused = () => {};\nexport const A = () => <sp-button>Go</sp-button>;" }, "handler-does-nothing"), false);
  assert.equal(has({ "src/A.tsx": "export const A = () => <img onError={() => {}} alt=\"\" />;" }, "handler-does-nothing"), false);
});

const sdkDocs = {
  ...docs(),
  "src/pages/guides/sdk.md": [
    "addOnUISdk.app.document.addImage(blob);",
    "addOnUISdk.app.document.addVideo(blob);",
    "addOnUISdk.app.document.createRenditions(options);"
  ].join("\n")
};

test("an SDK call one letter from a documented one is an error that names the right one", () => {
  const dir = project({ "src/add.ts": "async function add(v) { await addonSdk.app.document.addImag(v); }" });
  const found = scanAddon(dir, { docs: sdkDocs }).findings.find((f) => f.id === "sdk-method-unknown");
  assert.ok(found);
  assert.equal(found.severity, "error");
  assert.match(found.suggestion, /addImage/);
});

test("a documented SDK call and one the docs simply do not list are left alone", () => {
  const ok = project({ "src/add.ts": "addonSdk.app.document.addImage(v); addonSdk.app.document.somethingNew(v);" });
  assert.equal(scanAddon(ok, { docs: sdkDocs }).findings.some((f) => f.id === "sdk-method-unknown"), false);
});

test("an Adobe logo file in any image format is flagged", () => {
  assert.ok(has({ "src/assets/adobe-logo.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"/>" }, "adobe-logo-file"));
  assert.equal(has({ "src/assets/designed-for-adobe-logo.svg": "<svg/>" }, "adobe-logo-file"), false);
});
