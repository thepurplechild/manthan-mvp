/**
 * Alerting System
 *
 * Provides threshold-based alerting with multiple channels and rule evaluation.
 * Supports email, webhook, and log-based alert notifications.
 */

import { AlertRule, Alert, AlertChannel } from './types';
import { getLogger } from './logger';
import { getMetricsCollector } from './metrics-collector';
import { createId } from '@paralleldrive/cuid2';

class AlertingSystem {
  private rules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, Alert>();
  private evaluationInterval: NodeJS.Timeout | null = null;
  private logger = getLogger('alerting-system');
  private metricsCollector = getMetricsCollector();

  /**
   * Start the alerting system with periodic rule evaluation
   */
  start(evaluationIntervalMs = 60000) {
    if (this.evaluationInterval) {
      this.stop();
    }

    this.evaluationInterval = setInterval(async () => {
      await this.evaluateAllRules();
    }, evaluationIntervalMs);

    this.logger.info(`Alerting system started with ${evaluationIntervalMs}ms evaluation interval`);
  }

  /**
   * Stop the alerting system
   */
  stop() {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }

    this.logger.info('Alerting system stopped');
  }

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule) {
    this.rules.set(rule.id, rule);
    this.logger.info(`Added alert rule: ${rule.name}`, {
      ruleId: rule.id,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold
    });

    // Record rule metrics
    this.metricsCollector.incrementCounter(
      'alert_rules_total',
      { rule_name: rule.name, severity: rule.severity }
    );
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string) {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.delete(ruleId);

      // Resolve any active alerts for this rule
      for (const [alertId, alert] of this.activeAlerts.entries()) {
        if (alert.rule.id === ruleId) {
          this.resolveAlert(alertId);
        }
      }

      this.logger.info(`Removed alert rule: ${rule.name}`, { ruleId });
    }
  }

  /**
   * Update an existing alert rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>) {
    const rule = this.rules.get(ruleId);
    if (rule) {
      const updatedRule = { ...rule, ...updates, id: ruleId }; // Keep original ID
      this.rules.set(ruleId, updatedRule);

      this.logger.info(`Updated alert rule: ${updatedRule.name}`, { ruleId, updates });
    }
  }

  /**
   * Evaluate all alert rules
   */
  async evaluateAllRules() {
    const promises = Array.from(this.rules.values()).map(rule =>
      this.evaluateRule(rule).catch(error => {
        this.logger.error(`Rule evaluation failed: ${rule.name}`, error as Error, { ruleId: rule.id });
      })
    );

    await Promise.all(promises);
  }

  /**
   * Evaluate a specific alert rule
   */
  async evaluateRule(rule: AlertRule) {
    if (!rule.enabled) {
      return;
    }

    try {
      const latestValue = this.metricsCollector.getLatestGaugeValue(rule.metric);

      if (latestValue === undefined) {
        // No data available for this metric
        return;
      }

      const shouldTrigger = this.evaluateCondition(latestValue, rule.condition, rule.threshold);

      // Check if there's already an active alert for this rule
      const existingAlert = Array.from(this.activeAlerts.values())
        .find(alert => alert.rule.id === rule.id && alert.status === 'active');

      if (shouldTrigger && !existingAlert) {
        // Trigger new alert
        await this.triggerAlert(rule, latestValue);
      } else if (!shouldTrigger && existingAlert) {
        // Resolve existing alert
        this.resolveAlert(existingAlert.id);
      }
    } catch (error) {
      this.logger.error(`Rule evaluation error: ${rule.name}`, error as Error, { ruleId: rule.id });
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(value: number, condition: AlertRule['condition'], threshold: number): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  /**
   * Trigger a new alert
   */
  private async triggerAlert(rule: AlertRule, value: number) {
    const alertId = createId();
    const message = this.formatAlertMessage(rule, value, 'triggered');

    const alert: Alert = {
      id: alertId,
      rule,
      triggeredAt: new Date(),
      status: 'active',
      value,
      message
    };

    this.activeAlerts.set(alertId, alert);

    // Record metrics
    this.metricsCollector.incrementCounter(
      'alerts_triggered_total',
      { rule_name: rule.name, severity: rule.severity }
    );

    this.metricsCollector.setGauge(
      'active_alerts_count',
      this.activeAlerts.size
    );

    this.logger.warn(`Alert triggered: ${rule.name}`, {
      alertId,
      ruleId: rule.id,
      value,
      threshold: rule.threshold,
      condition: rule.condition
    });

    // Send notifications
    await this.sendNotifications(alert, 'triggered');
  }

  /**
   * Resolve an active alert
   */
  private async resolveAlert(alertId: string) {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return;
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();

    // Record metrics
    const duration = alert.resolvedAt.getTime() - alert.triggeredAt.getTime();
    this.metricsCollector.recordHistogram(
      'alert_duration_ms',
      duration,
      { rule_name: alert.rule.name, severity: alert.rule.severity }
    );

    this.metricsCollector.incrementCounter(
      'alerts_resolved_total',
      { rule_name: alert.rule.name, severity: alert.rule.severity }
    );

    this.metricsCollector.setGauge(
      'active_alerts_count',
      this.activeAlerts.size - 1
    );

    this.logger.info(`Alert resolved: ${alert.rule.name}`, {
      alertId,
      ruleId: alert.rule.id,
      duration
    });

    // Send resolution notifications
    await this.sendNotifications(alert, 'resolved');

    // Remove from active alerts
    this.activeAlerts.delete(alertId);
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: Alert, action: 'triggered' | 'resolved') {
    const promises = alert.rule.channels.map(channel =>
      this.sendNotification(channel, alert, action).catch(error => {
        this.logger.error(`Notification failed for alert: ${alert.rule.name}`, error as Error, {
          alertId: alert.id,
          channelType: channel.type
        });
      })
    );

    await Promise.all(promises);
  }

  /**
   * Send notification through a specific channel
   */
  private async sendNotification(channel: AlertChannel, alert: Alert, action: 'triggered' | 'resolved') {
    const message = this.formatAlertMessage(alert.rule, alert.value, action);

    switch (channel.type) {
      case 'log':
        this.logger.error(`ALERT: ${message}`, undefined, {
          alertId: alert.id,
          ruleId: alert.rule.id,
          severity: alert.rule.severity,
          action
        });
        break;

      case 'email':
        await this.sendEmailNotification(channel.config, alert, message, action);
        break;

      case 'webhook':
        await this.sendWebhookNotification(channel.config, alert, message, action);
        break;

      default:
        this.logger.warn(`Unknown notification channel type: ${channel.type}`);
    }
  }

  /**
   * Send email notification (placeholder - integrate with your email service)
   */
  private async sendEmailNotification(
    config: Record<string, unknown>,
    alert: Alert,
    message: string,
    action: 'triggered' | 'resolved'
  ) {
    // This is a placeholder - integrate with your preferred email service
    // Examples: SendGrid, AWS SES, Nodemailer, etc.

    const emailData = {
      to: config.to as string,
      subject: `Alert ${action}: ${alert.rule.name}`,
      body: this.formatEmailBody(alert, message, action),
      priority: alert.rule.severity === 'critical' ? 'high' : 'normal'
    };

    this.logger.info('Email notification would be sent', emailData);

    // TODO: Implement actual email sending
    // await emailService.send(emailData);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    config: Record<string, unknown>,
    alert: Alert,
    message: string,
    action: 'triggered' | 'resolved'
  ) {
    const url = config.url as string;
    if (!url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      alert: {
        id: alert.id,
        rule: alert.rule.name,
        severity: alert.rule.severity,
        metric: alert.rule.metric,
        value: alert.value,
        threshold: alert.rule.threshold,
        condition: alert.rule.condition,
        message,
        action,
        triggeredAt: alert.triggeredAt.toISOString(),
        resolvedAt: alert.resolvedAt?.toISOString()
      },
      timestamp: new Date().toISOString()
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers as Record<string, string> || {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook responded with ${response.status}: ${response.statusText}`);
      }

      this.logger.info('Webhook notification sent successfully', {
        alertId: alert.id,
        url,
        status: response.status
      });
    } catch (error) {
      this.logger.error('Webhook notification failed', error as Error, {
        alertId: alert.id,
        url
      });
      throw error;
    }
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(rule: AlertRule, value: number, action: 'triggered' | 'resolved'): string {
    const comparison = rule.condition === 'gt' || rule.condition === 'gte' ? 'above' : 'below';

    if (action === 'resolved') {
      return `Alert resolved: ${rule.name} - ${rule.metric} returned to normal (${value})`;
    }

    return `Alert triggered: ${rule.name} - ${rule.metric} is ${comparison} threshold (${value} ${rule.condition} ${rule.threshold})`;
  }

  /**
   * Format email body
   */
  private formatEmailBody(alert: Alert, message: string, _action: 'triggered' | 'resolved'): string {
    const rule = alert.rule;

    return `
${message}

Alert Details:
- Rule: ${rule.name}
- Description: ${rule.description}
- Metric: ${rule.metric}
- Current Value: ${alert.value}
- Threshold: ${rule.threshold} (${rule.condition})
- Severity: ${rule.severity}
- Triggered: ${alert.triggeredAt.toISOString()}
${alert.resolvedAt ? `- Resolved: ${alert.resolvedAt.toISOString()}` : ''}

This is an automated alert from the Manthan monitoring system.
    `.trim();
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get all alert rules
   */
  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get alert history (simplified - in production you'd want persistent storage)
   */
  getAlertHistory(limit = 100): Alert[] {
    // This is a simplified implementation
    // In production, you'd store resolved alerts in a database
    return this.getActiveAlerts().slice(0, limit);
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    totalRules: number;
    enabledRules: number;
    activeAlerts: number;
    alertsBySeverity: Record<string, number>;
    alertsByStatus: Record<string, number>;
  } {
    const rules = Array.from(this.rules.values());
    const alerts = Array.from(this.activeAlerts.values());

    const alertsBySeverity = alerts.reduce((acc, alert) => {
      acc[alert.rule.severity] = (acc[alert.rule.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const alertsByStatus = alerts.reduce((acc, alert) => {
      acc[alert.status] = (acc[alert.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length,
      activeAlerts: alerts.length,
      alertsBySeverity,
      alertsByStatus
    };
  }
}

// Singleton instance
let alertingSystem: AlertingSystem | null = null;

export function getAlertingSystem(): AlertingSystem {
  if (!alertingSystem) {
    alertingSystem = new AlertingSystem();
  }
  return alertingSystem;
}

export { AlertingSystem };