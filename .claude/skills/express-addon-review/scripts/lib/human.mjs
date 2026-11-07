export const HUMAN_CHECKS = [
  {
    id: "running-panel",
    message: "The scanner cannot see the running panel. The skill's audit opens it at 320px in light and dark and measures the layout. The checks below are what a measurement cannot prove."
  },
  {
    id: "license-state",
    message: "After a test license or login, confirm paid marks disappear or clearly say the item is already included."
  },
  {
    id: "no-way-back",
    message: "The audit flags a dialog with no exit and a close button in the wrong place. Confirm by hand any screen it could not reach: every screen, dialog, and menu needs a way to go back, close, or cancel. Adobe's review team says most rejections are functional, and a user with no way out is the usual cause."
  },
  {
    id: "export-cancel",
    message: "Start a long encode or export and confirm Cancel actually stops it. When the work has already gone to a server and cannot be stopped, the panel must say so, and say whether credits are still used."
  },
  {
    id: "rendition-progress",
    message: "Confirm a rendition shows progress and the finished file can be downloaded or placed."
  },
  {
    id: "contrast",
    message: "Read success and error text in light and dark. Adobe requires it to be readable and does not publish a contrast ratio."
  },
  {
    id: "credentials",
    message: "If the add-on needs a login or a license key, put test credentials in the review notes. If it uses AI or another credit-based flow, leave enough credits for a full test. An empty license key needs a validation message, and the user must be able to deactivate or replace the key."
  },
  {
    id: "browsers",
    message: "Try Chrome, Safari, Edge, and Firefox, and throttle the network once. Adobe's reviewers test on all four, and a panel that works only on a fast localhost is a common rejection."
  },
  {
    id: "publisher-site",
    message: "Reviewers open the publisher website. Check its name, logo, and domain there too."
  },
  {
    id: "generated-output",
    message: "Illegal, adult, or hateful generative output cannot be judged from source."
  },
  {
    id: "listing-form",
    message: "The publisher form is the last question. Do not draft it, and do not read it from index.html, until they say yes."
  }
];
