/**
 * Intelligent Cache Manager
 *
 * Multi-tiered caching system for processed results, metadata, and blob storage
 * optimization with automatic cache warming and intelligent invalidation.
 */

import { kv } from '@vercel/kv';
import { getLogger } from '@/lib/monitoring/logger';
import { getMetricsCollector } from '@/lib/monitoring/metrics-collector';
// import { createId } from '@paralleldrive/cuid2';

export interface CacheConfig {
  defaultTTL: number;
  maxMemorySize: number;
  enableCompression: boolean;
  warmupThreshold: number;
  cleanupInterval: number;
  metrics: boolean;
}

export interface CacheItem<T> {
  key: string;
  value: T;
  ttl: number;
  size: number;
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;
  compressed: boolean;
  metadata?: Record<string, unknown>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  memoryUsage: number;
  itemCount: number;
  averageAccessTime: number;
  compressionRatio: number;
}

class CacheManager {
  private memoryCache = new Map<string, CacheItem<unknown>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    memoryUsage: 0,
    itemCount: 0,
    averageAccessTime: 0,
    compressionRatio: 0
  };

  private config: CacheConfig;
  private logger = getLogger('cache-manager');
  private metrics = getMetricsCollector();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 60 * 60 * 1000, // 1 hour
      maxMemorySize: 512 * 1024 * 1024, // 512MB
      enableCompression: true,
      warmupThreshold: 5, // Cache items accessed 5+ times
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      metrics: true,
      ...config
    };

    this.startCleanupTimer();
    this.logger.info('Cache manager initialized', { config: this.config });
  }

  /**
   * Get item from cache with fallback
   */
  async get<T>(
    key: string,
    fallback?: () => Promise<T>,
    options?: {
      ttl?: number;
      skipMemory?: boolean;
      skipKV?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Try memory cache first
      if (!options?.skipMemory) {
        const memoryItem = await this.getFromMemory<T>(key);
        if (memoryItem) {
          this.recordMetrics('hit', 'memory', Date.now() - startTime);
          return memoryItem;
        }
      }

      // Try KV storage
      if (!options?.skipKV) {
        const kvItem = await this.getFromKV<T>(key);
        if (kvItem) {
          // Warm memory cache for frequently accessed items
          if (this.shouldWarmMemory(key)) {
            await this.setToMemory(key, kvItem, options?.ttl, options?.metadata);
          }
          this.recordMetrics('hit', 'kv', Date.now() - startTime);
          return kvItem;
        }
      }

      // Use fallback if available
      if (fallback) {
        const value = await fallback();
        await this.set(key, value, options);
        this.recordMetrics('miss', 'fallback', Date.now() - startTime);
        return value;
      }

      this.recordMetrics('miss', 'none', Date.now() - startTime);
      return null;

    } catch (error) {
      this.logger.error('Cache get error', error as Error, { key });
      if (fallback) {
        return await fallback();
      }
      return null;
    }
  }

  /**
   * Set item in cache with intelligent tiering
   */
  async set<T>(
    key: string,
    value: T,
    options?: {
      ttl?: number;
      skipMemory?: boolean;
      skipKV?: boolean;
      metadata?: Record<string, unknown>;
      priority?: 'high' | 'medium' | 'low';
    }
  ): Promise<void> {
    const ttl = options?.ttl || this.config.defaultTTL;

    try {
      // Set in memory cache (unless skipped or low priority)
      if (!options?.skipMemory && options?.priority !== 'low') {
        await this.setToMemory(key, value, ttl, options?.metadata);
      }

      // Set in KV storage for persistence
      if (!options?.skipKV) {
        await this.setToKV(key, value, ttl, options?.metadata);
      }

      this.stats.sets++;
      this.recordCacheMetrics();

    } catch (error) {
      this.logger.error('Cache set error', error as Error, { key });
    }
  }

  /**
   * Invalidate cache item
   */
  async invalidate(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];

    try {
      // Remove from memory cache
      for (const k of keys) {
        this.memoryCache.delete(k);
      }

      // Remove from KV storage
      if (keys.length > 0) {
        await kv.del(...keys);
      }

      this.logger.debug('Cache invalidated', { keys: keys.length });

    } catch (error) {
      this.logger.error('Cache invalidation error', error as Error, { keys });
    }
  }

  /**
   * Cache warming for frequently accessed items
   */
  async warmCache(
    patterns: string[],
    warmFunction: (pattern: string) => Promise<Array<{ key: string; value: unknown }>>
  ): Promise<void> {
    this.logger.info('Starting cache warming', { patterns });

    try {
      for (const pattern of patterns) {
        const items = await warmFunction(pattern);

        for (const item of items) {
          await this.set(item.key, item.value, {
            priority: 'high',
            ttl: this.config.defaultTTL * 2 // Longer TTL for warmed items
          });
        }

        this.logger.debug(`Warmed ${items.length} items for pattern: ${pattern}`);
      }

      this.logger.info('Cache warming completed', {
        patterns: patterns.length,
        totalItems: this.stats.itemCount
      });

    } catch (error) {
      this.logger.error('Cache warming error', error as Error, { patterns });
    }
  }

  /**
   * Get item from memory cache
   */
  private async getFromMemory<T>(key: string): Promise<T | null> {
    const item = this.memoryCache.get(key) as CacheItem<T> | undefined;

    if (!item) {
      return null;
    }

    // Check TTL
    if (Date.now() - item.createdAt.getTime() > item.ttl) {
      this.memoryCache.delete(key);
      this.stats.evictions++;
      return null;
    }

    // Update access stats
    item.accessCount++;
    item.lastAccessed = new Date();
    this.stats.hits++;

    // Decompress if needed
    if (item.compressed && typeof item.value === 'string') {
      try {
        return JSON.parse(item.value as string) as T;
      } catch {
        return item.value;
      }
    }

    return item.value;
  }

  /**
   * Set item in memory cache
   */
  private async setToMemory<T>(
    key: string,
    value: T,
    ttl?: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Check memory limits before adding
    if (this.stats.memoryUsage > this.config.maxMemorySize * 0.9) {
      await this.evictLRU();
    }

    let processedValue: unknown = value;
    let compressed = false;
    let size = this.estimateSize(value);

    // Compress large items
    if (this.config.enableCompression && size > 1024) {
      try {
        processedValue = JSON.stringify(value);
        compressed = true;
        size = this.estimateSize(processedValue);
      } catch {
        // Keep original value if compression fails
      }
    }

    const item: CacheItem<unknown> = {
      key,
      value: processedValue,
      ttl: ttl || this.config.defaultTTL,
      size,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: new Date(),
      compressed,
      metadata
    };

    this.memoryCache.set(key, item);
    this.stats.memoryUsage += size;
    this.stats.itemCount = this.memoryCache.size;
  }

  /**
   * Get item from KV storage
   */
  private async getFromKV<T>(key: string): Promise<T | null> {
    try {
      const item = await kv.get(key);
      return item as T;
    } catch (error) {
      this.logger.error('KV get error', error as Error, { key });
      return null;
    }
  }

  /**
   * Set item in KV storage
   */
  private async setToKV<T>(
    key: string,
    value: T,
    ttl: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const expiresAt = Date.now() + ttl;
      const cacheItem = {
        value,
        metadata,
        expiresAt
      };

      await kv.set(key, cacheItem, { px: ttl });
    } catch (error) {
      this.logger.error('KV set error', error as Error, { key });
    }
  }

  /**
   * LRU eviction for memory cache
   */
  private async evictLRU(): Promise<void> {
    const items = Array.from(this.memoryCache.entries())
      .map(([key, item]) => ({ key, item }))
      .sort((a, b) => a.item.lastAccessed.getTime() - b.item.lastAccessed.getTime());

    // Evict 25% of items
    const evictCount = Math.max(1, Math.floor(items.length * 0.25));

    for (let i = 0; i < evictCount && i < items.length; i++) {
      const { key, item } = items[i];
      this.memoryCache.delete(key);
      this.stats.memoryUsage -= item.size;
      this.stats.evictions++;
    }

    this.stats.itemCount = this.memoryCache.size;
    this.logger.debug(`Evicted ${evictCount} items from memory cache`);
  }

  /**
   * Check if item should be warmed in memory
   */
  private shouldWarmMemory(_key: string): boolean {
    // Simple heuristic: warm frequently accessed items
    return Math.random() < 0.1; // 10% chance for now
  }

  /**
   * Estimate object size in bytes
   */
  private estimateSize(obj: unknown): number {
    if (typeof obj === 'string') {
      return obj.length * 2; // Rough UTF-16 estimate
    }
    if (typeof obj === 'number') {
      return 8;
    }
    if (typeof obj === 'boolean') {
      return 4;
    }
    if (obj === null || obj === undefined) {
      return 4;
    }

    // For objects, rough JSON size estimate
    try {
      return JSON.stringify(obj).length * 2;
    } catch {
      return 100; // Default estimate
    }
  }

  /**
   * Record cache metrics
   */
  private recordMetrics(
    type: 'hit' | 'miss',
    source: 'memory' | 'kv' | 'fallback' | 'none',
    responseTime: number
  ): void {
    if (!this.config.metrics) return;

    this.metrics.incrementCounter('cache_requests_total', {
      type,
      source
    });

    this.metrics.recordHistogram('cache_response_time_ms', responseTime, {
      type,
      source
    });

    // Update running average
    this.stats.averageAccessTime =
      (this.stats.averageAccessTime + responseTime) / 2;
  }

  /**
   * Record general cache metrics
   */
  private recordCacheMetrics(): void {
    if (!this.config.metrics) return;

    this.metrics.setGauge('cache_memory_usage_bytes', this.stats.memoryUsage);
    this.metrics.setGauge('cache_item_count', this.stats.itemCount);
    this.metrics.setGauge('cache_hit_ratio',
      this.stats.hits / (this.stats.hits + this.stats.misses || 1)
    );
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Cleanup expired items
   */
  private async cleanup(): Promise<void> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.memoryCache.entries()) {
      if (now - item.createdAt.getTime() > item.ttl) {
        this.memoryCache.delete(key);
        this.stats.memoryUsage -= item.size;
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.itemCount = this.memoryCache.size;
      this.stats.evictions += cleaned;
      this.logger.debug(`Cleaned up ${cleaned} expired cache items`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      memoryUsage: 0,
      itemCount: 0,
      averageAccessTime: 0,
      compressionRatio: 0
    };

    try {
      // Clear KV storage (be careful in production!)
      await kv.flushall();
    } catch (error) {
      this.logger.error('Failed to clear KV storage', error as Error);
    }

    this.logger.info('Cache cleared');
  }

  /**
   * Destroy cache manager
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.memoryCache.clear();
  }
}

/**
 * File Processing Cache
 */
export class FileProcessingCache {
  private cache: CacheManager;
  private logger = getLogger('file-processing-cache');

  constructor(config?: Partial<CacheConfig>) {
    this.cache = new CacheManager({
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours for processed files
      maxMemorySize: 256 * 1024 * 1024, // 256MB
      enableCompression: true,
      ...config
    });
  }

  /**
   * Generate cache key for file
   */
  private generateFileKey(
    filename: string,
    checksum: string,
    processorType: string
  ): string {
    return `file:${processorType}:${checksum}:${Buffer.from(filename).toString('base64')}`;
  }

  /**
   * Get processed file result from cache
   */
  async getProcessedFile(
    filename: string,
    checksum: string,
    processorType: string
  ): Promise<{
    textContent: string;
    metadata: Record<string, unknown>;
    warnings: unknown[];
  } | null> {
    const key = this.generateFileKey(filename, checksum, processorType);

    return await this.cache.get(key, undefined, {
      metadata: { filename, processorType, checksum }
    });
  }

  /**
   * Cache processed file result
   */
  async cacheProcessedFile(
    filename: string,
    checksum: string,
    processorType: string,
    result: {
      textContent: string;
      metadata: Record<string, unknown>;
      warnings: unknown[];
    }
  ): Promise<void> {
    const key = this.generateFileKey(filename, checksum, processorType);

    await this.cache.set(key, result, {
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      metadata: {
        filename,
        processorType,
        checksum,
        size: result.textContent.length
      }
    });

    this.logger.debug('Cached processed file', {
      filename,
      processorType,
      contentSize: result.textContent.length
    });
  }

  /**
   * Get file metadata cache
   */
  async getFileMetadata(checksum: string): Promise<Record<string, unknown> | null> {
    return await this.cache.get(`metadata:${checksum}`);
  }

  /**
   * Cache file metadata
   */
  async cacheFileMetadata(
    checksum: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.cache.set(`metadata:${checksum}`, metadata, {
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
      priority: 'high'
    });
  }

  /**
   * Invalidate file cache
   */
  async invalidateFile(filename: string, checksum: string): Promise<void> {
    const patterns = [
      `file:*:${checksum}:*`,
      `metadata:${checksum}`
    ];

    for (const pattern of patterns) {
      await this.cache.invalidate(pattern);
    }

    this.logger.debug('Invalidated file cache', { filename, checksum });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.cache.getStats();
  }
}

// Singleton instances
let cacheManager: CacheManager | null = null;
let fileProcessingCache: FileProcessingCache | null = null;

export function getCacheManager(config?: Partial<CacheConfig>): CacheManager {
  if (!cacheManager) {
    cacheManager = new CacheManager(config);
  }
  return cacheManager;
}

export function getFileProcessingCache(config?: Partial<CacheConfig>): FileProcessingCache {
  if (!fileProcessingCache) {
    fileProcessingCache = new FileProcessingCache(config);
  }
  return fileProcessingCache;
}

export { CacheManager };