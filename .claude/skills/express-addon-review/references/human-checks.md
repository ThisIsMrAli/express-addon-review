# Still needs a person

The scanner does not open Adobe Express. `audit.mjs` simulates the panel in a browser at 320px wide and finds layout bugs. It cannot judge taste or meaning.

- Whether the screens make sense: wording, order, and whether a first-time user knows what to press. The audit measures; it does not read.
- Screens the audit could not reach: behind a login, a long task, or a control it is told never to press. `session.json` lists what it skipped.
- Paid marks after a real license or login. With a test license, `audit.mjs --licensed` walks the paid screens too.
- A long encode whose Cancel button really stops the work.
- A rendition that shows progress and produces a file.
- Success and error text that can be read. Adobe does not publish a 4.5:1 ratio.
- Test credentials in the review notes when the add-on logs in.
- Chrome, Safari, Edge, and Firefox, including a slow network.
- The publisher website.
- Illegal or hateful generative output.
- The publisher form: listing, screenshots, version, AI usage, monetization, publisher profile, and notes to the reviewer. Ask. Do not invent the answers.
