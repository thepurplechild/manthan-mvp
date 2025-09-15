/**
 * Capacity Planning and Monitoring Tools
 *
 * Predictive capacity planning, resource utilization analysis, cost optimization,
 * and scaling recommendations based on historical data and growth patterns.
 */

import { getLogger } from '@/lib/monitoring/logger';
import { getMetricsCollector } from '@/lib/monitoring/metrics-collector';
import { getHealthChecker } from '@/lib/monitoring/health-checker';
import { getCurrentMetrics } from './auto-scaler';

export interface CapacityMetrics {
  timestamp: Date;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  requests: number;
  errors: number;
  responseTime: number;
  queueDepth: number;
  activeUsers: number;
  cost: number;
}

export interface CapacityForecast {
  timeframe: string;
  metrics: {
    expectedCPU: number;
    expectedMemory: number;
    expectedRequests: number;
    expectedCost: number;
  };
  recommendations: {
    scaleUp: boolean;
    scaleDown: boolean;
    optimizations: string[];
    estimatedSavings: number;
  };
  confidence: number;
}

export interface ResourceThresholds {
  cpu: { warning: number; critical: number };
  memory: { warning: number; critical: number };
  disk: { warning: number; critical: number };
  responseTime: { warning: number; critical: number };
  errorRate: { warning: number; critical: number };
}

export interface CostAnalysis {
  current: {
    compute: number;
    storage: number;
    network: number;
    total: number;
  };
  projected: {
    timeframe: string;
    compute: number;
    storage: number;
    network: number;
    total: number;
  };
  optimizations: Array<{
    type: string;
    description: string;
    estimatedSavings: number;
    effort: 'low' | 'medium' | 'high';
  }>;
}

export interface ScalingRecommendation {
  action: 'scale_up' | 'scale_down' | 'optimize' | 'maintain';
  confidence: number;
  reason: string;
  timeframe: string;
  resourceChanges: {
    cpu: number;
    memory: number;
    instances: number;
  };
  costImpact: number;
  riskLevel: 'low' | 'medium' | 'high';
}

class CapacityPlanner {
  private logger = getLogger('capacity-planner');
  private metrics = getMetricsCollector();
  private healthChecker = getHealthChecker();

  private historicalData: CapacityMetrics[] = [];
  private thresholds: ResourceThresholds;
  private dataRetentionDays: number;

  constructor(config?: {
    thresholds?: Partial<ResourceThresholds>;
    dataRetentionDays?: number;
  }) {
    this.thresholds = {
      cpu: { warning: 70, critical: 85 },
      memory: { warning: 80, critical: 90 },
      disk: { warning: 85, critical: 95 },
      responseTime: { warning: 2000, critical: 5000 },
      errorRate: { warning: 0.01, critical: 0.05 },
      ...config?.thresholds
    };

    this.dataRetentionDays = config?.dataRetentionDays || 90;

    this.startDataCollection();

    this.logger.info('Capacity planner initialized', {
      thresholds: this.thresholds,
      dataRetentionDays: this.dataRetentionDays
    });
  }

  /**
   * Generate comprehensive capacity forecast
   */
  async generateForecast(timeframes: string[] = ['1h', '24h', '7d', '30d']): Promise<CapacityForecast[]> {
    const forecasts: CapacityForecast[] = [];

    for (const timeframe of timeframes) {
      const forecast = await this.generateSingleForecast(timeframe);
      forecasts.push(forecast);
    }

    this.logger.info('Capacity forecasts generated', {
      timeframes: timeframes.length,
      avgConfidence: forecasts.reduce((sum, f) => sum + f.confidence, 0) / forecasts.length
    });

    return forecasts;
  }

  /**
   * Analyze current resource utilization
   */
  async analyzeCurrentUtilization(): Promise<{
    overall: 'healthy' | 'warning' | 'critical';
    details: {
      cpu: { current: number; status: string };
      memory: { current: number; status: string };
      disk: { current: number; status: string };
      responseTime: { current: number; status: string };
      errorRate: { current: number; status: string };
    };
    bottlenecks: string[];
    recommendations: string[];
  }> {
    const currentMetrics = await getCurrentMetrics();
    const healthStatus = this.healthChecker.getOverallHealth();

    const details = {
      cpu: {
        current: currentMetrics.cpuUsage,
        status: this.getResourceStatus(currentMetrics.cpuUsage, this.thresholds.cpu)
      },
      memory: {
        current: currentMetrics.memoryUsage,
        status: this.getResourceStatus(currentMetrics.memoryUsage, this.thresholds.memory)
      },
      disk: {
        current: 0, // Would need actual disk monitoring
        status: 'healthy'
      },
      responseTime: {
        current: currentMetrics.responseTime,
        status: this.getResourceStatus(currentMetrics.responseTime, this.thresholds.responseTime)
      },
      errorRate: {
        current: currentMetrics.errorRate * 100,
        status: this.getResourceStatus(currentMetrics.errorRate * 100, this.thresholds.errorRate)
      }
    };

    // Determine overall status
    const statuses = Object.values(details).map(d => d.status);
    const overall = statuses.includes('critical') ? 'critical' :
                   statuses.includes('warning') ? 'warning' : 'healthy';

    // Identify bottlenecks
    const bottlenecks = Object.entries(details)
      .filter(([, info]) => info.status === 'critical')
      .map(([resource]) => resource);

    // Generate recommendations
    const recommendations = this.generateUtilizationRecommendations(details);

    return {
      overall,
      details,
      bottlenecks,
      recommendations
    };
  }

  /**
   * Perform cost analysis and optimization
   */
  async analyzeCosts(): Promise<CostAnalysis> {
    const currentCosts = await this.calculateCurrentCosts();
    const projectedCosts = await this.projectCosts('30d');
    const optimizations = this.identifyCostOptimizations();

    return {
      current: currentCosts,
      projected: projectedCosts,
      optimizations
    };
  }

  /**
   * Generate scaling recommendations
   */
  async generateScalingRecommendations(): Promise<ScalingRecommendation[]> {
    const recommendations: ScalingRecommendation[] = [];

    const utilization = await this.analyzeCurrentUtilization();
    const trends = this.analyzeTrends();
    const forecasts = await this.generateForecast(['1h', '24h']);

    // Short-term recommendations (1 hour)
    const shortTerm = this.generateShortTermRecommendation(utilization, trends, forecasts[0]);
    recommendations.push(shortTerm);

    // Medium-term recommendations (24 hours)
    const mediumTerm = this.generateMediumTermRecommendation(utilization, trends, forecasts[1]);
    recommendations.push(mediumTerm);

    this.logger.info('Scaling recommendations generated', {
      count: recommendations.length,
      actions: recommendations.map(r => r.action)
    });

    return recommendations;
  }

  /**
   * Get resource utilization trends
   */
  analyzeTrends(period: string = '24h'): {
    cpu: { trend: 'increasing' | 'decreasing' | 'stable'; rate: number };
    memory: { trend: 'increasing' | 'decreasing' | 'stable'; rate: number };
    requests: { trend: 'increasing' | 'decreasing' | 'stable'; rate: number };
    errors: { trend: 'increasing' | 'decreasing' | 'stable'; rate: number };
  } {
    const periodMs = this.parsePeriod(period);
    const cutoff = new Date(Date.now() - periodMs);
    const recentData = this.historicalData.filter(d => d.timestamp >= cutoff);

    if (recentData.length < 2) {
      return {
        cpu: { trend: 'stable', rate: 0 },
        memory: { trend: 'stable', rate: 0 },
        requests: { trend: 'stable', rate: 0 },
        errors: { trend: 'stable', rate: 0 }
      };
    }

    // Calculate trends using linear regression
    return {
      cpu: this.calculateTrend(recentData.map(d => d.cpu)),
      memory: this.calculateTrend(recentData.map(d => d.memory)),
      requests: this.calculateTrend(recentData.map(d => d.requests)),
      errors: this.calculateTrend(recentData.map(d => d.errors))
    };
  }

  /**
   * Start data collection
   */
  private startDataCollection(): void {
    // Collect data every 5 minutes
    setInterval(async () => {
      await this.collectMetrics();
    }, 5 * 60 * 1000);

    // Cleanup old data daily
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Collect current metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const currentMetrics = await getCurrentMetrics();

      const metrics: CapacityMetrics = {
        timestamp: new Date(),
        cpu: currentMetrics.cpuUsage,
        memory: currentMetrics.memoryUsage,
        disk: 0, // Would need actual disk monitoring
        network: 0, // Would need actual network monitoring
        requests: currentMetrics.throughput,
        errors: currentMetrics.errorRate * currentMetrics.throughput,
        responseTime: currentMetrics.responseTime,
        queueDepth: currentMetrics.queueDepth,
        activeUsers: currentMetrics.activeConnections,
        cost: this.estimateCurrentCost(currentMetrics)
      };

      this.historicalData.push(metrics);

      // Record aggregated metrics
      this.recordCapacityMetrics(metrics);

    } catch (error) {
      this.logger.error('Failed to collect capacity metrics', error as Error);
    }
  }

  /**
   * Generate single forecast
   */
  private async generateSingleForecast(timeframe: string): Promise<CapacityForecast> {
    const periodMs = this.parsePeriod(timeframe);
    const recentData = this.getRecentData('7d'); // Use last 7 days for forecasting

    if (recentData.length < 10) {
      return {
        timeframe,
        metrics: {
          expectedCPU: 50,
          expectedMemory: 60,
          expectedRequests: 100,
          expectedCost: 100
        },
        recommendations: {
          scaleUp: false,
          scaleDown: false,
          optimizations: ['Insufficient historical data for accurate forecasting'],
          estimatedSavings: 0
        },
        confidence: 0.1
      };
    }

    // Use simple linear regression for forecasting
    const trends = this.analyzeTrends('7d');
    const latest = recentData[recentData.length - 1];

    const forecastMultiplier = periodMs / (60 * 60 * 1000); // Hours

    const expectedCPU = Math.max(0, latest.cpu + (trends.cpu.rate * forecastMultiplier));
    const expectedMemory = Math.max(0, latest.memory + (trends.memory.rate * forecastMultiplier));
    const expectedRequests = Math.max(0, latest.requests + (trends.requests.rate * forecastMultiplier));
    const expectedCost = this.projectCostForMetrics(expectedCPU, expectedMemory, expectedRequests);

    // Generate recommendations
    const recommendations = this.generateForecastRecommendations(
      { expectedCPU, expectedMemory, expectedRequests, expectedCost },
      timeframe
    );

    // Calculate confidence based on data quality and trend stability
    const confidence = this.calculateForecastConfidence(recentData, trends);

    return {
      timeframe,
      metrics: {
        expectedCPU,
        expectedMemory,
        expectedRequests,
        expectedCost
      },
      recommendations,
      confidence
    };
  }

  /**
   * Calculate current costs
   */
  private async calculateCurrentCosts(): Promise<CostAnalysis['current']> {
    // Simplified cost calculation - in production, integrate with billing APIs
    const baseComputeCost = 50; // Base monthly cost
    const storageCost = 10; // Storage cost
    const networkCost = 5; // Network cost

    return {
      compute: baseComputeCost,
      storage: storageCost,
      network: networkCost,
      total: baseComputeCost + storageCost + networkCost
    };
  }

  /**
   * Project costs for timeframe
   */
  private async projectCosts(timeframe: string): Promise<CostAnalysis['projected']> {
    const current = await this.calculateCurrentCosts();
    const growthRate = this.calculateGrowthRate();

    const multiplier = this.getGrowthMultiplier(timeframe, growthRate);

    return {
      timeframe,
      compute: current.compute * multiplier,
      storage: current.storage * multiplier,
      network: current.network * multiplier,
      total: current.total * multiplier
    };
  }

  /**
   * Identify cost optimization opportunities
   */
  private identifyCostOptimizations(): CostAnalysis['optimizations'] {
    const optimizations: CostAnalysis['optimizations'] = [];

    // Analyze historical data for optimization opportunities
    const utilization = this.getAverageUtilization();

    if (utilization.cpu < 30) {
      optimizations.push({
        type: 'right-sizing',
        description: 'CPU utilization is low. Consider scaling down instances.',
        estimatedSavings: 200,
        effort: 'low'
      });
    }

    if (utilization.memory < 40) {
      optimizations.push({
        type: 'memory-optimization',
        description: 'Memory utilization is low. Optimize memory allocation.',
        estimatedSavings: 150,
        effort: 'medium'
      });
    }

    optimizations.push({
      type: 'caching',
      description: 'Implement intelligent caching to reduce compute costs.',
      estimatedSavings: 300,
      effort: 'medium'
    });

    optimizations.push({
      type: 'auto-scaling',
      description: 'Implement auto-scaling to optimize resource usage.',
      estimatedSavings: 500,
      effort: 'high'
    });

    return optimizations;
  }

  /**
   * Generate short-term scaling recommendation
   */
  private generateShortTermRecommendation(
    utilization: Awaited<ReturnType<typeof this.analyzeCurrentUtilization>>,
    trends: ReturnType<typeof this.analyzeTrends>,
    forecast: CapacityForecast
  ): ScalingRecommendation {
    let action: ScalingRecommendation['action'] = 'maintain';
    let confidence = 0.7;
    let reason = 'System is operating within normal parameters';
    let riskLevel: ScalingRecommendation['riskLevel'] = 'low';

    // Check for immediate scaling needs
    if (utilization.overall === 'critical') {
      action = 'scale_up';
      confidence = 0.9;
      reason = 'Critical resource utilization detected';
      riskLevel = 'high';
    } else if (forecast.metrics.expectedCPU > 80 || forecast.metrics.expectedMemory > 85) {
      action = 'scale_up';
      confidence = 0.8;
      reason = 'High resource utilization expected in next hour';
      riskLevel = 'medium';
    } else if (utilization.details.cpu.current < 20 && utilization.details.memory.current < 30) {
      action = 'scale_down';
      confidence = 0.6;
      reason = 'Low resource utilization detected';
      riskLevel = 'low';
    }

    return {
      action,
      confidence,
      reason,
      timeframe: '1h',
      resourceChanges: {
        cpu: action === 'scale_up' ? 2 : action === 'scale_down' ? -1 : 0,
        memory: action === 'scale_up' ? 2 : action === 'scale_down' ? -1 : 0,
        instances: action === 'scale_up' ? 1 : action === 'scale_down' ? -1 : 0
      },
      costImpact: this.calculateCostImpact(action),
      riskLevel
    };
  }

  /**
   * Generate medium-term scaling recommendation
   */
  private generateMediumTermRecommendation(
    utilization: Awaited<ReturnType<typeof this.analyzeCurrentUtilization>>,
    trends: ReturnType<typeof this.analyzeTrends>,
    forecast: CapacityForecast
  ): ScalingRecommendation {
    let action: ScalingRecommendation['action'] = 'optimize';
    let confidence = 0.6;
    let reason = 'Focus on optimization opportunities';

    // Look for trending patterns
    if (trends.cpu.trend === 'increasing' && trends.requests.trend === 'increasing') {
      action = 'scale_up';
      confidence = 0.7;
      reason = 'Upward trend in CPU usage and request volume';
    } else if (trends.cpu.trend === 'decreasing' && trends.memory.trend === 'decreasing') {
      action = 'scale_down';
      confidence = 0.5;
      reason = 'Declining resource usage trends';
    }

    return {
      action,
      confidence,
      reason,
      timeframe: '24h',
      resourceChanges: {
        cpu: action === 'scale_up' ? 4 : action === 'scale_down' ? -2 : 0,
        memory: action === 'scale_up' ? 4 : action === 'scale_down' ? -2 : 0,
        instances: action === 'scale_up' ? 2 : action === 'scale_down' ? -1 : 0
      },
      costImpact: this.calculateCostImpact(action) * 2,
      riskLevel: 'medium'
    };
  }

  /**
   * Helper methods
   */
  private parsePeriod(period: string): number {
    const match = period.match(/(\d+)([hdwmy])/);
    if (!match) return 60 * 60 * 1000; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      case 'm': return value * 30 * 24 * 60 * 60 * 1000;
      case 'y': return value * 365 * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }

  private getResourceStatus(current: number, threshold: { warning: number; critical: number }): string {
    if (current >= threshold.critical) return 'critical';
    if (current >= threshold.warning) return 'warning';
    return 'healthy';
  }

  private getRecentData(period: string): CapacityMetrics[] {
    const periodMs = this.parsePeriod(period);
    const cutoff = new Date(Date.now() - periodMs);
    return this.historicalData.filter(d => d.timestamp >= cutoff);
  }

  private calculateTrend(values: number[]): { trend: 'increasing' | 'decreasing' | 'stable'; rate: number } {
    if (values.length < 2) return { trend: 'stable', rate: 0 };

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + val * i, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    const trend = Math.abs(slope) < 0.1 ? 'stable' : slope > 0 ? 'increasing' : 'decreasing';

    return { trend, rate: slope };
  }

  private estimateCurrentCost(metrics: Awaited<ReturnType<typeof getCurrentMetrics>>): number {
    // Simplified cost estimation based on resource usage
    const baseCost = 10; // Base hourly cost
    const cpuCost = (metrics.cpuUsage / 100) * 5;
    const memoryCost = (metrics.memoryUsage / 100) * 3;

    return baseCost + cpuCost + memoryCost;
  }

  private projectCostForMetrics(cpu: number, memory: number, requests: number): number {
    const baseCost = 10;
    const cpuCost = (cpu / 100) * 5;
    const memoryCost = (memory / 100) * 3;
    const requestCost = requests * 0.001;

    return baseCost + cpuCost + memoryCost + requestCost;
  }

  private generateForecastRecommendations(
    metrics: { expectedCPU: number; expectedMemory: number; expectedRequests: number; expectedCost: number },
    timeframe: string
  ): CapacityForecast['recommendations'] {
    const recommendations: string[] = [];
    let scaleUp = false;
    let scaleDown = false;
    let estimatedSavings = 0;

    if (metrics.expectedCPU > 80) {
      scaleUp = true;
      recommendations.push('Scale up CPU resources to handle expected load');
    }

    if (metrics.expectedMemory > 85) {
      scaleUp = true;
      recommendations.push('Scale up memory resources to prevent bottlenecks');
    }

    if (metrics.expectedCPU < 30 && metrics.expectedMemory < 40) {
      scaleDown = true;
      estimatedSavings = 200;
      recommendations.push('Consider scaling down to optimize costs');
    }

    if (metrics.expectedCost > 500) {
      recommendations.push('High projected costs - review optimization opportunities');
    }

    return {
      scaleUp,
      scaleDown,
      optimizations: recommendations,
      estimatedSavings
    };
  }

  private calculateForecastConfidence(data: CapacityMetrics[], trends: ReturnType<typeof this.analyzeTrends>): number {
    let confidence = 0.5;

    // More data increases confidence
    confidence += Math.min(data.length / 100, 0.3);

    // Stable trends increase confidence
    const trendStability = Object.values(trends).filter(t => t.trend === 'stable').length / 4;
    confidence += trendStability * 0.2;

    return Math.min(confidence, 0.95);
  }

  private generateUtilizationRecommendations(details: Record<string, { current: number; status: string }>): string[] {
    const recommendations: string[] = [];

    Object.entries(details).forEach(([resource, info]) => {
      if (info.status === 'critical') {
        recommendations.push(`Immediate action needed for ${resource}: ${info.current}%`);
      } else if (info.status === 'warning') {
        recommendations.push(`Monitor ${resource} closely: ${info.current}%`);
      }
    });

    return recommendations;
  }

  private calculateGrowthRate(): number {
    const recentData = this.getRecentData('30d');
    if (recentData.length < 10) return 1.1; // Default 10% growth

    const trends = this.analyzeTrends('30d');
    const avgGrowth = (trends.cpu.rate + trends.memory.rate + trends.requests.rate) / 3;

    return 1 + Math.max(0, avgGrowth / 100);
  }

  private getGrowthMultiplier(timeframe: string, growthRate: number): number {
    const periodMs = this.parsePeriod(timeframe);
    const monthsMs = 30 * 24 * 60 * 60 * 1000;
    const periods = periodMs / monthsMs;

    return Math.pow(growthRate, periods);
  }

  private getAverageUtilization(): { cpu: number; memory: number } {
    const recentData = this.getRecentData('7d');
    if (recentData.length === 0) return { cpu: 50, memory: 60 };

    return {
      cpu: recentData.reduce((sum, d) => sum + d.cpu, 0) / recentData.length,
      memory: recentData.reduce((sum, d) => sum + d.memory, 0) / recentData.length
    };
  }

  private calculateCostImpact(action: ScalingRecommendation['action']): number {
    switch (action) {
      case 'scale_up': return 100;
      case 'scale_down': return -50;
      case 'optimize': return -25;
      default: return 0;
    }
  }

  private recordCapacityMetrics(metrics: CapacityMetrics): void {
    this.metrics.setGauge('capacity_cpu_utilization', metrics.cpu);
    this.metrics.setGauge('capacity_memory_utilization', metrics.memory);
    this.metrics.setGauge('capacity_requests_per_minute', metrics.requests);
    this.metrics.setGauge('capacity_estimated_cost_hourly', metrics.cost);
  }

  private cleanupOldData(): void {
    const cutoff = new Date(Date.now() - this.dataRetentionDays * 24 * 60 * 60 * 1000);
    const oldLength = this.historicalData.length;

    this.historicalData = this.historicalData.filter(d => d.timestamp >= cutoff);

    const cleaned = oldLength - this.historicalData.length;
    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} old capacity data points`);
    }
  }

  /**
   * Get capacity planning statistics
   */
  getStats(): {
    dataPoints: number;
    dataRange: { start: Date; end: Date } | null;
    averageUtilization: { cpu: number; memory: number };
    currentTrends: ReturnType<typeof this.analyzeTrends>;
    forecastAccuracy: number;
  } {
    const dataRange = this.historicalData.length > 0 ? {
      start: this.historicalData[0].timestamp,
      end: this.historicalData[this.historicalData.length - 1].timestamp
    } : null;

    return {
      dataPoints: this.historicalData.length,
      dataRange,
      averageUtilization: this.getAverageUtilization(),
      currentTrends: this.analyzeTrends(),
      forecastAccuracy: 0.8 // Would calculate based on actual vs predicted
    };
  }

  /**
   * Export capacity data
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'cpu', 'memory', 'requests', 'errors', 'responseTime', 'cost'];
      const rows = this.historicalData.map(d => [
        d.timestamp.toISOString(),
        d.cpu,
        d.memory,
        d.requests,
        d.errors,
        d.responseTime,
        d.cost
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    return JSON.stringify(this.historicalData, null, 2);
  }
}

// Singleton instance
let capacityPlanner: CapacityPlanner | null = null;

export function getCapacityPlanner(config?: Parameters<typeof CapacityPlanner.prototype.constructor>[0]): CapacityPlanner {
  if (!capacityPlanner) {
    capacityPlanner = new CapacityPlanner(config);
  }
  return capacityPlanner;
}

export { CapacityPlanner };