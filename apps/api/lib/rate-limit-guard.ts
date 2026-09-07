export interface RateLimitDecision {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  provider: "upstash" | "memory";
}

const buckets = new Map<string, number[]>();

function memorySlidingWindow(identifier: string, rpm: number, now = Date.now()): RateLimitDecision {
  const windowMs = 60_000;
  const cutoff = now - windowMs;
  const hits = (buckets.get(identifier) ?? []).filter((t) => t > cutoff);

  if (hits.length >= rpm) {
    const oldest = hits[0] ?? now;
    buckets.set(identifier, hits);
    return { success: false, limit: rpm, remaining: 0, reset: oldest + windowMs, provider: "memory" };
  }

  hits.push(now);
  buckets.set(identifier, hits);
  return {
    success: true,
    limit: rpm,
    remaining: Math.max(0, rpm - hits.length),
    reset: now + windowMs,
    provider: "memory",
  };
}

export function resetMemoryBuckets(): void {
  buckets.clear();
}

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function checkRateLimit(identifier: string, rpm: number): Promise<RateLimitDecision> {
  if (!upstashConfigured()) {
    return memorySlidingWindow(identifier, rpm);
  }

  const { createRateLimiter, slidingWindow } = await import("@repo/rate-limit");
  const limiter = createRateLimiter({
    limiter: slidingWindow(rpm, "60 s"),
    prefix: "screenshot-api",
  });
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    provider: "upstash",
  };
}

export function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  const retryAfter = Math.max(0, Math.ceil((decision.reset - Date.now()) / 1000));
  return {
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": String(Math.ceil(decision.reset / 1000)),
    "X-RateLimit-Provider": decision.provider,
    ...(decision.success ? {} : { "Retry-After": String(retryAfter) }),
  };
}
