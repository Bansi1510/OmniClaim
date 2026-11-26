import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;
  private warnedOffline = false;
  private readonly memoryCache = new Map<string, { value: string; expiresAt?: number }>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);

    this.client = new Redis({
      host: redisHost,
      port: redisPort,
      connectTimeout: 800,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) return null; // Stop retrying locally; use in-memory fallback seamlessly
        return Math.min(times * 200, 1000);
      },
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.warnedOffline = false;
      this.logger.log(`Connected to Redis at ${redisHost}:${redisPort}`);
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      if (!this.warnedOffline) {
        this.warnedOffline = true;
        this.logger.warn(
          `Redis unavailable at ${redisHost}:${redisPort} (${err.message}). Using fast in-memory fallback cache.`,
        );
      }
    });
  }

  getClient(): Redis | null {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (this.client && this.isConnected) {
      try {
        return await this.client.get(key);
      } catch {
        // Fall back to memory
      }
    }
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        if (ttlSeconds) {
          await this.client.set(key, value, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, value);
        }
        return;
      } catch {
        // Fall back to memory
      }
    }
    this.memoryCache.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    this.memoryCache.delete(key);
    if (this.client && this.isConnected) {
      try {
        await this.client.del(key);
      } catch {
        // Ignore when offline
      }
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    const prefix = pattern.replace(/\*$/, '');
    for (const k of Array.from(this.memoryCache.keys())) {
      if (k.startsWith(prefix)) this.memoryCache.delete(k);
    }
    if (this.client && this.isConnected) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } catch {
        // Ignore when offline
      }
    }
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }
}
