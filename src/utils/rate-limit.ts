import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { AUTH_CONFIG } from "@/config/auth";
import { NextRequest } from "next/server";

/**
 * Securely get client IP address from request headers.
 * Handles various proxy scenarios and prevents IP spoofing.
 */
export function getClientIp(request: NextRequest): string {
  // Check Vercel-specific headers first (most reliable in Vercel environment)
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) return vercelForwardedFor.split(",")[0];

  // Then check x-real-ip (set by many reverse proxies)
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  // Finally check x-forwarded-for (less reliable, but better than nothing)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0];

  // Fallback to localhost if no IP found
  return "127.0.0.1";
}

// If API rate limiting isn't enabled in the auth config, or Redis isn't configured, rate limiting will be disabled
const redis =
  AUTH_CONFIG.api_rate_limit.enabled &&
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
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

// Strict tier for SMS operations with both IP and user-based limits
export const smsRateLimit = redis
  ? {
      // IP-based limit (3 per hour)
      ip: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        analytics: true,
        prefix: "@upstash/ratelimit/sms/ip",
      }),
      // User-based limit (5 per 24 hours)
      user: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "24 h"),
        analytics: true,
        prefix: "@upstash/ratelimit/sms/user",
      }),
    }
  : null;

// Strict tier for data export operations (3 requests per day)
export const dataExportRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "24 h"),
      analytics: true,
      prefix: "@upstash/ratelimit/data-export",
    })
  : null;
