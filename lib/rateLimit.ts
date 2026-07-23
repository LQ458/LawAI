import "server-only";

import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";

type RateLimitBucket = "rag" | "chat" | "summary" | "activity";

const limiters: Record<RateLimitBucket, RateLimiterMemory> = {
  rag: new RateLimiterMemory({ points: 20, duration: 60 }),
  chat: new RateLimiterMemory({ points: 20, duration: 60 }),
  summary: new RateLimiterMemory({ points: 10, duration: 60 }),
  activity: new RateLimiterMemory({ points: 30, duration: 60 }),
};

function anonymousKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  const address =
    forwarded?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(address).digest("base64url");
}

export async function consumeRateLimit(
  bucket: RateLimitBucket,
  request: NextRequest,
  authenticatedSubject: string | null,
): Promise<boolean> {
  const key = authenticatedSubject
    ? `authenticated:${createHash("sha256")
        .update(authenticatedSubject)
        .digest("base64url")}`
    : `anonymous:${anonymousKey(request)}`;

  try {
    await limiters[bucket].consume(key);
    return true;
  } catch {
    return false;
  }
}
