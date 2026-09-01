import { Redis } from "ioredis";
import { env } from "../config/env.js";

const CONSUME_LUA = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return n
`;

type MemoryBucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, MemoryBucket>();
let redis: Redis | null = null;

export const CHAT_RATE_MAX = env.CHAT_RATE_MAX;
export const CHAT_RATE_WINDOW_SEC = env.CHAT_RATE_WINDOW_SEC;

export async function connectRedis(): Promise<Redis | null> {
  if (env.NODE_ENV === "test") {
    return null;
  }
  if (!env.REDIS_URL) {
    return null;
  }
  if (redis) {
    return redis;
  }

  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout: 2000
  });
  client.on("error", () => {
    // Avoid crashing on blips; consumeToken falls back to memory.
  });

  try {
    await client.connect();
    await client.ping();
    redis = client;
    return client;
  } catch {
    client.disconnect();
    return null;
  }
}

export function getRedis(): Redis | null {
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (!redis) {
    return;
  }
  const client = redis;
  redis = null;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}

export async function consumeChatMessage(userId: string): Promise<boolean> {
  return consumeToken(
    `rl:chat:${userId}`,
    CHAT_RATE_MAX,
    CHAT_RATE_WINDOW_SEC
  );
}

/** Returns true when the caller is still under `max` uses in this window. */
export async function consumeToken(
  key: string,
  max: number,
  windowSec: number
): Promise<boolean> {
  if (redis) {
    try {
      const count = await redis.eval(CONSUME_LUA, 1, key, String(windowSec));
      return Number(count) <= max;
    } catch {
      // Fall through to the process-local bucket if Redis blips.
    }
  }
  return consumeMemory(key, max, windowSec);
}

export function resetMemoryRateLimits(): void {
  memoryBuckets.clear();
}

function consumeMemory(key: string, max: number, windowSec: number): boolean {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  let bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    memoryBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= max;
}
