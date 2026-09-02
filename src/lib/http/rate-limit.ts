/**
 * Minimal in-memory token-bucket rate limiter (single-process, appropriate
 * for this app's current local/single-user deployment shape). Protects the
 * AI-triggering endpoints (transcript ingestion, manual ask) from runaway
 * loops or accidental floods.
 */
interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, maxPerWindow: number, windowMs: number): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: maxPerWindow, lastRefill: now };
    buckets.set(key, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  if (elapsed > windowMs) {
    bucket.tokens = maxPerWindow;
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) return false;
  bucket.tokens -= 1;
  return true;
}
