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

`@spectrum-icons/express` is the Express icon set named in the implementation guide. Do not import a default Spectrum icon for a control you are already theming for Express.

Tailwind, `react-icons`, or another custom control stays until they ask to replace that control.

## Listing pages that disagree

`distribute/listing-guide.md` is an older listing walkthrough. It still mentions three icon sizes. `distribute/public-dist.md` is the field list. When they disagree, use `public-dist.md`.
