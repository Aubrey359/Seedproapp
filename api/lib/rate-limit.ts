// Simple in-memory, per-key rate limiter. Resets on server restart and
// doesn't share state across instances — fine at this app's current scale,
// and specifically NOT meant to be bulletproof, just to stop a script from
// quietly draining paid API credits through a public, unauthenticated endpoint.
const hits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxPerWindow: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxPerWindow) return false;
  entry.count += 1;
  return true;
}
