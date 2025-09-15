/**
 * Monitoring System Entry Point
 *
 * Main entry point for the comprehensive monitoring and observability system.
 * Provides easy initialization and access to all monitoring components.
 */

// Core monitoring components
export { getLogger, createCorrelationId, Logger } from './logger';
export { getMetricsCollector, MetricsCollector } from './metrics-collector';
export { getPerformanceProfiler, AutoProfiler, PerformanceProfiler } from './performance-profiler';
export { getHealthChecker, BuiltInHealthChecks, HealthChecker } from './health-checker';
export { getAlertingSystem, AlertingSystem } from './alerting';
export { getMonitoringIntegration, MonitoringIntegration } from './integration';

// Types
export * from './types';

// Default alert rules for common scenarios
export const DEFAULT_ALERT_RULES = [
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    description: 'Alert when error rate exceeds 10%',
    metric: 'files_processed_error_total',
    condition: 'gt' as const,
    threshold: 10,
    duration: 300, // 5 minutes
    severity: 'warning' as const,
    channels: [{ type: 'log' as const, config: {} }],
    enabled: true
  },
  {
    id: 'critical-error-rate',
    name: 'Critical Error Rate',
    description: 'Alert when error rate exceeds 25%',
    metric: 'files_processed_error_total',
    condition: 'gt' as const,
    threshold: 25,
    duration: 180, // 3 minutes
    severity: 'critical' as const,
    channels: [{ type: 'log' as const, config: {} }],
    enabled: true
  },
  {
    id: 'high-memory-usage',
    name: 'High Memory Usage',
    description: 'Alert when memory usage exceeds 80%',
    metric: 'system_memory_usage_percent',
    condition: 'gt' as const,
    threshold: 80,
    duration: 300, // 5 minutes
    severity: 'warning' as const,
    channels: [{ type: 'log' as const, config: {} }],
    enabled: true
  },
  {
    id: 'critical-memory-usage',
    name: 'Critical Memory Usage',
    description: 'Alert when memory usage exceeds 90%',
    metric: 'system_memory_usage_percent',
    condition: 'gt' as const,
    threshold: 90,
    duration: 120, // 2 minutes
    severity: 'critical' as const,
    channels: [{ type: 'log' as const, config: {} }],
    enabled: true
  },
  {
    id: 'high-queue-depth',
    name: 'High Queue Depth',
    description: 'Alert when queue depth exceeds 100 jobs',
    metric: 'queue_depth',
    condition: 'gt' as const,
    threshold: 100,
    duration: 600, // 10 minutes
    severity: 'warning' as const,
    channels: [{ type: 'log' as const, config: {} }],
    enabled: true
  },
  {
    id: 'slow-processing',
    name: 'Slow Processing',
    description: 'Alert when average processing time exceeds 30 seconds',
    metric: 'processing_time_ms',
    condition: 'gt' as const,
    threshold: 30000,
    duration: 900, // 15 minutes
    severity: 'warning' as const,
    channels: [{ type: 'log' as const, config: {} }],
    enabled: true
  }
];

/**
 * Initialize the complete monitoring system
 */
export async function initializeMonitoring(config?: {
  enableSystemMetrics?: boolean;
  enableAlerting?: boolean;
  enableHealthChecks?: boolean;
  systemMetricsInterval?: number;
  alertEvaluationInterval?: number;
  healthCheckInterval?: number;
  customAlertRules?: typeof DEFAULT_ALERT_RULES;
}) {
  const {
    enableSystemMetrics = true,
    enableAlerting = true,
    enableHealthChecks = true,
    alertEvaluationInterval = 60000,
    customAlertRules = []
  } = config || {};

  const logger = getLogger('monitoring-init');

  try {
    // Initialize monitoring integration (includes system metrics)
    if (enableSystemMetrics) {
      getMonitoringIntegration();
      logger.info('System metrics collection initialized');
    }

    // Initialize health checks
    if (enableHealthChecks) {
      getHealthChecker();
      // Health checks are registered in API endpoints
      logger.info('Health check system initialized');
    }

    // Initialize alerting system
    if (enableAlerting) {
      const alertingSystem = getAlertingSystem();

      // Add default alert rules
      const allRules = [...DEFAULT_ALERT_RULES, ...customAlertRules];
      for (const rule of allRules) {
        alertingSystem.addRule(rule);
      }

      // Start alert evaluation
      alertingSystem.start(alertEvaluationInterval);

      logger.info('Alerting system initialized', {
        rulesCount: allRules.length,
        evaluationInterval: alertEvaluationInterval
      });
    }

    logger.info('Monitoring system fully initialized', {
      enableSystemMetrics,
      enableAlerting,
      enableHealthChecks
    });

    return true;
  } catch (error) {
    logger.error('Failed to initialize monitoring system', error as Error);
    return false;
  }
}

/**
 * Get monitoring system status
 */
export function getMonitoringStatus() {
  const logger = getLogger('monitoring-status');
  const metricsCollector = getMetricsCollector();
  const healthChecker = getHealthChecker();
  const alertingSystem = getAlertingSystem();

  try {
    const status = {
      timestamp: new Date().toISOString(),
      components: {
        logger: {
          status: 'active',
          totalLogs: logger.getLogStats().totalLogs
        },
        metrics: {
          status: 'active',
          metricsCount: Object.keys(metricsCollector.getAllMetrics()).length
        },
        healthChecker: {
          status: 'active',
          checksCount: healthChecker.getCheckNames().length,
          overallHealth: healthChecker.getOverallHealth().status
        },
        alerting: {
          status: 'active',
          rulesCount: alertingSystem.getAllRules().length,
          activeAlerts: alertingSystem.getActiveAlerts().length
        }
      }
    };

    logger.info('Monitoring system status check', status);
    return status;
  } catch (error) {
    logger.error('Failed to get monitoring status', error as Error);
    return {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Utility function to create a monitored version of any async function
 */
export function withMonitoring<T extends unknown[], R>(
  name: string,
  fn: (...args: T) => Promise<R>,
  options?: {
    recordMetrics?: boolean;
    logErrors?: boolean;
    profilePerformance?: boolean;
  }
): (...args: T) => Promise<R> {
  const {
    recordMetrics = true,
    logErrors = true,
    profilePerformance = true
  } = options || {};

  const logger = getLogger('monitored-function');
  const metricsCollector = getMetricsCollector();
  const performanceProfiler = getPerformanceProfiler();

  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    let profileId: string | undefined;

    if (profilePerformance) {
      profileId = performanceProfiler.startProfile(name);
    }

    try {
      logger.debug(`Starting monitored function: ${name}`);

      const result = await fn(...args);

      const duration = Date.now() - startTime;

      if (recordMetrics) {
        metricsCollector.recordHistogram(`function_duration_ms`, duration, { function_name: name });
        metricsCollector.incrementCounter(`function_calls_total`, { function_name: name, status: 'success' });
      }

      logger.debug(`Completed monitored function: ${name}`, { duration });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (logErrors) {
        logger.error(`Error in monitored function: ${name}`, error as Error, { duration });
      }

      if (recordMetrics) {
        metricsCollector.recordHistogram(`function_duration_ms`, duration, { function_name: name });
        metricsCollector.incrementCounter(`function_calls_total`, { function_name: name, status: 'error' });
      }

      throw error;
    } finally {
      if (profileId) {
        performanceProfiler.endProfile(profileId);
      }
    }
  };
}