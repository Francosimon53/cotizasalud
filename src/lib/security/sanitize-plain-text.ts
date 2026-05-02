// Plain-text sanitization for non-HTML message bodies (WhatsApp/SMS body,
// email subject lines). HTML escaping is *not* useful here — the channel
// doesn't render HTML — but control characters can break SDK serialization
// or duplicate lines in some clients, and unbounded length can blow past
// provider limits. This strips control chars and applies an optional cap.
//
// Strips the C0 control set (U+0000..U+001F) and DEL (U+007F).

export function sanitizePlainText(
  value: unknown,
  opts: { maxLength?: number } = {}
): string {
  if (value == null) return "";
  const src = String(value);
  let out = "";
  for (let i = 0; i < src.length; i++) {
    const code = src.charCodeAt(i);
    if ((code >= 0x00 && code <= 0x1f) || code === 0x7f) continue;
    out += src[i];
  }
  if (typeof opts.maxLength === "number" && out.length > opts.maxLength) {
    out = out.slice(0, opts.maxLength);
  }
  return out;
}
