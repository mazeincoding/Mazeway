import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// If Redis isn't configured, rate limiting will be disabled
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

// Strict tier for auth operations (10 requests per 10 seconds)
export const authRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 s"),
      analytics: true,
      prefix: "@upstash/ratelimit/auth",
    })
  : null;

// Medium tier for authenticated operations (100 requests per minute)
export const apiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "60 s"),
      analytics: true,
      prefix: "@upstash/ratelimit/api",
    })
  : null;

// Basic tier for general protection (1000 requests per minute)
export const basicRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1000, "60 s"),
      analytics: true,
      prefix: "@upstash/ratelimit/basic",
    })
  : null;
