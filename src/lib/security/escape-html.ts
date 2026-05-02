// HTML entity escaping for safe interpolation into HTML email templates.
// Covers the OWASP recommended set for HTML body context.
//
// This is *body context only*. Don't use it for URLs or JS string contexts —
// use encodeURIComponent / JSON.stringify for those.

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const HTML_ESCAPE_RE = /[&<>"']/g;

export function escapeHtml(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(HTML_ESCAPE_RE, (c) => HTML_ESCAPE_MAP[c]);
}
