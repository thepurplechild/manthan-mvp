/**
 * Performance Profiling System
 *
 * Provides detailed performance profiling for operations, including timing,
 * memory usage, and bottleneck identification.
 */

import { PerformanceProfile, PerformanceOperation } from './types';
import { getLogger } from './logger';
import { getMetricsCollector } from './metrics-collector';
import { createId } from '@paralleldrive/cuid2';

class PerformanceProfiler {
  private profiles = new Map<string, PerformanceProfile>();
  private logger = getLogger('performance-profiler');
  private metricsCollector = getMetricsCollector();

  /**
   * Start a new performance profile
   */
  startProfile(name: string, metadata?: Record<string, unknown>): string {
    const id = createId();
    const profile: PerformanceProfile = {
      id,
      name,
      startTime: new Date(),
      operations: [],
      metadata
    };

    this.profiles.set(id, profile);
    this.logger.debug(`Started performance profile: ${name}`, { profileId: id, metadata });

    return id;
  }

  /**
   * End a performance profile
   */
  endProfile(profileId: string): PerformanceProfile | null {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      this.logger.warn(`Profile not found: ${profileId}`);
      return null;
    }

    profile.endTime = new Date();
    profile.duration = profile.endTime.getTime() - profile.startTime.getTime();

    // Record metrics
    this.metricsCollector.recordHistogram(
      'performance_profile_duration_ms',
      profile.duration,
      { profile_name: profile.name }
    );

    this.metricsCollector.incrementCounter(
      'performance_profiles_completed_total',
      { profile_name: profile.name }
    );

    this.logger.info(`Completed performance profile: ${profile.name}`, {
      profileId,
      duration: profile.duration,
      operationCount: profile.operations.length
    });

    // Clean up
    this.profiles.delete(profileId);

    return profile;
  }

  /**
   * Start tracking an operation within a profile
   */
  startOperation(profileId: string, operationName: string, metadata?: Record<string, unknown>): string {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      this.logger.warn(`Profile not found for operation: ${profileId}`);
      return '';
    }

    const operation: PerformanceOperation = {
      name: operationName,
      startTime: new Date(),
      success: false,
      metadata
    };

    profile.operations.push(operation);

    this.logger.debug(`Started operation: ${operationName}`, {
      profileId,
      operationIndex: profile.operations.length - 1
    });

    return `${profileId}:${profile.operations.length - 1}`;
  }

  /**
   * End tracking an operation
   */
  endOperation(operationId: string, success = true, error?: string) {
    const [profileId, operationIndex] = operationId.split(':');
    const profile = this.profiles.get(profileId);

    if (!profile) {
      this.logger.warn(`Profile not found for operation end: ${profileId}`);
      return;
    }

    const operation = profile.operations[parseInt(operationIndex, 10)];
    if (!operation) {
      this.logger.warn(`Operation not found: ${operationIndex}`);
      return;
    }

    operation.endTime = new Date();
    operation.duration = operation.endTime.getTime() - operation.startTime.getTime();
    operation.success = success;
    operation.error = error;

    // Record operation metrics
    this.metricsCollector.recordHistogram(
      'performance_operation_duration_ms',
      operation.duration,
      {
        profile_name: profile.name,
        operation_name: operation.name,
        success: success.toString()
      }
    );

    this.metricsCollector.incrementCounter(
      'performance_operations_completed_total',
      {
        profile_name: profile.name,
        operation_name: operation.name,
        success: success.toString()
      }
    );

    this.logger.debug(`Ended operation: ${operation.name}`, {
      profileId,
      duration: operation.duration,
      success,
      error
    });
  }

  /**
   * Add memory measurement to current operations
   */
  measureMemory(profileId: string): number {
    if (typeof process === 'undefined' || !process.memoryUsage) {
      return 0;
    }

    const memUsage = process.memoryUsage();
    const memoryMB = memUsage.heapUsed / 1024 / 1024;

    this.metricsCollector.setGauge(
      'performance_memory_usage_mb',
      memoryMB,
      { profile_id: profileId }
    );

    return memoryMB;
  }

  /**
   * Get active profile
   */
  getProfile(profileId: string): PerformanceProfile | null {
    return this.profiles.get(profileId) || null;
  }

  /**
   * Get all active profiles
   */
  getActiveProfiles(): PerformanceProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Analyze performance bottlenecks in a completed profile
   */
  analyzeBottlenecks(profile: PerformanceProfile): {
    slowestOperations: PerformanceOperation[];
    totalTime: number;
    operationBreakdown: Record<string, {
      totalTime: number;
      count: number;
      avgTime: number;
      failureRate: number;
    }>;
    recommendations: string[];
  } {
    const breakdown: Record<string, {
      totalTime: number;
      count: number;
      avgTime: number;
      failureRate: number;
    }> = {};

    // Analyze operations
    profile.operations.forEach(op => {
      if (!op.duration) return;

      if (!breakdown[op.name]) {
        breakdown[op.name] = {
          totalTime: 0,
          count: 0,
          avgTime: 0,
          failureRate: 0
        };
      }

      breakdown[op.name].totalTime += op.duration;
      breakdown[op.name].count += 1;
      if (!op.success) {
        breakdown[op.name].failureRate += 1;
      }
    });

    // Calculate averages and failure rates
    Object.values(breakdown).forEach(data => {
      data.avgTime = data.totalTime / data.count;
      data.failureRate = data.failureRate / data.count;
    });

    // Find slowest operations
    const slowestOperations = profile.operations
      .filter(op => op.duration)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5);

    // Generate recommendations
    const recommendations: string[] = [];

    const slowOperationNames = Object.entries(breakdown)
      .filter(([, data]) => data.avgTime > 1000)
      .map(([name]) => name);

    if (slowOperationNames.length > 0) {
      recommendations.push(`Consider optimizing operations: ${slowOperationNames.join(', ')}`);
    }

    const highFailureOperations = Object.entries(breakdown)
      .filter(([, data]) => data.failureRate > 0.1)
      .map(([name]) => name);

    if (highFailureOperations.length > 0) {
      recommendations.push(`Review error handling for: ${highFailureOperations.join(', ')}`);
    }

    if (profile.duration && profile.duration > 10000) {
      recommendations.push('Consider breaking down long-running operations');
    }

    return {
      slowestOperations,
      totalTime: profile.duration || 0,
      operationBreakdown: breakdown,
      recommendations
    };
  }

  /**
   * Clean up abandoned profiles
   */
  cleanupAbandonedProfiles(maxAgeMs = 30 * 60 * 1000) {
    const cutoff = new Date(Date.now() - maxAgeMs);
    let cleaned = 0;

    for (const [id, profile] of this.profiles.entries()) {
      if (profile.startTime < cutoff) {
        this.profiles.delete(id);
        cleaned++;
        this.logger.warn(`Cleaned up abandoned profile: ${profile.name}`, { profileId: id });
      }
    }

    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} abandoned profiles`);
    }
  }
}

// Convenience class for automatic profiling
export class AutoProfiler {
  private profiler: PerformanceProfiler;
  private profileId: string;

  constructor(profiler: PerformanceProfiler, name: string, metadata?: Record<string, unknown>) {
    this.profiler = profiler;
    this.profileId = profiler.startProfile(name, metadata);
  }

  operation<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T>;
  operation<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T;
  operation<T>(name: string, fn: () => T | Promise<T>, metadata?: Record<string, unknown>): T | Promise<T> {
    const operationId = this.profiler.startOperation(this.profileId, name, metadata);

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result
          .then(value => {
            this.profiler.endOperation(operationId, true);
            return value;
          })
          .catch(error => {
            this.profiler.endOperation(operationId, false, error.message);
            throw error;
          });
      } else {
        this.profiler.endOperation(operationId, true);
        return result;
      }
    } catch (error) {
      this.profiler.endOperation(operationId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  end(): PerformanceProfile | null {
    return this.profiler.endProfile(this.profileId);
  }
}

// Singleton instance
let performanceProfiler: PerformanceProfiler | null = null;

export function getPerformanceProfiler(): PerformanceProfiler {
  if (!performanceProfiler) {
    performanceProfiler = new PerformanceProfiler();

    // Start cleanup interval
    setInterval(() => {
      performanceProfiler?.cleanupAbandonedProfiles();
    }, 10 * 60 * 1000); // Every 10 minutes
  }
  return performanceProfiler;
}

export { PerformanceProfiler };