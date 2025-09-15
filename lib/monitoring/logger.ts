/**
 * Structured Logging Infrastructure
 *
 * Provides structured logging with correlation IDs, log levels, and metadata.
 * Integrates with the monitoring system for centralized log management.
 */

import { LogEntry, LogLevel, MonitoringConfig } from './types';
import { createId } from '@paralleldrive/cuid2';

class Logger {
  private logs: LogEntry[] = [];
  private config: MonitoringConfig;
  private context: {
    service: string;
    correlationId?: string;
    userId?: string;
    requestId?: string;
  };

  constructor(
    service: string,
    config: MonitoringConfig = {
      metricsRetentionDays: 7,
      healthCheckInterval: 30000,
      alertEvaluationInterval: 60000,
      logLevel: 'info',
      enablePerformanceProfiling: true,
      maxLogEntries: 10000,
      dashboardRefreshInterval: 30000
    }
  ) {
    this.config = config;
    this.context = { service };
    this.startLogRotation();
  }

  setContext(context: Partial<typeof this.context>) {
    this.context = { ...this.context, ...context };
  }

  setCorrelationId(correlationId: string) {
    this.context.correlationId = correlationId;
  }

  setUserId(userId: string) {
    this.context.userId = userId;
  }

  setRequestId(requestId: string) {
    this.context.requestId = requestId;
  }

  clearContext() {
    this.context = { service: this.context.service };
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>) {
    this.log('ERROR', message, metadata, error);
  }

  warn(message: string, metadata?: Record<string, unknown>) {
    this.log('WARN', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>) {
    this.log('INFO', message, metadata);
  }

  debug(message: string, metadata?: Record<string, unknown>) {
    this.log('DEBUG', message, metadata);
  }

  private log(
    level: keyof LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      service: this.context.service,
      correlationId: this.context.correlationId,
      userId: this.context.userId,
      requestId: this.context.requestId,
      metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    this.logs.push(entry);
    this.outputLog(entry);

    // Prevent memory leaks
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs = this.logs.slice(-this.config.maxLogEntries);
    }
  }

  private shouldLog(level: keyof LogLevel): boolean {
    const levels: Record<keyof LogLevel, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };

    return levels[level] >= levels[this.config.logLevel];
  }

  private outputLog(entry: LogEntry) {
    const timestamp = entry.timestamp.toISOString();
    const context = [
      entry.correlationId && `[${entry.correlationId}]`,
      entry.userId && `[user:${entry.userId}]`,
      entry.requestId && `[req:${entry.requestId}]`
    ].filter(Boolean).join(' ');

    const logMessage = `${timestamp} [${entry.level}] [${entry.service}] ${context} ${entry.message}`;

    if (entry.metadata) {
      console.log(logMessage, entry.metadata);
    } else {
      console.log(logMessage);
    }

    if (entry.error) {
      console.error(entry.error.stack || entry.error.message);
    }
  }

  private startLogRotation() {
    setInterval(() => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - this.config.metricsRetentionDays);

      this.logs = this.logs.filter(log => log.timestamp >= cutoff);
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  getLogs(options: {
    level?: keyof LogLevel;
    service?: string;
    correlationId?: string;
    userId?: string;
    since?: Date;
    limit?: number;
  } = {}): LogEntry[] {
    let filtered = this.logs;

    if (options.level) {
      filtered = filtered.filter(log => log.level === options.level);
    }

    if (options.service) {
      filtered = filtered.filter(log => log.service === options.service);
    }

    if (options.correlationId) {
      filtered = filtered.filter(log => log.correlationId === options.correlationId);
    }

    if (options.userId) {
      filtered = filtered.filter(log => log.userId === options.userId);
    }

    if (options.since) {
      filtered = filtered.filter(log => log.timestamp >= options.since!);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  getLogStats(): {
    totalLogs: number;
    logsByLevel: Record<keyof LogLevel, number>;
    logsByService: Record<string, number>;
    recentErrors: LogEntry[];
  } {
    const logsByLevel = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<keyof LogLevel, number>);

    const logsByService = this.logs.reduce((acc, log) => {
      acc[log.service] = (acc[log.service] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentErrors = this.logs
      .filter(log => log.level === 'ERROR')
      .slice(0, 10);

    return {
      totalLogs: this.logs.length,
      logsByLevel,
      logsByService,
      recentErrors
    };
  }

  searchLogs(query: string): LogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.logs.filter(log =>
      log.message.toLowerCase().includes(lowerQuery) ||
      (log.error?.message.toLowerCase().includes(lowerQuery)) ||
      JSON.stringify(log.metadata || {}).toLowerCase().includes(lowerQuery)
    );
  }

  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'service', 'correlationId', 'userId', 'message'];
      const rows = this.logs.map(log => [
        log.timestamp.toISOString(),
        log.level,
        log.service,
        log.correlationId || '',
        log.userId || '',
        log.message.replace(/"/g, '""')
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    return JSON.stringify(this.logs, null, 2);
  }
}

// Global logger instances for different services
const loggers = new Map<string, Logger>();

export function getLogger(service: string): Logger {
  if (!loggers.has(service)) {
    loggers.set(service, new Logger(service));
  }
  return loggers.get(service)!;
}

export function createCorrelationId(): string {
  return createId();
}

export { Logger };