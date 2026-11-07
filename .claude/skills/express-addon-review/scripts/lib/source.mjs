/**
 * Helpers for reading add-on source without being fooled by comments,
 * multi-line JSX, or the framework that wrote it.
 */

/** Files whose markup is checked for labels, alt text, and button names. */
export const MARKUP_EXT = /\.(html?|jsx?|tsx?|mjs|cjs|mts|cts|vue|svelte)$/i;

/** Files whose strings can be user-visible copy. Developer docs (.md) are not. */
export const COPY_EXT = MARKUP_EXT;

/**
 * Blank out comments but keep every line break, so a match on the result has
 * the same line number as the original file. A `//` after a colon is a URL.
 */
export function blankComments(text) {
  const blank = (match) => match.replace(/[^\n]/g, " ");
  return text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(^|[^:\\'"`])(\/\/[^\n]*)/g, (match, before, comment) => before + blank(comment));
}

/** 1-based line number of a character offset. */
export function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

/**
 * Every opening tag whose name is in `names`, across lines. `{...}` in JSX is
 * skipped as a unit, so an arrow function's `>` does not end the tag early.
 * Returns `{ name, attrs, line, start, end, selfClosing }`.
 */
export function openTags(text, names) {
  const escaped = names.map((name) => name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"));
  const start = new RegExp(`<(${escaped.join("|")})(?=[\\s/>])`, "g");
  const tags = [];
  for (let match = start.exec(text); match; match = start.exec(text)) {
    const from = match.index + match[0].length;
    const end = tagEnd(text, from);
    if (end < 0) continue;
    const attrs = text.slice(from, end);
    tags.push({
      name: match[1],
      attrs,
      line: lineAt(text, match.index),
      start: match.index,
      end,
      selfClosing: /\/\s*$/.test(attrs)
    });
    start.lastIndex = end;
  }
  return tags;
}

function tagEnd(text, from) {
  let braces = 0;
  let quote = "";
  for (let i = from; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") braces += 1;
    else if (char === "}") braces = Math.max(0, braces - 1);
    else if (char === ">" && braces === 0) return i;
    // A new tag before this one closed means the text was not a tag.
    else if (char === "<" && braces === 0 && /[A-Za-z/]/.test(text[i + 1] || "")) return -1;
  }
  return -1;
}

/** The text between an opening tag and its matching close, or "" for a self-closing tag. */
export function innerOf(text, tag) {
  if (tag.selfClosing) return "";
  const close = text.indexOf(`</${tag.name}`, tag.end);
  return close < 0 ? "" : text.slice(tag.end + 1, close);
}

/** True when `attrs` has the attribute, as `name`, `name=`, `{name}`, or a spread that might supply it. */
export function hasAttr(attrs, names, { spread = true } = {}) {
  const list = Array.isArray(names) ? names : [names];
  if (spread && /\{\s*\.\.\./.test(attrs)) return true;
  return list.some((name) => new RegExp(`(^|[\\s{])${name.replace(/[-]/g, "\\-")}(?=[\\s=}/]|$)`, "i").test(attrs));
}

/** The value of a plain string attribute, or null. */
export function attrValue(attrs, name) {
  const match = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*["'\`]([^"'\`]*)["'\`]\\s*\\})`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

/** Visible words in a fragment: tags removed, `{expressions}` counted as words. */
export function hasVisibleText(fragment) {
  const withoutTags = fragment.replace(/<[^>]*>/g, " ");
  if (/\{[^}]+\}/.test(withoutTags)) return true;
  return /[A-Za-z0-9\u00C0-\uFFFF]/.test(withoutTags.replace(/&nbsp;|&#?\w+;/g, " "));
}

/** A field that reports its own invalid state has handled bad input, whatever min and max say. */
export const OWN_VALIDATION = /aria-invalid|isInvalid|validationState|errorMessage|setCustomValidity|\bpattern\s*=|maxLength/i;
