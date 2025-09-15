# Manthan Monitoring & Observability System

This document outlines the comprehensive production-grade monitoring and observability system implemented for the Manthan application.

## System Overview

The monitoring system provides complete observability across four key areas:

1. **Application Metrics** - Processing times, success rates, file distributions, resource usage
2. **Health Checks & Alerts** - System health monitoring with configurable alerting
3. **Logging Infrastructure** - Structured logging with correlation IDs and centralized management
4. **Admin Dashboard** - Real-time monitoring interface for system administrators

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │───▶│  Monitoring Core │───▶│  Admin Dashboard│
│   Processors    │    │                  │    │                 │
└─────────────────┘    │  - MetricsCollect│    └─────────────────┘
                       │  - Logger        │              │
┌─────────────────┐    │  - HealthChecker │    ┌─────────────────┐
│   API Endpoints │◀───│  - AlertSystem   │───▶│   API Endpoints │
│                 │    │  - Profiler      │    │  /health        │
└─────────────────┘    └──────────────────┘    │  /metrics       │
                                               │  /dashboard     │
                                               └─────────────────┘
```

## Core Components

### 1. Metrics Collection (`lib/monitoring/metrics-collector.ts`)

Collects and aggregates application metrics:

- **Counters**: File processing counts, error counts
- **Gauges**: System resources, queue depth, memory usage
- **Histograms**: Processing times, file sizes, response times

**Key Metrics:**
- `files_processed_total` - Total files processed
- `files_processed_success_total` - Successfully processed files
- `files_processed_error_total` - Failed file processing
- `processing_time_ms` - File processing duration
- `system_memory_usage_percent` - Memory utilization
- `system_cpu_usage_percent` - CPU utilization
- `queue_depth` - Number of pending jobs

### 2. Structured Logging (`lib/monitoring/logger.ts`)

Provides centralized logging with:

- **Correlation IDs**: Track requests across system boundaries
- **Structured Format**: JSON-formatted logs with metadata
- **Log Levels**: ERROR, WARN, INFO, DEBUG
- **Context Management**: User IDs, request IDs, service names
- **Log Rotation**: Automatic cleanup based on retention policies

**Example Usage:**
```typescript
import { getLogger } from '@/lib/monitoring';

const logger = getLogger('file-processor');
logger.setCorrelationId('req-123');
logger.info('Processing file', { filename: 'document.pdf', size: 1024 });
```

### 3. Health Monitoring (`lib/monitoring/health-checker.ts`)

Monitors system component health:

- **Built-in Checks**: Database, memory, disk space, queue depth
- **Custom Checks**: Extensible framework for application-specific monitoring
- **Status Levels**: Healthy, Degraded, Unhealthy
- **Periodic Monitoring**: Automatic health check execution
- **Critical vs Non-Critical**: Different handling for essential vs optional components

**Available Health Checks:**
- Database connectivity
- Memory usage thresholds
- Disk space monitoring
- Job queue depth
- Custom application checks

### 4. Alerting System (`lib/monitoring/alerting.ts`)

Configurable alerting with multiple notification channels:

- **Rule-Based**: Threshold monitoring with customizable conditions
- **Multiple Channels**: Email, webhook, and log-based notifications
- **Severity Levels**: Critical, Warning, Info
- **Alert States**: Active, Resolved with automatic resolution
- **Rate Limiting**: Prevent alert spam

**Default Alert Rules:**
- High error rate (>10% warnings, >25% critical)
- Memory usage (>80% warning, >90% critical)
- Queue depth (>100 jobs warning)
- Slow processing (>30s average warning)

### 5. Performance Profiling (`lib/monitoring/performance-profiler.ts`)

Detailed performance monitoring:

- **Operation Tracking**: Individual operation timing
- **Memory Monitoring**: Heap usage during processing
- **Bottleneck Analysis**: Automatic performance recommendations
- **Profile Management**: Automatic cleanup of abandoned profiles
- **Auto-Profiler**: Wrapper class for automatic instrumentation

## API Endpoints

### Health Check API (`/api/health`)

**Enhanced health monitoring endpoint:**

```bash
# Basic health check
GET /api/health

# Detailed health information
GET /api/health?detailed=true

# Specific health check
GET /api/health?check=database

# Legacy format (backwards compatibility)
GET /api/health?legacy=true

# Manual health check trigger
POST /api/health
{
  "action": "run_all"
}
```

### Metrics API (`/api/monitoring/metrics`)

**Application metrics access:**

```bash
# Get all metrics
GET /api/monitoring/metrics

# Get specific metric
GET /api/monitoring/metrics?metric=processing_time_ms

# Get metrics with aggregation
GET /api/monitoring/metrics?metric=processing_time_ms&aggregate=true

# Get metrics since timestamp
GET /api/monitoring/metrics?since=2023-12-01T00:00:00Z

# Export in Prometheus format
GET /api/monitoring/metrics?format=prometheus

# Record custom metric
POST /api/monitoring/metrics
{
  "action": "record",
  "metric": "custom_metric",
  "value": 42,
  "type": "gauge",
  "labels": { "component": "test" }
}
```

### Dashboard API (`/api/monitoring/dashboard`)

**Admin dashboard data aggregation:**

```bash
# Get dashboard data
GET /api/monitoring/dashboard

# Specify timeframe
GET /api/monitoring/dashboard?timeframe=24h

# Get detailed information
GET /api/monitoring/dashboard?detailed=true

# Refresh health checks
POST /api/monitoring/dashboard
{
  "action": "refresh_health"
}
```

## Admin Dashboard

Located at `/admin/monitoring`, provides:

### System Overview
- **System Health Status**: Overall health with uptime
- **Processing Statistics**: Files processed, success rates
- **Resource Utilization**: CPU, Memory, Disk usage charts
- **Queue Status**: Current job queue depth

### Detailed Views
- **Health Checks**: Individual component status
- **Active Alerts**: Current system alerts with severity
- **File Processing**: Distribution by file type and success rates
- **Error Analysis**: Error patterns and frequency
- **Performance Metrics**: Response times and bottlenecks

### Real-time Features
- **Auto-refresh**: Configurable automatic data updates
- **Manual Refresh**: On-demand data refresh
- **Time Range Selection**: 1h, 24h, 7d, 30d views
- **Health Check Triggers**: Manual health check execution

## Integration

### Automatic Monitoring Integration

The system automatically instruments file processing:

```typescript
import { getMonitoringIntegration } from '@/lib/monitoring';

// Create instrumented processor adapter
const integration = getMonitoringIntegration();
const instrumentedAdapter = integration.createInstrumentedAdapter();

// Use as normal - metrics are automatically collected
const result = await instrumentedAdapter.ingestFile(filename, buffer);
```

### Manual Instrumentation

For custom monitoring:

```typescript
import { withMonitoring, getMetricsCollector, getLogger } from '@/lib/monitoring';

// Wrap any async function with monitoring
const monitoredFunction = withMonitoring(
  'custom-operation',
  async (data) => {
    // Your processing logic
    return processData(data);
  }
);

// Or manual instrumentation
const metrics = getMetricsCollector();
const logger = getLogger('my-service');

const startTime = Date.now();
try {
  const result = await myOperation();

  metrics.recordHistogram('operation_duration_ms', Date.now() - startTime);
  metrics.incrementCounter('operations_success_total');
  logger.info('Operation completed successfully');

  return result;
} catch (error) {
  metrics.incrementCounter('operations_error_total');
  logger.error('Operation failed', error);
  throw error;
}
```

## System Initialization

Initialize the complete monitoring system:

```typescript
import { initializeMonitoring } from '@/lib/monitoring';

// Initialize with default configuration
await initializeMonitoring();

// Or with custom configuration
await initializeMonitoring({
  enableSystemMetrics: true,
  enableAlerting: true,
  enableHealthChecks: true,
  alertEvaluationInterval: 60000, // 1 minute
  customAlertRules: [
    // Your custom alert rules
  ]
});
```

## Production Deployment

### Environment Variables

Set these environment variables for optimal monitoring:

```bash
# Logging
LOG_LEVEL=info
ENABLE_PROCESSING_LOGS=true

# Performance
ENABLE_PERFORMANCE_MONITORING=true

# Security
ENABLE_FILE_SECURITY_SCAN=true
```

### Health Check Integration

Configure load balancers to use the health endpoint:

```yaml
# Example for load balancer health checks
health_check:
  path: /api/health
  healthy_threshold: 2
  unhealthy_threshold: 3
  interval: 30s
  timeout: 10s
```

### Alerting Configuration

Set up external alerting channels:

```typescript
// Example webhook alert configuration
{
  type: 'webhook',
  config: {
    url: 'https://hooks.slack.com/your-webhook-url',
    headers: {
      'Authorization': 'Bearer your-token'
    }
  }
}
```

## Testing

Run the monitoring system test:

```bash
node test-monitoring.js
```

This will verify all components are working correctly.

## Metrics Retention

- **Default**: 7 days retention for metrics and logs
- **Configurable**: Adjust via `MonitoringConfig`
- **Automatic Cleanup**: Old data automatically purged
- **Export Options**: JSON and Prometheus formats for external systems

## Troubleshooting

### Common Issues

1. **Missing Dependencies**: Ensure all monitoring dependencies are installed
2. **Memory Usage**: Monitor the monitoring system's own resource usage
3. **Log Volume**: Adjust log levels in high-traffic environments
4. **Alert Fatigue**: Fine-tune alert thresholds based on baseline metrics

### Monitoring the Monitors

The system includes self-monitoring capabilities:

- Monitor memory usage of the monitoring components
- Track metrics collection performance
- Health check response times
- Alert evaluation duration

## Future Enhancements

1. **Persistent Storage**: Database integration for long-term metric storage
2. **Advanced Analytics**: Trend analysis and forecasting
3. **Distributed Tracing**: Request flow across microservices
4. **Custom Dashboards**: User-configurable monitoring views
5. **Integration APIs**: External monitoring system integration
6. **Mobile Alerts**: SMS and push notification channels

## Support

For issues or questions regarding the monitoring system:

1. Check the test script output: `node test-monitoring.js`
2. Review system logs for monitoring components
3. Verify API endpoint responses
4. Check the admin dashboard for system status

The monitoring system is designed to be self-diagnosing and will log any internal issues to help with troubleshooting.