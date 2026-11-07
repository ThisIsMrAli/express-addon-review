import test from "node:test";
import assert from "node:assert/strict";
import { findingsFor, idsFor, manifest } from "./helpers.mjs";

// Each case below came from scanning real add-ons: a rule that fired when it should not have,
// or stayed silent when a reviewer would have objected. A wrong finding is worse than a missing
// one, because "fix everything" edits code that was fine.

test("a font called Source Sans Pro is not a Pro plan, but Upgrade to Pro is", () => {
  const fonts = idsFor({ "src/fonts.ts": 'export const fonts = [["Source Code Pro", "M"], ["Maven Pro", "S"], ["Be Vietnam Pro", "S"]];\n' });
  assert.equal(fonts.includes("pro-plan"), false);
  assert.equal(idsFor({ "src/Cta.tsx": 'export const Cta = () => <button>Upgrade to Pro</button>;\n' }).includes("pro-plan"), true);
  assert.equal(idsFor({ "src/Cta.tsx": 'export const label = "Go Pro";\n' }).includes("pro-plan"), true);
  assert.equal(idsFor({ "src/Cta.tsx": 'export const label = "Pro";\n' }).includes("pro-plan"), true);
  assert.equal(idsFor({ "src/Cta.tsx": 'export const label = "Pro Plan";\n' }).includes("pro-plan"), false);
});

test("developer notes in .md files are not marketplace copy", () => {
  const ids = idsFor({
    "STATUS.md": "Ready as an Adobe Express Add-on. Premium crown icon. Express sync, plugin notes.\n",
    "docs/NOTES.md": "Use Pro features in the addon.\n"
  });
  for (const id of ["offering-name-order", "name-adobe-express", "spelling-add-on", "crown-icon", "premium-word", "pro-plan"]) {
    assert.equal(ids.includes(id), false, `${id} fired on a .md file`);
  }
});

test("a comment that mentions confirm() is not a dialog, and a method named confirm is not window.confirm", () => {
  assert.equal(idsFor({ "src/a.tsx": "/** Adobe iframes block `confirm()` unless the sandbox allows modals. */\nexport const a = 1;\n" }).includes("modal-interrupt"), false);
  assert.equal(idsFor({ "src/a.tsx": "// alert( is not used here\nexport const a = dialog.confirm('x');\n" }).includes("modal-interrupt"), false);
  assert.equal(idsFor({ "src/a.tsx": "export function save() { alert('Saved'); }\n" }).includes("modal-interrupt"), true);
  assert.equal(idsFor({ "src/a.tsx": "export function save() { window.confirm('Sure?'); }\n" }).includes("modal-interrupt"), true);
});

test("sign-out in another file satisfies the log out rule", () => {
  const gate = "export const Gate = () => { const { signIn } = useAuth(); return null; };\n";
  assert.equal(idsFor({ "src/gate.tsx": gate, "src/menu.tsx": "export const Menu = () => { const { signOut } = useAuth(); return null; };\n" }).includes("logout-missing"), false);
  const alone = findingsFor({ "src/gate.tsx": gate, "src/other.tsx": "export const x = 1;\n" }).filter((item) => item.id === "logout-missing");
  assert.equal(alone.length, 1, "one finding for the project, not one per file");
  assert.equal(alone[0].file, "src/gate.tsx");
  assert.equal(idsFor({ "src/a.ts": "// signIn handled by the host\nexport const a = 1;\n" }).includes("logout-missing"), false, "a comment is not a sign in");
});

test("only the SDK's OAuth needs a POPUP_BLOCKED message", () => {
  assert.equal(idsFor({ "src/pdf.ts": "/** Uses OAuth: exchange client_id for a token. */\nexport const a = 1;\n" }).includes("popup-blocked"), false);
  assert.equal(idsFor({ "src/auth.ts": "export const go = () => addOnUISdk.app.oauth.authorize({});\n" }).includes("popup-blocked"), true);
  assert.equal(idsFor({ "src/auth.ts": "export const go = () => addOnUISdk.app.oauth.authorize({});\n", "src/msg.ts": "export const m = (c) => c === 'POPUP_BLOCKED';\n" }).includes("popup-blocked"), false);
});

test("a manifest key named renditionPreview is not a rendition without progress", () => {
  assert.equal(idsFor({ "manifest.json": { ...manifest, renditionPreview: true } }).includes("rendition-progress"), false);
  assert.equal(idsFor({ "src/r.ts": "export const go = () => addOnUISdk.app.document.createRenditions({});\n" }).includes("rendition-progress"), true);
  assert.equal(idsFor({ "src/r.ts": "export const go = () => addOnUISdk.app.document.createRenditions({});\n", "src/ui.tsx": "export const Ui = () => <progress />;\n" }).includes("rendition-progress"), false);
});

test("the export keyword is not an export, and Cancel or download in another file counts", () => {
  const encoder = "export async function makeGif(frames) {\n  const blob = await encode(frames, 'gif');\n  return blob;\n}\n";
  const ids = idsFor({ "src/encoder.ts": encoder });
  assert.equal(ids.includes("export-without-cancel"), true);
  assert.equal(ids.includes("export-without-download"), true);
  const finding = findingsFor({ "src/encoder.ts": encoder }).find((item) => item.id === "export-without-cancel");
  assert.equal(finding.line, 2, "the line is the encode, not the word export");
  const elsewhere = idsFor({ "src/encoder.ts": encoder, "src/ui.tsx": "export const Ui = () => <button onClick={cancel}>Cancel</button>;\nexport const dl = (b) => saveAs(b);\n" });
  assert.equal(elsewhere.includes("export-without-cancel"), false);
  assert.equal(elsewhere.includes("export-without-download"), false);
  assert.equal(idsFor({ "src/Preview.tsx": "export function Preview() { return <div />; }\nexport interface Options {}\n" }).includes("export-without-cancel"), false);
});

test("a field that validates itself does not need min and max", () => {
  const field = (attrs) => `export const F = () => <input ${attrs} />;\n`;
  assert.equal(idsFor({ "src/F.tsx": field('type="number" value={n} onChange={set}') }).includes("input-bounds"), true);
  assert.equal(idsFor({ "src/F.tsx": field('type="number" min={1} max={100}') }).includes("input-bounds"), false);
  assert.equal(idsFor({ "src/F.tsx": field('type="number" aria-invalid={bad ? true : undefined}') }).includes("input-bounds"), false);
  assert.equal(idsFor({ "src/F.tsx": field('aria-label="Custom size" aria-invalid={bad}') }).includes("unbounded-number"), false);
  assert.equal(idsFor({ "src/F.tsx": field('aria-label="Custom size"') }).includes("unbounded-number"), true);
});

test("one number field is one finding, not an Adobe finding and a review pattern on the same line", () => {
  const found = findingsFor({ "src/F.tsx": 'export const F = () => <input type="number" />;\n' }).filter((item) => ["input-bounds", "unbounded-number"].includes(item.id));
  assert.deepEqual(found.map((item) => item.id), ["input-bounds"]);
});

test("copy inside Vue and Svelte templates is checked, not only HTML and TSX", () => {
  assert.equal(idsFor({ "src/App.vue": "<template><p>Open Express to start</p></template>\n" }).includes("name-adobe-express"), true);
  assert.equal(idsFor({ "src/App.svelte": "<h1>Make it in Express</h1>\n" }).includes("name-adobe-express"), true);
  assert.equal(idsFor({ "src/App.vue": "<template><img src='a.png'></template>\n" }).includes("image-alt"), true);
  assert.equal(idsFor({ "src/App.svelte": "<img {src} {alt}>\n" }).includes("image-alt"), false);
  assert.equal(idsFor({ "src/util.mjs": "export const t = 'a plugin for Express';\n" }).includes("spelling-add-on"), true);
});

test("a11y checks read JSX across lines, not only one-line HTML", () => {
  const img = (attrs) => `export const I = () => (\n  <img\n    src={url}\n    ${attrs}\n  />\n);\n`;
  assert.equal(idsFor({ "src/I.tsx": img("className='x'") }).includes("image-alt"), true);
  assert.equal(idsFor({ "src/I.tsx": img("alt='Logo'") }).includes("image-alt"), false);
  assert.equal(idsFor({ "src/I.tsx": img('alt=""') }).includes("image-alt"), false);
  assert.equal(idsFor({ "src/I.tsx": img("{...rest}") }).includes("image-alt"), false, "a spread may carry alt");
  assert.equal(idsFor({ "src/I.tsx": img('aria-hidden="true"') }).includes("image-alt"), false);
  assert.equal(findingsFor({ "src/I.tsx": img("className='x'") }).find((item) => item.id === "image-alt").line, 2, "the line of the tag, not the closing line");
});

test("an arrow function inside a tag does not end the tag early", () => {
  const tsx = "export const F = () => (\n  <input onChange={(e) => set(e.target.value)} type=\"number\" min={1} max={9} aria-label=\"Count\" />\n);\n";
  const ids = idsFor({ "src/F.tsx": tsx });
  assert.equal(ids.includes("input-bounds"), false);
  assert.equal(ids.includes("field-label"), false);
});

test("form fields need a name, from a label prop, aria-label, or a label element", () => {
  const ids = (body) => idsFor({ "src/F.tsx": `export const F = () => (${body});\n` });
  assert.equal(ids("<Textfield value={v} />").includes("field-label"), true);
  assert.equal(ids("<SearchField id='s' value={q} />").includes("field-label"), true);
  assert.equal(ids("<textarea value={v} placeholder='Say something' />").includes("field-label"), true);
  assert.equal(ids("<Textfield label='Name' />").includes("field-label"), false);
  assert.equal(ids("<SearchField aria-label='Search' />").includes("field-label"), false);
  assert.equal(ids("<><label htmlFor='a'>A</label><input id='a' /></>").includes("field-label"), false);
  assert.equal(ids("<input type='hidden' value='x' />").includes("field-label"), false);
  assert.equal(ids("<Switch><Route /></Switch>").includes("field-label"), false, "a router Switch is not a form control");
});

test("a button needs a name, and text inside a nested element counts", () => {
  const ids = (body) => idsFor({ "src/B.tsx": `export const B = () => (${body});\n` });
  assert.equal(ids("<button onClick={close}><X size={16} /></button>").includes("button-name"), true);
  assert.equal(ids("<button role='switch' aria-checked={on}><span className='knob' /></button>").includes("button-name"), true);
  assert.equal(ids("<ActionButton onPress={go}><Icon /></ActionButton>").includes("button-name"), true);
  assert.equal(ids("<button onClick={close} aria-label='Close'><X /></button>").includes("button-name"), false);
  assert.equal(ids("<button><span className='row'><b>Save</b></span></button>").includes("button-name"), false);
  assert.equal(ids("<Button onPress={go}>{label}</Button>").includes("button-name"), false);
  assert.equal(ids("<ActionButton label='Zoom' />").includes("button-name"), false);
  assert.equal(ids("<button title='Undo'><Undo /></button>").includes("button-name"), false);
});

test("text input with no validation anywhere in the project gets one finding", () => {
  const ids = idsFor({ "src/F.tsx": "export const F = () => <Textfield label='Link' value={v} />;\n" });
  assert.equal(ids.includes("input-validation"), true);
  assert.equal(idsFor({ "src/F.tsx": "export const F = () => <Textfield label='Link' value={v} />;\n", "src/v.ts": "export const isInvalid = (v) => !v.startsWith('https');\n" }).includes("input-validation"), false);
});

test("generative AI disclaimers and cancel paths may live in another file", () => {
  assert.equal(idsFor({ "src/ai.ts": "export const call = () => fetch('https://api.openai.com/v1/images/generations');\n" }).includes("genai-disclaimer"), true);
  assert.equal(idsFor({ "src/ai.ts": "export const call = () => fetch('https://api.openai.com/v1/images/generations');\n", "src/note.tsx": "export const N = () => <p>Generated content may be inaccurate.</p>;\n" }).includes("genai-disclaimer"), false);
  const long = "export const run = async () => { const c = new MediaRecorder(s); return fetch('/x'); };\n";
  assert.equal(idsFor({ "src/run.ts": long }).includes("cancel-missing"), true);
  assert.equal(idsFor({ "src/run.ts": long, "src/ui.tsx": "export const U = () => <button>Cancel</button>;\n" }).includes("cancel-missing"), false);
});

test("text inside JSX is copy, even with no quote on the line", () => {
  const ids = (body) => idsFor({ "src/A.tsx": `export const A = () => (\n${body}\n);\n` });
  assert.equal(ids("<p>Open Express to start</p>").includes("name-adobe-express"), true);
  assert.equal(ids("<button>Save addon</button>").includes("spelling-add-on"), true);
  assert.equal(ids("<h1>Premium</h1>").includes("premium-word"), true);
  assert.equal(ids("<div>\n  Open Express to start\n</div>").includes("name-adobe-express"), true, "text on its own line");
  assert.equal(ids("<p>Open Adobe Express to start</p>").includes("name-adobe-express"), false);
  assert.equal(ids("<p className='addon'>Hello</p>").includes("spelling-add-on"), false, "a class name is not copy");
  assert.equal(idsFor({ "src/util.ts": "import { Express } from 'x';\nexport const e = Express;\n" }).includes("name-adobe-express"), false, "an identifier is not copy");
});

test("the brand order rule needs a name in front, and a console message is not copy", () => {
  const ids = (text) => idsFor({ "src/A.tsx": `export const t = ${JSON.stringify(text)};\n` });
  assert.equal(ids("Zyra Adobe Express add-on").includes("offering-name-order"), true);
  assert.equal(ids("Auto Icon Adobe Express Add-on").includes("offering-name-order"), true);
  assert.equal(ids("Run inside the Adobe Express add-on to insert on the page.").includes("offering-name-order"), false);
  assert.equal(ids("Zyra add-on for Adobe Express").includes("offering-name-order"), false);
  assert.equal(ids("Adobe Express add-on").includes("offering-name-order"), false, "at the start there is no name in front");
  assert.equal(ids("ready as an Adobe Express add-on").includes("offering-name-order"), false);
  assert.equal(idsFor({ "src/log.ts": "console.warn('Express addImage failed', e);\n" }).includes("name-adobe-express"), false);
  assert.equal(idsFor({ "src/log.ts": "toast.info('Express could not add it');\n" }).includes("name-adobe-express"), true);
});

// A review has to finish on a messy folder. One bad file is not a reason to stop.

test("a file the scanner cannot read, a dangling zip link, and a huge data file do not stop the scan", { skip: process.platform === "win32" || process.getuid?.() === 0 }, async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { project, docs } = await import("./helpers.mjs");
  const { scanAddon } = await import("../.claude/skills/express-addon-review/scripts/lib/scan.mjs");
  const dir = project({ "src/App.tsx": 'export const App = () => <button>Add to Express</button>;\n', "data.json": `{"x":"${"a".repeat(3 * 1024 * 1024)}"}` });
  fs.writeFileSync(path.join(dir, "secret.json"), "{}");
  fs.chmodSync(path.join(dir, "secret.json"), 0o000);
  fs.mkdirSync(path.join(dir, "locked"));
  fs.writeFileSync(path.join(dir, "locked", "a.js"), "x");
  fs.chmodSync(path.join(dir, "locked"), 0o000);
  fs.symlinkSync(path.join(dir, "missing.zip"), path.join(dir, "latest.zip"));
  try {
    const result = scanAddon(dir, { docs: docs() });
    assert.ok(result.findings.some((finding) => finding.file.endsWith("App.tsx")), "the readable files were still scanned");
  } finally {
    fs.chmodSync(path.join(dir, "locked"), 0o755);
  }
});

test("every file path in a finding uses forward slashes", () => {
  const found = findingsFor({ "src/deep/Panel.tsx": 'export const x = () => <button>Add to Express</button>;\n' });
  assert.ok(found.length > 0);
  for (const finding of found) assert.equal(finding.file.includes("\\"), false, finding.file);
});
