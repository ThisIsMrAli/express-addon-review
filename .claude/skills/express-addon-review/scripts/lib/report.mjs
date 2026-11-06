export function renderMarkdown(report) {
  const lines = [
    "# Express add-on review",
    "",
    `Add-on: ${report.addon || "unknown"}`,
    ""
  ];
  if (report.docsSha) lines.push(`Docs revision: ${report.docsSha}`, "");
  section(lines, "Errors", report.findings.filter((finding) => finding.severity === "error" && finding.source?.kind !== "review-pattern"));
  section(lines, "Warnings", report.findings.filter((finding) => finding.severity === "warn" && finding.source?.kind !== "review-pattern"));
  section(lines, "Review patterns", report.findings.filter((finding) => finding.source?.kind === "review-pattern"));
  if (report.views?.length) {
    lines.push("## Views to open", "");
    for (const view of report.views) lines.push(`- ${view.kind}: ${view.name}${view.url ? ` ${view.url}` : ""} (${view.file}:${view.line})`);
    lines.push("");
  }
  return lines.join("\n");
}

function section(lines, title, findings) {
  lines.push(`## ${title}`, "");
  if (!findings.length) {
    lines.push("None.", "");
    return;
  }
  for (const finding of findings) {
    const link = finding.source?.url ? ` ${finding.source.url}` : "";
    lines.push(`- \`${finding.id}\` ${finding.file}:${finding.line}${link}`, `  ${finding.message}`, `  Edit: ${finding.suggestion}`, "");
  }
}
