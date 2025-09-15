/**
 * Monitoring and Observability Types
 *
 * Defines all types used across the monitoring system including metrics,
 * health checks, logging, and alerting.
 */

export interface MetricValue {
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface Counter extends MetricValue {
  type: 'counter';
}

export interface Gauge extends MetricValue {
  type: 'gauge';
}

export interface Histogram extends MetricValue {
  type: 'histogram';
  buckets?: number[];
}

export type Metric = Counter | Gauge | Histogram;

export interface MetricsCollection {
  [key: string]: Metric[];
}

export interface ProcessingMetrics {
  processingTime: number;
  fileSize: number;
  processorType: string;
  success: boolean;
  errorType?: string;
  queueDepth?: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface SystemMetrics {
  memoryUsage: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  cpuUsage: {
    percentage: number;
    loadAverage: number[];
  };
  diskUsage: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  timestamp: Date;
}

export interface HealthCheckStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  responseTime?: number;
}

export interface HealthCheck {
  name: string;
  description: string;
  check: () => Promise<HealthCheckStatus>;
  interval?: number;
  timeout?: number;
  critical?: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // seconds
  severity: 'critical' | 'warning' | 'info';
  channels: AlertChannel[];
  enabled: boolean;
}

export interface AlertChannel {
  type: 'email' | 'webhook' | 'log';
  config: Record<string, unknown>;
}

export interface Alert {
  id: string;
  rule: AlertRule;
  triggeredAt: Date;
  resolvedAt?: Date;
  status: 'active' | 'resolved';
  value: number;
  message: string;
}

export interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

export interface LogEntry {
  timestamp: Date;
  level: keyof LogLevel;
  message: string;
  correlationId?: string;
  userId?: string;
  requestId?: string;
  service: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface PerformanceProfile {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  operations: PerformanceOperation[];
  metadata?: Record<string, unknown>;
}

export interface PerformanceOperation {
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface QueueMetrics {
  depth: number;
  processing: number;
  completed: number;
  failed: number;
  avgProcessingTime: number;
  oldestJobAge: number;
  timestamp: Date;
}

export interface FileTypeDistribution {
  fileType: string;
  count: number;
  totalSize: number;
  avgProcessingTime: number;
  successRate: number;
}

export interface ErrorAnalysis {
  errorType: string;
  count: number;
  lastOccurrence: Date;
  avgRecoveryTime: number;
  affectedFiles: number;
  pattern?: string;
}

export interface DashboardMetrics {
  processingStats: {
    totalFiles: number;
    successRate: number;
    avgProcessingTime: number;
    filesProcessedToday: number;
    queueDepth: number;
  };
  systemHealth: {
    status: HealthCheckStatus['status'];
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
  fileTypeDistribution: FileTypeDistribution[];
  recentErrors: ErrorAnalysis[];
  activeAlerts: Alert[];
}

export interface MonitoringConfig {
  metricsRetentionDays: number;
  healthCheckInterval: number;
  alertEvaluationInterval: number;
  logLevel: keyof LogLevel;
  enablePerformanceProfiling: boolean;
  maxLogEntries: number;
  dashboardRefreshInterval: number;
}