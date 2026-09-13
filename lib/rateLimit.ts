import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

/**
 * Rate limit на подбор пароля/спам регистраций (ключи вида "login:+79990000000"
 * или "login:ip:1.2.3.4"). На Vercel serverless-функции не делят память между
 * инстансами и переживают холодный старт —in-memory счётчик там по факту не
 * защищает ничего. Поэтому основной путь — Upstash Redis: подключается в один
 * клик через Vercel Marketplace → Upstash for Redis, интеграция сама пропишет
 * UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.
 *
 * Если переменные не заданы (например, локальная разработка без Redis) —
 * откатываемся на in-memory лимит. Он даёт базовую защиту для одного
 * постоянного процесса, но не переживает рестарт и не общий между инстансами —
 * на проде без настроенного Upstash полагаться на него нельзя.
 */

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null

if (!redis && process.env.NODE_ENV === "production") {
  console.warn(
    "[rateLimit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN не заданы — используется in-memory лимит, " +
      "который не защищает между serverless-инстансами. Подключите Upstash for Redis в Vercel.",
  )
}

// Разные вызовы приходят с разными (limit, windowMs) — держим по лимитеру на
// каждую уникальную пару, а не создаём новый объект на каждый запрос.
const limiters = new Map<string, Ratelimit>()

function getLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`
  let limiter = limiters.get(cacheKey)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: "dragonvpn:ratelimit",
    })
    limiters.set(cacheKey, limiter)
  }
  return limiter
}

const buckets = new Map<string, number[]>()

function isRateLimitedInMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs)
  hits.push(now)
  buckets.set(key, hits)
  return hits.length > limit
}

export async function isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!redis) return isRateLimitedInMemory(key, limit, windowMs)

  const { success } = await getLimiter(limit, windowMs).limit(key)
  return !success
}
