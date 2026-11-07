// Runs inside the add-on page at panel width. It only measures. It never changes the page, except that
// it scrolls to look at what is below the fold, and it puts the scroll back.
// scripts/audit.mjs injects this file and calls window.__expressReview.audit().
(() => {
  if (window.__expressReview) return;

  // ---- reading the page, through open shadow roots --------------------------------------------
  const parentOf = (node) => {
    const parent = node.parentNode;
    if (!parent) return null;
    return parent.nodeType === 11 && parent.host ? parent.host : parent;
  };
  const contains = (outer, inner) => {
    for (let node = inner; node; node = parentOf(node)) if (node === outer) return true;
    return false;
  };
  function everything(root = document, out = []) {
    for (const el of root.querySelectorAll("*")) {
      out.push(el);
      if (el.shadowRoot) everything(el.shadowRoot, out);
    }
    return out;
  }
  function topAt(x, y) {
    let el = document.elementFromPoint(x, y);
    while (el && el.shadowRoot) {
      const inner = el.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === el) break;
      el = inner;
    }
    return el;
  }
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
  };
  const visible = (el) => {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  };
  const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();
  function labelOf(el) {
    const named = clean(el.getAttribute?.("aria-label") || el.getAttribute?.("title"));
    if (named) return named.slice(0, 60);
    const text = clean(el.innerText ?? el.textContent);
    if (text) return text.slice(0, 60);
    return clean(el.alt || el.placeholder || el.getAttribute?.("name")).slice(0, 60);
  }
  function selectorOf(el) {
    const parts = [];
    for (let node = el, depth = 0; node && node.nodeType === 1 && depth < 4; node = parentOf(node), depth += 1) {
      let part = node.tagName.toLowerCase();
      if (node.id && !/\d{4,}/.test(node.id)) {
        parts.unshift(`${part}#${CSS.escape(node.id)}`);
        break;
      }
      const classes = (typeof node.className === "string" ? node.className : "").split(/\s+/).filter((name) => name && !/^css-|^_|[0-9a-f]{6,}|\d/.test(name)).slice(0, 2);
      if (classes.length) part += `.${classes.join(".")}`;
      parts.unshift(part);
    }
    return parts.join(" > ");
  }
  const ownText = (el) => [...el.childNodes].some((node) => node.nodeType === 3 && clean(node.nodeValue));

  // ---- what counts as a control ---------------------------------------------------------------
  const TAGS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"]);
  const ROLES = new Set(["button", "link", "tab", "menuitem", "menuitemcheckbox", "menuitemradio", "checkbox", "radio", "switch", "option", "slider", "textbox", "combobox", "searchbox", "spinbutton"]);
  const SPECTRUM = /^(SP|SWC)-(BUTTON|ACTION-BUTTON|ACTION-MENU|CHECKBOX|RADIO|SWITCH|TAB|TEXTFIELD|SEARCH|NUMBER-FIELD|PICKER|SLIDER|MENU-ITEM|LINK|COMBOBOX|CLOSE-BUTTON|CLEAR-BUTTON|SPLIT-BUTTON|STEPPER)$/;
  function isControl(el) {
    if (TAGS.has(el.tagName)) {
      if (el.tagName === "A") return el.hasAttribute("href");
      if (el.tagName === "INPUT" && el.type === "hidden") return false;
      return true;
    }
    if (SPECTRUM.test(el.tagName)) return true;
    const role = el.getAttribute("role");
    if (role && ROLES.has(role)) return true;
    const index = el.getAttribute("tabindex");
    return index !== null && Number(index) >= 0 && el.tagName !== "BODY" && el.tagName !== "HTML";
  }
  const disabled = (el) => el.disabled === true || el.getAttribute("aria-disabled") === "true";

  // ---- the dialog on top, if one is open ------------------------------------------------------
  function findModal(all) {
    const candidates = all.filter((el) => {
      const role = el.getAttribute("role");
      const named = role === "dialog" || role === "alertdialog" || el.getAttribute("aria-modal") === "true" || (el.tagName === "DIALOG" && el.open) || el.tagName === "SP-DIALOG" || el.tagName === "SP-DIALOG-WRAPPER";
      return named && visible(el);
    });
    const loose = candidates.length ? [] : all.filter((el) => {
      const cls = typeof el.className === "string" ? el.className : "";
      if (!/(^|[-_ ])(modal|dialog|popup)([-_ ]|$)/i.test(cls) || !visible(el)) return false;
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (style.position === "fixed" || style.position === "absolute") && r.width * r.height >= 0.2 * innerWidth * innerHeight;
    });
    const pool = [...candidates, ...loose];
    const inner = pool.filter((el) => !pool.some((other) => other !== el && contains(el, other)));
    return inner[inner.length - 1] || null;
  }

  const CLOSE_WORD = /^(close|dismiss|cancel|back|done|ok|okay|got it|no thanks|not now|skip|maybe later|×|✕|✖|x)$/i;
  const CORNER_WORD = /^(close|dismiss|×|✕|✖|x)$/i;

  // ---- colour ---------------------------------------------------------------------------------
  function parseColor(value) {
    let m = String(value).match(/^rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    m = String(value).match(/^color\(srgb ([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number);
      return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 };
    }
    return null;
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (top, under) => ({ r: top.a * top.r + (1 - top.a) * under.r, g: top.a * top.g + (1 - top.a) * under.g, b: top.a * top.b + (1 - top.a) * under.b, a: 1 });
  /** The colour behind an element, or null when a gradient or picture is behind it and the answer would be a guess. */
  function backdrop(el) {
    const layers = [];
    for (let node = el; node; node = parentOf(node)) {
      if (node.nodeType !== 1) continue;
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== "none") return null;
      const c = parseColor(style.backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
    }
    if (!layers.length || layers[layers.length - 1].a < 1) return null;
    let color = layers.pop();
    while (layers.length) color = over(layers.pop(), color);
    return color;
  }
  function opacityOf(el) {
    let value = 1;
    for (let node = el; node && node.nodeType === 1; node = parentOf(node)) value *= Number(getComputedStyle(node).opacity);
    return value;
  }

  // ---- containment ----------------------------------------------------------------------------
  const CLIPPERS = new Set(["auto", "scroll", "hidden", "clip"]);
  /** True when something between the element and the page edge already scrolls or clips sideways. */
  function containedSideways(el) {
    for (let node = parentOf(el); node && node.nodeType === 1 && node !== document.body && node !== document.documentElement; node = parentOf(node)) {
      const style = getComputedStyle(node);
      if (CLIPPERS.has(style.overflowX) && node.getBoundingClientRect().right <= innerWidth + 1) return true;
    }
    return false;
  }

  // ---- what is covering a control, and whether that is a bug -----------------------------------
  /** The centre of a control can be scrolled or clipped out of sight. Whatever is drawn there is not covering it. */
  function clippedAway(el, cx, cy) {
    for (let node = parentOf(el); node && node.nodeType === 1 && node !== document.body && node !== document.documentElement; node = parentOf(node)) {
      const style = getComputedStyle(node);
      if (!CLIPPERS.has(style.overflowX) && !CLIPPERS.has(style.overflowY)) continue;
      const r = node.getBoundingClientRect();
      if (cx < r.left - 1 || cx > r.right + 1 || cy < r.top - 1 || cy > r.bottom + 1) return true;
    }
    return false;
  }
  const POPUP_ROLE = /^(menu|listbox|tooltip|dialog|alertdialog|combobox|tree|grid)$/;
  const POPUP_NAME = /(^|[-_ ])(popover|popup|dropdown|menu|tooltip|listbox|flyout|picker)([-_ ]|$)/i;
  function positioned(el, kinds) {
    for (let node = el; node && node.nodeType === 1 && node !== document.documentElement; node = parentOf(node)) {
      if (kinds.includes(getComputedStyle(node).position)) return true;
    }
    return false;
  }
  /** A menu, popover, or tooltip is on top on purpose. Whatever it hides is not a bug. */
  function intentionalOverlay(top, popupOpen) {
    for (let node = top; node && node.nodeType === 1; node = parentOf(node)) {
      if (POPUP_ROLE.test(node.getAttribute("role") || "") || node.hasAttribute("popover")) return true;
      if (/^SP-(POPOVER|OVERLAY|TOOLTIP|MENU|PICKER|DIALOG)/.test(node.tagName)) return true;
      if (POPUP_NAME.test(classOf(node))) return true;
    }
    return popupOpen && positioned(top, ["absolute", "fixed", "sticky"]);
  }
  const DIALOG_SELECTOR = '[role="dialog"],[role="alertdialog"],[aria-modal="true"],dialog,sp-dialog,sp-dialog-wrapper';
  /** The dialog a covering element belongs to, or the one a scrim wraps. */
  function dialogOf(top) {
    for (let node = top; node && node.nodeType === 1; node = parentOf(node)) if (node.matches && node.matches(DIALOG_SELECTOR)) return node;
    return (top.querySelector && top.querySelector(DIALOG_SELECTOR)) || null;
  }
  /** The outermost positioned element around `top`: the whole sheet, scrim, or bar it is part of. */
  function layerHost(top) {
    let host = top;
    for (let node = top; node && node.nodeType === 1 && node !== document.documentElement; node = parentOf(node)) {
      if (["fixed", "absolute", "sticky"].includes(getComputedStyle(node).position)) host = node;
    }
    return host;
  }

  // ---- one pass at the current scroll position ------------------------------------------------
  function pass(modal, all) {
    const found = [];
    const add = (finding) => found.push({ ...finding, rect: finding.rect || { x: 0, y: 0, w: 0, h: 0 } });
    const inScope = (el) => (modal ? contains(modal, el) : true);
    const everyScoped = all.filter((el) => inScope(el) && visible(el));

    const controls = everyScoped.filter((el) => isControl(el) && !disabled(el));
    const outermost = controls.filter((el) => {
      for (let node = parentOf(el); node; node = parentOf(node)) if (node.nodeType === 1 && isControl(node)) return false;
      return true;
    });

    const popupOpen = everyScoped.some((el) => el.getAttribute("aria-expanded") === "true");

    // Controls outside the panel, or covered by something else.
    const covered = [];
    const ghosts = new Map();
    for (const el of outermost.slice(0, 90)) {
      const r = el.getBoundingClientRect();
      if ((r.right > innerWidth + 1 || r.left < -1) && !containedSideways(el)) {
        add({ kind: "control-offscreen", severity: "error", message: `"${labelOf(el) || el.tagName.toLowerCase()}" sits outside the ${innerWidth}px panel, so it cannot be reached.`, fix: "Let the row wrap, or give the container min-width: 0 and overflow-x: auto.", el, rect: box(el) });
        continue;
      }
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue;
      if (clippedAway(el, cx, cy)) continue;
      const top = topAt(cx, cy);
      if (!top || contains(el, top) || contains(top, el)) continue;
      // A label or wrapper around the control still receives the click for it.
      if (el.labels && [...el.labels].some((label) => contains(label, top))) continue;
      const host = layerHost(top);
      const dialog = dialogOf(top);
      if (dialog || intentionalOverlay(top, popupOpen)) {
        // A dialog or menu on top is on purpose, unless it cannot be seen: then it eats clicks for nothing.
        if (opacityOf(dialog || host) < 0.05) {
          const ghost = ghosts.get(host) || { host, label: labelOf(dialog || host), items: [] };
          ghost.items.push(el);
          ghosts.set(host, ghost);
        }
        continue;
      }
      covered.push({ el, top, host });
    }
    for (const ghost of ghosts.values()) {
      const names = ghost.items.slice(0, 3).map((item) => `"${labelOf(item) || item.tagName.toLowerCase()}"`).join(", ");
      add({
        kind: "invisible-cover",
        severity: "error",
        message: `Something you cannot see${ghost.label ? ` ("${ghost.label}")` : ""} sits on top of the panel and takes the clicks meant for ${ghost.items.length} control${ghost.items.length === 1 ? "" : "s"}, such as ${names}. Nothing seems to happen when they are pressed.`,
        fix: "Make it visible, or give it pointer-events: none while it is hidden. If it only goes invisible with reduced motion on, give it opacity: 1 inside @media (prefers-reduced-motion: reduce).",
        el: ghost.host,
        covers: selectorOf(ghost.host),
        floating: false,
        rect: box(ghost.host)
      });
    }
    // A layer over three or more controls is a sheet or a scrim, put there on purpose. One or two is a stray overlap.
    const byHost = new Map();
    for (const item of covered) byHost.set(item.host, [...(byHost.get(item.host) || []), item]);
    for (const [host, list] of byHost) {
      if (list.length >= 3 && opacityOf(host) >= 0.05) continue;
      for (const { el, top } of list) {
        add({ kind: "control-covered", severity: "error", message: `"${labelOf(el) || el.tagName.toLowerCase()}" is covered by ${labelOf(top) ? `"${labelOf(top)}"` : `<${top.tagName.toLowerCase()}>`}, so a click lands on the wrong element.`, fix: "Move the overlapping element, give the page room for it, or lower its z-index.", el, covers: selectorOf(top), floating: positioned(top, ["fixed", "sticky"]), rect: box(el) });
      }
    }

    // Touch targets. WCAG 2.5.8 lets a small target stand when a 24px circle around it touches no other control.
    let small = 0;
    const rects = outermost.map((el) => ({ el, r: el.getBoundingClientRect() }));
    for (const { el, r } of rects) {
      if (small >= 6) break;
      if (el.tagName === "INPUT" && /^(checkbox|radio)$/.test(el.type)) continue;
      if (el.tagName === "A" && el.closest("p, li") && !el.closest("button")) continue;
      if (Math.min(r.width, r.height) >= 24) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const crowded = rects.some((other) => other.el !== el && other.r.left <= cx + 12 && other.r.right >= cx - 12 && other.r.top <= cy + 12 && other.r.bottom >= cy - 12);
      if (!crowded) continue;
      small += 1;
      add({ kind: "small-target", severity: "warn", message: `"${labelOf(el) || el.tagName.toLowerCase()}" is ${Math.round(r.width)}×${Math.round(r.height)}px with another control right beside it. A tap target should be at least 24×24px (WCAG 2.5.8).`, fix: "Add padding or set a minimum 24px size. Spectrum controls are already 32px.", el, rect: box(el) });
    }

    // Text that is cut off.
    let clipped = 0;
    for (const el of everyScoped) {
      if (clipped >= 6) break;
      if (!ownText(el) && el.tagName !== "BUTTON") continue;
      const style = getComputedStyle(el);
      if (style.display === "inline") continue;
      const lineClamp = style.webkitLineClamp && style.webkitLineClamp !== "none";
      const sideways = CLIPPERS.has(style.overflowX) && style.overflowX !== "auto" && style.overflowX !== "scroll" && el.scrollWidth > el.clientWidth + 2 && style.textOverflow !== "ellipsis";
      const down = CLIPPERS.has(style.overflowY) && style.overflowY !== "auto" && style.overflowY !== "scroll" && el.scrollHeight > el.clientHeight + 2 && !lineClamp;
      if (sideways || down) {
        clipped += 1;
        add({ kind: "text-clipped", severity: "warn", message: `Text is cut off: "${clean(el.innerText || el.textContent).slice(0, 50)}".`, fix: "Let it wrap, or remove the fixed width or height.", el, rect: box(el) });
      }
    }

    // Pictures that never loaded.
    for (const el of everyScoped) {
      if (el.tagName === "IMG" && el.complete && el.naturalWidth === 0 && el.getAttribute("src")) {
        add({ kind: "image-broken", severity: "error", message: `An image did not load: ${clean(el.getAttribute("src")).slice(0, 60)}.`, fix: "Fix the path, or bundle the file with the add-on. A remote image fails offline.", el, rect: box(el) });
      }
    }

    // Small type and contrast.
    const contrast = new Map();
    let tiny = 0;
    for (const el of everyScoped) {
      if (!ownText(el) || /^(SCRIPT|STYLE|NOSCRIPT|TITLE|OPTION)$/.test(el.tagName)) continue;
      if (disabled(el) || el.closest("[disabled], [aria-disabled='true']")) continue;
      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      if (size < 11 && tiny < 4) {
        tiny += 1;
        add({ kind: "small-type", severity: "warn", message: `Text is ${size}px: "${clean(el.textContent).slice(0, 40)}". Anything under 11px is hard to read in a narrow panel.`, fix: "Use 12px or larger for body text.", el, rect: box(el) });
      }
      const fg = parseColor(style.color);
      const bg = backdrop(el);
      if (!fg || !bg) continue;
      const a = fg.a * opacityOf(el);
      const text = over({ ...fg, a }, bg);
      const l1 = lum(text);
      const l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) {
        const key = `${style.color}|${style.backgroundColor}`;
        const entry = contrast.get(key) || { count: 0, ratio, el, size };
        entry.count += 1;
        contrast.set(key, entry);
      }
    }
    for (const [key, entry] of [...contrast].slice(0, 5)) {
      add({ kind: "low-contrast", severity: "warn", message: `Contrast is ${entry.ratio.toFixed(1)}:1 on "${clean(entry.el.textContent).slice(0, 36)}"${entry.count > 1 ? ` and ${entry.count - 1} more like it` : ""}. Text needs 4.5:1.`, fix: "Use a darker text colour, or a lighter or darker background.", el: entry.el, rect: box(entry.el) });
    }

    // Something clickable that no keyboard can reach.
    let dead = 0;
    for (const el of everyScoped) {
      if (dead >= 4) break;
      if (isControl(el) || !(ownText(el) || el.querySelector("svg, img"))) continue;
      if (getComputedStyle(el).cursor !== "pointer") continue;
      if (everyScoped.some((other) => other !== el && isControl(other) && (contains(other, el) || contains(el, other)))) continue;
      if (el.closest("label, [role], [tabindex]")) continue;
      dead += 1;
      add({ kind: "click-without-keyboard", severity: "warn", message: `"${labelOf(el) || el.tagName.toLowerCase()}" looks clickable but is not a button, link, or focusable element, so the keyboard cannot reach it.`, fix: "Use a <button>, or add role=\"button\", tabindex=\"0\", and a key handler.", el, rect: box(el) });
    }
    return found;
  }

  function scrollers() {
    const list = [];
    for (const el of everything()) {
      if (el === document.body || el === document.documentElement) continue;
      const style = getComputedStyle(el);
      if ((style.overflowY === "auto" || style.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 8 && visible(el) && el.clientHeight > 80) list.push(el);
    }
    return list.sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth).slice(0, 2);
  }

  // ---- the public face ------------------------------------------------------------------------
  function audit() {
    const all = everything();
    const modal = findModal(all);
    const findings = [];
    const seen = new Set();
    const keep = (items, scrollY) => {
      for (const item of items) {
        const el = item.el;
        delete item.el;
        item.selector = el ? selectorOf(el) : "";
        item.label = el ? labelOf(el) : "";
        item.scrollY = scrollY;
        const id = `${item.kind}|${item.selector}`;
        if (seen.has(id)) continue;
        seen.add(id);
        findings.push(item);
      }
    };

    // Whole-page problems first.
    if (document.documentElement.scrollWidth > innerWidth + 1 && !modal) {
      let worst = null;
      let over = 0;
      for (const el of all) {
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.right - innerWidth > over && !containedSideways(el)) { over = r.right - innerWidth; worst = el; }
      }
      keep([{ kind: "scrolls-sideways", severity: "error", message: `The panel scrolls sideways: its content is ${document.documentElement.scrollWidth}px wide in a ${innerWidth}px panel${worst ? `, widest at "${labelOf(worst) || worst.tagName.toLowerCase()}"` : ""}.`, fix: "Find the element that is wider than 100% and let it shrink or wrap.", el: worst, rect: worst ? box(worst) : undefined }], 0);
    }
    const text = clean(document.body?.innerText);
    if (!modal && !text && !all.some((el) => ["IMG", "SVG", "CANVAS", "VIDEO"].includes(el.tagName.toUpperCase()) && visible(el)) && !all.some((el) => isControl(el) && visible(el))) {
      keep([{ kind: "panel-blank", severity: "error", message: "The panel shows nothing: no text, no controls, no image.", fix: "Check the console for a script error, and make sure the preview host is available." }], 0);
    }

    // The dialog on top.
    let modalInfo = null;
    if (modal) {
      const r = modal.getBoundingClientRect();
      const pool = all.filter((el) => contains(modal, el) && isControl(el) && visible(el));
      const exits = pool.map((el) => ({ el, label: labelOf(el) })).filter((item) => CLOSE_WORD.test(item.label) || /(close|dismiss)/i.test(item.label));
      modalInfo = { selector: selectorOf(modal), label: labelOf(modal).slice(0, 60), rect: box(modal), exits: exits.map((item) => item.label) };

      if (r.bottom > innerHeight + 1 || r.top < -1 || r.right > innerWidth + 1 || r.left < -1) {
        const scrolls = ["auto", "scroll"].includes(getComputedStyle(modal).overflowY);
        keep([{ kind: "dialog-overflows", severity: scrolls ? "warn" : "error", message: `The dialog is ${Math.round(r.width)}×${Math.round(r.height)}px and does not fit the ${innerWidth}×${innerHeight} panel${scrolls ? ", but it scrolls" : ", and it does not scroll"}.`, fix: "Give the dialog max-height: 100% with overflow-y: auto, and keep its width under the panel width.", el: modal, rect: box(modal) }], 0);
      }
      const corner = exits.filter((item) => CORNER_WORD.test(item.label));
      for (const item of corner) {
        const c = item.el.getBoundingClientRect();
        const offset = (c.top + c.height / 2 - r.top) / Math.max(r.height, 1);
        if (offset > 0.5) {
          keep([{ kind: "dialog-close-misplaced", severity: "error", message: `The close button is at the bottom of the dialog (${Math.round(offset * 100)}% down). People look for it in the top corner.`, fix: "Put the dismiss control in the dialog header, top right. If the dialog uses a vertical ButtonGroup, move the dismiss button out of it or switch to a horizontal group.", el: item.el, rect: box(item.el) }], 0);
        } else if (Math.min(c.width, c.height) < 24) {
          keep([{ kind: "small-target", severity: "warn", message: `The close button is ${Math.round(c.width)}×${Math.round(c.height)}px. It should be at least 24×24px.`, fix: "Enlarge its hit area.", el: item.el, rect: box(item.el) }], 0);
        }
      }
      if (!exits.length) {
        keep([{ kind: "dialog-no-exit", severity: "error", message: "This dialog has no Close, Cancel, or Back control. A person who opens it is trapped unless they know to press Escape.", fix: "Add a visible Close control in the dialog header, top right. A Close placed at the bottom of the dialog is reported as misplaced.", el: modal, rect: box(modal) }], 0);
      }
    }

    // The page itself, at the top and then further down.
    // A fixed or sticky bar covers what scrolls under it. That is only a bug when the page cannot scroll
    // the control out from under it: at the first position of a page that does not scroll, or at the very end.
    const scrolling = modal ? [] : scrollers();
    const canScroll = scrolling.length > 0 || document.documentElement.scrollHeight > innerHeight + 4;
    const floating = (item) => item.kind === "control-covered" && item.floating;
    keep(pass(modal, all).filter((item) => !(floating(item) && !modal && canScroll)), 0);
    const midway = (items) => items.filter((item) => ["control-covered", "control-offscreen"].includes(item.kind) && !floating(item));
    const atEnd = (items) => items.filter(floating);
    for (const scroller of scrolling) {
      const top = scroller.scrollTop;
      const step = Math.max(scroller.clientHeight * 0.8, 120);
      for (let y = step, n = 0; y < scroller.scrollHeight && n < 6; y += step, n += 1) {
        scroller.scrollTop = y;
        keep(midway(pass(null, everything())), Math.round(y));
      }
      scroller.scrollTop = scroller.scrollHeight;
      keep(atEnd(pass(null, everything())), Math.round(scroller.scrollTop));
      scroller.scrollTop = top;
    }
    if (!modal) {
      const y = window.scrollY;
      const step = Math.max(innerHeight * 0.8, 120);
      for (let at = step, n = 0; at < document.documentElement.scrollHeight && n < 6; at += step, n += 1) {
        window.scrollTo(0, at);
        keep(midway(pass(null, everything())), Math.round(at));
      }
      if (document.documentElement.scrollHeight > innerHeight + 4) {
        window.scrollTo(0, document.documentElement.scrollHeight);
        keep(atEnd(pass(null, everything())), Math.round(window.scrollY));
      }
      window.scrollTo(0, y);
    }

    // A sideways scroll already names the element that causes it.
    const culprit = findings.find((item) => item.kind === "scrolls-sideways");
    const reported = culprit ? findings.filter((item) => !(item.kind === "control-offscreen" && item.selector === culprit.selector)) : findings.slice();
    findings.splice(0, findings.length, ...reported);

    const controls = everything().filter((el) => isControl(el) && visible(el) && (!modal || contains(modal, el)));
    const signature = `${modalInfo ? modalInfo.selector : "page"}|${clean((modal || document.body).innerText).slice(0, 1500)}|${controls.length}`;
    // The words on the screen, most distinctive first. They help find the file the screen comes from.
    const lines = String((modal || document.body).innerText || "").split("\n").map((line) => clean(line)).filter((line) => line.length >= 4 && line.length <= 70);
    const texts = [...new Set(lines)].sort((a, b) => b.length - a.length).slice(0, 14);
    return { modal: modalInfo, findings, signature, texts, size: { w: innerWidth, h: innerHeight } };
  }

  function classOf(node) {
    return node && node.nodeType === 1 ? String(node.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
  }

  /** What a person could press right now, with a stable key and where to press. */
  function candidates() {
    const all = everything();
    const modal = findModal(all);
    const seen = new Map();
    const groups = new Map();
    const list = [];
    for (const el of all) {
      if (!isControl(el) || disabled(el) || !visible(el)) continue;
      if (modal && !contains(modal, el)) continue;
      let blocked = false;
      for (let node = parentOf(el); node; node = parentOf(node)) if (node.nodeType === 1 && isControl(node)) { blocked = true; break; }
      if (blocked) continue;
      const tag = el.tagName.toLowerCase();
      const label = labelOf(el);
      const base = `${tag}|${label}`;
      const n = seen.get(base) || 0;
      seen.set(base, n + 1);
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const r = el.getBoundingClientRect();
      const shape = [tag, el.getAttribute("role") || "", classOf(parentOf(el)), classOf(parentOf(parentOf(el)))].join("|");
      groups.set(shape, (groups.get(shape) || 0) + 1);
      list.push({
        key: `${base}|${n}`,
        tag,
        role: el.getAttribute("role") || "",
        shape,
        groupIndex: groups.get(shape) - 1,
        label,
        type: el.type || "",
        href: el.tagName === "A" ? el.getAttribute("href") || "" : "",
        download: el.hasAttribute("download"),
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
        inView: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight + 1
      });
    }
    window.scrollTo(0, 0);
    // A grid of a hundred look-alike buttons is one control to explore, not a hundred.
    for (const item of list) item.groupSize = groups.get(item.shape);
    return { modal: Boolean(modal), list };
  }

  /** Where to press for a key from candidates(), after scrolling it into view. */
  function locate(key) {
    const all = everything();
    const modal = findModal(all);
    const seen = new Map();
    for (const el of all) {
      if (!isControl(el) || disabled(el) || !visible(el)) continue;
      if (modal && !contains(modal, el)) continue;
      let blocked = false;
      for (let node = parentOf(el); node; node = parentOf(node)) if (node.nodeType === 1 && isControl(node)) { blocked = true; break; }
      if (blocked) continue;
      const base = `${el.tagName.toLowerCase()}|${labelOf(el)}`;
      const n = seen.get(base) || 0;
      seen.set(base, n + 1);
      if (`${base}|${n}` !== key) continue;
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: el.tagName.toLowerCase(), type: el.type || "" };
    }
    return null;
  }

  /** The licence or key field on screen, and the button that sends it. */
  function licenseField() {
    const all = everything();
    const modal = findModal(all);
    const WORDS = /licen[sc]e|serial|activation|product key|redeem|\bkey\b|\bcode\b/i;
    for (const el of all) {
      if (!["INPUT", "TEXTAREA", "SP-TEXTFIELD"].includes(el.tagName) || !visible(el) || disabled(el)) continue;
      if (el.tagName === "INPUT" && !["text", "password", "search", ""].includes(el.type)) continue;
      if (modal && !contains(modal, el)) continue;
      const hint = `${el.placeholder || ""} ${el.getAttribute("aria-label") || ""} ${el.name || ""} ${el.id || ""} ${(el.labels && el.labels[0] && el.labels[0].textContent) || ""}`;
      if (!WORDS.test(hint)) continue;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      let button = null;
      for (let node = el, hops = 0; node && !button && hops < 5; node = parentOf(node), hops += 1) {
        const near = everything(node.shadowRoot || node).filter((item) => (item.tagName === "BUTTON" || item.tagName === "SP-BUTTON" || item.getAttribute("role") === "button") && visible(item) && !disabled(item) && /activate|unlock|apply|verify|redeem|submit|save|ok|continue|confirm|enter|use/i.test(labelOf(item)));
        if (near.length) button = near[0];
      }
      let at = null;
      if (button) {
        button.scrollIntoView({ block: "center" });
        const b = button.getBoundingClientRect();
        at = { x: b.left + b.width / 2, y: b.top + b.height / 2, label: labelOf(button) };
      }
      el.scrollIntoView({ block: "center" });
      const r2 = el.getBoundingClientRect();
      return { field: { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 }, button: at };
    }
    return null;
  }

  function clear() {
    document.getElementById("__review_marks")?.remove();
  }
  function mark(items) {
    clear();
    const layer = document.createElement("div");
    layer.id = "__review_marks";
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    items.forEach((item, i) => {
      const r = item.rect;
      if (!r || !r.w || !r.h) return;
      const frame = document.createElement("div");
      frame.style.cssText = `position:absolute;left:${r.x - 3}px;top:${r.y - 3}px;width:${r.w + 6}px;height:${r.h + 6}px;border:2px solid #ff2d6f;border-radius:6px;box-shadow:0 0 0 2px rgba(255,255,255,.9)`;
      const tag = document.createElement("div");
      tag.textContent = String(i + 1);
      tag.style.cssText = "position:absolute;left:-2px;top:-19px;background:#ff2d6f;color:#fff;font:700 11px/17px system-ui,sans-serif;padding:0 6px;border-radius:9px";
      frame.append(tag);
      layer.append(frame);
    });
    document.documentElement.append(layer);
  }

  window.__expressReview = { audit, candidates, locate, licenseField, mark, clear, version: 1 };
})();
