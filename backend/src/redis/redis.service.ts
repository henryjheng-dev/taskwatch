import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * 封裝所有 Redis 操作。
 * 目前用途：AI 每日使用次數計數（PRD §8.3）。
 */
@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * 原子遞增計數器，第一次呼叫時設定 TTL。
   * 用於 AI 每日限額計數。
   * @returns 遞增後的數值
   */
  async increment(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.redis.incr(key);
    // 第一次呼叫時設定過期時間（之後的 incr 不會重置 TTL）
    if (count === 1) {
      await this.redis.expire(key, ttlSeconds);
    }
    return count;
  }

  /**
   * 原子遞減計數器。
   * 用於「本次請求失敗，退還額度」的情境（例如 AI 生成失敗）。
   * 注意：不會重設或延長 TTL，也不會讓計數低於 0（低於 0 時歸零並刪除 key，
   * 避免殘留一個負數，導致之後的 remaining 計算異常）。
   */
  async decrement(key: string): Promise<number> {
    const count = await this.redis.decr(key);
    if (count <= 0) {
      await this.redis.del(key);
      return 0;
    }
    return count;
  }

  /** 取得剩餘 TTL（秒） */
  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  /** 取得計數器當前值（不存在則回傳 0） */
  async get(key: string): Promise<number> {
    const val = await this.redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  /** 刪除 key */
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
