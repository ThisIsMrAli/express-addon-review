import fs from "node:fs";
import path from "node:path";

export function detectDesign(projectRoot, addonDir, files = []) {
  const deps = readDeps(projectRoot) || readDeps(addonDir) || readDeps(path.dirname(addonDir)) || {};
  const names = Object.keys(deps);
  const swcReact = names.filter((name) => name.startsWith("@swc-react/"));
  const swc = names.filter((name) => name.startsWith("@spectrum-web-components/"));
  const reactSpectrum = names.filter((name) => name === "@adobe/react-spectrum" || name.startsWith("@react-spectrum/"));
  const libraries = [];
  if (swcReact.length) libraries.push("swc-react");
  if (swc.length) libraries.push("spectrum-web-components");
  if (reactSpectrum.length) libraries.push("react-spectrum");
  const expressTheme = names.includes("@react-spectrum/theme-express")
    || names.includes("@spectrum-icons/express")
    || files.some((file) => /system\s*=\s*["']express["']|theme\/express\/|@react-spectrum\/theme-express/.test(file.text));
  return {
    libraries,
    expressTheme,
    tailwind: names.includes("tailwindcss"),
    swcReact,
    swc,
    reactSpectrum
  };
}

function readDeps(dir) {
  if (!dir) return null;
  const file = path.join(dir, "package.json");
  if (!fs.existsSync(file)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return null;
  }
}
