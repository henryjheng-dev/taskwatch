import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

/**
 * 以 Redis 實現的 ThrottlerStorage（固定視窗 + 封鎖）。
 *
 * 動機：@nestjs/throttler 內建的 storage 是記憶體版（ThrottlerStorageService），
 * 多實例水平擴展時每個 process 各自計數，限流會失效。
 * 本實作將計數搬到共享的 Redis，用 Lua script 保證「讀取＋遞增＋過期」的原子性。
 *
 * Key 結構：throttle:{trackerKey}:{throttlerName}（Hash，欄位 totalHits/expiresAt/blockExpiresAt/isBlocked）
 */
const INCREMENT_SCRIPT = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local totalHits = tonumber(redis.call('HGET', key, 'totalHits') or '0')
local expiresAt = tonumber(redis.call('HGET', key, 'expiresAt') or '0')
local blockExpiresAt = tonumber(redis.call('HGET', key, 'blockExpiresAt') or '0')
local isBlocked = redis.call('HGET', key, 'isBlocked') == '1'

-- 視窗過期 → 重置
if expiresAt == 0 or now >= expiresAt then
  expiresAt = now + ttl
  totalHits = 0
end

-- 封鎖期滿 → 解除並重置
if isBlocked and blockDuration > 0 and now >= blockExpiresAt then
  isBlocked = false
  blockExpiresAt = 0
  totalHits = 0
  expiresAt = now + ttl
end

if not isBlocked then
  totalHits = totalHits + 1
end

if totalHits > limit and not isBlocked then
  isBlocked = true
  blockExpiresAt = now + blockDuration
end

redis.call('HSET', key,
  'totalHits', totalHits,
  'expiresAt', expiresAt,
  'blockExpiresAt', blockExpiresAt,
  'isBlocked', isBlocked and '1' or '0')

-- key 的 TTL 取 ttl 與 blockDuration 較大者，避免封鎖期間資料被清掉
local ttlMillis = ttl
if blockDuration > ttlMillis then ttlMillis = blockDuration end
redis.call('PEXPIRE', key, ttlMillis)

local timeToExpire = math.ceil((expiresAt - now) / 1000)
local timeToBlockExpire = 0
if isBlocked and blockExpiresAt > 0 then
  timeToBlockExpire = math.ceil((blockExpiresAt - now) / 1000)
end

return { totalHits, timeToExpire, isBlocked and 1 or 0, timeToBlockExpire }
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const hashKey = `throttle:${key}:${throttlerName}`;
    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] =
      (await this.redis.eval(
        INCREMENT_SCRIPT,
        1,
        hashKey,
        ttl,
        limit,
        blockDuration,
        Date.now(),
      )) as [number, number, number, number];

    return {
      totalHits,
      timeToExpire,
      isBlocked: isBlocked === 1,
      timeToBlockExpire,
    };
  }
}
