import { NextResponse } from "next/server";

const buckets = new Map<string, number[]>();

export const RATE_LIMITS = {
  siteAccess: { limit: 5, windowMs: 15 * 60 * 1000 },
  support: { limit: 8, windowMs: 10 * 60 * 1000 },
  notify: { limit: 5, windowMs: 10 * 60 * 1000 },
  travelFee: { limit: 20, windowMs: 10 * 60 * 1000 },
} as const;

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
  store?: Map<string, number[]>;
}): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = input.now ?? Date.now();
  const store = input.store ?? buckets;
  const fresh = (store.get(input.key) ?? []).filter(
    (stamp) => now - stamp < input.windowMs,
  );

  if (fresh.length >= input.limit) {
    const retryAfterMs = input.windowMs - (now - fresh[0]!);
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  fresh.push(now);
  store.set(input.key, fresh);
  pruneStore(store, now);
  return { ok: true };
}

export function rateLimitResponse(retryAfterSec: number, message?: string) {
  return NextResponse.json(
    {
      error:
        message ?? "Too many attempts. Please wait a moment and try again.",
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

export function enforceIpRateLimit(
  request: Request,
  scope: keyof typeof RATE_LIMITS,
) {
  const { limit, windowMs } = RATE_LIMITS[scope];
  const result = consumeRateLimit({
    key: `${scope}:${clientIp(request)}`,
    limit,
    windowMs,
  });
  if (result.ok) return null;
  return rateLimitResponse(result.retryAfterSec);
}

export function clearRateLimitStore() {
  buckets.clear();
}

function pruneStore(store: Map<string, number[]>, now: number) {
  if (store.size <= 2000) return;
  for (const [key, stamps] of store) {
    if (!stamps.length || now - stamps[stamps.length - 1]! > 60 * 60 * 1000) {
      store.delete(key);
    }
  }
}
