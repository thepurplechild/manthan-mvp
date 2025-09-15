import { cpus } from 'os';

/**
 * Performance Optimization System Entry Point
 *
 * Main interface for all performance optimization features including caching,
 * parallel processing, auto-scaling, load testing, and capacity planning.
 */

// Core performance components
export { getCacheManager, getFileProcessingCache, CacheManager, FileProcessingCache } from './cache-manager';
export { getParallelProcessor, getOptimizedFileProcessor, ParallelProcessor, OptimizedFileProcessor, Semaphore } from './parallel-processor';
export { getAutoScaler, getCurrentMetrics, AutoScaler, PredictiveModel } from './auto-scaler';
export { getCDNOptimizer, getBlobStorageOptimizer, CDNOptimizer, BlobStorageOptimizer } from './cdn-optimizer';
export { getLoadTester, LoadTester } from './load-tester';
export { getDatabaseOptimizer, DatabaseOptimizer } from './database-optimizer';
export { getCapacityPlanner, CapacityPlanner } from './capacity-planner';

// Types
export * from './cache-manager';
export * from './parallel-processor';
export * from './auto-scaler';
export * from './cdn-optimizer';
export * from './load-tester';
export * from './database-optimizer';
export * from './capacity-planner';

// Default configurations
export const DEFAULT_PERFORMANCE_CONFIG = {
  cache: {
    defaultTTL: 60 * 60 * 1000, // 1 hour
    maxMemorySize: 512 * 1024 * 1024, // 512MB
    enableCompression: true,
    warmupThreshold: 5,
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    metrics: true
  },
  parallelProcessing: {
    maxConcurrency: Math.max(1, Math.floor((process.env.VERCEL_FUNCTION_REGION ? 4 : cpus().length) * 0.8)),
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    enableWorkerThreads: !process.env.VERCEL_FUNCTION_REGION,
    queueSize: 1000,
    batchSize: 10,
    adaptiveScaling: true,
    memoryThreshold: 0.8,
    cpuThreshold: 0.7
  },
  autoScaling: {
    minInstances: 1,
    maxInstances: process.env.VERCEL_FUNCTION_REGION ? 10 : 50,
    targetUtilization: 0.7,
    scaleUpThreshold: 0.8,
    scaleDownThreshold: 0.3,
    evaluationInterval: 30000, // 30 seconds
    predictiveScaling: true,
    costOptimization: true,
    regionalDistribution: true
  },
  cdn: {
    enableCompression: true,
    cacheControlMaxAge: 86400, // 24 hours
    enableRegionalReplication: true,
    compressionThreshold: 1024, // 1KB
    enableCDNPurging: true,
    geoDistribution: true,
    customHeaders: {
      'X-Content-Source': 'manthan-cdn',
      'X-Cache-Strategy': 'intelligent'
    }
  },
  database: {
    enableQueryCache: true,
    enableConnectionPooling: true,
    enableQueryAnalysis: true,
    maxConnections: 10,
    connectionIdleTimeout: 300000, // 5 minutes
    queryCacheTTL: 300000, // 5 minutes
    slowQueryThreshold: 1000, // 1 second
    enableQueryRewriting: true,
    enableIndexSuggestions: true,
    enableQueryPlanCaching: true
  },
  capacityPlanning: {
    thresholds: {
      cpu: { warning: 70, critical: 85 },
      memory: { warning: 80, critical: 90 },
      disk: { warning: 85, critical: 95 },
      responseTime: { warning: 2000, critical: 5000 },
      errorRate: { warning: 0.01, critical: 0.05 }
    },
    dataRetentionDays: 90
  }
};

/**
 * Initialize the complete performance optimization system
 */
export async function initializePerformanceOptimization(config?: {
  enableCaching?: boolean;
  enableParallelProcessing?: boolean;
  enableAutoScaling?: boolean;
  enableCDNOptimization?: boolean;
  enableDatabaseOptimization?: boolean;
  enableCapacityPlanning?: boolean;
  customConfig?: Partial<typeof DEFAULT_PERFORMANCE_CONFIG>;
}) {
  const {
    enableCaching = true,
    enableParallelProcessing = true,
    enableAutoScaling = true,
    enableCDNOptimization = true,
    enableDatabaseOptimization = true,
    enableCapacityPlanning = true,
    customConfig = {}
  } = config || {};

  const { getLogger } = await import('@/lib/monitoring/logger');
  const logger = getLogger('performance-init');
  const mergedConfig = {
    ...DEFAULT_PERFORMANCE_CONFIG,
    ...customConfig
  };

  try {
    const initializedComponents: string[] = [];

    // Initialize caching system
    if (enableCaching) {
      getCacheManager(mergedConfig.cache);
      getFileProcessingCache(mergedConfig.cache);
      initializedComponents.push('caching');
    }

    // Initialize parallel processing
    if (enableParallelProcessing) {
      getParallelProcessor(mergedConfig.parallelProcessing);
      getOptimizedFileProcessor(mergedConfig.parallelProcessing);
      initializedComponents.push('parallel-processing');
    }

    // Initialize auto-scaling
    if (enableAutoScaling) {
      getAutoScaler(mergedConfig.autoScaling);
      initializedComponents.push('auto-scaling');
    }

    // Initialize CDN optimization
    if (enableCDNOptimization) {
      getCDNOptimizer(mergedConfig.cdn);
      getBlobStorageOptimizer();
      initializedComponents.push('cdn-optimization');
    }

    // Initialize database optimization
    if (enableDatabaseOptimization) {
      getDatabaseOptimizer(mergedConfig.database);
      initializedComponents.push('database-optimization');
    }

    // Initialize capacity planning
    if (enableCapacityPlanning) {
      getCapacityPlanner(mergedConfig.capacityPlanning);
      initializedComponents.push('capacity-planning');
    }

    logger.info('Performance optimization system initialized', {
      components: initializedComponents,
      config: Object.keys(mergedConfig)
    });

    return true;
  } catch (error) {
    logger.error('Failed to initialize performance optimization system', error as Error);
    return false;
  }
}

/**
 * Get comprehensive performance system status
 */
export function getPerformanceSystemStatus() {
  const { getLogger } = await import('@/lib/monitoring/logger');
  const logger = getLogger('performance-status');

  try {
    const status = {
      timestamp: new Date().toISOString(),
      components: {
        cache: {
          status: 'active',
          stats: getCacheManager().getStats()
        },
        parallelProcessor: {
          status: 'active',
          stats: getParallelProcessor().getStats()
        },
        autoScaler: {
          status: 'active',
          stats: getAutoScaler().getStats()
        },
        cdnOptimizer: {
          status: 'active',
          stats: getCDNOptimizer().getStats()
        },
        databaseOptimizer: {
          status: 'active',
          stats: getDatabaseOptimizer().getStats()
        },
        capacityPlanner: {
          status: 'active',
          stats: getCapacityPlanner().getStats()
        }
      }
    };

    logger.info('Performance system status check completed', {
      componentsActive: Object.keys(status.components).length
    });

    return status;
  } catch (error) {
    logger.error('Failed to get performance system status', error as Error);
    return {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Performance optimization presets for different scenarios
 */
export const PERFORMANCE_PRESETS = {
  development: {
    enableCaching: true,
    enableParallelProcessing: false,
    enableAutoScaling: false,
    enableCDNOptimization: false,
    enableDatabaseOptimization: true,
    enableCapacityPlanning: false,
    customConfig: {
      cache: {
        maxMemorySize: 128 * 1024 * 1024, // 128MB
        defaultTTL: 10 * 60 * 1000 // 10 minutes
      },
      database: {
        maxConnections: 3,
        enableQueryAnalysis: true
      }
    }
  },

  production: {
    enableCaching: true,
    enableParallelProcessing: true,
    enableAutoScaling: true,
    enableCDNOptimization: true,
    enableDatabaseOptimization: true,
    enableCapacityPlanning: true,
    customConfig: {
      cache: {
        maxMemorySize: 1024 * 1024 * 1024, // 1GB
        defaultTTL: 60 * 60 * 1000 // 1 hour
      },
      parallelProcessing: {
        maxConcurrency: 20,
        adaptiveScaling: true
      },
      autoScaling: {
        predictiveScaling: true,
        costOptimization: true
      }
    }
  },

  highTraffic: {
    enableCaching: true,
    enableParallelProcessing: true,
    enableAutoScaling: true,
    enableCDNOptimization: true,
    enableDatabaseOptimization: true,
    enableCapacityPlanning: true,
    customConfig: {
      cache: {
        maxMemorySize: 2048 * 1024 * 1024, // 2GB
        defaultTTL: 2 * 60 * 60 * 1000 // 2 hours
      },
      parallelProcessing: {
        maxConcurrency: 50,
        batchSize: 20
      },
      autoScaling: {
        maxInstances: 100,
        scaleUpThreshold: 0.6
      },
      database: {
        maxConnections: 25,
        enableConnectionPooling: true
      }
    }
  },

  costOptimized: {
    enableCaching: true,
    enableParallelProcessing: true,
    enableAutoScaling: true,
    enableCDNOptimization: true,
    enableDatabaseOptimization: true,
    enableCapacityPlanning: true,
    customConfig: {
      cache: {
        maxMemorySize: 256 * 1024 * 1024, // 256MB
        defaultTTL: 4 * 60 * 60 * 1000 // 4 hours
      },
      autoScaling: {
        costOptimization: true,
        scaleDownThreshold: 0.2,
        minInstances: 1
      },
      parallelProcessing: {
        maxConcurrency: 8,
        adaptiveScaling: true
      }
    }
  }
};

/**
 * Initialize performance optimization with preset
 */
export async function initializeWithPreset(preset: keyof typeof PERFORMANCE_PRESETS) {
  if (!PERFORMANCE_PRESETS[preset]) {
    throw new Error(`Unknown performance preset: ${preset}`);
  }

  return await initializePerformanceOptimization(PERFORMANCE_PRESETS[preset]);
}

/**
 * Utility function to optimize any async function with performance monitoring
 */
export function withPerformanceOptimization<T extends unknown[], R>(
  name: string,
  fn: (...args: T) => Promise<R>,
  options?: {
    enableCaching?: boolean;
    enableProfiling?: boolean;
    enableParallelization?: boolean;
    cacheKey?: (...args: T) => string;
    cacheTTL?: number;
    maxConcurrency?: number;
  }
): (...args: T) => Promise<R> {
  const {
    enableCaching = true,
    enableProfiling = true,
    enableParallelization: _enableParallelization = false,
    cacheKey,
    cacheTTL = 60 * 60 * 1000, // 1 hour
    maxConcurrency: _maxConcurrency = 5
  } = options || {};

  const { getLogger } = await import('@/lib/monitoring/logger');
  const logger = getLogger('performance-wrapper');
  const cache = enableCaching ? getCacheManager() : null;
  let profiler = null;
  if (enableProfiling) {
    const { getPerformanceProfiler } = await import('@/lib/monitoring/performance-profiler');
    profiler = getPerformanceProfiler();
  }

  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    let profileId: string | undefined;

    if (enableProfiling && profiler) {
      profileId = profiler.startProfile(name, { args: args.length });
    }

    try {
      // Check cache first
      if (enableCaching && cache && cacheKey) {
        const key = cacheKey(...args);
        const cached = await cache.get<R>(key);
        if (cached) {
          logger.debug(`Cache hit for ${name}`, { key });
          return cached;
        }
      }

      // Execute function
      logger.debug(`Executing optimized function: ${name}`);
      const result = await fn(...args);

      // Cache result
      if (enableCaching && cache && cacheKey && result) {
        const key = cacheKey(...args);
        await cache.set(key, result, { ttl: cacheTTL });
      }

      const duration = Date.now() - startTime;
      logger.debug(`Completed optimized function: ${name}`, { duration });

      return result;
    } catch (error) {
      logger.error(`Error in optimized function: ${name}`, error as Error);
      throw error;
    } finally {
      if (profileId && profiler) {
        profiler.endProfile(profileId);
      }
    }
  };
}

/**
 * Batch operation optimizer
 */
export async function optimizeBatchOperation<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options?: {
    batchSize?: number;
    maxConcurrency?: number;
    enableCaching?: boolean;
    cacheKeyGenerator?: (item: T) => string;
  }
): Promise<R[]> {
  const {
    batchSize: _batchSize = 10,
    maxConcurrency: _maxConcurrency = 5,
    enableCaching = true,
    cacheKeyGenerator
  } = options || {};

  const parallelProcessor = getParallelProcessor();

  const jobs = items.map(item => ({
    data: item,
    processingFunction: processor,
    cacheKey: enableCaching && cacheKeyGenerator ? cacheKeyGenerator(item) : undefined
  }));

  const results = await parallelProcessor.processParallel(jobs, {
    maxConcurrency,
    enableCache: enableCaching
  });

  return results.map(result => result.result as R).filter(Boolean);
}

/**
 * Performance monitoring for API endpoints
 */
export function createPerformanceMiddleware() {
  return async (request: Request, response: Response, next: () => void) => {
    const startTime = Date.now();
    const method = request.method;
    const url = request.url;

    const { getLogger } = await import('@/lib/monitoring/logger');
    const logger = getLogger('api-performance');
    const { getMetricsCollector } = await import('@/lib/monitoring/metrics-collector');
    const metrics = getMetricsCollector();

    try {
      await next();

      const duration = Date.now() - startTime;

      // Record metrics
      metrics.recordHistogram('api_request_duration_ms', duration, {
        method,
        endpoint: url,
        status: 'success'
      });

      logger.info('API request completed', {
        method,
        url,
        duration,
        status: 'success'
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      metrics.recordHistogram('api_request_duration_ms', duration, {
        method,
        endpoint: url,
        status: 'error'
      });

      metrics.incrementCounter('api_request_errors_total', {
        method,
        endpoint: url
      });

      logger.error('API request failed', error as Error, {
        method,
        url,
        duration
      });

      throw error;
    }
  };
}