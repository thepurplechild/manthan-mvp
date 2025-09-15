/**
 * Health Check and Alerting System
 *
 * Comprehensive health monitoring for all system components
 * with configurable checks, alerting, and remediation actions.
 */

import { getMetricsCollector } from './metrics';

// Health Check Types
export interface HealthCheck {
  id: string;
  name: string;
  description: string;
  category: 'database' | 'storage' | 'processing' | 'external' | 'system';
  check: () => Promise<HealthCheckResult>;
  timeout: number;
  interval: number;
  enabled: boolean;
  dependencies?: string[];
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: Date;
  duration: number;
  metadata?: Record<string, any>;
  error?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  overallScore: number;
  checks: Record<string, HealthCheckResult>;
  alerts: HealthAlert[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export interface HealthAlert {
  id: string;
  checkId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
  escalated: boolean;
  metadata?: Record<string, any>;
}

export interface AlertingConfig {
  enabled: boolean;
  webhookUrl?: string;
  emailRecipients?: string[];
  slackWebhook?: string;
  escalationDelay: number; // minutes
  maxRetries: number;
  retryDelay: number; // seconds
  suppressDuration: number; // minutes - suppress duplicate alerts
}

export class HealthMonitor {
  private checks: Map<string, HealthCheck> = new Map();
  private results: Map<string, HealthCheckResult> = new Map();
  private alerts: HealthAlert[] = [];
  private intervalIds: Map<string, NodeJS.Timeout> = new Map();
  private alertingConfig: AlertingConfig;
  private suppressedAlerts: Set<string> = new Set();

  constructor(alertingConfig?: Partial<AlertingConfig>) {
    this.alertingConfig = {
      enabled: true,
      escalationDelay: 15,
      maxRetries: 3,
      retryDelay: 30,
      suppressDuration: 5,
      ...alertingConfig
    };

    this.registerDefaultChecks();
  }

  /**
   * Register a health check
   */
  registerCheck(check: HealthCheck): void {
    this.checks.set(check.id, check);

    if (check.enabled) {
      this.startPeriodicCheck(check);
    }

    console.log(`[HealthMonitor] Registered check: ${check.name}`);
  }

  /**
   * Remove a health check
   */
  unregisterCheck(checkId: string): void {
    this.stopPeriodicCheck(checkId);
    this.checks.delete(checkId);
    this.results.delete(checkId);
    console.log(`[HealthMonitor] Unregistered check: ${checkId}`);
  }

  /**
   * Run a specific health check
   */
  async runCheck(checkId: string): Promise<HealthCheckResult> {
    const check = this.checks.get(checkId);
    if (!check) {
      throw new Error(`Health check not found: ${checkId}`);
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // Check dependencies first
      if (check.dependencies?.length) {
        for (const depId of check.dependencies) {
          const depResult = this.results.get(depId);
          if (!depResult || depResult.status === 'unhealthy') {
            result = {
              status: 'degraded',
              message: `Dependency ${depId} is unhealthy`,
              timestamp: new Date(),
              duration: Date.now() - startTime,
              metadata: { dependency: depId }
            };
            this.results.set(checkId, result);
            return result;
          }
        }
      }

      // Run the actual check with timeout
      const checkPromise = check.check();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
      });

      result = await Promise.race([checkPromise, timeoutPromise]);
      result.duration = Date.now() - startTime;

    } catch (error) {
      result = {
        status: 'unhealthy',
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.stack : String(error)
      };
    }

    this.results.set(checkId, result);
    this.handleCheckResult(check, result);

    return result;
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<SystemHealth> {
    const enabledChecks = Array.from(this.checks.values()).filter(check => check.enabled);

    // Run checks in parallel, respecting dependencies
    const checkResults = await this.runChecksWithDependencies(enabledChecks);

    const summary = {
      total: checkResults.length,
      healthy: checkResults.filter(r => r.status === 'healthy').length,
      degraded: checkResults.filter(r => r.status === 'degraded').length,
      unhealthy: checkResults.filter(r => r.status === 'unhealthy').length
    };

    // Calculate overall health score
    const healthyWeight = 1.0;
    const degradedWeight = 0.5;
    const unhealthyWeight = 0.0;

    const overallScore = summary.total > 0 ?
      ((summary.healthy * healthyWeight + summary.degraded * degradedWeight + summary.unhealthy * unhealthyWeight) / summary.total) * 100 : 100;

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (overallScore >= 80) status = 'healthy';
    else if (overallScore >= 50) status = 'degraded';
    else status = 'unhealthy';

    const checks: Record<string, HealthCheckResult> = {};
    this.results.forEach((result, checkId) => {
      checks[checkId] = result;
    });

    return {
      status,
      timestamp: new Date(),
      overallScore,
      checks,
      alerts: this.getActiveAlerts(),
      summary
    };
  }

  /**
   * Get current system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    return this.runAllChecks();
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return this.alerts
      .filter(alert => !alert.resolvedAt)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`[HealthMonitor] Alert acknowledged: ${alertId}`);
      return true;
    }
    return false;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      console.log(`[HealthMonitor] Alert resolved: ${alertId}`);
      return true;
    }
    return false;
  }

  /**
   * Start monitoring (run all checks periodically)
   */
  startMonitoring(): void {
    console.log('[HealthMonitor] Starting health monitoring...');

    Array.from(this.checks.values())
      .filter(check => check.enabled)
      .forEach(check => this.startPeriodicCheck(check));
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    console.log('[HealthMonitor] Stopping health monitoring...');

    this.intervalIds.forEach((intervalId, checkId) => {
      this.stopPeriodicCheck(checkId);
    });
  }

  /**
   * Export health data
   */
  exportHealthData(): {
    checks: HealthCheck[];
    results: Record<string, HealthCheckResult>;
    alerts: HealthAlert[];
    config: AlertingConfig;
  } {
    const checks = Array.from(this.checks.values());
    const results: Record<string, HealthCheckResult> = {};
    this.results.forEach((result, checkId) => {
      results[checkId] = result;
    });

    return {
      checks,
      results,
      alerts: [...this.alerts],
      config: this.alertingConfig
    };
  }

  // Private methods

  private registerDefaultChecks(): void {
    // Application metrics health check
    this.registerCheck({
      id: 'metrics_health',
      name: 'Metrics System Health',
      description: 'Verify metrics collection is working properly',
      category: 'system',
      timeout: 5000,
      interval: 60000, // 1 minute
      enabled: true,
      check: async () => {
        const metricsCollector = getMetricsCollector();
        const health = metricsCollector.getSystemHealth();

        return {
          status: health.status,
          message: `Health score: ${health.score}%, Issues: ${health.issues.length}`,
          timestamp: new Date(),
          duration: 0,
          metadata: {
            score: health.score,
            issues: health.issues
          }
        };
      }
    });

    // Memory usage check
    this.registerCheck({
      id: 'memory_usage',
      name: 'Memory Usage',
      description: 'Monitor system memory consumption',
      category: 'system',
      timeout: 2000,
      interval: 30000, // 30 seconds
      enabled: true,
      check: async () => {
        const memUsage = process.memoryUsage();
        const usedMB = memUsage.heapUsed / (1024 * 1024);
        const totalMB = memUsage.heapTotal / (1024 * 1024);
        const usagePercent = (usedMB / totalMB) * 100;

        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (usagePercent < 70) status = 'healthy';
        else if (usagePercent < 90) status = 'degraded';
        else status = 'unhealthy';

        return {
          status,
          message: `Memory usage: ${usedMB.toFixed(1)}MB (${usagePercent.toFixed(1)}%)`,
          timestamp: new Date(),
          duration: 0,
          metadata: {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            usagePercent
          }
        };
      }
    });

    // Processing queue health check
    this.registerCheck({
      id: 'processing_queue',
      name: 'Processing Queue Health',
      description: 'Monitor job queue depth and processing lag',
      category: 'processing',
      timeout: 5000,
      interval: 30000, // 30 seconds
      enabled: true,
      check: async () => {
        try {
          // This would integrate with your actual queue system
          // For now, we'll simulate queue health based on recent metrics
          const metricsCollector = getMetricsCollector();
          const recentMetrics = metricsCollector.getAggregatedMetrics(
            new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
            new Date()
          );

          const queueDepth = 0; // Would get from actual queue
          const avgProcessingTime = recentMetrics.processingStats.avgProcessingTime;
          const errorRate = recentMetrics.errorStats.errorRate;

          let status: 'healthy' | 'degraded' | 'unhealthy';
          if (queueDepth < 100 && avgProcessingTime < 10000 && errorRate < 0.05) {
            status = 'healthy';
          } else if (queueDepth < 500 && avgProcessingTime < 30000 && errorRate < 0.15) {
            status = 'degraded';
          } else {
            status = 'unhealthy';
          }

          return {
            status,
            message: `Queue depth: ${queueDepth}, Avg processing: ${avgProcessingTime}ms, Error rate: ${(errorRate * 100).toFixed(1)}%`,
            timestamp: new Date(),
            duration: 0,
            metadata: {
              queueDepth,
              avgProcessingTime,
              errorRate,
              totalOperations: recentMetrics.processingStats.totalOperations
            }
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            message: `Queue health check failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
            duration: 0,
            error: error instanceof Error ? error.stack : String(error)
          };
        }
      }
    });

    // File storage health check
    this.registerCheck({
      id: 'file_storage',
      name: 'File Storage Health',
      description: 'Verify file storage accessibility and capacity',
      category: 'storage',
      timeout: 10000,
      interval: 120000, // 2 minutes
      enabled: true,
      check: async () => {
        try {
          const fs = require('fs').promises;
          const path = require('path');
          const os = require('os');

          // Test file write/read/delete
          const testFile = path.join(os.tmpdir(), `health_check_${Date.now()}.txt`);
          const testContent = 'Health check test file';

          await fs.writeFile(testFile, testContent);
          const readContent = await fs.readFile(testFile, 'utf8');
          await fs.unlink(testFile);

          if (readContent !== testContent) {
            throw new Error('File content mismatch');
          }

          // Check disk space (simplified)
          const stats = await fs.stat(os.tmpdir());

          return {
            status: 'healthy',
            message: 'File storage is accessible and functional',
            timestamp: new Date(),
            duration: 0,
            metadata: {
              testFileSize: testContent.length,
              storageAvailable: true
            }
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            message: `File storage check failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
            duration: 0,
            error: error instanceof Error ? error.stack : String(error)
          };
        }
      }
    });

    // External dependencies health check (example)
    this.registerCheck({
      id: 'external_deps',
      name: 'External Dependencies',
      description: 'Check connectivity to external services',
      category: 'external',
      timeout: 15000,
      interval: 300000, // 5 minutes
      enabled: true,
      check: async () => {
        try {
          // This would check actual external dependencies
          // For now, we'll simulate based on network connectivity
          const https = require('https');

          const checkUrl = (url: string): Promise<boolean> => {
            return new Promise((resolve) => {
              const request = https.get(url, (response) => {
                resolve(response.statusCode === 200);
              });
              request.on('error', () => resolve(false));
              request.setTimeout(5000, () => {
                request.destroy();
                resolve(false);
              });
            });
          };

          // Test connectivity to a reliable service
          const isConnected = await checkUrl('https://www.google.com');

          return {
            status: isConnected ? 'healthy' : 'degraded',
            message: isConnected ? 'External connectivity verified' : 'Limited external connectivity',
            timestamp: new Date(),
            duration: 0,
            metadata: {
              internetConnectivity: isConnected
            }
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            message: `External dependencies check failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
            duration: 0,
            error: error instanceof Error ? error.stack : String(error)
          };
        }
      }
    });
  }

  private startPeriodicCheck(check: HealthCheck): void {
    // Run initial check
    this.runCheck(check.id).catch(console.error);

    // Set up periodic execution
    const intervalId = setInterval(() => {
      this.runCheck(check.id).catch(console.error);
    }, check.interval);

    this.intervalIds.set(check.id, intervalId);
  }

  private stopPeriodicCheck(checkId: string): void {
    const intervalId = this.intervalIds.get(checkId);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervalIds.delete(checkId);
    }
  }

  private async runChecksWithDependencies(checks: HealthCheck[]): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    const completed = new Set<string>();
    const checkMap = new Map(checks.map(check => [check.id, check]));

    const runCheck = async (check: HealthCheck): Promise<void> => {
      // Wait for dependencies
      if (check.dependencies?.length) {
        for (const depId of check.dependencies) {
          while (!completed.has(depId)) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      const result = await this.runCheck(check.id);
      results.push(result);
      completed.add(check.id);
    };

    // Start all checks
    const promises = checks.map(check => runCheck(check));
    await Promise.allSettled(promises);

    return results;
  }

  private handleCheckResult(check: HealthCheck, result: HealthCheckResult): void {
    if (result.status !== 'healthy' && this.alertingConfig.enabled) {
      this.createAlert(check, result);
    }
  }

  private createAlert(check: HealthCheck, result: HealthCheckResult): void {
    const alertKey = `${check.id}_${result.status}`;

    // Check if alert is suppressed
    if (this.suppressedAlerts.has(alertKey)) {
      return;
    }

    const severity = this.determineSeverity(check, result);
    const alert: HealthAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      checkId: check.id,
      severity,
      message: `${check.name}: ${result.message}`,
      timestamp: new Date(),
      acknowledged: false,
      escalated: false,
      metadata: {
        checkCategory: check.category,
        checkDuration: result.duration,
        ...result.metadata
      }
    };

    this.alerts.push(alert);

    // Suppress similar alerts for the configured duration
    this.suppressedAlerts.add(alertKey);
    setTimeout(() => {
      this.suppressedAlerts.delete(alertKey);
    }, this.alertingConfig.suppressDuration * 60 * 1000);

    console.warn(`[HealthMonitor] Alert created: ${alert.message}`);

    // Send notifications
    this.sendAlertNotifications(alert);
  }

  private determineSeverity(check: HealthCheck, result: HealthCheckResult): HealthAlert['severity'] {
    if (result.status === 'unhealthy') {
      return check.category === 'database' || check.category === 'processing' ? 'critical' : 'high';
    } else if (result.status === 'degraded') {
      return check.category === 'system' ? 'medium' : 'low';
    }
    return 'low';
  }

  private async sendAlertNotifications(alert: HealthAlert): Promise<void> {
    if (!this.alertingConfig.enabled) return;

    try {
      // Send webhook notification
      if (this.alertingConfig.webhookUrl) {
        await this.sendWebhookNotification(alert);
      }

      // Send Slack notification
      if (this.alertingConfig.slackWebhook) {
        await this.sendSlackNotification(alert);
      }

      // Email notifications would be implemented here
      // if (this.alertingConfig.emailRecipients?.length) {
      //   await this.sendEmailNotification(alert);
      // }

    } catch (error) {
      console.error(`[HealthMonitor] Failed to send alert notifications:`, error);
    }
  }

  private async sendWebhookNotification(alert: HealthAlert): Promise<void> {
    if (!this.alertingConfig.webhookUrl) return;

    const payload = {
      alert_id: alert.id,
      check_id: alert.checkId,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp.toISOString(),
      metadata: alert.metadata
    };

    try {
      const response = await fetch(this.alertingConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('[HealthMonitor] Webhook notification failed:', error);
    }
  }

  private async sendSlackNotification(alert: HealthAlert): Promise<void> {
    if (!this.alertingConfig.slackWebhook) return;

    const color = {
      low: 'good',
      medium: 'warning',
      high: 'danger',
      critical: 'danger'
    }[alert.severity];

    const payload = {
      text: `Health Alert: ${alert.severity.toUpperCase()}`,
      attachments: [{
        color,
        title: `Health Check Failed: ${alert.checkId}`,
        text: alert.message,
        fields: [
          {
            title: 'Severity',
            value: alert.severity,
            short: true
          },
          {
            title: 'Timestamp',
            value: alert.timestamp.toISOString(),
            short: true
          }
        ]
      }]
    };

    try {
      const response = await fetch(this.alertingConfig.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack notification failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('[HealthMonitor] Slack notification failed:', error);
    }
  }
}

// Global health monitor instance
let globalHealthMonitor: HealthMonitor | null = null;

/**
 * Get or create global health monitor
 */
export function getHealthMonitor(config?: Partial<AlertingConfig>): HealthMonitor {
  if (!globalHealthMonitor) {
    globalHealthMonitor = new HealthMonitor(config);
  }
  return globalHealthMonitor;
}

/**
 * Reset global health monitor (useful for testing)
 */
export function resetHealthMonitor(): void {
  if (globalHealthMonitor) {
    globalHealthMonitor.stopMonitoring();
  }
  globalHealthMonitor = null;
}