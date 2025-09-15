/**
 * Metrics Collection System
 *
 * Collects, stores, and aggregates application metrics including processing
 * times, success rates, system resources, and custom business metrics.
 */

import {
  Metric,
  Counter,
  Gauge,
  Histogram,
  MetricsCollection,
  ProcessingMetrics,
  SystemMetrics,
  QueueMetrics,
  FileTypeDistribution,
  ErrorAnalysis
} from './types';
import { getLogger } from './logger';

class MetricsCollector {
  private metrics: MetricsCollection = {};
  private logger = getLogger('metrics-collector');
  private retentionMs: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(retentionDays = 7) {
    this.retentionMs = retentionDays * 24 * 60 * 60 * 1000;

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000); // Cleanup every hour
  }

  // Counter methods
  incrementCounter(name: string, labels?: Record<string, string>, value = 1) {
    const counter: Counter = {
      type: 'counter',
      value,
      timestamp: new Date(),
      labels
    };

    this.recordMetric(name, counter);
    this.logger.debug(`Counter incremented: ${name}`, { value, labels });
  }

  // Gauge methods
  setGauge(name: string, value: number, labels?: Record<string, string>) {
    const gauge: Gauge = {
      type: 'gauge',
      value,
      timestamp: new Date(),
      labels
    };

    this.recordMetric(name, gauge);
    this.logger.debug(`Gauge set: ${name}`, { value, labels });
  }

  // Histogram methods
  recordHistogram(name: string, value: number, labels?: Record<string, string>, buckets?: number[]) {
    const histogram: Histogram = {
      type: 'histogram',
      value,
      timestamp: new Date(),
      labels,
      buckets
    };

    this.recordMetric(name, histogram);
    this.logger.debug(`Histogram recorded: ${name}`, { value, labels });
  }

  // Processing metrics
  recordProcessingMetrics(metrics: ProcessingMetrics) {
    const labels = {
      processor_type: metrics.processorType,
      success: metrics.success.toString(),
      ...(metrics.errorType && { error_type: metrics.errorType })
    };

    this.recordHistogram('processing_time_ms', metrics.processingTime, labels);
    this.recordHistogram('file_size_bytes', metrics.fileSize, labels);
    this.incrementCounter('files_processed_total', labels);

    if (metrics.success) {
      this.incrementCounter('files_processed_success_total', labels);
    } else {
      this.incrementCounter('files_processed_error_total', labels);
    }

    if (metrics.queueDepth !== undefined) {
      this.setGauge('queue_depth', metrics.queueDepth);
    }

    if (metrics.memoryUsage !== undefined) {
      this.setGauge('memory_usage_mb', metrics.memoryUsage);
    }

    if (metrics.cpuUsage !== undefined) {
      this.setGauge('cpu_usage_percent', metrics.cpuUsage);
    }

    this.logger.info('Processing metrics recorded', {
      processorType: metrics.processorType,
      success: metrics.success,
      processingTime: metrics.processingTime,
      fileSize: metrics.fileSize
    });
  }

  // System metrics
  recordSystemMetrics(metrics: SystemMetrics) {
    this.setGauge('system_memory_used_bytes', metrics.memoryUsage.used);
    this.setGauge('system_memory_free_bytes', metrics.memoryUsage.free);
    this.setGauge('system_memory_usage_percent', metrics.memoryUsage.percentage);

    this.setGauge('system_cpu_usage_percent', metrics.cpuUsage.percentage);
    this.setGauge('system_load_average_1m', metrics.cpuUsage.loadAverage[0] || 0);
    this.setGauge('system_load_average_5m', metrics.cpuUsage.loadAverage[1] || 0);
    this.setGauge('system_load_average_15m', metrics.cpuUsage.loadAverage[2] || 0);

    this.setGauge('system_disk_used_bytes', metrics.diskUsage.used);
    this.setGauge('system_disk_free_bytes', metrics.diskUsage.free);
    this.setGauge('system_disk_usage_percent', metrics.diskUsage.percentage);

    this.setGauge('system_uptime_seconds', metrics.uptime);

    this.logger.debug('System metrics recorded', {
      memoryUsage: metrics.memoryUsage.percentage,
      cpuUsage: metrics.cpuUsage.percentage,
      diskUsage: metrics.diskUsage.percentage,
      uptime: metrics.uptime
    });
  }

  // Queue metrics
  recordQueueMetrics(metrics: QueueMetrics) {
    this.setGauge('queue_depth', metrics.depth);
    this.setGauge('queue_processing_jobs', metrics.processing);
    this.setGauge('queue_completed_jobs', metrics.completed);
    this.setGauge('queue_failed_jobs', metrics.failed);
    this.setGauge('queue_avg_processing_time_ms', metrics.avgProcessingTime);
    this.setGauge('queue_oldest_job_age_seconds', metrics.oldestJobAge);

    this.logger.debug('Queue metrics recorded', metrics);
  }

  private recordMetric(name: string, metric: Metric) {
    if (!this.metrics[name]) {
      this.metrics[name] = [];
    }

    this.metrics[name].push(metric);

    // Limit individual metric arrays to prevent memory issues
    if (this.metrics[name].length > 10000) {
      this.metrics[name] = this.metrics[name].slice(-5000);
    }
  }

  private cleanupOldMetrics() {
    const cutoff = new Date(Date.now() - this.retentionMs);
    let totalRemoved = 0;

    for (const [name, metrics] of Object.entries(this.metrics)) {
      const originalLength = metrics.length;
      this.metrics[name] = metrics.filter(m => m.timestamp >= cutoff);
      totalRemoved += originalLength - this.metrics[name].length;
    }

    if (totalRemoved > 0) {
      this.logger.info(`Cleaned up ${totalRemoved} old metrics`);
    }
  }

  // Query methods
  getMetrics(name: string, since?: Date): Metric[] {
    const metrics = this.metrics[name] || [];

    if (since) {
      return metrics.filter(m => m.timestamp >= since);
    }

    return [...metrics];
  }

  getAllMetrics(): MetricsCollection {
    return { ...this.metrics };
  }

  // Aggregation methods
  getCounterValue(name: string, since?: Date): number {
    const metrics = this.getMetrics(name, since);
    return metrics.reduce((sum, m) => sum + (m.type === 'counter' ? m.value : 0), 0);
  }

  getLatestGaugeValue(name: string): number | undefined {
    const metrics = this.getMetrics(name);
    const latestGauge = metrics
      .filter(m => m.type === 'gauge')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    return latestGauge?.value;
  }

  getHistogramStats(name: string, since?: Date): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.getMetrics(name, since);
    const values = metrics
      .filter(m => m.type === 'histogram')
      .map(m => m.value)
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return null;
    }

    const sum = values.reduce((s, v) => s + v, 0);
    const count = values.length;
    const avg = sum / count;

    const getPercentile = (p: number) => {
      const index = Math.floor((p / 100) * (values.length - 1));
      return values[index];
    };

    return {
      count,
      sum,
      avg,
      min: values[0],
      max: values[values.length - 1],
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99)
    };
  }

  // Analysis methods
  getFileTypeDistribution(since?: Date): FileTypeDistribution[] {
    const metrics = this.getMetrics('files_processed_total', since);
    const distribution: Record<string, {
      count: number;
      totalSize: number;
      totalTime: number;
      successCount: number;
    }> = {};

    // Aggregate by file type
    metrics.forEach(metric => {
      if (metric.labels?.processor_type) {
        const type = metric.labels.processor_type;
        if (!distribution[type]) {
          distribution[type] = {
            count: 0,
            totalSize: 0,
            totalTime: 0,
            successCount: 0
          };
        }
        distribution[type].count += metric.value;
        if (metric.labels.success === 'true') {
          distribution[type].successCount += metric.value;
        }
      }
    });

    // Add size and time data
    const sizeMetrics = this.getMetrics('file_size_bytes', since);
    const timeMetrics = this.getMetrics('processing_time_ms', since);

    sizeMetrics.forEach(metric => {
      if (metric.labels?.processor_type && distribution[metric.labels.processor_type]) {
        distribution[metric.labels.processor_type].totalSize += metric.value;
      }
    });

    timeMetrics.forEach(metric => {
      if (metric.labels?.processor_type && distribution[metric.labels.processor_type]) {
        distribution[metric.labels.processor_type].totalTime += metric.value;
      }
    });

    return Object.entries(distribution).map(([fileType, data]) => ({
      fileType,
      count: data.count,
      totalSize: data.totalSize,
      avgProcessingTime: data.count > 0 ? data.totalTime / data.count : 0,
      successRate: data.count > 0 ? data.successCount / data.count : 0
    }));
  }

  getErrorAnalysis(since?: Date): ErrorAnalysis[] {
    const metrics = this.getMetrics('files_processed_error_total', since);
    const analysis: Record<string, {
      count: number;
      lastOccurrence: Date;
      affectedFiles: number;
    }> = {};

    metrics.forEach(metric => {
      if (metric.labels?.error_type) {
        const errorType = metric.labels.error_type;
        if (!analysis[errorType] || metric.timestamp > analysis[errorType].lastOccurrence) {
          analysis[errorType] = {
            count: (analysis[errorType]?.count || 0) + metric.value,
            lastOccurrence: metric.timestamp,
            affectedFiles: (analysis[errorType]?.affectedFiles || 0) + metric.value
          };
        }
      }
    });

    return Object.entries(analysis).map(([errorType, data]) => ({
      errorType,
      count: data.count,
      lastOccurrence: data.lastOccurrence,
      avgRecoveryTime: 0, // TODO: Calculate from recovery metrics
      affectedFiles: data.affectedFiles
    }));
  }

  // Export metrics
  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'prometheus') {
      return this.exportPrometheusFormat();
    }

    return JSON.stringify(this.metrics, null, 2);
  }

  private exportPrometheusFormat(): string {
    const lines: string[] = [];

    for (const [name, metrics] of Object.entries(this.metrics)) {
      const latest = metrics[metrics.length - 1];
      if (!latest) continue;

      const labels = latest.labels
        ? `{${Object.entries(latest.labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
        : '';

      lines.push(`# HELP ${name} ${name}`);
      lines.push(`# TYPE ${name} ${latest.type}`);
      lines.push(`${name}${labels} ${latest.value} ${latest.timestamp.getTime()}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
let metricsCollector: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector();
  }
  return metricsCollector;
}

export { MetricsCollector };