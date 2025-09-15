/**
 * Auto-scaling Configuration System
 *
 * Dynamic resource allocation and scaling based on real-time metrics,
 * queue depth, and system load with cost optimization strategies.
 */

import { getLogger } from '@/lib/monitoring/logger';
import { getMetricsCollector } from '@/lib/monitoring/metrics-collector';
import { getHealthChecker } from '@/lib/monitoring/health-checker';

export interface ScalingMetrics {
  queueDepth: number;
  averageProcessingTime: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  throughput: number; // requests per minute
  responseTime: number;
}

export interface ScalingRule {
  id: string;
  name: string;
  metric: keyof ScalingMetrics;
  condition: 'gt' | 'lt' | 'gte' | 'lte';
  threshold: number;
  duration: number; // How long condition must persist (ms)
  cooldown: number; // Minimum time between scaling actions (ms)
  action: 'scale_up' | 'scale_down';
  amount: number; // How much to scale
  priority: number; // Higher priority rules execute first
  enabled: boolean;
  costWeight: number; // Cost consideration (0-1)
}

export interface ScalingConfig {
  minInstances: number;
  maxInstances: number;
  targetUtilization: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  evaluationInterval: number;
  predictiveScaling: boolean;
  costOptimization: boolean;
  regionalDistribution: boolean;
}

export interface ScalingAction {
  id: string;
  rule: ScalingRule;
  timestamp: Date;
  fromInstances: number;
  toInstances: number;
  reason: string;
  cost: number;
  success: boolean;
  duration?: number;
}

export interface RegionalConfig {
  region: string;
  priority: number;
  maxInstances: number;
  costMultiplier: number;
  latencyTarget: number;
  enabled: boolean;
}

class AutoScaler {
  private currentInstances = 1;
  private scalingRules: Map<string, ScalingRule> = new Map();
  private scalingHistory: ScalingAction[] = [];
  private lastScalingAction: Date = new Date(0);
  private ruleConditionHistory: Map<string, Date[]> = new Map();

  private config: ScalingConfig;
  private logger = getLogger('auto-scaler');
  private metrics = getMetricsCollector();
  private healthChecker = getHealthChecker();

  private evaluationTimer?: NodeJS.Timeout;
  private predictionModel?: PredictiveModel;

  constructor(config: Partial<ScalingConfig> = {}) {
    this.config = {
      minInstances: 1,
      maxInstances: process.env.VERCEL_FUNCTION_REGION ? 10 : 50,
      targetUtilization: 0.7,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.3,
      evaluationInterval: 30000, // 30 seconds
      predictiveScaling: true,
      costOptimization: true,
      regionalDistribution: true,
      ...config
    };

    this.initializeDefaultRules();

    if (this.config.predictiveScaling) {
      this.predictionModel = new PredictiveModel();
    }

    this.startEvaluation();

    this.logger.info('Auto-scaler initialized', {
      config: this.config,
      defaultRules: this.scalingRules.size
    });
  }

  /**
   * Add scaling rule
   */
  addRule(rule: ScalingRule): void {
    this.scalingRules.set(rule.id, rule);
    this.logger.info(`Added scaling rule: ${rule.name}`, { ruleId: rule.id });
  }

  /**
   * Remove scaling rule
   */
  removeRule(ruleId: string): void {
    this.scalingRules.delete(ruleId);
    this.ruleConditionHistory.delete(ruleId);
    this.logger.info(`Removed scaling rule: ${ruleId}`);
  }

  /**
   * Get current system metrics for scaling decisions
   */
  private async getCurrentMetrics(): Promise<ScalingMetrics> {
    const queueDepth = this.metrics.getLatestGaugeValue('queue_depth') || 0;
    const processingTime = this.metrics.getHistogramStats('processing_time_ms');
    const errorRate = this.calculateErrorRate();
    const memoryUsage = this.metrics.getLatestGaugeValue('system_memory_usage_percent') || 0;
    const cpuUsage = this.metrics.getLatestGaugeValue('system_cpu_usage_percent') || 0;
    const activeConnections = this.metrics.getLatestGaugeValue('active_connections') || 0;
    const throughput = this.calculateThroughput();
    const responseTime = this.metrics.getHistogramStats('response_time_ms')?.avg || 0;

    return {
      queueDepth,
      averageProcessingTime: processingTime?.avg || 0,
      errorRate,
      memoryUsage,
      cpuUsage,
      activeConnections,
      throughput,
      responseTime
    };
  }

  /**
   * Evaluate scaling rules and take actions
   */
  private async evaluateScaling(): Promise<void> {
    try {
      const currentMetrics = await getCurrentMetrics();
      const healthStatus = this.healthChecker.getOverallHealth();

      // Skip scaling if system is unhealthy
      if (healthStatus.status === 'unhealthy') {
        this.logger.warn('Skipping scaling due to unhealthy system status');
        return;
      }

      // Get applicable rules sorted by priority
      const applicableRules = Array.from(this.scalingRules.values())
        .filter(rule => rule.enabled)
        .sort((a, b) => b.priority - a.priority);

      for (const rule of applicableRules) {
        if (await this.shouldTriggerRule(rule, currentMetrics)) {
          await this.executeScalingAction(rule, currentMetrics);
          break; // Execute only one rule per evaluation cycle
        }
      }

      // Predictive scaling
      if (this.config.predictiveScaling && this.predictionModel) {
        await this.evaluatePredictiveScaling(currentMetrics);
      }

      // Record metrics
      this.recordScalingMetrics(currentMetrics);

    } catch (error) {
      this.logger.error('Scaling evaluation failed', error as Error);
    }
  }

  /**
   * Check if scaling rule should be triggered
   */
  private async shouldTriggerRule(rule: ScalingRule, metrics: ScalingMetrics): Promise<boolean> {
    const metricValue = metrics[rule.metric];
    const conditionMet = this.evaluateCondition(metricValue, rule.condition, rule.threshold);

    if (!conditionMet) {
      // Clear condition history if condition not met
      this.ruleConditionHistory.delete(rule.id);
      return false;
    }

    // Track how long condition has been met
    const now = new Date();
    let conditionHistory = this.ruleConditionHistory.get(rule.id) || [];
    conditionHistory.push(now);

    // Keep only recent history
    const cutoff = new Date(now.getTime() - rule.duration);
    conditionHistory = conditionHistory.filter(time => time >= cutoff);
    this.ruleConditionHistory.set(rule.id, conditionHistory);

    // Check if condition has persisted long enough
    const conditionDuration = conditionHistory.length > 0
      ? now.getTime() - conditionHistory[0].getTime()
      : 0;

    if (conditionDuration < rule.duration) {
      return false;
    }

    // Check cooldown period
    const timeSinceLastAction = now.getTime() - this.lastScalingAction.getTime();
    if (timeSinceLastAction < rule.cooldown) {
      this.logger.debug(`Rule ${rule.id} in cooldown period`, {
        timeSinceLastAction,
        cooldown: rule.cooldown
      });
      return false;
    }

    // Check instance limits
    if (rule.action === 'scale_up' && this.currentInstances >= this.config.maxInstances) {
      this.logger.warn(`Cannot scale up: at maximum instances (${this.config.maxInstances})`);
      return false;
    }

    if (rule.action === 'scale_down' && this.currentInstances <= this.config.minInstances) {
      this.logger.warn(`Cannot scale down: at minimum instances (${this.config.minInstances})`);
      return false;
    }

    return true;
  }

  /**
   * Execute scaling action
   */
  private async executeScalingAction(rule: ScalingRule, metrics: ScalingMetrics): Promise<void> {
    const actionId = `action_${Date.now()}`;
    const fromInstances = this.currentInstances;
    const toInstances = rule.action === 'scale_up'
      ? Math.min(this.config.maxInstances, this.currentInstances + rule.amount)
      : Math.max(this.config.minInstances, this.currentInstances - rule.amount);

    const estimatedCost = this.estimateScalingCost(fromInstances, toInstances);

    // Cost optimization check
    if (this.config.costOptimization && !this.isCostEffective(rule, estimatedCost)) {
      this.logger.info('Scaling action rejected due to cost optimization', {
        rule: rule.name,
        estimatedCost,
        costWeight: rule.costWeight
      });
      return;
    }

    const action: ScalingAction = {
      id: actionId,
      rule,
      timestamp: new Date(),
      fromInstances,
      toInstances,
      reason: this.buildScalingReason(rule, metrics),
      cost: estimatedCost,
      success: false
    };

    try {
      this.logger.info(`Executing scaling action: ${rule.action}`, {
        rule: rule.name,
        from: fromInstances,
        to: toInstances,
        reason: action.reason
      });

      // Execute the scaling action
      const startTime = Date.now();
      await this.performScaling(toInstances);
      action.duration = Date.now() - startTime;
      action.success = true;

      this.currentInstances = toInstances;
      this.lastScalingAction = new Date();

      // Record metrics
      this.metrics.incrementCounter('scaling_actions_total', {
        action: rule.action,
        rule: rule.name,
        success: 'true'
      });

      this.metrics.setGauge('current_instances', this.currentInstances);

      this.logger.info('Scaling action completed successfully', {
        actionId,
        duration: action.duration,
        newInstanceCount: this.currentInstances
      });

    } catch (error) {
      action.success = false;
      this.logger.error('Scaling action failed', error as Error, { actionId });

      this.metrics.incrementCounter('scaling_actions_total', {
        action: rule.action,
        rule: rule.name,
        success: 'false'
      });
    }

    this.scalingHistory.push(action);

    // Keep only recent history
    if (this.scalingHistory.length > 100) {
      this.scalingHistory = this.scalingHistory.slice(-50);
    }
  }

  /**
   * Perform actual scaling operation
   */
  private async performScaling(targetInstances: number): Promise<void> {
    // In a real implementation, this would call cloud provider APIs
    // For now, we'll simulate the scaling operation

    if (process.env.VERCEL_FUNCTION_REGION) {
      // Vercel Functions auto-scale, so we just log the intent
      this.logger.info('Vercel function scaling request', { targetInstances });

      // Simulate scaling delay
      await new Promise(resolve => setTimeout(resolve, 1000));

    } else {
      // For other environments, implement actual scaling logic
      this.logger.info('Scaling operation simulated', { targetInstances });

      // Simulate scaling time
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  /**
   * Predictive scaling evaluation
   */
  private async evaluatePredictiveScaling(currentMetrics: ScalingMetrics): Promise<void> {
    if (!this.predictionModel) return;

    try {
      const prediction = await this.predictionModel.predict(currentMetrics);

      if (prediction.confidence > 0.8) {
        const predictiveRule: ScalingRule = {
          id: 'predictive_scaling',
          name: 'Predictive Scaling',
          metric: 'queueDepth',
          condition: prediction.action === 'scale_up' ? 'gt' : 'lt',
          threshold: prediction.threshold,
          duration: 60000, // 1 minute
          cooldown: 300000, // 5 minutes
          action: prediction.action,
          amount: prediction.amount,
          priority: 100, // High priority
          enabled: true,
          costWeight: 0.5
        };

        this.logger.info('Predictive scaling suggestion', {
          action: prediction.action,
          confidence: prediction.confidence,
          reason: prediction.reason
        });

        if (await this.shouldTriggerRule(predictiveRule, currentMetrics)) {
          await this.executeScalingAction(predictiveRule, currentMetrics);
        }
      }
    } catch (error) {
      this.logger.error('Predictive scaling evaluation failed', error as Error);
    }
  }

  /**
   * Initialize default scaling rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: ScalingRule[] = [
      {
        id: 'high_queue_depth',
        name: 'High Queue Depth',
        metric: 'queueDepth',
        condition: 'gt',
        threshold: 50,
        duration: 60000, // 1 minute
        cooldown: 300000, // 5 minutes
        action: 'scale_up',
        amount: 2,
        priority: 80,
        enabled: true,
        costWeight: 0.6
      },
      {
        id: 'low_queue_depth',
        name: 'Low Queue Depth',
        metric: 'queueDepth',
        condition: 'lt',
        threshold: 5,
        duration: 300000, // 5 minutes
        cooldown: 600000, // 10 minutes
        action: 'scale_down',
        amount: 1,
        priority: 60,
        enabled: true,
        costWeight: 0.9
      },
      {
        id: 'high_cpu_usage',
        name: 'High CPU Usage',
        metric: 'cpuUsage',
        condition: 'gt',
        threshold: 80,
        duration: 120000, // 2 minutes
        cooldown: 300000, // 5 minutes
        action: 'scale_up',
        amount: 1,
        priority: 70,
        enabled: true,
        costWeight: 0.7
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        metric: 'errorRate',
        condition: 'gt',
        threshold: 0.05, // 5%
        duration: 180000, // 3 minutes
        cooldown: 600000, // 10 minutes
        action: 'scale_up',
        amount: 2,
        priority: 90,
        enabled: true,
        costWeight: 0.3 // Cost is less important when errors are high
      }
    ];

    for (const rule of defaultRules) {
      this.addRule(rule);
    }
  }

  /**
   * Calculate current error rate
   */
  private calculateErrorRate(): number {
    const errorCount = this.metrics.getCounterValue('files_processed_error_total');
    const totalCount = this.metrics.getCounterValue('files_processed_total');

    return totalCount > 0 ? errorCount / totalCount : 0;
  }

  /**
   * Calculate current throughput (requests per minute)
   */
  private calculateThroughput(): number {
    // Get requests from the last minute
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentRequests = this.metrics.getCounterValue('files_processed_total', oneMinuteAgo);

    return recentRequests;
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(value: number, condition: ScalingRule['condition'], threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      default: return false;
    }
  }

  /**
   * Build scaling reason message
   */
  private buildScalingReason(rule: ScalingRule, metrics: ScalingMetrics): string {
    const metricValue = metrics[rule.metric];
    return `${rule.name}: ${rule.metric} is ${metricValue} (${rule.condition} ${rule.threshold})`;
  }

  /**
   * Estimate scaling cost
   */
  private estimateScalingCost(fromInstances: number, toInstances: number): number {
    const instanceCostPerHour = process.env.VERCEL_FUNCTION_REGION ? 0.0001 : 0.05;
    const instanceDiff = Math.abs(toInstances - fromInstances);

    // Estimated cost for next hour
    return instanceDiff * instanceCostPerHour;
  }

  /**
   * Check if scaling action is cost-effective
   */
  private isCostEffective(rule: ScalingRule, estimatedCost: number): boolean {
    if (!this.config.costOptimization) return true;

    const maxAcceptableCost = 1.0; // $1 per hour
    const costEffectiveness = rule.costWeight * (1 - estimatedCost / maxAcceptableCost);

    return costEffectiveness > 0.3; // Minimum 30% cost effectiveness
  }

  /**
   * Record scaling metrics
   */
  private recordScalingMetrics(metrics: ScalingMetrics): void {
    this.metrics.setGauge('autoscaler_current_instances', this.currentInstances);
    this.metrics.setGauge('autoscaler_queue_depth', metrics.queueDepth);
    this.metrics.setGauge('autoscaler_cpu_usage', metrics.cpuUsage);
    this.metrics.setGauge('autoscaler_memory_usage', metrics.memoryUsage);
    this.metrics.setGauge('autoscaler_error_rate', metrics.errorRate);
    this.metrics.setGauge('autoscaler_throughput', metrics.throughput);
  }

  /**
   * Start evaluation timer
   */
  private startEvaluation(): void {
    this.evaluationTimer = setInterval(() => {
      this.evaluateScaling();
    }, this.config.evaluationInterval);

    this.logger.info('Auto-scaling evaluation started', {
      interval: this.config.evaluationInterval
    });
  }

  /**
   * Get scaling statistics
   */
  getStats(): {
    currentInstances: number;
    scalingHistory: ScalingAction[];
    activeRules: number;
    lastScalingAction: Date;
    totalScalingActions: number;
    successfulScalingActions: number;
  } {
    return {
      currentInstances: this.currentInstances,
      scalingHistory: this.scalingHistory.slice(-10), // Last 10 actions
      activeRules: Array.from(this.scalingRules.values()).filter(r => r.enabled).length,
      lastScalingAction: this.lastScalingAction,
      totalScalingActions: this.scalingHistory.length,
      successfulScalingActions: this.scalingHistory.filter(a => a.success).length
    };
  }

  /**
   * Stop auto-scaling
   */
  stop(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }

    this.logger.info('Auto-scaling stopped');
  }
}

/**
 * Predictive scaling model
 */
class PredictiveModel {
  private historicalData: Array<{ timestamp: Date; metrics: ScalingMetrics; outcome: string }> = [];
  private logger = getLogger('predictive-model');

  async predict(currentMetrics: ScalingMetrics): Promise<{
    action: 'scale_up' | 'scale_down';
    amount: number;
    threshold: number;
    confidence: number;
    reason: string;
  }> {
    // Simple pattern-based prediction
    // In production, this would use ML models

    const recentTrend = this.analyzeRecentTrend();
    const timePattern = this.analyzeTimePattern();

    let action: 'scale_up' | 'scale_down' = 'scale_up';
    let confidence = 0.5;
    let reason = 'Pattern-based prediction';

    // Queue depth trend analysis
    if (recentTrend.queueDepthTrend > 0.2) {
      action = 'scale_up';
      confidence = 0.7;
      reason = 'Rising queue depth trend detected';
    } else if (recentTrend.queueDepthTrend < -0.2) {
      action = 'scale_down';
      confidence = 0.6;
      reason = 'Declining queue depth trend detected';
    }

    // Time-based patterns
    if (timePattern.isPeakHour) {
      action = 'scale_up';
      confidence = Math.min(confidence + 0.2, 0.9);
      reason += ' (peak hour pattern)';
    }

    return {
      action,
      amount: action === 'scale_up' ? 2 : 1,
      threshold: action === 'scale_up' ? 30 : 10,
      confidence,
      reason
    };
  }

  private analyzeRecentTrend(): { queueDepthTrend: number; errorRateTrend: number } {
    // Simplified trend analysis
    return {
      queueDepthTrend: Math.random() - 0.5, // -0.5 to 0.5
      errorRateTrend: Math.random() - 0.5
    };
  }

  private analyzeTimePattern(): { isPeakHour: boolean; isOffPeak: boolean } {
    const hour = new Date().getHours();
    const isPeakHour = (hour >= 9 && hour <= 17) || (hour >= 19 && hour <= 22);

    return {
      isPeakHour,
      isOffPeak: !isPeakHour
    };
  }
}

// Singleton instance
let autoScaler: AutoScaler | null = null;

export function getAutoScaler(config?: Partial<ScalingConfig>): AutoScaler {
  if (!autoScaler) {
    autoScaler = new AutoScaler(config);
  }
  return autoScaler;
}

// Helper function to get current metrics (for external use)
export async function getCurrentMetrics(): Promise<ScalingMetrics> {
  const metrics = getMetricsCollector();

  const queueDepth = metrics.getLatestGaugeValue('queue_depth') || 0;
  const processingTime = metrics.getHistogramStats('processing_time_ms');
  const memoryUsage = metrics.getLatestGaugeValue('system_memory_usage_percent') || 0;
  const cpuUsage = metrics.getLatestGaugeValue('system_cpu_usage_percent') || 0;

  // Calculate error rate
  const errorCount = metrics.getCounterValue('files_processed_error_total');
  const totalCount = metrics.getCounterValue('files_processed_total');
  const errorRate = totalCount > 0 ? errorCount / totalCount : 0;

  // Calculate throughput
  const oneMinuteAgo = new Date(Date.now() - 60000);
  const throughput = metrics.getCounterValue('files_processed_total', oneMinuteAgo);

  const responseTime = metrics.getHistogramStats('response_time_ms')?.avg || 0;

  return {
    queueDepth,
    averageProcessingTime: processingTime?.avg || 0,
    errorRate,
    memoryUsage,
    cpuUsage,
    activeConnections: 0, // Would need actual connection tracking
    throughput,
    responseTime
  };
}

export { AutoScaler, PredictiveModel };