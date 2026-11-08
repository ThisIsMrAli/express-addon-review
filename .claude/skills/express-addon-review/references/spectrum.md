# Spectrum and the Express design pages

The session asks this. Do not restyle the panel until the answer is yes.

When they say yes, read the fresh downloads before writing UI. If a page and this note disagree, follow the page.

- `src/pages/guides/build/design/implementation-guide.md` is the component choice.
- `src/pages/guides/build/design/ux-guidelines/theming.md` is the Express theme.
- `src/pages/guides/build/design/ux-guidelines/` is the rest of the UX guide: visual elements, branding, feedback, mobile, and principles.
- `src/pages/guides/build/design/best-practices.md` and `fonts.md` are design guidance. `best-practices.md` still says only the light theme exists. `learn/how-to/theme-locale.md` is the theme rule: light and dark both exist, and a submission after August 31, 2026 is rejected when dark theme is unusable. Follow theme-locale.
- `learn/how-to/tutorials/spectrum-workshop/` is the worked example. Use it for the import and the theme tag. Do not copy the bingo card.

## What the current implementation guide prefers

Spectrum Web Components are the preferred controls. For a React add-on, `swc-react` is preferred over React Spectrum. Spectrum CSS is for a simple control only. React Spectrum's Express theme package is described there as alpha.

The Express theme on a Spectrum Web Component page is `<sp-theme>` with `scale="medium"`, `color="light"` or `color="dark"`, and `system="express"`. Import the Express color and scale modules the implementation guide lists, not the default Spectrum theme. Keep the theme in sync with `addOnUISdk.app.ui.theme` and the `themechange` event. The theme-locale page says Spectrum Web Components follow dark theme on their own.

Match the stack the scan already found.

- No Spectrum library: add Spectrum Web Components and the Express theme. Do not add React Spectrum beside them.
- `swc-react` or Spectrum Web Components only: keep that library. Review the controls against the UX pages.
- React Spectrum only: leave it unless they agree to move. The guide prefers `swc-react`, and it also documents `@react-spectrum/theme-express` while that package is alpha.
- Both `swc-react` and React Spectrum: the guide says not to keep two component sets. Move a control only after they say yes. Do not rewrite the panel in one pass.

Swapping a control changes how it reports an event, so do it with care:

- Use the library's own wrapper and its documented props. A raw Spectrum Web Component (`<sp-tabs>`, `<sp-slider>`) fires `change` on the element, which does not reach a React `onChange`, and its `selected` or `value` is read as a property, so set it as one. `swc-react` wrappers already map these. Look the control up in the fetched docs before writing the swap.
- Swap one kind of control at a time (all buttons, then all fields), and run the add-on's build or type check after each kind. A type error found there costs seconds. The same error found by an audit costs a minute.
- A swap is only done when the screen it opens still opens. The full walk reports `screen-lost` when a screen the earlier walk reached cannot be reached now.

`@spectrum-icons/express` is the Express icon set named in the implementation guide. Do not import a default Spectrum icon for a control you are already theming for Express.

Tailwind, `react-icons`, or another custom control stays until they ask to replace that control.

## What the scan finds before any browser opens

These come from the code alone, so fix them in the same pass as the other code findings:

- `font-not-adobe-clean`: a `font-family` that names another typeface. `design/fonts.md` says the Adobe Express fonts, including `adobe-clean` in weights 400, 700, 800, and 900, are injected into the add-on and need no bundling. The visual-elements page says Spectrum is based on Adobe Clean. Custom fonts are allowed, but a body font that differs from the host looks wrong next to it. The fix is to delete the declaration, or use `var(--spectrum-sans-font-family-stack)`. A `!important` font blocks the theme and is always wrong.
- `control-not-spectrum`: a plain `<button>`, `<input>`, `<select>`, or `<textarea>`. Replace it with the Spectrum control for the same job, in the library the project already uses. Keep the same handler and props, and change nothing else in the file. Replace a control only when that library ships one that does the same job. Spectrum Web Components has no work-ready color control, so an `<input type="color">` stays as it is. Do not stand in for it with a text field or a row of swatches.
- `spectrum-not-express`: the project uses Spectrum and never selects `system="express"`.
- `handler-does-nothing`: a control is wired to a function with an empty body. Write the action. If the feature does not exist, ask before removing the control.
- `sdk-method-unknown`: a call one or two letters from a documented Add-on SDK member. Use the documented name.

## Listing pages that disagree

`distribute/listing-guide.md` is an older listing walkthrough. It still mentions three icon sizes. `distribute/public-dist.md` is the field list. When they disagree, use `public-dist.md`.
