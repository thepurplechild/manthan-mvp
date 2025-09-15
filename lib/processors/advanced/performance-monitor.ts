/**
 * Performance monitoring system for file processing operations
 */

import * as os from 'os';
import {
  PerformanceMetrics,
  ResourceUsage,
  ProcessingStats,
  PerformanceThresholds,
  PerformanceAlert,
  PerformanceReport,
  MetricType,
  AlertSeverity,
  TimeSeriesData,
  PerformanceConfig
} from './types';

export class PerformanceMonitor {
  private metrics: Map<string, TimeSeriesData[]> = new Map();
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThresholds;
  private config: PerformanceConfig;
  private startTime: number;

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = {
      retentionDays: 7,
      samplingInterval: 1000,
      alertThresholds: {
        memoryUsagePercent: 80,
        cpuUsagePercent: 75,
        processingTimeMs: 60000,
        errorRate: 0.05,
        throughputMin: 1
      },
      enableRealTimeMonitoring: true,
      enablePerformanceReports: true,
      ...config
    };

    this.thresholds = this.config.alertThresholds;
    this.startTime = Date.now();

    if (this.config.enableRealTimeMonitoring) {
      this.startRealTimeMonitoring();
    }
  }

  /**
   * Record processing metrics
   */
  recordMetrics(operationId: string, metrics: PerformanceMetrics): void {
    const timestamp = Date.now();

    // Store time series data
    this.storeTimeSeriesData(MetricType.MEMORY_USAGE, metrics.memoryUsage.current, timestamp);
    this.storeTimeSeriesData(MetricType.CPU_USAGE, metrics.cpuUsage.current, timestamp);
    this.storeTimeSeriesData(MetricType.PROCESSING_TIME, metrics.processingTime, timestamp);
    this.storeTimeSeriesData(MetricType.THROUGHPUT, metrics.throughput, timestamp);
    this.storeTimeSeriesData(MetricType.ERROR_RATE, metrics.errorRate, timestamp);

    // Check for threshold violations
    this.checkThresholds(operationId, metrics);

    // Log performance data
    console.log(`[PerformanceMonitor] Operation ${operationId}:`, {
      memory: `${(metrics.memoryUsage.current / 1024 / 1024).toFixed(2)}MB`,
      cpu: `${(metrics.cpuUsage.current * 100).toFixed(1)}%`,
      processingTime: `${metrics.processingTime}ms`,
      throughput: `${metrics.throughput.toFixed(2)} ops/sec`,
      errorRate: `${(metrics.errorRate * 100).toFixed(2)}%`
    });
  }

  /**
   * Record processing statistics
   */
  recordProcessingStats(operationId: string, stats: ProcessingStats): void {
    const processingTime = stats.endTime.getTime() - stats.startTime.getTime();

    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      operationId,
      memoryUsage: {
        current: stats.peakMemoryUsage,
        peak: stats.peakMemoryUsage,
        average: stats.peakMemoryUsage
      },
      cpuUsage: {
        current: stats.cpuUsage,
        peak: stats.cpuUsage,
        average: stats.cpuUsage
      },
      processingTime,
      throughput: 1000 / processingTime, // ops per second
      errorRate: 0, // No error if we're recording stats
      concurrent: 1,
      queueSize: 0
    };

    this.recordMetrics(operationId, metrics);
  }

  /**
   * Start real-time system monitoring
   */
  private startRealTimeMonitoring(): void {
    const monitor = () => {
      try {
        const resourceUsage = this.getCurrentResourceUsage();
        const timestamp = Date.now();

        this.storeTimeSeriesData(MetricType.SYSTEM_MEMORY, resourceUsage.memoryUsage, timestamp);
        this.storeTimeSeriesData(MetricType.SYSTEM_CPU, resourceUsage.cpuUsage, timestamp);

        // Check system-level thresholds
        if (resourceUsage.memoryUsage > this.thresholds.memoryUsagePercent) {
          this.triggerAlert({
            id: `system-memory-${timestamp}`,
            severity: AlertSeverity.WARNING,
            type: 'system_memory_high',
            message: `System memory usage is ${resourceUsage.memoryUsage.toFixed(1)}%`,
            timestamp: new Date(),
            metrics: {
              memoryUsage: resourceUsage.memoryUsage
            }
          });
        }

        if (resourceUsage.cpuUsage > this.thresholds.cpuUsagePercent) {
          this.triggerAlert({
            id: `system-cpu-${timestamp}`,
            severity: AlertSeverity.WARNING,
            type: 'system_cpu_high',
            message: `System CPU usage is ${resourceUsage.cpuUsage.toFixed(1)}%`,
            timestamp: new Date(),
            metrics: {
              cpuUsage: resourceUsage.cpuUsage
            }
          });
        }
      } catch (error) {
        console.error('[PerformanceMonitor] Error in real-time monitoring:', error);
      }

      setTimeout(monitor, this.config.samplingInterval);
    };

    monitor();
  }

  /**
   * Get current system resource usage
   */
  private getCurrentResourceUsage(): ResourceUsage {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Basic CPU usage estimation (this would need more sophisticated implementation in production)
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const cpuUsage = (loadAvg / cpuCount) * 100;

    return {
      memoryUsage: (usedMemory / totalMemory) * 100,
      cpuUsage: Math.min(cpuUsage, 100),
      diskUsage: 0, // Would need disk space checking in production
      networkUsage: 0 // Would need network monitoring in production
    };
  }

  /**
   * Store time series data point
   */
  private storeTimeSeriesData(metricType: MetricType, value: number, timestamp: number): void {
    if (!this.metrics.has(metricType)) {
      this.metrics.set(metricType, []);
    }

    const data = this.metrics.get(metricType)!;
    data.push({ timestamp, value });

    // Clean up old data based on retention policy
    const cutoffTime = timestamp - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    const filteredData = data.filter(point => point.timestamp > cutoffTime);
    this.metrics.set(metricType, filteredData);
  }

  /**
   * Check performance thresholds and trigger alerts
   */
  private checkThresholds(operationId: string, metrics: PerformanceMetrics): void {
    // Memory usage check
    if (metrics.memoryUsage.current > this.thresholds.memoryUsagePercent * 1024 * 1024) {
      this.triggerAlert({
        id: `memory-${operationId}-${Date.now()}`,
        severity: AlertSeverity.WARNING,
        type: 'memory_usage_high',
        message: `High memory usage for operation ${operationId}: ${(metrics.memoryUsage.current / 1024 / 1024).toFixed(2)}MB`,
        timestamp: new Date(),
        operationId,
        metrics: {
          memoryUsage: metrics.memoryUsage.current
        }
      });
    }

    // CPU usage check
    if (metrics.cpuUsage.current > this.thresholds.cpuUsagePercent / 100) {
      this.triggerAlert({
        id: `cpu-${operationId}-${Date.now()}`,
        severity: AlertSeverity.WARNING,
        type: 'cpu_usage_high',
        message: `High CPU usage for operation ${operationId}: ${(metrics.cpuUsage.current * 100).toFixed(1)}%`,
        timestamp: new Date(),
        operationId,
        metrics: {
          cpuUsage: metrics.cpuUsage.current * 100
        }
      });
    }

    // Processing time check
    if (metrics.processingTime > this.thresholds.processingTimeMs) {
      this.triggerAlert({
        id: `processing-time-${operationId}-${Date.now()}`,
        severity: AlertSeverity.ERROR,
        type: 'processing_time_high',
        message: `Slow processing for operation ${operationId}: ${metrics.processingTime}ms`,
        timestamp: new Date(),
        operationId,
        metrics: {
          processingTime: metrics.processingTime
        }
      });
    }

    // Error rate check
    if (metrics.errorRate > this.thresholds.errorRate) {
      this.triggerAlert({
        id: `error-rate-${operationId}-${Date.now()}`,
        severity: AlertSeverity.CRITICAL,
        type: 'error_rate_high',
        message: `High error rate for operation ${operationId}: ${(metrics.errorRate * 100).toFixed(2)}%`,
        timestamp: new Date(),
        operationId,
        metrics: {
          errorRate: metrics.errorRate * 100
        }
      });
    }

    // Throughput check
    if (metrics.throughput < this.thresholds.throughputMin) {
      this.triggerAlert({
        id: `throughput-${operationId}-${Date.now()}`,
        severity: AlertSeverity.WARNING,
        type: 'throughput_low',
        message: `Low throughput for operation ${operationId}: ${metrics.throughput.toFixed(2)} ops/sec`,
        timestamp: new Date(),
        operationId,
        metrics: {
          throughput: metrics.throughput
        }
      });
    }
  }

  /**
   * Trigger performance alert
   */
  private triggerAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    // Log alert
    console.warn(`[PerformanceMonitor] ${alert.severity.toUpperCase()}: ${alert.message}`);

    // In production, this would send notifications via webhooks, email, etc.
    if (alert.severity === AlertSeverity.CRITICAL) {
      console.error(`[PerformanceMonitor] CRITICAL ALERT: ${alert.message}`);
    }

    // Clean up old alerts (keep last 1000)
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  /**
   * Get performance metrics for a time range
   */
  getMetrics(
    metricType: MetricType,
    startTime?: number,
    endTime?: number
  ): TimeSeriesData[] {
    const data = this.metrics.get(metricType) || [];

    if (!startTime && !endTime) {
      return [...data];
    }

    const start = startTime || 0;
    const end = endTime || Date.now();

    return data.filter(point => point.timestamp >= start && point.timestamp <= end);
  }

  /**
   * Get performance summary statistics
   */
  getPerformanceSummary(timeRangeMs?: number): PerformanceReport {
    const endTime = Date.now();
    const startTime = timeRangeMs ? endTime - timeRangeMs : this.startTime;

    const memoryData = this.getMetrics(MetricType.MEMORY_USAGE, startTime, endTime);
    const cpuData = this.getMetrics(MetricType.CPU_USAGE, startTime, endTime);
    const processingTimeData = this.getMetrics(MetricType.PROCESSING_TIME, startTime, endTime);
    const throughputData = this.getMetrics(MetricType.THROUGHPUT, startTime, endTime);
    const errorRateData = this.getMetrics(MetricType.ERROR_RATE, startTime, endTime);

    return {
      timeRange: {
        start: new Date(startTime),
        end: new Date(endTime)
      },
      summary: {
        totalOperations: processingTimeData.length,
        avgProcessingTime: this.calculateAverage(processingTimeData),
        maxProcessingTime: this.calculateMax(processingTimeData),
        minProcessingTime: this.calculateMin(processingTimeData),
        avgThroughput: this.calculateAverage(throughputData),
        avgMemoryUsage: this.calculateAverage(memoryData),
        peakMemoryUsage: this.calculateMax(memoryData),
        avgCpuUsage: this.calculateAverage(cpuData),
        peakCpuUsage: this.calculateMax(cpuData),
        errorRate: this.calculateAverage(errorRateData),
        totalErrors: Math.round(this.calculateSum(errorRateData))
      },
      alerts: this.alerts.filter(alert =>
        alert.timestamp.getTime() >= startTime &&
        alert.timestamp.getTime() <= endTime
      ),
      trends: {
        memoryTrend: this.calculateTrend(memoryData),
        cpuTrend: this.calculateTrend(cpuData),
        throughputTrend: this.calculateTrend(throughputData),
        errorRateTrend: this.calculateTrend(errorRateData)
      }
    };
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(count: number = 50): PerformanceAlert[] {
    return this.alerts.slice(-count).reverse();
  }

  /**
   * Clear old metrics and alerts
   */
  cleanup(): void {
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);

    // Clean up metrics
    for (const [metricType, data] of this.metrics.entries()) {
      const filteredData = data.filter(point => point.timestamp > cutoffTime);
      this.metrics.set(metricType, filteredData);
    }

    // Clean up alerts
    this.alerts = this.alerts.filter(alert => alert.timestamp.getTime() > cutoffTime);

    console.log(`[PerformanceMonitor] Cleaned up data older than ${this.config.retentionDays} days`);
  }

  /**
   * Export performance data
   */
  exportData(): {
    metrics: Record<string, TimeSeriesData[]>;
    alerts: PerformanceAlert[];
    config: PerformanceConfig;
  } {
    const exportedMetrics: Record<string, TimeSeriesData[]> = {};
    for (const [metricType, data] of this.metrics.entries()) {
      exportedMetrics[metricType] = [...data];
    }

    return {
      metrics: exportedMetrics,
      alerts: [...this.alerts],
      config: { ...this.config }
    };
  }

  /**
   * Set performance thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('[PerformanceMonitor] Updated performance thresholds:', this.thresholds);
  }

  /**
   * Helper methods for statistical calculations
   */
  private calculateAverage(data: TimeSeriesData[]): number {
    if (data.length === 0) return 0;
    return data.reduce((sum, point) => sum + point.value, 0) / data.length;
  }

  private calculateMax(data: TimeSeriesData[]): number {
    if (data.length === 0) return 0;
    return Math.max(...data.map(point => point.value));
  }

  private calculateMin(data: TimeSeriesData[]): number {
    if (data.length === 0) return 0;
    return Math.min(...data.map(point => point.value));
  }

  private calculateSum(data: TimeSeriesData[]): number {
    return data.reduce((sum, point) => sum + point.value, 0);
  }

  private calculateTrend(data: TimeSeriesData[]): 'increasing' | 'decreasing' | 'stable' {
    if (data.length < 2) return 'stable';

    const recentData = data.slice(-10); // Last 10 data points
    const firstHalf = recentData.slice(0, Math.floor(recentData.length / 2));
    const secondHalf = recentData.slice(Math.floor(recentData.length / 2));

    const firstAvg = this.calculateAverage(firstHalf);
    const secondAvg = this.calculateAverage(secondHalf);

    const threshold = firstAvg * 0.1; // 10% threshold for trend detection

    if (secondAvg > firstAvg + threshold) return 'increasing';
    if (secondAvg < firstAvg - threshold) return 'decreasing';
    return 'stable';
  }
}

/**
 * Global performance monitor instance
 */
let globalMonitor: PerformanceMonitor | null = null;

/**
 * Get or create global performance monitor
 */
export function getPerformanceMonitor(config?: Partial<PerformanceConfig>): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor(config);
  }
  return globalMonitor;
}

/**
 * Reset global performance monitor (useful for testing)
 */
export function resetPerformanceMonitor(): void {
  globalMonitor = null;
}

/**
 * Performance monitoring decorator for functions
 */
export function monitorPerformance(operationId?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const monitor = getPerformanceMonitor();
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;

      try {
        const result = await method.apply(this, args);
        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;

        const stats: ProcessingStats = {
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          duration: endTime - startTime,
          peakMemoryUsage: Math.max(startMemory, endMemory),
          cpuUsage: 0.1 // Placeholder - would need more sophisticated CPU monitoring
        };

        monitor.recordProcessingStats(
          operationId || `${target.constructor.name}.${propertyName}`,
          stats
        );

        return result;
      } catch (error) {
        const endTime = Date.now();

        // Record error metrics
        monitor.recordMetrics(operationId || `${target.constructor.name}.${propertyName}`, {
          timestamp: endTime,
          operationId: operationId || `${target.constructor.name}.${propertyName}`,
          memoryUsage: {
            current: process.memoryUsage().heapUsed,
            peak: process.memoryUsage().heapUsed,
            average: process.memoryUsage().heapUsed
          },
          cpuUsage: {
            current: 0.1,
            peak: 0.1,
            average: 0.1
          },
          processingTime: endTime - startTime,
          throughput: 0,
          errorRate: 1, // 100% error rate for this operation
          concurrent: 1,
          queueSize: 0
        });

        throw error;
      }
    };

    return descriptor;
  };
}