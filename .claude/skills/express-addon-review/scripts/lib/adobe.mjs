import path from "node:path";
import { PACKAGE_LIMIT } from "./package.mjs";
import { BRAND_TEXT, publishedUrl } from "./sources.mjs";
import { attrValue, COPY_EXT, hasAttr, hasVisibleText, innerOf, MARKUP_EXT, openTags, OWN_VALIDATION } from "./source.mjs";

const UI = "src/pages/guides/build/distribute/guidelines/general/user-interface.md";
const MONETIZATION = "src/pages/guides/build/distribute/guidelines/monetization.md";
const FEATURES = "src/pages/guides/build/distribute/guidelines/general/features.md";
const USABILITY = "src/pages/guides/build/distribute/guidelines/general/usability.md";
const A11Y = "src/pages/guides/build/distribute/guidelines/general/accessibility.md";
const EDGE = "src/pages/guides/build/distribute/guidelines/general/edge-case.md";
const AUTH = "src/pages/guides/build/distribute/guidelines/general/auth.md";
const GENAI = "src/pages/guides/build/distribute/guidelines/genai/requirements.md";
const BRANDING = "src/pages/guides/build/design/ux-guidelines/branding-guidelines.md";
const PUBLIC = "src/pages/guides/build/distribute/public-dist.md";
const MANIFEST = "extra/manifest.txt";

export const ADOBE_RULES = [
  rule("manifest-version", "error", MANIFEST, "Version of the manifest schema", checkManifestVersion),
  rule("manifest-semver", "error", MANIFEST, "major.minor.patch", checkSemver),
  rule("manifest-app", "error", MANIFEST, "apiVersion", checkExpressApp),
  rule("experimental-apis", "error", MANIFEST, "needs to be removed during submission", checkExperimental),
  rule("entrypoint-missing", "error", MANIFEST, "At least one is required", checkEntries),
  rule("entrypoint-file", "error", MANIFEST, "Main file for this entry point", checkEntryFiles),
  rule("sandbox-file", "error", MANIFEST, "documentSandbox", checkSandbox),
  rule("name-adobe-express", "error", UI, 'Do not shorten it to "Express"', checkProductName),
  rule("spelling-add-on", "error", UI, 'NOT "addon" or "plugin"', checkSpelling),
  rule("stock-lowercase", "error", UI, 'lower case "s"', checkStock),
  rule("crown-icon", "error", MONETIZATION, "Don't use any crown icons", checkCrown),
  rule("lock-icon", "error", MONETIZATION, "Don't use a lock icon", checkLock),
  rule("premium-word", "error", MONETIZATION, 'Don\'t use "Premium" for your add-on\'s upgrade', checkPremium),
  rule("pro-plan", "warn", MONETIZATION, 'saying "Pro Plan"', checkPro),
  rule("modal-interrupt", "warn", UI, "rather than a dialog box", checkDialog),
  rule("theme-missing", "warn", UI, "functionally broken in dark theme", checkTheme),
  rule("cancel-missing", "warn", FEATURES, "allows the user to cancel the operation", checkCancel),
  rule("rendition-progress", "warn", FEATURES, "must provide some sort of progress indicator", checkRendition),
  rule("third-party-ads", "error", MONETIZATION, "must not contain any third-party advertising", checkAds),
  rule("genai-disclaimer", "warn", GENAI, "content generated may be inaccurate", checkGenAi),
  rule("image-alt", "warn", A11Y, "alternative text for images", checkAlt),
  rule("field-label", "warn", A11Y, "labels for form fields", checkLabels),
  rule("button-name", "warn", A11Y, "keyboard focus indicators", checkButtons),
  rule("listing-icon", "error", PUBLIC, "144x144", checkListingIcon),
  rule("listing-screenshot", "error", PUBLIC, "1360x800", checkListingShot),
  rule("input-bounds", "warn", EDGE, "empty inputs, long inputs", checkInputBounds),
  rule("logout-missing", "warn", AUTH, "Users must be able to logout", checkLogout),
  rule("popup-blocked", "warn", AUTH, "POPUP_BLOCKED", checkPopup),
  rule("input-validation", "warn", USABILITY, "validation for user inputs", checkValidation),
  rule("adobe-logo-file", "error", BRAND_TEXT, '"Designed for Adobe Express" badge', checkLogoFile),
  rule("offering-name-order", "error", BRAND_TEXT, "NOT this: [Your offering name] Adobe Express add-on", checkOfferingName),
  rule("package-root", "error", PUBLIC, "MANIFEST_NOT_FOUND_ERROR", checkPackageRoot),
  rule("package-size", "error", PUBLIC, "must not exceed 50 MB", checkPackageSize),
  rule("package-hidden", "error", PUBLIC, "Hidden files should not be present", checkPackageHidden),
  rule("package-entry", "error", PUBLIC, "production-ready built content", checkPackageEntry)
];

function rule(id, severity, sourceKey, evidence, run) {
  const url = sourceKey.startsWith("extra/")
    ? extraUrl(sourceKey)
    : publishedUrl(sourceKey);
  return { id, severity, sourceKey, evidence, url, run };
}

function extraUrl(sourceKey) {
  const urls = {
    "extra/manifest.txt": "https://developer.adobe.com/express/add-ons/docs/references/manifest/",
    "extra/premium-content.txt": "https://developer.adobe.com/express/add-ons/docs/guides/learn/how-to/premium-content",
    "extra/rejections-blog.txt": "https://blog.developer.adobe.com/en/publish/2026/05/how-to-get-your-adobe-express-add-on-approved-avoiding-the-most-common-rejections"
  };
  return urls[sourceKey] || "";
}

export function adobeActive(rule, docs) {
  const text = docs[rule.sourceKey];
  return Boolean(text && text.includes(rule.evidence));
}

function checkManifestVersion(ctx) {
  if (ctx.manifest.manifestVersion !== 2) {
    ctx.add("manifest.json", 1, "manifestVersion on the fresh manifest page is 2.", 'Set "manifestVersion": 2.');
  }
}

function checkSemver(ctx) {
  if (!/^\d+\.\d+\.\d+$/.test(ctx.manifest.version || "")) {
    ctx.add("manifest.json", 1, "version on the fresh manifest page is major.minor.patch.", "Set version to a value such as 1.0.0.");
  }
}

function checkExpressApp(ctx) {
  const apps = ctx.manifest.requirements?.apps || [];
  if (!apps.some((app) => app.name === "Express" && app.apiVersion === 1)) {
    ctx.add("manifest.json", 1, "requirements.apps on the fresh manifest page includes Express at apiVersion 1.", 'Add { "name": "Express", "apiVersion": 1 }.');
  }
}

function checkExperimental(ctx) {
  if (ctx.manifest.requirements?.experimentalApis === true) {
    ctx.add("manifest.json", 1, "experimentalApis is for development and the fresh manifest page says to remove it before submission.", "Delete requirements.experimentalApis before you submit.");
  }
}

function checkEntries(ctx) {
  if (!(ctx.manifest.entryPoints || []).length) {
    ctx.add("manifest.json", 1, "The fresh manifest page requires at least one entry point.", "Add a panel entry with type, id, and main.");
  }
}

function checkEntryFiles(ctx) {
  for (const entry of ctx.manifest.entryPoints || []) {
    if (entry.type !== "panel" || !entry.id || !entry.main) {
      ctx.add("manifest.json", 1, "Each entry point on the fresh manifest page needs type panel, an id, and main.", "Set type to panel and point main at a file in the project.");
    } else if (!ctx.exists(entry.main)) {
      ctx.add("manifest.json", 1, `Entry file ${entry.main} is not in the project.`, "Create that file or fix the main path.");
    }
  }
}

function checkSandbox(ctx) {
  for (const entry of ctx.manifest.entryPoints || []) {
    if (!entry.documentSandbox) continue;
    if (ctx.exists(entry.documentSandbox)) continue;
    const stem = String(entry.documentSandbox).replace(/\.[^.]+$/, "");
    const source = ["js", "ts", "tsx"].some((ext) => ctx.exists(`sandbox/${stem}.${ext}`) || ctx.exists(`${stem}.${ext}`));
    if (source) continue;
    ctx.add("manifest.json", 1, `documentSandbox file ${entry.documentSandbox} is missing.`, "Add the sandbox file or remove the key. A CLI project keeps the source in sandbox/ and the manifest names the built file.");
  }
}

function checkProductName(ctx) {
  eachCopyLine(ctx, (file, line, index) => {
    if (/(?<!Adobe )\bExpress\b/.test(line) && !/["'`]Express["'`]/.test(line)) {
      ctx.add(file.rel, index + 1, 'The fresh UI page says to use the full name "Adobe Express".', correctedCopy(line));
    }
  });
}

function checkSpelling(ctx) {
  eachCopyLine(ctx, (file, line, index) => {
    const copy = visibleCopy(line);
    if (!misspelledAddOn(copy)) return;
    ctx.add(file.rel, index + 1, 'The fresh UI page spells it "add-on", not "addon", "add on", "Add-On", or "plugin".', correctedCopy(copy));
  });
}

function visibleCopy(line) {
  return line
    .replace(/\bclassName\s*=\s*(?:\{[^}]*\}|"[^"]*"|'[^']*'|`[^`]*`)/g, " ")
    .replace(/\bclassList\.(?:add|remove|toggle|contains)\([^)]*\)/g, " ")
    .replace(/\bclass\s*=\s*["'][^"']*["']/g, " ")
    .replace(/\bid\s*=\s*["'][^"']*["']/g, " ");
}

function misspelledAddOn(line) {
  return /(?<![\w-])addon(?![\w-])/i.test(line)
    || /(?<![\w-])add on(?![\w-])/i.test(line)
    || /(?<![\w-])plugin(?![\w-])/i.test(line)
    || /(?<![\w-])Add-On(?![\w-])/.test(line);
}

function correctedCopy(line) {
  return line
    .replace(/(?<!Adobe )\bExpress\b/g, "Adobe Express")
    .replace(/(?<![\w-])addon(?![\w-])/ig, "add-on")
    .replace(/(?<![\w-])add on(?![\w-])/ig, "add-on")
    .replace(/(?<![\w-])plugin(?![\w-])/ig, "add-on")
    .replace(/(?<![\w-])Add-On(?![\w-])/g, "add-on");
}

function checkStock(ctx) {
  eachCopyLine(ctx, (file, line, index) => {
    if (/Adobe Stock/.test(line)) return;
    if (/\bStock (photos|assets|images|content)\b/.test(line)) {
      ctx.add(file.rel, index + 1, 'The fresh UI page uses a lowercase "stock" unless the words are Adobe Stock.', line.replace(/\bStock\b/, "stock"));
    }
  });
}

function checkCrown(ctx) {
  for (const file of codeFiles(ctx)) {
    file.codeLines.forEach((line, index) => {
      if (/\bnot\b[^.]{0,80}\bcrown\b/i.test(line)) return;
      if (/\bcrown\b/i.test(line)) {
        ctx.add(file.rel, index + 1, "The fresh monetization page says a crown icon is reserved for Adobe Express Premium and can cause a rejection.", "Remove the crown. Use the plus badge for a purchase and the paid checkmark only while a single item is unlocked.");
      }
    });
  }
}

function checkLock(ctx) {
  for (const file of codeFiles(ctx)) {
    file.codeLines.forEach((line, index) => {
      if (/(^|[^a-zA-Z])(lock[- ]icon|lockIcon|padlock)/i.test(line)) {
        ctx.add(file.rel, index + 1, "The fresh monetization page says not to use a lock icon, because it conflicts with lock layer.", "Replace the lock with the plus badge.");
      }
    });
  }
}

function checkPremium(ctx) {
  eachCopyLine(ctx, (file, line, index) => {
    if (/\bPremium\b/.test(line) && !/Adobe Express Premium|Premium Plan/.test(line)) {
      ctx.add(file.rel, index + 1, 'The fresh monetization page says not to use "Premium" for this add-on\'s own upgrade.', 'Use "upgrade", "subscribe", or "Plus". Keep "Premium" for the Adobe Express Premium plan.');
    }
  });
}

function checkPro(ctx) {
  eachCopyLine(ctx, (file, line, index) => {
    if (proUse(line)) {
      ctx.add(file.rel, index + 1, 'The fresh monetization page says to avoid "pro" unless the words are "Pro Plan". The same page also shows "Upgrade to Pro".', 'If this is a price, write "Pro Plan" or "Upgrade to Pro" so it is not a product grade.');
    }
  });
}

/** "Pro" as a plan or grade. A name such as "Source Sans Pro" is a font, not a plan. */
function proUse(line) {
  for (const match of line.matchAll(/\bPro\b/g)) {
    const before = line.slice(0, match.index);
    if (/^\s+Plan\b/.test(line.slice(match.index + 3))) continue;
    if (/\b(?:Go|Upgrade to|Get|Unlock|Buy|Try|Become|Switch to)\s+$/i.test(before)) return true;
    if (/\b[A-Z][A-Za-z0-9]*\s+$/.test(before)) continue;
    return true;
  }
  return false;
}

function checkDialog(ctx) {
  for (const file of codeFiles(ctx)) {
    const index = file.codeLines.findIndex((line) => /(?<![.\w])(?:window\.)?(?:alert|confirm)\s*\(/.test(line));
    if (index < 0) continue;
    const around = file.codeLines.slice(Math.max(0, index - 30), index + 1).join("\n");
    if (/function\s+preview|previewModal|get\(\s*["']preview["']\s*\)/.test(around)) continue;
    ctx.add(file.rel, index + 1, "The fresh UI page says to keep ordinary status in the panel instead of a dialog box.", "Replace alert or confirm with an in-panel message.");
  }
}

function checkTheme(ctx) {
  if (!ctx.files.some((file) => /\.html?$/i.test(file.rel))) return;
  const joined = ctx.files.map((file) => file.text).join("\n");
  if (!/theme|colorScheme|prefers-color-scheme|sp-theme|@spectrum-web-components/i.test(joined)) {
    ctx.add(ctx.entryHtml() || "index.html", 1, "The fresh UI page says submissions after August 31, 2026 are rejected when dark theme is unreadable. This project has no theme or Spectrum signal.", "Read the theme from the Express host and keep text and controls readable in light and dark.");
  }
}

const CANCEL = /AbortController|signal\s*:|\bcancel\b|\babort\b/i;

function checkCancel(ctx) {
  if (projectHas(ctx, CANCEL)) return;
  for (const file of codeFiles(ctx)) {
    if (!longOperation(file.code)) continue;
    const index = file.codeLines.findIndex((line) => /\bfetch\s*\(/.test(line));
    if (index < 0) continue;
    ctx.add(file.rel, index + 1, "The fresh features page says a long blocking operation should let the user cancel it.", "Keep a Cancel control and pass an AbortSignal to fetch.");
    return;
  }
}

function longOperation(code) {
  return /\bencode(?!URI)\w*|\b(rendition|ffmpeg|MediaRecorder)\b/i.test(code);
}

function checkRendition(ctx) {
  const hit = firstHit(ctx, /\bcreateRenditions?\b/);
  if (!hit || projectHas(ctx, /progress|spinner|loading/i)) return;
  ctx.add(hit.file, hit.line, "The fresh features page says a rendition must show progress.", "Show a progress indicator while the rendition is created.");
}

function checkAds(ctx) {
  const hit = firstHit(ctx, /(^|[^a-zA-Z])(googlesyndication|doubleclick|adsbygoogle)\b|facebook\.com\/tr/i);
  if (hit) ctx.add(hit.file, hit.line, "The fresh monetization page forbids third-party advertising in every add-on.", "Remove the ad script.");
}

function checkGenAi(ctx) {
  const hit = firstHit(ctx, /openai|firefly|stability\.ai|images\/generations|generative/i);
  if (!hit || projectHas(ctx, /inaccurate/i)) return;
  ctx.add(hit.file, hit.line, "The fresh generative AI requirements page says text or code must remind the user that the result may be inaccurate.", "Show that disclaimer next to the generated text or code.");
}

function checkAlt(ctx) {
  for (const file of markupFiles(ctx)) {
    for (const tag of openTags(file.code, ["img"])) {
      if (hasAttr(tag.attrs, ["alt"]) || /\b(?:role\s*=\s*["']presentation["']|aria-hidden\s*=\s*(?:["']true["']|\{\s*true\s*\}))/.test(tag.attrs)) continue;
      ctx.add(file.rel, tag.line, "The fresh accessibility page says images need alternative text.", 'Add an alt attribute. Use alt="" when the image is decorative.');
    }
  }
}

const FIELDS = ["input", "textarea", "select", "sp-textfield", "sp-number-field", "sp-picker", "sp-checkbox", "sp-slider", "sp-combobox", "Textfield", "TextField", "TextArea", "NumberField", "SearchField", "Picker", "Checkbox", "Slider", "ComboBox"];
const LABEL_ELEMENT = /<label\b|<Label\b|<FieldLabel\b|<sp-field-label\b|\bhtmlFor\s*=|\bfor\s*=\s*["']/;

function checkLabels(ctx) {
  for (const file of markupFiles(ctx)) {
    const labelled = LABEL_ELEMENT.test(file.code);
    for (const tag of openTags(file.code, FIELDS)) {
      if (tag.name === "input" && /^(hidden|submit|button|reset|image)$/i.test(attrValue(tag.attrs, "type") || "")) continue;
      if (labelled || hasAttr(tag.attrs, ["aria-label", "aria-labelledby", "label", "title"])) continue;
      ctx.add(file.rel, tag.line, "The fresh accessibility page says form fields need labels.", "Add a <label>, a label prop, or an aria-label.");
    }
  }
}

const BUTTONS = ["button", "sp-button", "sp-action-button", "Button", "ActionButton"];

function checkButtons(ctx) {
  for (const file of markupFiles(ctx)) {
    for (const tag of openTags(file.code, BUTTONS)) {
      if (hasAttr(tag.attrs, ["aria-label", "aria-labelledby", "title", "label"])) continue;
      if (hasVisibleText(innerOf(file.code, tag))) continue;
      ctx.add(file.rel, tag.line, "The fresh accessibility page expects controls to have a name a keyboard user can reach.", "Add visible text or an aria-label on the button.");
    }
  }
}

function checkListingIcon(ctx) {
  const icons = listingImages(ctx).filter((image) => /icon/i.test(image.rel) && !/publisher/i.test(image.rel));
  for (const image of icons) {
    if (!image.size || image.size.width !== 144 || image.size.height !== 144) {
      ctx.add(image.rel, 1, "The fresh public-distribution page requires a 144×144 PNG or JPG icon.", "Export the icon at 144×144.");
    }
  }
}

function checkListingShot(ctx) {
  const shots = listingImages(ctx).filter((image) => /(^|\/)thumbnails\//.test(image.rel) || /screenshot|shot|preview/i.test(image.rel));
  for (const image of shots) {
    if (!image.size || image.size.width !== 1360 || image.size.height !== 800) {
      ctx.add(image.rel, 1, "The fresh public-distribution page requires a 1360×800 JPEG or PNG screenshot.", "Export the screenshot at 1360×800 as a JPEG or PNG.");
    }
  }
}

function sourceFile(file) {
  return !/\.(json|md)$/i.test(file.rel);
}

function codeFiles(ctx) {
  return ctx.files.filter(sourceFile);
}

function markupFiles(ctx) {
  return ctx.files.filter((file) => MARKUP_EXT.test(file.rel));
}

/** Evidence may sit in a different file than the code it covers, so the verdict is the project's. */
function projectHas(ctx, pattern) {
  return codeFiles(ctx).some((file) => pattern.test(file.code));
}

function firstHit(ctx, pattern) {
  for (const file of codeFiles(ctx)) {
    const index = file.codeLines.findIndex((line) => pattern.test(line));
    if (index >= 0) return { file: file.rel, line: index + 1 };
  }
  return null;
}

function checkInputBounds(ctx) {
  for (const file of markupFiles(ctx)) {
    for (const tag of openTags(file.code, ["input", "NumberField", "sp-number-field"])) {
      if (tag.name === "input" && attrValue(tag.attrs, "type") !== "number") continue;
      if (hasAttr(tag.attrs, ["min", "minValue"]) && hasAttr(tag.attrs, ["max", "maxValue"])) continue;
      if (OWN_VALIDATION.test(tag.attrs)) continue;
      ctx.add(file.rel, tag.line, "The fresh edge-case page says to handle empty input, long input, and boundary values.", "Set min and max, and reject scientific notation such as 4e28.");
    }
  }
}

const SIGN_IN = /\b(signIn|logIn|login|sign-in|signInWith\w*)\b/;
const SIGN_OUT = /\b(signOut|logOut|logout|sign-out|signout)\b/i;

function checkLogout(ctx) {
  const hit = firstHit(ctx, SIGN_IN);
  if (!hit || projectHas(ctx, SIGN_OUT)) return;
  ctx.add(hit.file, hit.line, "The fresh authentication page says a user must be able to log out.", "Add a logout button or link that is easy to find.");
}

function checkPopup(ctx) {
  const hit = firstHit(ctx, /\.oauth\b|\bstartOAuth\b/);
  if (!hit || projectHas(ctx, /POPUP_BLOCKED/)) return;
  ctx.add(hit.file, hit.line, "The fresh authentication page says an OAuth add-on must tell the user when the browser blocked the popup.", "When the API returns POPUP_BLOCKED, show that message in the panel.");
}

const TEXT_ENTRY = ["input", "textarea", "sp-textfield", "sp-number-field", "Textfield", "TextField", "TextArea", "NumberField"];
const VALIDATION = /setCustomValidity|aria-invalid|isInvalid|validationState|errorMessage|checkValidity|\.validity|invalid|\berror\b/i;

function checkValidation(ctx) {
  if (projectHas(ctx, VALIDATION)) return;
  for (const file of markupFiles(ctx)) {
    const tag = openTags(file.code, TEXT_ENTRY).find((item) => !(item.name === "input" && /^(hidden|submit|button|reset|image|checkbox|radio|range|file)$/i.test(attrValue(item.attrs, "type") || "")));
    if (!tag) continue;
    ctx.add(file.rel, tag.line, "The fresh usability page says user input must get a confirmation or an error.", "Show an in-panel error for an invalid value and a confirmation when the action succeeds.");
    return;
  }
}

function eachCopyLine(ctx, visit) {
  for (const file of ctx.files) {
    if (!COPY_EXT.test(file.rel)) continue;
    const script = /\.(jsx?|tsx?|mjs|cjs|mts|cts)$/i.test(file.rel);
    const markup = /\.(jsx|tsx|vue|svelte)$/i.test(file.rel) || (script && /\.[jt]sx?$/i.test(file.rel) && /<[A-Za-z]/.test(file.code));
    file.codeLines.forEach((line, index) => {
      if (!line.trim() || skipCopyLine(line)) return;
      if (script && !/["'`]/.test(line) && !(markup && jsxText(line))) return;
      visit(file, line, index);
    });
  }
}

/** JSX text has no quotes: `<button>Save</button>`, or a line of words between tags. */
function jsxText(line) {
  return />[^<>{}\n]*[A-Za-z]{2,}[^<>{}\n]*</.test(line)
    || /^\s*[A-Z][A-Za-z'\u2019,.!?-]*(?:\s+[A-Za-z'\u2019,.!?:;-]+)+\s*$/.test(line);
}

function skipCopyLine(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("<!--")) return true;
  if (/^(?:import\b|export\b[^"'`]*\bfrom\b|\}\s*from\b)|\brequire\s*\(/.test(trimmed)) return true;
  if (/^console\.(?:log|warn|error|info|debug|trace)\(/.test(trimmed)) return true;
  if (/<title\b/i.test(line)) return true;
  if (/<meta\b/i.test(line) && /\bname=["'](?:keywords|description)["']/i.test(line)) return true;
  return false;
}

const NOT_A_NAME = new Set(["the", "this", "that", "these", "those", "your", "our", "my", "an", "a", "any", "each", "every", "use", "run", "in", "on", "to", "for", "of", "with", "and", "or", "as", "is", "it"]);

/** "[Name] Adobe Express add-on" is wrong. "the Adobe Express add-on" is only a way to point at the product. */
function checkOfferingName(ctx) {
  eachCopyLine(ctx, (file, line, index) => {
    for (const match of line.matchAll(/(?:^|[^A-Za-z0-9])([A-Za-z][A-Za-z0-9&'-]*)\s+Adobe Express [Aa]dd-?[Oo]n\b/g)) {
      const before = match[1];
      if (NOT_A_NAME.has(before.toLowerCase()) || !/^[A-Z0-9]/.test(before)) continue;
      ctx.add(file.rel, index + 1, 'The fresh brand guide says "[name] add-on for Adobe Express", not "[name] Adobe Express add-on".', line.replace(/Adobe Express [Aa]dd-?[Oo]n/g, "add-on for Adobe Express"));
      return;
    }
  });
}

function checkLogoFile(ctx) {
  for (const image of ctx.images) {
    if (/adobe[-_ ]?logo|premium[-_ ]?crown/i.test(path.basename(image.rel)) && !/designed-for/i.test(image.rel)) {
      ctx.add(image.rel, 1, "The fresh brand guide tells you to use the Designed for badge unless Adobe has given a written license for the logo.", "Use your own icon, or the Designed for badge.");
    }
  }
}

function listingImages(ctx) {
  return ctx.images.filter((image) => /(^|\/)(listing|thumbnails)\//.test(image.rel));
}

function checkPackageRoot(ctx) {
  for (const pkg of ctx.packages || []) {
    if (pkg.unreadable) {
      ctx.add(pkg.rel, 1, `${pkg.rel} could not be read as a zip: ${pkg.unreadable}`, "Build it again with npm run package.");
    } else if (!pkg.entries.includes("manifest.json")) {
      const nested = pkg.entries.find((name) => /^[^/]+\/manifest\.json$/.test(name));
      ctx.add(pkg.rel, 1, nested
        ? `${pkg.rel} holds the folder "${nested.split("/")[0]}/", so manifest.json is not at the root. Adobe rejects that upload with MANIFEST_NOT_FOUND_ERROR.`
        : `${pkg.rel} has no manifest.json at its root. Adobe rejects that upload with MANIFEST_NOT_FOUND_ERROR.`,
      "Zip the contents of the built folder, not the folder itself. npm run package does this.");
    }
  }
}

function checkPackageSize(ctx) {
  for (const pkg of ctx.packages || []) {
    if (pkg.bytes > PACKAGE_LIMIT) {
      ctx.add(pkg.rel, 1, `${pkg.rel} is ${(pkg.bytes / 1048576).toFixed(1)} MB. The fresh page says the package must not exceed 50 MB.`, "Drop unused assets and source maps, and compress images and video, then package again.");
    }
  }
}

function checkPackageHidden(ctx) {
  for (const pkg of ctx.packages || []) {
    const hidden = pkg.entries.filter((name) => name.split("/").some((part) => part.startsWith(".") && part.length > 1) || /(^|\/)__MACOSX(\/|$)/.test(name));
    if (hidden.length) {
      const shown = hidden.slice(0, 3).join(", ") + (hidden.length > 3 ? `, and ${hidden.length - 3} more` : "");
      ctx.add(pkg.rel, 1, `${pkg.rel} holds hidden files (${shown}). The fresh page says hidden files should not be in the package.`, "Use npm run package, or on a Mac: zip -r name.zip . -x '**/.*' -x '**/__MACOSX' -x '*.DS_Store'.");
    }
  }
}

function checkPackageEntry(ctx) {
  for (const pkg of ctx.packages || []) {
    if (!pkg.manifest) continue;
    for (const entry of pkg.manifest.entryPoints || []) {
      for (const key of ["main", "documentSandbox"]) {
        if (entry[key] && !pkg.entries.includes(entry[key])) {
          ctx.add(pkg.rel, 1, `${pkg.rel} names ${entry[key]} as ${key}, and that file is not inside the zip. The package must hold the built content.`, "Build before you package, so the files the manifest names are in the zip.");
        }
      }
    }
  }
}
