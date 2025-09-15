/**
 * Admin Dashboard API Endpoint
 *
 * Provides aggregated data for the admin monitoring dashboard including
 * system health, processing stats, errors, and performance metrics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetricsCollector } from '@/lib/monitoring/metrics-collector';
import { getHealthChecker } from '@/lib/monitoring/health-checker';
import { getAlertingSystem } from '@/lib/monitoring/alerting';
import { getLogger } from '@/lib/monitoring/logger';
import { DashboardMetrics } from '@/lib/monitoring/types';

const metricsCollector = getMetricsCollector();
const healthChecker = getHealthChecker();
const alertingSystem = getAlertingSystem();
const logger = getLogger('dashboard-api');

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeframe = searchParams.get('timeframe') || '24h';
    const detailed = searchParams.get('detailed') === 'true';

    // Calculate since date based on timeframe
    const now = new Date();
    const sinceDate = new Date();

    switch (timeframe) {
      case '1h':
        sinceDate.setHours(now.getHours() - 1);
        break;
      case '24h':
        sinceDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        sinceDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        sinceDate.setDate(now.getDate() - 30);
        break;
      default:
        sinceDate.setDate(now.getDate() - 1); // Default to 24h
    }

    logger.info('Dashboard API request', { timeframe, detailed, since: sinceDate.toISOString() });

    // Get processing statistics
    const processingStats = await getProcessingStats(sinceDate);

    // Get system health
    const systemHealth = await getSystemHealth();

    // Get file type distribution
    const fileTypeDistribution = metricsCollector.getFileTypeDistribution(sinceDate);

    // Get error analysis
    const recentErrors = metricsCollector.getErrorAnalysis(sinceDate);

    // Get active alerts
    const activeAlerts = alertingSystem.getActiveAlerts();

    const dashboardData: DashboardMetrics = {
      processingStats,
      systemHealth,
      fileTypeDistribution,
      recentErrors,
      activeAlerts
    };

    // Add detailed data if requested
    let detailedData = {};
    if (detailed) {
      detailedData = {
        healthChecks: healthChecker.getAllLastResults(),
        alertStats: alertingSystem.getAlertStats(),
        logStats: logger.getLogStats(),
        recentLogs: logger.getLogs({ level: 'ERROR', limit: 10 }),
        metricsSummary: getMetricsSummary(sinceDate)
      };
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      timeframe,
      data: dashboardData,
      ...(detailed && { detailed: detailedData })
    });

  } catch (error) {
    logger.error('Dashboard API error', error as Error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

async function getProcessingStats(since: Date) {
  // Get total files processed
  const totalFiles = metricsCollector.getCounterValue('files_processed_total', since);
  const successfulFiles = metricsCollector.getCounterValue('files_processed_success_total', since);

  // Calculate success rate
  const successRate = totalFiles > 0 ? (successfulFiles / totalFiles) * 100 : 0;

  // Get average processing time
  const processingTimeStats = metricsCollector.getHistogramStats('processing_time_ms', since);
  const avgProcessingTime = processingTimeStats?.avg || 0;

  // Get files processed today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const filesProcessedToday = metricsCollector.getCounterValue('files_processed_total', today);

  // Get current queue depth
  const queueDepth = metricsCollector.getLatestGaugeValue('queue_depth') || 0;

  return {
    totalFiles,
    successRate,
    avgProcessingTime,
    filesProcessedToday,
    queueDepth
  };
}

async function getSystemHealth() {
  const overallHealth = healthChecker.getOverallHealth();

  // Get system metrics
  const memoryUsage = metricsCollector.getLatestGaugeValue('system_memory_usage_percent') || 0;
  const cpuUsage = metricsCollector.getLatestGaugeValue('system_cpu_usage_percent') || 0;
  const diskUsage = metricsCollector.getLatestGaugeValue('system_disk_usage_percent') || 0;
  const uptime = metricsCollector.getLatestGaugeValue('system_uptime_seconds') || 0;

  return {
    status: overallHealth.status,
    uptime,
    memoryUsage,
    cpuUsage,
    diskUsage
  };
}

function getMetricsSummary(since: Date) {
  const allMetrics = metricsCollector.getAllMetrics();
  const summary: Record<string, {
    type: string;
    dataPoints: number;
    latestValue?: number;
    totalValue?: number;
  }> = {};

  for (const [name, metrics] of Object.entries(allMetrics)) {
    const filteredMetrics = metrics.filter(m => m.timestamp >= since);

    if (filteredMetrics.length > 0) {
      const latest = filteredMetrics[filteredMetrics.length - 1];

      summary[name] = {
        type: latest.type,
        dataPoints: filteredMetrics.length,
        latestValue: latest.value
      };

      if (latest.type === 'counter') {
        summary[name].totalValue = filteredMetrics.reduce((sum, m) => sum + m.value, 0);
      }
    }
  }

  return summary;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    logger.info('Dashboard API POST request', { action });

    if (action === 'refresh_health') {
      // Trigger a refresh of all health checks
      const results = await healthChecker.runAllChecks();

      return NextResponse.json({
        success: true,
        message: 'Health checks refreshed',
        results,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'clear_alerts') {
      // This would typically resolve all alerts (implementation depends on your alert system)
      return NextResponse.json({
        success: true,
        message: 'Action not implemented yet',
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    logger.error('Dashboard API POST error', error as Error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}