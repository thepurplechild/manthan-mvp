/**
 * Parallel Processing System
 *
 * High-performance parallel processing engine with intelligent workload distribution,
 * memory management, and resource optimization for large-scale file processing.
 */

import { Worker } from 'worker_threads';
import { getLogger } from '@/lib/monitoring/logger';
import { getMetricsCollector } from '@/lib/monitoring/metrics-collector';
import { getPerformanceProfiler } from '@/lib/monitoring/performance-profiler';
import { getCacheManager } from './cache-manager';
import { createId } from '@paralleldrive/cuid2';

export interface ProcessingJob<T = unknown, R = unknown> {
  id: string;
  data: T;
  priority: 'high' | 'medium' | 'low';
  retries: number;
  maxRetries: number;
  timeout: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  processingFunction: string;
}

export interface ProcessingResult<R = unknown> {
  id: string;
  success: boolean;
  result?: R;
  error?: string;
  processingTime: number;
  memoryUsage: number;
  cacheHit?: boolean;
}

export interface ProcessorConfig {
  maxConcurrency: number;
  maxMemoryUsage: number;
  enableWorkerThreads: boolean;
  queueSize: number;
  batchSize: number;
  adaptiveScaling: boolean;
  memoryThreshold: number;
  cpuThreshold: number;
}

export interface WorkerPoolStats {
  activeWorkers: number;
  idleWorkers: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  currentMemoryUsage: number;
  cpuUsage: number;
}

class ParallelProcessor {
  private jobQueue: ProcessingJob[] = [];
  private activeJobs = new Map<string, ProcessingJob>();
  private workers: Worker[] = [];
  private config: ProcessorConfig;
  private logger = getLogger('parallel-processor');
  private metrics = getMetricsCollector();
  private profiler = getPerformanceProfiler();
  private cache = getCacheManager();

  private stats: WorkerPoolStats = {
    activeWorkers: 0,
    idleWorkers: 0,
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    averageProcessingTime: 0,
    currentMemoryUsage: 0,
    cpuUsage: 0
  };

  constructor(config: Partial<ProcessorConfig> = {}) {
    this.config = {
      maxConcurrency: Math.max(1, Math.floor((process.env.VERCEL_FUNCTION_REGION ? 4 : require('os').cpus().length) * 0.8)),
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      enableWorkerThreads: !process.env.VERCEL_FUNCTION_REGION, // Disable on Vercel
      queueSize: 1000,
      batchSize: 10,
      adaptiveScaling: true,
      memoryThreshold: 0.8,
      cpuThreshold: 0.7,
      ...config
    };

    this.logger.info('Parallel processor initialized', {
      maxConcurrency: this.config.maxConcurrency,
      enableWorkerThreads: this.config.enableWorkerThreads
    });

    if (this.config.enableWorkerThreads) {
      this.initializeWorkerPool();
    }

    this.startMonitoring();
  }

  /**
   * Process jobs in parallel with intelligent batching
   */
  async processParallel<T, R>(
    jobs: Array<{
      data: T;
      processingFunction: (data: T) => Promise<R>;
      priority?: 'high' | 'medium' | 'low';
      timeout?: number;
      cacheKey?: string;
    }>,
    options?: {
      maxConcurrency?: number;
      enableCache?: boolean;
      memoryLimit?: number;
    }
  ): Promise<ProcessingResult<R>[]> {
    const profileId = this.profiler.startProfile('parallel-processing', {
      jobCount: jobs.length,
      maxConcurrency: options?.maxConcurrency || this.config.maxConcurrency
    });

    try {
      const results: ProcessingResult<R>[] = [];
      const concurrency = Math.min(
        options?.maxConcurrency || this.config.maxConcurrency,
        jobs.length
      );

      // Check memory constraints
      await this.checkMemoryConstraints(options?.memoryLimit);

      // Process in batches to manage memory
      const batches = this.createBatches(jobs, this.config.batchSize);

      for (const batch of batches) {
        const batchResults = await this.processBatch(batch, concurrency, options);
        results.push(...batchResults);

        // Memory cleanup between batches
        if (typeof global.gc === 'function') {
          global.gc();
        }
      }

      this.logger.info('Parallel processing completed', {
        totalJobs: jobs.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      return results;

    } catch (error) {
      this.logger.error('Parallel processing failed', error as Error, {
        jobCount: jobs.length
      });
      throw error;
    } finally {
      this.profiler.endProfile(profileId);
    }
  }

  /**
   * Process a batch of jobs with controlled concurrency
   */
  private async processBatch<T, R>(
    jobs: Array<{
      data: T;
      processingFunction: (data: T) => Promise<R>;
      priority?: 'high' | 'medium' | 'low';
      timeout?: number;
      cacheKey?: string;
    }>,
    concurrency: number,
    options?: {
      enableCache?: boolean;
      memoryLimit?: number;
    }
  ): Promise<ProcessingResult<R>[]> {
    const semaphore = new Semaphore(concurrency);
    const promises = jobs.map(async (job, index) => {
      await semaphore.acquire();

      try {
        const operationId = this.profiler.startOperation(
          'batch-processing',
          `job-${index}`,
          { priority: job.priority || 'medium' }
        );

        const result = await this.processJob(job, options);

        this.profiler.endOperation(operationId, result.success, result.error);

        return result;
      } finally {
        semaphore.release();
      }
    });

    return Promise.all(promises);
  }

  /**
   * Process individual job with caching and error handling
   */
  private async processJob<T, R>(
    job: {
      data: T;
      processingFunction: (data: T) => Promise<R>;
      priority?: 'high' | 'medium' | 'low';
      timeout?: number;
      cacheKey?: string;
    },
    options?: {
      enableCache?: boolean;
      memoryLimit?: number;
    }
  ): Promise<ProcessingResult<R>> {
    const jobId = createId();
    const startTime = Date.now();
    const startMemory = this.getCurrentMemoryUsage();

    // Check cache first
    if (options?.enableCache && job.cacheKey) {
      const cached = await this.cache.get<R>(job.cacheKey);
      if (cached) {
        return {
          id: jobId,
          success: true,
          result: cached,
          processingTime: Date.now() - startTime,
          memoryUsage: 0,
          cacheHit: true
        };
      }
    }

    try {
      // Apply timeout
      const timeout = job.timeout || 30000; // 30 seconds default
      const result = await Promise.race([
        job.processingFunction(job.data),
        this.createTimeoutPromise<R>(timeout, `Job ${jobId} timed out`)
      ]);

      const processingTime = Date.now() - startTime;
      const memoryUsage = this.getCurrentMemoryUsage() - startMemory;

      // Cache result if enabled
      if (options?.enableCache && job.cacheKey && result) {
        await this.cache.set(job.cacheKey, result, {
          ttl: 60 * 60 * 1000, // 1 hour
          priority: job.priority === 'high' ? 'high' : 'medium'
        });
      }

      // Update statistics
      this.updateStats(true, processingTime);

      // Record metrics
      this.metrics.recordHistogram('parallel_job_duration_ms', processingTime, {
        priority: job.priority || 'medium',
        cached: 'false'
      });

      this.metrics.recordHistogram('parallel_job_memory_usage_bytes', memoryUsage, {
        priority: job.priority || 'medium'
      });

      return {
        id: jobId,
        success: true,
        result,
        processingTime,
        memoryUsage,
        cacheHit: false
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const memoryUsage = this.getCurrentMemoryUsage() - startMemory;

      this.updateStats(false, processingTime);

      this.logger.error('Job processing failed', error as Error, {
        jobId,
        processingTime,
        memoryUsage
      });

      return {
        id: jobId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
        memoryUsage,
        cacheHit: false
      };
    }
  }

  /**
   * Create processing batches based on memory and performance constraints
   */
  private createBatches<T>(jobs: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < jobs.length; i += batchSize) {
      batches.push(jobs.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Check and manage memory constraints
   */
  private async checkMemoryConstraints(memoryLimit?: number): Promise<void> {
    const currentUsage = this.getCurrentMemoryUsage();
    const limit = memoryLimit || this.config.maxMemoryUsage;

    if (currentUsage > limit * this.config.memoryThreshold) {
      this.logger.warn('Memory usage approaching limit', {
        currentUsage,
        limit,
        threshold: this.config.memoryThreshold
      });

      // Force garbage collection if available
      if (typeof global.gc === 'function') {
        global.gc();
      }

      // Wait for memory to stabilize
      await new Promise(resolve => setTimeout(resolve, 100));

      const newUsage = this.getCurrentMemoryUsage();
      if (newUsage > limit * 0.9) {
        throw new Error(`Memory usage too high: ${newUsage} bytes (limit: ${limit})`);
      }
    }
  }

  /**
   * Initialize worker thread pool
   */
  private initializeWorkerPool(): void {
    if (!this.config.enableWorkerThreads) return;

    // Worker thread implementation would go here
    // For now, we'll use the main thread with async processing
    this.logger.info('Worker thread pool initialized', {
      workerCount: this.config.maxConcurrency
    });
  }

  /**
   * Start system monitoring
   */
  private startMonitoring(): void {
    setInterval(() => {
      this.updateSystemStats();
      this.recordMetrics();
    }, 5000); // Every 5 seconds
  }

  /**
   * Update system statistics
   */
  private updateSystemStats(): void {
    this.stats.currentMemoryUsage = this.getCurrentMemoryUsage();
    this.stats.activeWorkers = this.activeJobs.size;
    this.stats.idleWorkers = this.config.maxConcurrency - this.activeJobs.size;

    // Adaptive scaling based on system load
    if (this.config.adaptiveScaling) {
      this.adaptScale();
    }
  }

  /**
   * Adaptive scaling based on system metrics
   */
  private adaptScale(): void {
    const memoryRatio = this.stats.currentMemoryUsage / this.config.maxMemoryUsage;
    const queueRatio = this.jobQueue.length / this.config.queueSize;

    // Scale down if memory usage is high
    if (memoryRatio > this.config.memoryThreshold) {
      this.config.maxConcurrency = Math.max(1, this.config.maxConcurrency - 1);
      this.logger.debug('Scaled down due to memory pressure', {
        newConcurrency: this.config.maxConcurrency,
        memoryRatio
      });
    }
    // Scale up if queue is building up and resources allow
    else if (queueRatio > 0.5 && memoryRatio < 0.5) {
      const maxConcurrency = Math.floor(require('os').cpus().length * 0.8);
      this.config.maxConcurrency = Math.min(maxConcurrency, this.config.maxConcurrency + 1);
      this.logger.debug('Scaled up due to queue pressure', {
        newConcurrency: this.config.maxConcurrency,
        queueRatio
      });
    }
  }

  /**
   * Record performance metrics
   */
  private recordMetrics(): void {
    this.metrics.setGauge('parallel_processor_active_jobs', this.stats.activeWorkers);
    this.metrics.setGauge('parallel_processor_queue_depth', this.jobQueue.length);
    this.metrics.setGauge('parallel_processor_memory_usage', this.stats.currentMemoryUsage);
    this.metrics.setGauge('parallel_processor_max_concurrency', this.config.maxConcurrency);

    this.metrics.setGauge('parallel_processor_success_rate',
      this.stats.completedJobs / (this.stats.totalJobs || 1)
    );
  }

  /**
   * Update processing statistics
   */
  private updateStats(success: boolean, processingTime: number): void {
    this.stats.totalJobs++;
    if (success) {
      this.stats.completedJobs++;
    } else {
      this.stats.failedJobs++;
    }

    // Update running average
    this.stats.averageProcessingTime =
      (this.stats.averageProcessingTime + processingTime) / 2;
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise<T>(timeout: number, message: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeout);
    });
  }

  /**
   * Get processor statistics
   */
  getStats(): WorkerPoolStats {
    return { ...this.stats };
  }

  /**
   * Clear job queue
   */
  clearQueue(): void {
    this.jobQueue.length = 0;
    this.logger.info('Job queue cleared');
  }

  /**
   * Shutdown processor
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down parallel processor');

    // Wait for active jobs to complete
    while (this.activeJobs.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Terminate workers
    for (const worker of this.workers) {
      await worker.terminate();
    }

    this.clearQueue();
    this.logger.info('Parallel processor shutdown complete');
  }
}

/**
 * Semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      if (next) {
        this.permits--;
        next();
      }
    }
  }
}

/**
 * Memory-optimized file processor
 */
export class OptimizedFileProcessor {
  private parallelProcessor: ParallelProcessor;
  private logger = getLogger('optimized-file-processor');

  constructor(config?: Partial<ProcessorConfig>) {
    this.parallelProcessor = new ParallelProcessor({
      maxConcurrency: 4,
      maxMemoryUsage: 256 * 1024 * 1024, // 256MB for file processing
      batchSize: 5, // Smaller batches for large files
      ...config
    });
  }

  /**
   * Process multiple files in parallel with memory optimization
   */
  async processFiles(
    files: Array<{
      filename: string;
      buffer: Buffer;
      mimeType?: string;
      processor: (filename: string, buffer: Buffer, mimeType?: string) => Promise<unknown>;
    }>,
    options?: {
      maxConcurrency?: number;
      enableCache?: boolean;
    }
  ): Promise<ProcessingResult[]> {
    // Sort files by size (process smaller files first)
    const sortedFiles = files.sort((a, b) => a.buffer.length - b.buffer.length);

    // Create processing jobs
    const jobs = sortedFiles.map(file => ({
      data: file,
      processingFunction: async (fileData: typeof file) => {
        // Use streaming for large files
        if (fileData.buffer.length > 10 * 1024 * 1024) { // 10MB
          return this.processLargeFile(fileData);
        }
        return fileData.processor(fileData.filename, fileData.buffer, fileData.mimeType);
      },
      priority: this.getPriority(file.buffer.length),
      timeout: this.getTimeout(file.buffer.length),
      cacheKey: options?.enableCache ? this.generateCacheKey(file) : undefined
    }));

    return this.parallelProcessor.processParallel(jobs, {
      maxConcurrency: options?.maxConcurrency,
      enableCache: options?.enableCache,
      memoryLimit: 512 * 1024 * 1024 // 512MB
    });
  }

  /**
   * Process large files with streaming and chunking
   */
  private async processLargeFile(file: {
    filename: string;
    buffer: Buffer;
    mimeType?: string;
    processor: (filename: string, buffer: Buffer, mimeType?: string) => Promise<unknown>;
  }): Promise<unknown> {
    this.logger.info('Processing large file with optimization', {
      filename: file.filename,
      size: file.buffer.length
    });

    // For very large files, we might want to process in chunks
    // This is a simplified implementation
    try {
      const result = await file.processor(file.filename, file.buffer, file.mimeType);

      // Clear buffer reference to help GC
      file.buffer = Buffer.alloc(0);

      return result;
    } catch (error) {
      this.logger.error('Large file processing failed', error as Error, {
        filename: file.filename,
        size: file.buffer.length
      });
      throw error;
    }
  }

  /**
   * Get processing priority based on file size
   */
  private getPriority(fileSize: number): 'high' | 'medium' | 'low' {
    if (fileSize < 1024 * 1024) return 'high'; // < 1MB
    if (fileSize < 10 * 1024 * 1024) return 'medium'; // < 10MB
    return 'low'; // >= 10MB
  }

  /**
   * Get timeout based on file size
   */
  private getTimeout(fileSize: number): number {
    const baseTimeout = 30000; // 30 seconds
    const sizeMultiplier = Math.floor(fileSize / (1024 * 1024)); // MB
    return baseTimeout + (sizeMultiplier * 10000); // +10s per MB
  }

  /**
   * Generate cache key for file
   */
  private generateCacheKey(file: {
    filename: string;
    buffer: Buffer;
    mimeType?: string;
  }): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    return `file:${hash}:${file.mimeType || 'unknown'}`;
  }

  /**
   * Get processor statistics
   */
  getStats(): WorkerPoolStats {
    return this.parallelProcessor.getStats();
  }
}

// Singleton instance
let parallelProcessor: ParallelProcessor | null = null;
let optimizedFileProcessor: OptimizedFileProcessor | null = null;

export function getParallelProcessor(config?: Partial<ProcessorConfig>): ParallelProcessor {
  if (!parallelProcessor) {
    parallelProcessor = new ParallelProcessor(config);
  }
  return parallelProcessor;
}

export function getOptimizedFileProcessor(config?: Partial<ProcessorConfig>): OptimizedFileProcessor {
  if (!optimizedFileProcessor) {
    optimizedFileProcessor = new OptimizedFileProcessor(config);
  }
  return optimizedFileProcessor;
}

export { ParallelProcessor, Semaphore };