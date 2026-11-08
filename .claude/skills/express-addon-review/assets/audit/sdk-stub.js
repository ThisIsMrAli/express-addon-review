// A stand-in for Adobe's add-on SDK, served to the panel by the audit in place of
// https://new.express.adobe.com/static/add-on-sdk/sdk.js.
//
// The real SDK waits for a message from Express before `ready` resolves. A panel opened on its own never gets
// it, so any add-on that renders after `await addOnUISdk.ready` stays blank. The audit answers that one request
// itself, so the add-on does not have to change, and nobody has to put a fake host into the add-on's code.
//
// It only lets the panel draw and the controls be pressed. It does nothing in a document, and it does not
// check a method's name: a misspelled SDK call is found by the source scan, not here.
const __deep = (name) => new Proxy(function () {}, {
  get(_, key) {
    // Empty, so a destructure or a spread of something the host would have filled in does not throw.
    if (key === Symbol.iterator) return function* () {};
    if (key === Symbol.toPrimitive) return () => "";
    if (key === "then" || typeof key === "symbol") return undefined;
    if (key === "toString" || key === "valueOf" || key === "toJSON") return () => "";
    return __deep(`${name}.${String(key)}`);
  },
  apply() { return __deep(`${name}()`); },
  construct() { return __deep(`new ${name}`); }
});

const __dark = () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
const __sdk = new Proxy({}, {
  get(_, key) {
    switch (key) {
      case "ready": return Promise.resolve();
      case "apiVersion": return "1.0.0";
      case "__standIn": return true;
      case "then": return undefined;
      case "app": return new Proxy({}, {
        get(__, name) {
          if (name === "ui") {
            return new Proxy({}, {
              get(___, member) {
                if (member === "theme") return __dark() ? "dark" : "light";
                if (member === "locale" || member === "locales") return member === "locale" ? "en-US" : ["en-US"];
                if (member === "on" || member === "off") return () => {};
                return __deep(`app.ui.${String(member)}`);
              }
            });
          }
          return typeof name === "symbol" ? undefined : __deep(`app.${String(name)}`);
        }
      });
      default: return typeof key === "symbol" ? undefined : __deep(String(key));
    }
  }
});
