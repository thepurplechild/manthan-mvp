/**
 * Metrics API Endpoint
 *
 * Provides access to collected application metrics for monitoring
 * dashboards and external monitoring systems.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetricsCollector } from '@/lib/monitoring/metrics-collector';
import { getLogger } from '@/lib/monitoring/logger';

const metricsCollector = getMetricsCollector();
const logger = getLogger('metrics-api');

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const metric = searchParams.get('metric');
    const format = searchParams.get('format') || 'json';
    const since = searchParams.get('since');
    const aggregate = searchParams.get('aggregate');

    // Parse since parameter
    let sinceDate: Date | undefined;
    if (since) {
      sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid since parameter, must be ISO date string' },
          { status: 400 }
        );
      }
    }

    logger.info('Metrics API request', {
      metric,
      format,
      since: sinceDate?.toISOString(),
      aggregate
    });

    if (format === 'prometheus') {
      // Export in Prometheus format
      const prometheusData = metricsCollector.exportMetrics('prometheus');
      return new Response(prometheusData, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    let result;

    if (metric) {
      // Get specific metric
      const metrics = metricsCollector.getMetrics(metric, sinceDate);

      if (aggregate) {
        // Return aggregated data based on metric type
        const latest = metrics[metrics.length - 1];
        if (latest?.type === 'counter') {
          result = {
            metric,
            type: 'counter',
            total: metricsCollector.getCounterValue(metric, sinceDate),
            dataPoints: metrics.length
          };
        } else if (latest?.type === 'gauge') {
          result = {
            metric,
            type: 'gauge',
            current: metricsCollector.getLatestGaugeValue(metric),
            dataPoints: metrics.length
          };
        } else if (latest?.type === 'histogram') {
          result = {
            metric,
            type: 'histogram',
            stats: metricsCollector.getHistogramStats(metric, sinceDate),
            dataPoints: metrics.length
          };
        } else {
          result = {
            metric,
            type: 'unknown',
            rawData: metrics
          };
        }
      } else {
        // Return raw metric data
        result = {
          metric,
          data: metrics
        };
      }
    } else {
      // Get all metrics
      const allMetrics = metricsCollector.getAllMetrics();

      // Filter by date if provided
      if (sinceDate) {
        const filtered: typeof allMetrics = {};
        for (const [name, metrics] of Object.entries(allMetrics)) {
          filtered[name] = metrics.filter(m => m.timestamp >= sinceDate);
        }
        result = filtered;
      } else {
        result = allMetrics;
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      result
    });

  } catch (error) {
    logger.error('Metrics API error', error as Error);

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, metric, value, labels, type } = body;

    logger.info('Metrics API POST request', { action, metric, type });

    if (action === 'record') {
      // Record a new metric
      if (!metric || value === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields: metric, value' },
          { status: 400 }
        );
      }

      switch (type) {
        case 'counter':
          metricsCollector.incrementCounter(metric, labels, value);
          break;
        case 'gauge':
          metricsCollector.setGauge(metric, value, labels);
          break;
        case 'histogram':
          metricsCollector.recordHistogram(metric, value, labels);
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid metric type. Must be: counter, gauge, or histogram' },
            { status: 400 }
          );
      }

      return NextResponse.json({
        success: true,
        message: `${type} metric recorded`,
        metric,
        value,
        labels,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    logger.error('Metrics API POST error', error as Error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}