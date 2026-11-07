# Polish

A small pass over the panel, run only when the user chose **apply** in the `polish` question. It fixes what a checklist can measure and name. It does not redesign anything.

**Stays as it is:** colors, fonts, layout, copy, Spectrum components, Adobe branding, the way screens connect.
**Not added:** new components, new screens, new animations beyond state feedback.

The bugs the audit measures as errors are already fixed by now and are not part of this pass. This pass is the layer above them.

## Checklist

Each line is one edit when it fails. Make the smallest edit that fixes it.

**Targets and type**
- Every control is at least 24×24 CSS px, with 8px between neighbors. In a 320px panel, 32 to 40px is better. The audit reports `small-target`.
- Body text is 12px or more. Nothing is under 11px. Paragraph line height is 1.4 to 1.5. The audit reports `small-type`.
- Long names wrap or truncate with a title or tooltip. No text is clipped. The audit reports `text-clipped`.

**Contrast and color**
- Text is 4.5:1 against its background. Icons and input borders are 3:1. Check light and dark. The audit reports `low-contrast` for the theme where it fails.
- Status is never color alone. Pair color with an icon and a word.
- Colors come from Spectrum tokens or the add-on's own variables, not raw hex in components.

**Keyboard and screen reader**
- Every control shows a focus ring. Do not write `outline: none` without a replacement.
- Tab order follows the visual order.
- An icon-only button has an `aria-label` or a Tooltip. The audit reports `click-without-keyboard` for a clickable element that is not a button or link.

**Spacing**
- Spacing uses a 4 or 8px scale: 4, 8, 12, 16, 24. Replace a stray 5, 7, or 13px with the nearest step.
- Panel side padding is the same on every screen.

**State feedback**
- Anything that takes longer than about 300ms shows a spinner or skeleton, and disables its button while it runs. No double submit.
- An empty list says what to do next, in one sentence, with one action.
- An error sits next to the field it belongs to and says how to fix it, not just "Error".

**Dialogs**
- The title is first, the close control is top right, and the main action is visible without scrolling at 320×600.
- Escape closes it, and focus goes back to the control that opened it.

**Motion**
- Animate `transform` and `opacity` only, 150 to 250ms.
- Honor `prefers-reduced-motion`: no movement, only the state change.

## How to run it

1. Start from the open warnings in the session (`session.mjs show`) and the dashboard's Panel tab. Add what you can see by reading the code against the checklist.
2. Make each edit one at a time. Do not batch a refactor into a polish pass.
3. Run `node scripts/audit.mjs` again. A polish edit counts only if the audit no longer measures the problem, or the checklist line now holds.
4. In the closing summary, name each edit in one line: the screen, the change, why.

On **review**, do step 1 and print each item as `screen, what fails, the exact edit`. Change nothing.

## When the ui-ux-pro-max skill is installed

It can explain one concern in depth: `search.py "<one concern>" --domain ux`. Use it for a single rule you are unsure about. Do not install it, and do not pull its style or palette recommendations into this add-on. They are for new designs, and this pass is not one.
