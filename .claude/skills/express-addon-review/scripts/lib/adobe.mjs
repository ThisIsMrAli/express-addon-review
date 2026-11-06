import path from "node:path";
import { BRAND_TEXT, publishedUrl } from "./sources.mjs";

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
  rule("offering-name-order", "error", BRAND_TEXT, "NOT this: [Your offering name] Adobe Express add-on", checkOfferingName)
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
  for (const file of ctx.files.filter(sourceFile)) {
    file.lines.forEach((line, index) => {
      if (!visibleLine(line)) return;
      if (/\bnot\b[^.]{0,80}\bcrown\b/i.test(line)) return;
      if (/\bcrown\b/i.test(line)) {
        ctx.add(file.rel, index + 1, "The fresh monetization page says a crown icon is reserved for Adobe Express Premium and can cause a rejection.", "Remove the crown. Use the plus badge for a purchase and the paid checkmark only while a single item is unlocked.");
      }
    });
  }
}

function checkLock(ctx) {
  for (const file of ctx.files.filter(sourceFile)) {
    file.lines.forEach((line, index) => {
      if (!visibleLine(line)) return;
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
    if (/Pro Plan/.test(line)) return;
    if (/\bPro\b/.test(line)) {
      ctx.add(file.rel, index + 1, 'The fresh monetization page says to avoid "pro" unless the words are "Pro Plan". The same page also shows "Upgrade to Pro".', 'If this is a price, write "Pro Plan" or "Upgrade to Pro" so it is not a product grade.');
    }
  });
}

function checkDialog(ctx) {
  for (const file of ctx.files) {
    const hit = lineMatch(file, /\b(?:window\.)?(?:alert|confirm)\s*\(/);
    if (!hit) continue;
    const around = file.lines.slice(Math.max(0, hit.line - 30), hit.line).join("\n");
    if (/function\s+preview|previewModal|get\(\s*["']preview["']\s*\)/.test(around)) continue;
    ctx.add(file.rel, hit.line, "The fresh UI page says to keep ordinary status in the panel instead of a dialog box.", "Replace alert or confirm with an in-panel message.");
  }
}

function checkTheme(ctx) {
  if (!ctx.files.some((file) => /\.html?$/i.test(file.rel))) return;
  const joined = ctx.files.map((file) => file.text).join("\n");
  if (!/theme|colorScheme|prefers-color-scheme|sp-theme|@spectrum-web-components/i.test(joined)) {
    ctx.add(ctx.entryHtml() || "index.html", 1, "The fresh UI page says submissions after August 31, 2026 are rejected when dark theme is unreadable. This project has no theme or Spectrum signal.", "Read the theme from the Express host and keep text and controls readable in light and dark.");
  }
}

function checkCancel(ctx) {
  for (const file of ctx.files) {
    if (!longOperation(file.text)) continue;
    if (/\bfetch\s*\(/.test(file.text) && !/AbortController|signal\s*:|\bcancel\b|\babort\b/i.test(file.text)) {
      const hit = lineMatch(file, /\bfetch\s*\(/);
      ctx.add(file.rel, (hit?.line ?? 1), "The fresh features page says a long blocking operation should let the user cancel it.", "Keep a Cancel control and pass an AbortSignal to fetch.");
    }
  }
}

function longOperation(text) {
  const code = stripComments(text);
  return /\bencode(?!URI)\w*|\b(rendition|ffmpeg|MediaRecorder)\b/i.test(code);
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function checkRendition(ctx) {
  for (const file of ctx.files) {
    if (/createRendition|rendition/i.test(file.text) && !/progress|spinner|loading/i.test(file.text)) {
      const hit = lineMatch(file, /createRendition|rendition/i);
      ctx.add(file.rel, (hit?.line ?? 1), "The fresh features page says a rendition must show progress.", "Show a progress indicator while the rendition is created.");
    }
  }
}

function checkAds(ctx) {
  for (const file of ctx.files.filter(sourceFile)) {
    const hit = lineMatch(file, /(^|[^a-zA-Z])(googlesyndication|doubleclick|adsbygoogle)\b|facebook\.com\/tr/i);
    if (hit && visibleLine(file.lines[hit.line - 1] || "")) ctx.add(file.rel, hit.line, "The fresh monetization page forbids third-party advertising in every add-on.", "Remove the ad script.");
  }
}

function checkGenAi(ctx) {
  for (const file of ctx.files.filter(sourceFile)) {
    if (/openai|firefly|stability\.ai|images\/generations|generative/i.test(file.text) && !/inaccurate/i.test(file.text)) {
      const hit = lineMatch(file, /openai|firefly|stability\.ai|images\/generations|generative/i);
      if (hit && visibleLine(file.lines[hit.line - 1] || "")) ctx.add(file.rel, hit.line, "The fresh generative AI requirements page says text or code must remind the user that the result may be inaccurate.", "Show that disclaimer next to the generated text or code.");
    }
  }
}

function checkAlt(ctx) {
  for (const file of ctx.files.filter((file) => /\.html?$/i.test(file.rel))) {
    file.lines.forEach((line, index) => {
      if (/<img\b/i.test(line) && !/\balt=/i.test(line)) {
        ctx.add(file.rel, index + 1, "The fresh accessibility page says images need alternative text.", 'Add an alt attribute. Use alt="" when the image is decorative.');
      }
    });
  }
}

function checkLabels(ctx) {
  for (const file of ctx.files.filter((file) => /\.html?$/i.test(file.rel))) {
    const hasLabel = /<label\b/i.test(file.text);
    file.lines.forEach((line, index) => {
      if (/<(input|textarea|select)\b/i.test(line) && !/type=["']hidden["']/i.test(line) && !/aria-label|aria-labelledby/i.test(line) && !hasLabel) {
        ctx.add(file.rel, index + 1, "The fresh accessibility page says form fields need labels.", "Add a <label> or an aria-label.");
      }
    });
  }
}

function checkButtons(ctx) {
  for (const file of ctx.files.filter((file) => /\.html?$/i.test(file.rel))) {
    file.lines.forEach((line, index) => {
      const empty = /<button\b[^>]*>\s*<\/button>/i.test(line);
      const iconOnly = /<button\b/i.test(line) && !/aria-label/i.test(line) && /<(svg|img)\b/i.test(line) && !/>[^<]*[A-Za-z]/.test(line);
      if (empty || iconOnly) {
        ctx.add(file.rel, index + 1, "The fresh accessibility page expects controls to have a name a keyboard user can reach.", "Add visible text or an aria-label on the button.");
      }
    });
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
  return !/\.json$/i.test(file.rel);
}

function visibleLine(line) {
  const trimmed = line.trim();
  return !(trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("<!--"));
}

function checkInputBounds(ctx) {
  for (const file of ctx.files.filter((file) => /\.html?$/i.test(file.rel))) {
    file.lines.forEach((line, index) => {
      if (/<input\b/i.test(line) && /type=["']number["']|size/i.test(line) && !/\bmin=/.test(line) && !/\bmax=/.test(line)) {
        ctx.add(file.rel, index + 1, "The fresh edge-case page says to handle empty input, long input, and boundary values.", "Set min and max, and reject scientific notation such as 4e28.");
      }
    });
  }
}

function checkLogout(ctx) {
  for (const file of ctx.files.filter(sourceFile)) {
    if (/\b(signIn|logIn|login|sign-in)\b/.test(file.text) && !/\b(signOut|logOut|logout|sign-out)\b/.test(file.text)) {
      const hit = lineMatch(file, /\b(signIn|logIn|login|sign-in)\b/);
      ctx.add(file.rel, (hit?.line ?? 1), "The fresh authentication page says a user must be able to log out.", "Add a logout button or link that is easy to find.");
    }
  }
}

function checkPopup(ctx) {
  for (const file of ctx.files.filter(sourceFile)) {
    if (/\boauth\b|startOAuth|signInWith/i.test(file.text) && !/POPUP_BLOCKED/.test(file.text)) {
      const hit = lineMatch(file, /\boauth\b|startOAuth|signInWith/i);
      ctx.add(file.rel, (hit?.line ?? 1), "The fresh authentication page says an OAuth add-on must tell the user when the browser blocked the popup.", "When the API returns POPUP_BLOCKED, show that message in the panel.");
    }
  }
}

function checkValidation(ctx) {
  for (const file of ctx.files.filter((file) => /\.html?$/i.test(file.rel))) {
    if (/<input\b/i.test(file.text) && !/setCustomValidity|aria-invalid|error|invalid/i.test(file.text)) {
      const hit = lineMatch(file, /<input\b/i);
      ctx.add(file.rel, (hit?.line ?? 1), "The fresh usability page says user input must get a confirmation or an error.", "Show an in-panel error for an invalid value and a confirmation when the action succeeds.");
    }
  }
}

function eachCopyLine(ctx, visit) {
  for (const file of ctx.files) {
    if (file.rel === "manifest.json" || /(^|\/)package\.json$/.test(file.rel)) continue;
    const code = /\.(jsx?|tsx?)$/i.test(file.rel);
    const prose = /\.(html?|md)$/i.test(file.rel);
    if (!code && !prose) continue;
    file.lines.forEach((line, index) => {
      if (skipCopyLine(line)) return;
      if (code && !/["'`]/.test(line)) return;
      visit(file, line, index);
    });
  }
}

function skipCopyLine(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("<!--")) return true;
  if (/<title\b/i.test(line)) return true;
  if (/<meta\b/i.test(line) && /\bname=["'](?:keywords|description)["']/i.test(line)) return true;
  return false;
}

function lineMatch(file, pattern) {
  const index = file.lines.findIndex((line) => pattern.test(line));
  return index >= 0 ? { line: index + 1 } : null;
}

function checkOfferingName(ctx) {
  eachCopyLine(ctx, (file, line, index) => {
    if (/(?<!for )Adobe Express add-on/i.test(line)) {
      ctx.add(file.rel, index + 1, 'The fresh brand guide says "[name] add-on for Adobe Express", not "[name] Adobe Express add-on".', line.replace(/Adobe Express add-on/ig, "add-on for Adobe Express"));
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
