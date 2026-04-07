const hits = new Map<string, { count: number; resetAt: number }>();

// Clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of hits) {
    if (now > val.resetAt) hits.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Simple in-memory rate limiter.
 * Returns { limited: true } if the caller exceeded `max` requests within `windowMs`.
 */
export function rateLimit(
  ip: string,
  { max, windowMs }: { max: number; windowMs: number }
): { limited: boolean } {
  const now = Date.now();
  const key = ip;
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  entry.count++;
  if (entry.count > max) {
    return { limited: true };
  }
  return { limited: false };
}
