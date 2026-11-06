export const REPO = "AdobeDocs/express-add-ons-docs";
export const BRANCH = "main";

export const TREE_PREFIXES = [
  "src/pages/guides/"
];

export const TREE_FILES = [
  "static/pdf/Adobe_Express_Developer_Program_brand_guide_100625.pdf"
];

export const EXTRA_PAGES = [
  {
    key: "extra/manifest.txt",
    url: "https://developer.adobe.com/express/add-ons/docs/references/manifest/"
  },
  {
    key: "extra/premium-content.txt",
    url: "https://developer.adobe.com/express/add-ons/docs/guides/learn/how-to/premium-content"
  },
  {
    key: "extra/rejections-blog.txt",
    url: "https://blog.developer.adobe.com/en/publish/2026/05/how-to-get-your-adobe-express-add-on-approved-avoiding-the-most-common-rejections"
  }
];

export const BRAND_PDF = "static/pdf/Adobe_Express_Developer_Program_brand_guide_100625.pdf";
export const BRAND_TEXT = "static/pdf/Adobe_Express_Developer_Program_brand_guide_100625.txt";

export function publishedUrl(repoPath) {
  const page = repoPath
    .replace(/^src\/pages\//, "")
    .replace(/\/index\.md$/, "")
    .replace(/\.md$/, "");
  return `https://developer.adobe.com/express/add-ons/docs/${page}`;
}

export function rawUrl(repoPath) {
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${repoPath}`;
}
