/**
 * Monitoring Integration Layer
 *
 * Integrates monitoring with existing processors and systems to automatically
 * collect metrics, log events, and track performance.
 */

import { getMetricsCollector } from './metrics-collector';
import { getLogger, createCorrelationId } from './logger';
import { getPerformanceProfiler, AutoProfiler } from './performance-profiler';
import { ProcessorIntegrationAdapter } from '../processors/integration';
import { IngestionResult, IngestionOptions, IngestionProgressCallback } from '@/lib/ingestion/types';

class MonitoringIntegration {
  private metricsCollector = getMetricsCollector();
  private performanceProfiler = getPerformanceProfiler();

  /**
   * Wrap file processing with monitoring
   */
  async instrumentFileProcessing(
    processor: ProcessorIntegrationAdapter,
    filename: string,
    fileBuffer: Buffer,
    mimeType?: string,
    options: IngestionOptions = {},
    progressCallback?: IngestionProgressCallback
  ): Promise<IngestionResult> {
    const correlationId = createCorrelationId();
    const logger = getLogger('file-processing');

    logger.setCorrelationId(correlationId);

    // Create performance profile
    const profiler = new AutoProfiler(
      this.performanceProfiler,
      `file-processing-${filename}`,
      {
        filename,
        fileSize: fileBuffer.length,
        mimeType,
        correlationId
      }
    );

    const startTime = Date.now();
    let result: IngestionResult;
    let processorType = 'unknown';

    try {
      // Detect processor type
      if (processor.isFileTypeSupported(filename, mimeType)) {
        const factory = processor.getProcessorFactory();
        const detection = factory.detectFileType(filename, mimeType);
        processorType = detection.fileType || 'unknown';
      }

      logger.info('Starting file processing', {
        filename,
        fileSize: fileBuffer.length,
        mimeType,
        processorType,
        correlationId
      });

      // Record start metrics
      this.metricsCollector.incrementCounter(
        'file_processing_started_total',
        { processor_type: processorType }
      );

      // Create instrumented progress callback
      const instrumentedProgressCallback: IngestionProgressCallback = (progress) => {
        logger.debug('Processing progress', {
          step: progress.currentStep,
          progress: progress.progress,
          details: progress.details
        });

        // Call original callback if provided
        progressCallback?.(progress);
      };

      // Process file with monitoring
      result = await profiler.operation(
        'file-processing',
        () => processor.ingestFile(filename, fileBuffer, mimeType, options, instrumentedProgressCallback)
      );

      const processingTime = Date.now() - startTime;

      // Record processing metrics
      this.metricsCollector.recordProcessingMetrics({
        processingTime,
        fileSize: fileBuffer.length,
        processorType,
        success: result.success,
        errorType: result.error ? this.categorizeError(result.error.message) : undefined,
        memoryUsage: this.getCurrentMemoryUsage(),
        cpuUsage: 0 // Would need additional instrumentation
      });

      if (result.success) {
        logger.info('File processing completed successfully', {
          filename,
          processingTime,
          contentLength: result.content?.textContent?.length || 0,
          warnings: result.warnings?.length || 0
        });
      } else {
        logger.error('File processing failed', new Error(result.error?.message || 'Unknown error'), {
          filename,
          processingTime,
          errorType: result.error?.type,
          retryable: result.error?.retryable
        });
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error('File processing exception', error as Error, {
        filename,
        processingTime
      });

      // Record error metrics
      this.metricsCollector.recordProcessingMetrics({
        processingTime,
        fileSize: fileBuffer.length,
        processorType,
        success: false,
        errorType: this.categorizeError(error instanceof Error ? error.message : 'Unknown error'),
        memoryUsage: this.getCurrentMemoryUsage()
      });

      throw error;
    } finally {
      // End performance profile
      const profile = profiler.end();

      if (profile) {
        const analysis = this.performanceProfiler.analyzeBottlenecks(profile);

        if (analysis.recommendations.length > 0) {
          logger.warn('Performance recommendations available', {
            totalTime: analysis.totalTime,
            recommendations: analysis.recommendations
          });
        }
      }

      logger.clearContext();
    }

    return result;
  }

  /**
   * Record system metrics periodically
   */
  startSystemMetricsCollection(intervalMs = 60000) {
    const logger = getLogger('system-metrics');

    setInterval(() => {
      try {
        const metrics = this.collectSystemMetrics();
        this.metricsCollector.recordSystemMetrics(metrics);

        logger.debug('System metrics collected', {
          memoryUsage: metrics.memoryUsage.percentage,
          cpuUsage: metrics.cpuUsage.percentage,
          uptime: metrics.uptime
        });
      } catch (error) {
        logger.error('Failed to collect system metrics', error as Error);
      }
    }, intervalMs);

    logger.info(`Started system metrics collection with ${intervalMs}ms interval`);
  }

  /**
   * Collect current system metrics
   */
  private collectSystemMetrics() {
    const timestamp = new Date();

    // Memory usage
    const memUsage = typeof process !== 'undefined' && process.memoryUsage
      ? process.memoryUsage()
      : { heapUsed: 0, heapTotal: 1, rss: 0, external: 0 };

    const memoryUsage = {
      used: memUsage.heapUsed,
      free: memUsage.heapTotal - memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };

    // CPU usage (simplified)
    const loadAverage = typeof process !== 'undefined' && process.loadavg
      ? process.loadavg()
      : [0, 0, 0];

    const cpuUsage = {
      percentage: Math.min(loadAverage[0] * 100, 100), // Simplified
      loadAverage
    };

    // Disk usage (placeholder - would need additional library in production)
    const diskUsage = {
      used: 0,
      free: 1000000000, // 1GB placeholder
      total: 1000000000,
      percentage: 0
    };

    // Uptime
    const uptime = typeof process !== 'undefined' && process.uptime
      ? process.uptime()
      : 0;

    return {
      memoryUsage,
      cpuUsage,
      diskUsage,
      uptime,
      timestamp
    };
  }

  /**
   * Get current memory usage in MB
   */
  private getCurrentMemoryUsage(): number {
    if (typeof process === 'undefined' || !process.memoryUsage) {
      return 0;
    }

    return process.memoryUsage().heapUsed / 1024 / 1024;
  }

  /**
   * Categorize errors for better metrics
   */
  private categorizeError(errorMessage: string): string {
    const message = errorMessage.toLowerCase();

    if (message.includes('timeout')) return 'timeout';
    if (message.includes('memory')) return 'memory';
    if (message.includes('network')) return 'network';
    if (message.includes('permission')) return 'permission';
    if (message.includes('file not found')) return 'file_not_found';
    if (message.includes('invalid format') || message.includes('corrupted')) return 'invalid_format';
    if (message.includes('size limit')) return 'size_limit';
    if (message.includes('security')) return 'security';

    return 'unknown';
  }

  /**
   * Create instrumented version of processor adapter
   */
  createInstrumentedAdapter(): ProcessorIntegrationAdapter {
    const originalAdapter = new ProcessorIntegrationAdapter();

    // Wrap the ingestFile method with monitoring
    const originalIngestFile = originalAdapter.ingestFile.bind(originalAdapter);
    originalAdapter.ingestFile = async (filename, fileBuffer, mimeType, options, progressCallback) => {
      return this.instrumentFileProcessing(
        { ...originalAdapter, ingestFile: originalIngestFile } as ProcessorIntegrationAdapter,
        filename,
        fileBuffer,
        mimeType,
        options,
        progressCallback
      );
    };

    return originalAdapter;
  }
}

// Singleton instance
let monitoringIntegration: MonitoringIntegration | null = null;

export function getMonitoringIntegration(): MonitoringIntegration {
  if (!monitoringIntegration) {
    monitoringIntegration = new MonitoringIntegration();

    // Start system metrics collection
    monitoringIntegration.startSystemMetricsCollection();
  }

  return monitoringIntegration;
}

export { MonitoringIntegration };