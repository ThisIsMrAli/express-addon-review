# A rejection letter

When the user pastes a rejection email, or says the add-on was rejected, start here. The goal is that the next submission answers every point, so there is no second round.

Do not skip the normal review. A letter names the points the reviewer reached. A reviewer who sees a clean first page often finds more on the next pass. Check the letter's points first and then the rest.

## 1. Number the reasons

Read the letter and list each separate reason as one short line, in the reviewer's words. Do not merge two reasons. Do not drop a reason that looks minor. Do not add one the letter does not say.

Put each on the session as a note named `r1`, `r2`, and so on, so the user sees all of them and each one is tracked until it is fixed:

```bash
node scripts/session.mjs note --id r1 --text "Reviewer 1: no way to cancel the export" --screen "Rejection letter"
```

Do this after `review.mjs`, before the panel walk.

## 2. Find where each one is checked

| The letter says | Where to look |
| --- | --- |
| Adobe logo, Adobe name, brand, "Express" | `name-adobe-express`, `offering-name-order`, `adobe-logo-file`, `name-looks-official`, the listing images, and the publisher website |
| Crown, lock, Premium, Pro, paid marks | `crown-icon`, `lock-icon`, `premium-word`, `pro-plan`, `paid-state-conflict`, and the paid screens after a license |
| No Cancel, trapped, cannot go back | `cancel-missing`, `export-without-cancel`, and the "no way back" check in [visual.md](visual.md) |
| Blank panel, does not load, only works for you | `unpkg-cdn`, `entrypoint-file`, `package-entry`, and the throttled and offline walk in [visual.md](visual.md) |
| Cannot log in, no credentials, no credits | the `credentials` question, and the notes to the reviewer in [submission.md](submission.md) |
| Manifest not found, package too big, wrong zip | `package-root`, `package-size`, `package-hidden`, `package-stale` |
| Screenshot, icon, listing wrong | `listing-icon`, `listing-screenshot`, and [listing-shots.md](listing-shots.md) |
| Does not follow the Express design, wrong font, plain controls | `font-not-adobe-clean`, `control-not-spectrum`, `spectrum-not-express`, and [spectrum.md](spectrum.md) |
| A button or feature does nothing, an error in the console | `handler-does-nothing`, `sdk-method-unknown`, and the click-through in [visual.md](visual.md) |
| Dark theme, unreadable, contrast | `theme-missing`, and the dark pass in [visual.md](visual.md) |
| Label, alt text, keyboard | `field-label`, `image-alt`, `button-name`, and the keyboard pass |
| A number like `4.11e+28`, empty input | `input-bounds`, `unbounded-number` |
| Does not work in Firefox or Safari | a person check. Say so, and test it |

If a reason matches no row, it is specific to this add-on. Find it in the panel walk. Do not make up a rule for it.

## 3. Verify each one by itself

For each numbered reason, write one of three answers, and never a vague "looks fine":

- **Fixed and checked.** Name the file, and the screen where you saw it gone, in light and in dark at 320px.
- **Could not reproduce.** Say what you tried. Do not say the reviewer was wrong.
- **Needs you.** The point depends on something only the user has: a credential, another browser, the publisher site, or a decision.

Mark each note `fixed` or `skipped` with `session.mjs note --id r1 --status fixed`.

## 4. Give the user the reply

At the end, write the "Notes to the reviewer" for the new submission. It is plain text the user pastes into the form:

- One line per reason from the letter, and what changed for it.
- The test credentials line, with credits for any AI or credit-based flow. Leave the secret out. Say "add them here".
- Anything that cannot be proved from source, such as browsers tested.

Say what the user still has to do by hand. Do not say the add-on will be approved.
