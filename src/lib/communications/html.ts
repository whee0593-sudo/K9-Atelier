function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Text-only view of a stored snapshot.
 * The HTML column stays in the database for audit, but this helper never
 * returns markup a browser would execute.
 */
export function communicationSnapshotAsText(input: {
  bodyText: string;
  bodyHtml?: string | null;
}) {
  const text = input.bodyText ?? "";
  if (!input.bodyHtml) return text;
  const escaped = escapeHtml(input.bodyHtml);
  return text ? `${text}\n\n${escaped}` : escaped;
}
