import { attrValue, lineAt, MARKUP_EXT, openTags } from "./source.mjs";

/**
 * Checks that read only the code: fonts, controls, dead handlers, and SDK
 * names. They need no browser, so they run in the first scan and the person
 * fixing the add-on gets them before the slow panel pass starts.
 *
 * Every check is general. None of them names a project, a component, or a
 * string that only one add-on uses.
 */

const VISUAL = "src/pages/guides/build/design/ux-guidelines/visual-elements.md";
const IMPLEMENTATION = "src/pages/guides/build/design/implementation-guide.md";
const BLOG = "extra/rejections-blog.txt";

export const UI_CHECKS = [
  { id: "font-not-adobe-clean", severity: "warn", sourceKey: VISUAL, evidence: "Spectrum is based on the Adobe Clean and Adobe Clean Han typefaces", run: checkFonts },
  { id: "control-not-spectrum", severity: "warn", sourceKey: VISUAL, evidence: "Foundational components should use the Spectrum for Adobe Express theme whenever possible", run: checkControls },
  { id: "spectrum-not-express", severity: "warn", sourceKey: IMPLEMENTATION, evidence: "Use the Express theme with your chosen Spectrum implementation", run: checkExpressTheme },
  { id: "handler-does-nothing", severity: "error", sourceKey: BLOG, evidence: "fail due to basic functional issues", run: checkDeadHandlers },
  { id: "sdk-method-unknown", severity: "error", sourceKey: BLOG, evidence: "fail due to basic functional issues", run: checkSdkNames }
];

function styleFiles(ctx) {
  return ctx.files.filter((file) => /\.(css|html?|jsx?|tsx?|mjs|cjs|mts|cts|vue|svelte)$/i.test(file.rel));
}

function markup(ctx) {
  return ctx.files.filter((file) => /\.(html?|jsx|tsx|vue|svelte)$/i.test(file.rel));
}

// ---------------------------------------------------------------- fonts

const NAMED_OK = /^(adobe[- ]clean(?: han)?|adobe[- ]clean[- ]serif|inherit|initial|unset|revert|revert-layer)$/;
const SYSTEM_STACK = /^(system-ui|ui-sans-serif|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica(?: neue)?|arial|sans-serif|noto sans|ubuntu|cantarell|oxygen|fira sans|droid sans|source sans(?: pro| 3)?)$/;
const CODE_FONT = /^(monospace|ui-monospace|menlo|monaco|consolas|courier(?: new)?|sfmono-regular|sf mono|source code pro|fira code|jetbrains mono|liberation mono|dejavu sans mono)$/;

/** The families of one declaration, lower case, without quotes. */
function families(value) {
  return value
    .replace(/!important/i, "")
    .split(",")
    .map((part) => part.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase())
    .filter(Boolean);
}

/** A named typeface that is not Adobe Clean, a system stack, or a code font; or a decorative generic family. */
function odd(list) {
  if (!list.length) return false;
  if (list.some((name) => NAMED_OK.test(name) || name.startsWith("var(") || /\$\{/.test(name))) return false;
  if (list.some((name) => /^(serif|cursive|fantasy)$/.test(name))) return true;
  return list.some((name) => !SYSTEM_STACK.test(name) && !CODE_FONT.test(name) && !/icon|symbol|emoji/.test(name));
}

function checkFonts(ctx) {
  for (const file of styleFiles(ctx)) {
    let reported = 0;
    const patterns = [/font-family\s*:\s*([^;}\n]+)/gi, /\bfontFamily\s*:\s*["'`]([^"'`\n]+)["'`]/g];
    for (const pattern of patterns) {
      for (const match of file.code.matchAll(pattern)) {
        if (reported >= 3) break;
        const before = file.code.slice(Math.max(0, match.index - 160), match.index);
        if (/@font-face\s*\{[^}]*$/i.test(before)) continue;
        const list = families(match[1]);
        if (!odd(list)) continue;
        const forced = /!important/i.test(match[1]);
        reported += 1;
        ctx.add(
          file.rel,
          lineAt(file.code, match.index),
          `The fresh visual-elements page says Spectrum is based on Adobe Clean, and the fonts page says Express injects it into every add-on. This sets "${list[0]}"${forced ? " with !important, so the Spectrum theme cannot apply its font" : ""}.`,
          'Remove the declaration so Adobe Clean applies, or write font-family: var(--spectrum-sans-font-family-stack), adobe-clean, sans-serif. Keep a custom font only for a logo or a code sample.'
        );
      }
    }
  }
}

// ------------------------------------------------------------- controls

const NATIVE = ["button", "select", "textarea", "input"];
const NATIVE_INPUT = /^(text|search|number|range|checkbox|radio|email|password|url|tel|color|date|time)$/i;

function checkControls(ctx) {
  for (const file of markup(ctx)) {
    const hits = [];
    for (const tag of openTags(file.code, NATIVE)) {
      if (tag.name === "input" && !NATIVE_INPUT.test(attrValue(tag.attrs, "type") || "text")) continue;
      if (/\b(?:spectrum|sp-|swc)[\w-]*/i.test(tag.attrs)) continue;
      if (/\bis\s*=\s*["']sp-/i.test(tag.attrs)) continue;
      hits.push(tag);
    }
    if (!hits.length) continue;
    const names = [...new Set(hits.map((tag) => (tag.name === "input" ? `input ${attrValue(tag.attrs, "type") || "text"}` : tag.name)))];
    ctx.add(
      file.rel,
      hits[0].line,
      `The fresh visual-elements page says foundational components should use the Spectrum for Adobe Express theme. This file draws ${hits.length} plain control${hits.length === 1 ? "" : "s"} (${names.join(", ")}), which do not get the Express look.`,
      "Use Spectrum controls with the Express theme: sp-button, sp-action-button, sp-slider, sp-textfield, sp-picker, sp-checkbox (or the swc-react versions)."
    );
  }
}

// ---------------------------------------------------------- the theme

const SPECTRUM_USE = /@spectrum-web-components\/|@swc-react\/|@adobe\/react-spectrum|@react-spectrum\/|<sp-(?!theme\b)[a-z]/;
const EXPRESS_THEME = /system\s*[=:]\s*["']express["']|theme\/express\/|theme-express|spectrum-web-components\/theme\/express/;

function checkExpressTheme(ctx) {
  const uses = ctx.files.find((file) => MARKUP_EXT.test(file.rel) && SPECTRUM_USE.test(file.code)) || ctx.files.find((file) => SPECTRUM_USE.test(file.code));
  if (!uses) return;
  if (ctx.files.some((file) => EXPRESS_THEME.test(file.code))) return;
  const theme = ctx.files.find((file) => /<sp-theme\b|<Theme\b|<Provider\b/.test(file.code));
  const file = theme || uses;
  const hit = file.code.search(/<sp-theme\b|<Theme\b|<Provider\b/);
  ctx.add(
    file.rel,
    hit < 0 ? 1 : lineAt(file.code, hit),
    "The fresh implementation guide says to use the Express theme with the Spectrum library you chose. This project uses Spectrum and never selects the express system.",
    'Wrap the app in <sp-theme system="express" color="light" scale="medium"> (swc-react: <Theme system="express">) and keep color in step with addOnUISdk.app.ui.theme.'
  );
}

// ------------------------------------------------------ dead handlers

const EMPTY_BODY = String.raw`\{\s*(?:console\.\w+\([^)]*\)\s*;?\s*)?\}`;

function checkDeadHandlers(ctx) {
  const files = ctx.files.filter((file) => /\.(html?|jsx?|tsx?|mjs|cjs|mts|cts|vue|svelte)$/i.test(file.rel));
  const wired = (name) => {
    const escaped = name.replace(/\$/g, "\\$");
    const pattern = new RegExp(`\\bon[A-Za-z]+\\s*=\\s*\\{?\\s*${escaped}\\s*\\}?|addEventListener\\(\\s*["'][a-z]+["']\\s*,\\s*${escaped}\\b|\\bon(?:click|change|input)\\s*=\\s*${escaped}\\b`);
    return files.some((file) => pattern.test(file.code));
  };
  for (const file of files) {
    for (const match of file.code.matchAll(new RegExp(String.raw`\bon(?!Error|Load|Focus|Blur|Mouse|Pointer|Key|Scroll|Animation|Transition)[A-Z]\w*\s*=\s*\{\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>\s*(?:${EMPTY_BODY}|undefined|null|void 0)\s*\}`, "g"))) {
      add(ctx, file, match.index, match[0].match(/^on[A-Z]\w*/)[0], null);
    }
    const named = [
      new RegExp(String.raw`(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:useCallback\(\s*)?(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=>\s*${EMPTY_BODY}`, "g"),
      new RegExp(String.raw`function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*${EMPTY_BODY}`, "g")
    ];
    for (const pattern of named) {
      for (const match of file.code.matchAll(pattern)) {
        const name = match[1];
        if (/^(noop|_noop|empty|nothing)$/i.test(name) || !wired(name)) continue;
        add(ctx, file, match.index, null, name);
      }
    }
  }
}

function add(ctx, file, index, prop, name) {
  const what = name ? `\`${name}\`` : `The \`${prop}\` handler`;
  ctx.add(
    file.rel,
    lineAt(file.code, index),
    `The fresh rejection guide says most rejected add-ons fail on basic functional issues. ${what} is wired to a control but its body does nothing, so pressing the control has no effect.`,
    "Implement the action the control promises, or remove the control. A control that does nothing is a rejection reason."
  );
}

// -------------------------------------------------------- SDK method names

const CHAIN = /\b(?:addOnUISdk|addonSdk|addOnSdk|sdk)\.((?:app|instance)(?:\.[a-z]\w*)*)\.([A-Za-z_]\w*)/g;
const USE = /\b[A-Za-z_$][\w$]*\.((?:app|instance)(?:\.[a-z]\w*)*)\.([A-Za-z_$][\w$]*)\s*\(/g;

function knownMembers(docs) {
  const known = new Map();
  for (const [key, text] of Object.entries(docs || {})) {
    if (!key.startsWith("src/pages/")) continue;
    for (const match of text.matchAll(CHAIN)) {
      if (!known.has(match[1])) known.set(match[1], new Set());
      known.get(match[1]).add(match[2]);
    }
  }
  return known;
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = next;
    }
  }
  return row[b.length];
}

/**
 * A name that is not in the docs and sits one or two edits from one that is
 * ("addImag" for "addImage") is a typo. A name that is merely missing from the
 * docs is left alone, because the docs do not list every member.
 */
function checkSdkNames(ctx) {
  const known = knownMembers(ctx.docs);
  if (!known.size) return;
  for (const file of ctx.files) {
    if (!MARKUP_EXT.test(file.rel) || /\.html?$/i.test(file.rel)) continue;
    for (const match of file.code.matchAll(USE)) {
      const members = known.get(match[1]);
      if (!members || members.size < 2 || members.has(match[2]) || match[2].length < 5) continue;
      const near = [...members].filter((name) => name.length >= 5 && distance(name.toLowerCase(), match[2].toLowerCase()) <= 2);
      if (near.length !== 1) continue;
      ctx.add(
        file.rel,
        lineAt(file.code, match.index),
        `${match[1]}.${match[2]} is not an Add-on SDK member in the fresh docs. It is one or two letters from ${near[0]}, so the call fails when a person uses the feature.`,
        `Use ${near[0]}.`
      );
    }
  }
}
