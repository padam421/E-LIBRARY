import { readPositiveIntEnv } from "../config/runtimeLimits.js";

const buckets = new Map();
let requestCounter = 0;
const maxBuckets = readPositiveIntEnv("RATE_LIMIT_MAX_BUCKETS", 100000, {
  min: 1000,
  max: 1000000,
});

function getClientAddress(req) {
  if (req.ip) {
    return req.ip;
  }

  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0] || "").trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown"
  );
}

function cleanupExpiredBuckets(now) {
  requestCounter += 1;
  if (requestCounter % 50 !== 0 && buckets.size <= maxBuckets) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  while (buckets.size > maxBuckets) {
    const oldestKey = buckets.keys().next().value;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 60,
  message = "Too many requests. Please try again later.",
  keyPrefix = "rate-limit",
} = {}) {
  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredBuckets(now);

    const key = `${keyPrefix}:${getClientAddress(req)}`;
    const existingBucket = buckets.get(key);
    const bucket =
      existingBucket && existingBucket.resetAt > now
        ? existingBucket
        : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000),
    );

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, max - bucket.count)),
    );
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: message,
        retryAfterSeconds,
      });
    }

    return next();
  };
}
