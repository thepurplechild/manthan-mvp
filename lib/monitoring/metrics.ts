/**
 * Application Metrics Collection and Analysis System
 *
 * Comprehensive metrics tracking for file processing operations
 * including performance, success rates, and resource usage.
 */

import { SupportedFileType } from '@/lib/processors/types';

// Metric Types
export interface ProcessingMetric {
  id: string;
  timestamp: Date;
  operationType: 'file_processing' | 'content_analysis' | 'security_scan' | 'output_generation';
  fileType: SupportedFileType | 'unknown';
  fileSize: number;
  processingTimeMs: number;
  success: boolean;
  errorType?: string;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  correlationId: string;
  userId?: string;
  metadata: Record<string, any>;
}

export interface AggregatedMetrics {
  timeRange: {
    start: Date;
    end: Date;
  };
  processingStats: {
    totalOperations: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgProcessingTime: number;
    p50ProcessingTime: number;
    p95ProcessingTime: number;
    p99ProcessingTime: number;
  };
  fileStats: {
    totalFilesProcessed: number;
    totalDataProcessedMB: number;
    avgFileSizeMB: number;
    fileTypeDistribution: Record<string, number>;
    largestFileSizeMB: number;
  };
  resourceStats: {
    avgMemoryUsageMB: number;
    peakMemoryUsageMB: number;
    avgCpuUsagePercent: number;
    peakCpuUsagePercent: number;
  };
  errorStats: {
    errorRate: number;
    errorDistribution: Record<string, number>;
    topErrors: Array<{ error: string; count: number; percentage: number }>;
  };
  throughputStats: {
    operationsPerSecond: number;
    operationsPerMinute: number;
    operationsPerHour: number;
    filesPerHour: number;
    dataProcessedPerHourMB: number;
  };
}

export interface MetricAlert {
  id: string;
  type: 'performance' | 'error_rate' | 'resource' | 'throughput';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  value: number;
  threshold: number;
  correlationId?: string;
}

export class MetricsCollector {
  private metrics: ProcessingMetric[] = [];
  private alerts: MetricAlert[] = [];
  private readonly maxMetricsRetention = 100000; // Keep last 100k metrics
  private readonly maxAlertsRetention = 10000; // Keep last 10k alerts

  // Performance thresholds for alerting
  private readonly thresholds = {
    processingTimeMs: 30000, // 30 seconds
    errorRate: 0.05, // 5%
    memoryUsageMB: 1000, // 1GB
    cpuUsagePercent: 80, // 80%
    throughputMinPerHour: 100 // 100 operations per hour minimum
  };

  /**
   * Record a processing metric
   */
  recordMetric(metric: Omit<ProcessingMetric, 'id' | 'timestamp'>): void {
    const fullMetric: ProcessingMetric = {
      id: this.generateMetricId(),
      timestamp: new Date(),
      ...metric
    };

    this.metrics.push(fullMetric);
    this.checkThresholds(fullMetric);
    this.cleanupOldMetrics();

    // Log metric for debugging
    console.log(`[Metrics] Recorded: ${fullMetric.operationType} - ${fullMetric.success ? 'SUCCESS' : 'FAILURE'} - ${fullMetric.processingTimeMs}ms`);
  }

  /**
   * Get aggregated metrics for a time range
   */
  getAggregatedMetrics(
    startTime: Date = new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    endTime: Date = new Date()
  ): AggregatedMetrics {
    const filteredMetrics = this.metrics.filter(
      metric => metric.timestamp >= startTime && metric.timestamp <= endTime
    );

    if (filteredMetrics.length === 0) {
      return this.getEmptyAggregatedMetrics(startTime, endTime);
    }

    const processingTimes = filteredMetrics.map(m => m.processingTimeMs).sort((a, b) => a - b);
    const successfulMetrics = filteredMetrics.filter(m => m.success);
    const failedMetrics = filteredMetrics.filter(m => !m.success);

    // Calculate percentiles
    const p50 = this.calculatePercentile(processingTimes, 50);
    const p95 = this.calculatePercentile(processingTimes, 95);
    const p99 = this.calculatePercentile(processingTimes, 99);

    // File type distribution
    const fileTypeDistribution: Record<string, number> = {};
    filteredMetrics.forEach(metric => {
      fileTypeDistribution[metric.fileType] = (fileTypeDistribution[metric.fileType] || 0) + 1;
    });

    // Error distribution
    const errorDistribution: Record<string, number> = {};
    failedMetrics.forEach(metric => {
      if (metric.errorType) {
        errorDistribution[metric.errorType] = (errorDistribution[metric.errorType] || 0) + 1;
      }
    });

    // Top errors
    const topErrors = Object.entries(errorDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([error, count]) => ({
        error,
        count,
        percentage: (count / failedMetrics.length) * 100
      }));

    // Time range in hours for throughput calculations
    const timeRangeHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const timeRangeMinutes = timeRangeHours * 60;
    const timeRangeSeconds = timeRangeMinutes * 60;

    return {
      timeRange: { start: startTime, end: endTime },
      processingStats: {
        totalOperations: filteredMetrics.length,
        successCount: successfulMetrics.length,
        failureCount: failedMetrics.length,
        successRate: filteredMetrics.length > 0 ? successfulMetrics.length / filteredMetrics.length : 0,
        avgProcessingTime: this.average(processingTimes),
        p50ProcessingTime: p50,
        p95ProcessingTime: p95,
        p99ProcessingTime: p99
      },
      fileStats: {
        totalFilesProcessed: filteredMetrics.length,
        totalDataProcessedMB: this.sum(filteredMetrics.map(m => m.fileSize)) / (1024 * 1024),
        avgFileSizeMB: this.average(filteredMetrics.map(m => m.fileSize)) / (1024 * 1024),
        fileTypeDistribution,
        largestFileSizeMB: Math.max(...filteredMetrics.map(m => m.fileSize)) / (1024 * 1024)
      },
      resourceStats: {
        avgMemoryUsageMB: this.average(filteredMetrics.map(m => m.memoryUsageMB)),
        peakMemoryUsageMB: Math.max(...filteredMetrics.map(m => m.memoryUsageMB)),
        avgCpuUsagePercent: this.average(filteredMetrics.map(m => m.cpuUsagePercent)),
        peakCpuUsagePercent: Math.max(...filteredMetrics.map(m => m.cpuUsagePercent))
      },
      errorStats: {
        errorRate: filteredMetrics.length > 0 ? failedMetrics.length / filteredMetrics.length : 0,
        errorDistribution,
        topErrors
      },
      throughputStats: {
        operationsPerSecond: timeRangeSeconds > 0 ? filteredMetrics.length / timeRangeSeconds : 0,
        operationsPerMinute: timeRangeMinutes > 0 ? filteredMetrics.length / timeRangeMinutes : 0,
        operationsPerHour: timeRangeHours > 0 ? filteredMetrics.length / timeRangeHours : 0,
        filesPerHour: timeRangeHours > 0 ? filteredMetrics.length / timeRangeHours : 0,
        dataProcessedPerHourMB: timeRangeHours > 0 ?
          this.sum(filteredMetrics.map(m => m.fileSize)) / (1024 * 1024) / timeRangeHours : 0
      }
    };
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(limit: number = 100): ProcessingMetric[] {
    return this.metrics
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get metrics by correlation ID
   */
  getMetricsByCorrelationId(correlationId: string): ProcessingMetric[] {
    return this.metrics.filter(metric => metric.correlationId === correlationId);
  }

  /**
   * Get current alerts
   */
  getCurrentAlerts(): MetricAlert[] {
    return this.alerts
      .slice(-50) // Last 50 alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get system health status
   */
  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    score: number;
    issues: string[];
    lastUpdateTime: Date;
  } {
    const recentMetrics = this.getAggregatedMetrics(
      new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
      new Date()
    );

    const issues: string[] = [];
    let healthScore = 100;

    // Check error rate
    if (recentMetrics.errorStats.errorRate > this.thresholds.errorRate) {
      issues.push(`High error rate: ${(recentMetrics.errorStats.errorRate * 100).toFixed(1)}%`);
      healthScore -= 30;
    }

    // Check processing time
    if (recentMetrics.processingStats.p95ProcessingTime > this.thresholds.processingTimeMs) {
      issues.push(`Slow processing: P95 ${recentMetrics.processingStats.p95ProcessingTime}ms`);
      healthScore -= 20;
    }

    // Check resource usage
    if (recentMetrics.resourceStats.peakMemoryUsageMB > this.thresholds.memoryUsageMB) {
      issues.push(`High memory usage: ${recentMetrics.resourceStats.peakMemoryUsageMB}MB`);
      healthScore -= 15;
    }

    if (recentMetrics.resourceStats.peakCpuUsagePercent > this.thresholds.cpuUsagePercent) {
      issues.push(`High CPU usage: ${recentMetrics.resourceStats.peakCpuUsagePercent}%`);
      healthScore -= 15;
    }

    // Check throughput
    const hourlyMetrics = this.getAggregatedMetrics(
      new Date(Date.now() - 60 * 60 * 1000), // Last hour
      new Date()
    );
    if (hourlyMetrics.throughputStats.operationsPerHour < this.thresholds.throughputMinPerHour) {
      issues.push(`Low throughput: ${hourlyMetrics.throughputStats.operationsPerHour} ops/hour`);
      healthScore -= 20;
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthScore >= 80) status = 'healthy';
    else if (healthScore >= 50) status = 'degraded';
    else status = 'unhealthy';

    return {
      status,
      score: Math.max(0, healthScore),
      issues,
      lastUpdateTime: new Date()
    };
  }

  /**
   * Export metrics data
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      return this.metricsToCSV();
    }
    return JSON.stringify(this.metrics, null, 2);
  }

  /**
   * Clear all metrics (for testing or maintenance)
   */
  clearMetrics(): void {
    this.metrics = [];
    this.alerts = [];
    console.log('[Metrics] All metrics and alerts cleared');
  }

  // Private helper methods

  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private checkThresholds(metric: ProcessingMetric): void {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();

    // Check processing time threshold
    if (metric.processingTimeMs > this.thresholds.processingTimeMs) {
      this.alerts.push({
        id: alertId,
        type: 'performance',
        severity: metric.processingTimeMs > this.thresholds.processingTimeMs * 2 ? 'critical' : 'warning',
        message: `Slow processing detected: ${metric.processingTimeMs}ms for ${metric.operationType}`,
        timestamp,
        value: metric.processingTimeMs,
        threshold: this.thresholds.processingTimeMs,
        correlationId: metric.correlationId
      });
    }

    // Check memory usage threshold
    if (metric.memoryUsageMB > this.thresholds.memoryUsageMB) {
      this.alerts.push({
        id: alertId,
        type: 'resource',
        severity: metric.memoryUsageMB > this.thresholds.memoryUsageMB * 1.5 ? 'critical' : 'warning',
        message: `High memory usage: ${metric.memoryUsageMB}MB`,
        timestamp,
        value: metric.memoryUsageMB,
        threshold: this.thresholds.memoryUsageMB,
        correlationId: metric.correlationId
      });
    }

    // Check CPU usage threshold
    if (metric.cpuUsagePercent > this.thresholds.cpuUsagePercent) {
      this.alerts.push({
        id: alertId,
        type: 'resource',
        severity: metric.cpuUsagePercent > 95 ? 'critical' : 'warning',
        message: `High CPU usage: ${metric.cpuUsagePercent}%`,
        timestamp,
        value: metric.cpuUsagePercent,
        threshold: this.thresholds.cpuUsagePercent,
        correlationId: metric.correlationId
      });
    }

    // Check for failures
    if (!metric.success) {
      this.alerts.push({
        id: alertId,
        type: 'error_rate',
        severity: 'error',
        message: `Operation failed: ${metric.operationType} - ${metric.errorType || 'Unknown error'}`,
        timestamp,
        value: 1,
        threshold: 0,
        correlationId: metric.correlationId
      });
    }

    this.cleanupOldAlerts();
  }

  private cleanupOldMetrics(): void {
    if (this.metrics.length > this.maxMetricsRetention) {
      const toRemove = this.metrics.length - this.maxMetricsRetention;
      this.metrics.splice(0, toRemove);
    }
  }

  private cleanupOldAlerts(): void {
    if (this.alerts.length > this.maxAlertsRetention) {
      const toRemove = this.alerts.length - this.maxAlertsRetention;
      this.alerts.splice(0, toRemove);
    }
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sortedArray[lower];
    return sortedArray[lower] * (upper - index) + sortedArray[upper] * (index - lower);
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private sum(numbers: number[]): number {
    return numbers.reduce((sum, num) => sum + num, 0);
  }

  private getEmptyAggregatedMetrics(startTime: Date, endTime: Date): AggregatedMetrics {
    return {
      timeRange: { start: startTime, end: endTime },
      processingStats: {
        totalOperations: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        avgProcessingTime: 0,
        p50ProcessingTime: 0,
        p95ProcessingTime: 0,
        p99ProcessingTime: 0
      },
      fileStats: {
        totalFilesProcessed: 0,
        totalDataProcessedMB: 0,
        avgFileSizeMB: 0,
        fileTypeDistribution: {},
        largestFileSizeMB: 0
      },
      resourceStats: {
        avgMemoryUsageMB: 0,
        peakMemoryUsageMB: 0,
        avgCpuUsagePercent: 0,
        peakCpuUsagePercent: 0
      },
      errorStats: {
        errorRate: 0,
        errorDistribution: {},
        topErrors: []
      },
      throughputStats: {
        operationsPerSecond: 0,
        operationsPerMinute: 0,
        operationsPerHour: 0,
        filesPerHour: 0,
        dataProcessedPerHourMB: 0
      }
    };
  }

  private metricsToCSV(): string {
    const headers = [
      'id', 'timestamp', 'operationType', 'fileType', 'fileSize', 'processingTimeMs',
      'success', 'errorType', 'memoryUsageMB', 'cpuUsagePercent', 'correlationId', 'userId'
    ];

    const rows = this.metrics.map(metric => [
      metric.id,
      metric.timestamp.toISOString(),
      metric.operationType,
      metric.fileType,
      metric.fileSize,
      metric.processingTimeMs,
      metric.success,
      metric.errorType || '',
      metric.memoryUsageMB,
      metric.cpuUsagePercent,
      metric.correlationId,
      metric.userId || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

// Global metrics collector instance
let globalMetricsCollector: MetricsCollector | null = null;

/**
 * Get or create global metrics collector
 */
export function getMetricsCollector(): MetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new MetricsCollector();
  }
  return globalMetricsCollector;
}

/**
 * Reset global metrics collector (useful for testing)
 */
export function resetMetricsCollector(): void {
  globalMetricsCollector = null;
}

/**
 * Decorator for automatic metrics collection
 */
export function collectMetrics(
  operationType: ProcessingMetric['operationType'],
  fileType?: SupportedFileType
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const metricsCollector = getMetricsCollector();
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;
      const correlationId = args.find(arg => arg?.correlationId)?.correlationId ||
                          `${target.constructor.name}_${Date.now()}`;

      try {
        const result = await method.apply(this, args);
        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;

        metricsCollector.recordMetric({
          operationType,
          fileType: fileType || 'unknown',
          fileSize: args.find(arg => arg?.buffer)?.buffer?.length || 0,
          processingTimeMs: endTime - startTime,
          success: true,
          memoryUsageMB: Math.max(startMemory, endMemory) / (1024 * 1024),
          cpuUsagePercent: 0, // Would need more sophisticated CPU monitoring
          correlationId,
          metadata: {
            method: `${target.constructor.name}.${propertyName}`,
            args: args.length
          }
        });

        return result;
      } catch (error) {
        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;

        metricsCollector.recordMetric({
          operationType,
          fileType: fileType || 'unknown',
          fileSize: args.find(arg => arg?.buffer)?.buffer?.length || 0,
          processingTimeMs: endTime - startTime,
          success: false,
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          memoryUsageMB: Math.max(startMemory, endMemory) / (1024 * 1024),
          cpuUsagePercent: 0,
          correlationId,
          metadata: {
            method: `${target.constructor.name}.${propertyName}`,
            error: error instanceof Error ? error.message : String(error),
            args: args.length
          }
        });

        throw error;
      }
    };

    return descriptor;
  };
}