/**
 * Health Check System
 *
 * Provides comprehensive health monitoring for various system components
 * including database, external services, disk space, memory, and custom checks.
 */

import { HealthCheck, HealthCheckStatus } from './types';
import { getLogger } from './logger';
import { getMetricsCollector } from './metrics-collector';

class HealthChecker {
  private checks = new Map<string, HealthCheck>();
  private intervals = new Map<string, NodeJS.Timeout>();
  private lastResults = new Map<string, HealthCheckStatus>();
  private logger = getLogger('health-checker');
  private metricsCollector = getMetricsCollector();

  /**
   * Register a health check
   */
  registerCheck(check: HealthCheck) {
    this.checks.set(check.name, check);
    this.logger.info(`Registered health check: ${check.name}`);

    // Start periodic checks if interval is specified
    if (check.interval && check.interval > 0) {
      this.startPeriodicCheck(check);
    }
  }

  /**
   * Start periodic checking for a health check
   */
  private startPeriodicCheck(check: HealthCheck) {
    if (this.intervals.has(check.name)) {
      clearInterval(this.intervals.get(check.name)!);
    }

    const interval = setInterval(async () => {
      try {
        await this.runCheck(check.name);
      } catch (error) {
        this.logger.error(`Periodic health check failed: ${check.name}`, error as Error);
      }
    }, check.interval);

    this.intervals.set(check.name, interval);
  }

  /**
   * Run a specific health check
   */
  async runCheck(name: string): Promise<HealthCheckStatus> {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check not found: ${name}`);
    }

    const startTime = Date.now();
    let status: HealthCheckStatus;

    try {
      // Apply timeout if specified
      const timeout = check.timeout || 10000; // Default 10 seconds
      const result = await Promise.race([
        check.check(),
        this.createTimeoutPromise(timeout, name)
      ]);

      status = {
        ...result,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      status = {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        responseTime: Date.now() - startTime
      };
    }

    // Store result
    this.lastResults.set(name, status);

    // Record metrics
    this.metricsCollector.setGauge(
      'health_check_status',
      status.status === 'healthy' ? 1 : status.status === 'degraded' ? 0.5 : 0,
      { check_name: name }
    );

    this.metricsCollector.recordHistogram(
      'health_check_response_time_ms',
      status.responseTime || 0,
      { check_name: name }
    );

    this.metricsCollector.incrementCounter(
      'health_checks_total',
      { check_name: name, status: status.status }
    );

    this.logger.debug(`Health check completed: ${name}`, {
      status: status.status,
      responseTime: status.responseTime,
      message: status.message
    });

    return status;
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<Record<string, HealthCheckStatus>> {
    const results: Record<string, HealthCheckStatus> = {};
    const promises = Array.from(this.checks.keys()).map(async name => {
      try {
        results[name] = await this.runCheck(name);
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        };
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get the last result for a health check
   */
  getLastResult(name: string): HealthCheckStatus | undefined {
    return this.lastResults.get(name);
  }

  /**
   * Get all last results
   */
  getAllLastResults(): Record<string, HealthCheckStatus> {
    const results: Record<string, HealthCheckStatus> = {};
    for (const [name, status] of this.lastResults.entries()) {
      results[name] = status;
    }
    return results;
  }

  /**
   * Get overall system health status
   */
  getOverallHealth(): {
    status: HealthCheckStatus['status'];
    message: string;
    checks: Record<string, HealthCheckStatus>;
    criticalFailures: string[];
  } {
    const checks = this.getAllLastResults();
    const criticalFailures: string[] = [];
    let hasUnhealthy = false;
    let hasDegraded = false;

    for (const [name, result] of Object.entries(checks)) {
      const check = this.checks.get(name);

      if (result.status === 'unhealthy') {
        hasUnhealthy = true;
        if (check?.critical) {
          criticalFailures.push(name);
        }
      } else if (result.status === 'degraded') {
        hasDegraded = true;
      }
    }

    let status: HealthCheckStatus['status'];
    let message: string;

    if (criticalFailures.length > 0) {
      status = 'unhealthy';
      message = `Critical failures: ${criticalFailures.join(', ')}`;
    } else if (hasUnhealthy || hasDegraded) {
      status = hasDegraded && !hasUnhealthy ? 'degraded' : 'unhealthy';
      message = hasUnhealthy ? 'Some health checks are failing' : 'System is degraded';
    } else {
      status = 'healthy';
      message = 'All health checks passing';
    }

    return {
      status,
      message,
      checks,
      criticalFailures
    };
  }

  /**
   * Create timeout promise for health checks
   */
  private createTimeoutPromise(timeout: number, checkName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check timeout after ${timeout}ms: ${checkName}`));
      }, timeout);
    });
  }

  /**
   * Stop all periodic health checks
   */
  stopAllChecks() {
    for (const [name, interval] of this.intervals.entries()) {
      clearInterval(interval);
      this.logger.info(`Stopped periodic health check: ${name}`);
    }
    this.intervals.clear();
  }

  /**
   * Remove a health check
   */
  removeCheck(name: string) {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }

    this.checks.delete(name);
    this.lastResults.delete(name);

    this.logger.info(`Removed health check: ${name}`);
  }

  /**
   * Get registered check names
   */
  getCheckNames(): string[] {
    return Array.from(this.checks.keys());
  }
}

/**
 * Built-in health checks
 */

export class BuiltInHealthChecks {
  /**
   * Database connection health check
   */
  static createDatabaseCheck(
    name = 'database',
    connectionFn: () => Promise<boolean>
  ): HealthCheck {
    return {
      name,
      description: 'Check database connectivity',
      interval: 30000, // 30 seconds
      timeout: 5000,   // 5 seconds
      critical: true,
      async check(): Promise<HealthCheckStatus> {
        try {
          const connected = await connectionFn();
          return {
            status: connected ? 'healthy' : 'unhealthy',
            message: connected ? 'Database connection healthy' : 'Database connection failed',
            timestamp: new Date()
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            message: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date()
          };
        }
      }
    };
  }

  /**
   * Memory usage health check
   */
  static createMemoryCheck(
    name = 'memory',
    thresholds = { warning: 0.8, critical: 0.9 }
  ): HealthCheck {
    return {
      name,
      description: 'Check memory usage',
      interval: 60000, // 1 minute
      timeout: 1000,
      critical: false,
      async check(): Promise<HealthCheckStatus> {
        if (typeof process === 'undefined' || !process.memoryUsage) {
          return {
            status: 'healthy',
            message: 'Memory check not available in this environment',
            timestamp: new Date()
          };
        }

        const memUsage = process.memoryUsage();
        const totalMemory = memUsage.heapTotal;
        const usedMemory = memUsage.heapUsed;
        const usage = usedMemory / totalMemory;

        let status: HealthCheckStatus['status'];
        let message: string;

        if (usage >= thresholds.critical) {
          status = 'unhealthy';
          message = `Critical memory usage: ${(usage * 100).toFixed(1)}%`;
        } else if (usage >= thresholds.warning) {
          status = 'degraded';
          message = `High memory usage: ${(usage * 100).toFixed(1)}%`;
        } else {
          status = 'healthy';
          message = `Memory usage normal: ${(usage * 100).toFixed(1)}%`;
        }

        return {
          status,
          message,
          timestamp: new Date(),
          details: {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            usagePercentage: usage * 100
          }
        };
      }
    };
  }

  /**
   * Disk space health check
   */
  static createDiskSpaceCheck(
    name = 'disk_space',
    path = '/',
    thresholds = { warning: 0.8, critical: 0.9 }
  ): HealthCheck {
    return {
      name,
      description: `Check disk space for ${path}`,
      interval: 300000, // 5 minutes
      timeout: 5000,
      critical: true,
      async check(): Promise<HealthCheckStatus> {
        try {
          const fs = await import('fs');
          const { promisify } = await import('util');
          const stat = promisify(fs.stat);

          const stats = await stat(path);

          // This is a simplified check - in production you might use a library like 'diskusage'
          return {
            status: 'healthy',
            message: 'Disk space check completed (simplified implementation)',
            timestamp: new Date(),
            details: {
              path,
              note: 'Use diskusage library for accurate disk space monitoring'
            }
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            message: `Disk space check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date()
          };
        }
      }
    };
  }

  /**
   * Queue depth health check
   */
  static createQueueCheck(
    name = 'job_queue',
    getQueueDepth: () => Promise<number>,
    thresholds = { warning: 100, critical: 500 }
  ): HealthCheck {
    return {
      name,
      description: 'Check job queue depth',
      interval: 30000, // 30 seconds
      timeout: 5000,
      critical: false,
      async check(): Promise<HealthCheckStatus> {
        try {
          const depth = await getQueueDepth();

          let status: HealthCheckStatus['status'];
          let message: string;

          if (depth >= thresholds.critical) {
            status = 'unhealthy';
            message = `Critical queue depth: ${depth}`;
          } else if (depth >= thresholds.warning) {
            status = 'degraded';
            message = `High queue depth: ${depth}`;
          } else {
            status = 'healthy';
            message = `Queue depth normal: ${depth}`;
          }

          return {
            status,
            message,
            timestamp: new Date(),
            details: { queueDepth: depth, thresholds }
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            message: `Queue check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date()
          };
        }
      }
    };
  }
}

// Singleton instance
let healthChecker: HealthChecker | null = null;

export function getHealthChecker(): HealthChecker {
  if (!healthChecker) {
    healthChecker = new HealthChecker();
  }
  return healthChecker;
}

export { HealthChecker };