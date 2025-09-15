/**
 * Advanced Output Formatter
 *
 * Multi-format output generation with structured data extraction,
 * export capabilities, and webhook notifications.
 */

import {
  OutputConfig,
  OutputFormat,
  OutputFormatType,
  FormatConfig,
  FormattingOptions,
  CompressionSettings,
  PostProcessingStep,
  OutputDestination,
  DestinationType,
  DestinationConfig,
  AuthConfig,
  TransformationRule,
  ExportSettings,
  ScheduleConfig,
  ExportFilter,
  AggregationConfig,
  NotificationSettings,
  NotificationChannel,
  NotificationTrigger,
  NotificationContent,
  RateLimitConfig
} from './types';
import { IngestionProgressCallback } from '@/lib/ingestion/types';
import { PipelineResult } from './pipeline';

/**
 * Output generation context
 */
export interface OutputContext {
  /** Source data */
  source: {
    filename: string;
    content: string;
    metadata: Record<string, unknown>;
    analysis?: Record<string, unknown>;
    security?: Record<string, unknown>;
  };
  /** Processing results */
  processingResults: PipelineResult;
  /** Output configuration */
  config: OutputConfig;
  /** Generation timestamp */
  timestamp: Date;
  /** User context */
  userContext?: Record<string, unknown>;
}

/**
 * Generated output
 */
export interface GeneratedOutput {
  /** Output format type */
  format: OutputFormatType;
  /** Generated content */
  content: string | Buffer;
  /** Content metadata */
  metadata: OutputMetadata;
  /** Export results */
  exports?: ExportResult[];
  /** Notification results */
  notifications?: NotificationResult[];
}

/**
 * Output metadata
 */
export interface OutputMetadata {
  /** Generation timestamp */
  generatedAt: Date;
  /** Content type */
  contentType: string;
  /** Content size in bytes */
  size: number;
  /** Compression applied */
  compressed: boolean;
  /** Encoding used */
  encoding: string;
  /** Checksum */
  checksum: string;
  /** Generator information */
  generator: {
    name: string;
    version: string;
    config: Record<string, unknown>;
  };
}

/**
 * Export result
 */
export interface ExportResult {
  /** Destination type */
  destination: DestinationType;
  /** Export success */
  success: boolean;
  /** Export location/identifier */
  location?: string;
  /** Export metadata */
  metadata?: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
  /** Export timestamp */
  timestamp: Date;
}

/**
 * Notification result
 */
export interface NotificationResult {
  /** Channel used */
  channel: string;
  /** Notification success */
  success: boolean;
  /** Response metadata */
  metadata?: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
  /** Notification timestamp */
  timestamp: Date;
}

/**
 * Format processor interface
 */
export interface FormatProcessor {
  /** Process and format output */
  process(
    data: unknown,
    config: FormatConfig,
    context: OutputContext
  ): Promise<string | Buffer>;

  /** Validate format configuration */
  validateConfig(config: FormatConfig): { valid: boolean; errors: string[] };

  /** Get supported options */
  getSupportedOptions(): string[];
}

/**
 * Export handler interface
 */
export interface ExportHandler {
  /** Export to destination */
  export(
    content: string | Buffer,
    config: DestinationConfig,
    context: OutputContext
  ): Promise<ExportResult>;

  /** Validate destination configuration */
  validateConfig(config: DestinationConfig): { valid: boolean; errors: string[] };

  /** Test connection */
  testConnection(config: DestinationConfig): Promise<boolean>;
}

/**
 * Advanced output formatter
 */
export class OutputFormatter {
  private formatProcessors: Map<OutputFormatType, FormatProcessor> = new Map();
  private exportHandlers: Map<DestinationType, ExportHandler> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();

  constructor() {
    this.initializeFormatProcessors();
    this.initializeExportHandlers();
  }

  /**
   * Generate output in multiple formats
   */
  async generateOutput(
    context: OutputContext,
    progressCallback?: IngestionProgressCallback
  ): Promise<GeneratedOutput[]> {
    const outputs: GeneratedOutput[] = [];

    try {
      console.log(`[OutputFormatter] Generating ${context.config.formats.length} output formats`);

      // Process each format
      for (let i = 0; i < context.config.formats.length; i++) {
        const format = context.config.formats[i];

        progressCallback?.({
          currentStep: `Generating ${format.type} output`,
          progress: Math.round((i / context.config.formats.length) * 50),
          details: `Format ${i + 1} of ${context.config.formats.length}`
        });

        try {
          const output = await this.processFormat(format, context);
          outputs.push(output);
        } catch (error) {
          console.error(`[OutputFormatter] Failed to generate ${format.type} format:`, error);
          // Continue with other formats
        }
      }

      // Export outputs if configured
      if (context.config.export?.enabled) {
        progressCallback?.({
          currentStep: 'Exporting outputs',
          progress: 60,
          details: 'Processing exports'
        });

        await this.exportOutputs(outputs, context);
      }

      // Send notifications if configured
      if (context.config.notifications?.enabled) {
        progressCallback?.({
          currentStep: 'Sending notifications',
          progress: 80,
          details: 'Processing notifications'
        });

        await this.sendNotifications(outputs, context);
      }

      progressCallback?.({
        currentStep: 'Output generation complete',
        progress: 100,
        details: `Generated ${outputs.length} outputs`
      });

      console.log(`[OutputFormatter] Generated ${outputs.length} outputs successfully`);
      return outputs;

    } catch (error) {
      console.error('[OutputFormatter] Output generation failed:', error);
      throw new Error(`Output generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process single format
   */
  private async processFormat(
    format: OutputFormat,
    context: OutputContext
  ): Promise<GeneratedOutput> {
    const processor = this.formatProcessors.get(format.type);
    if (!processor) {
      throw new Error(`No processor found for format: ${format.type}`);
    }

    try {
      // Prepare data for formatting
      const data = this.prepareDataForFormat(format, context);

      // Process format
      let content = await processor.process(data, format.config, context);

      // Apply post-processing
      if (format.postProcessing) {
        content = await this.applyPostProcessing(content, format.postProcessing, context);
      }

      // Apply compression if configured
      if (format.config.compression?.enabled) {
        content = await this.compressContent(content, format.config.compression);
      }

      // Generate metadata
      const metadata = this.generateOutputMetadata(content, format, context);

      return {
        format: format.type,
        content,
        metadata
      };

    } catch (error) {
      throw new Error(`Format processing failed for ${format.type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Prepare data based on format requirements
   */
  private prepareDataForFormat(
    format: OutputFormat,
    context: OutputContext
  ): unknown {
    const baseData = {
      filename: context.source.filename,
      content: context.source.content,
      timestamp: context.timestamp.toISOString(),
      processing: context.processingResults
    };

    // Include optional data based on configuration
    if (format.config.includeMetadata) {
      (baseData as any).metadata = context.source.metadata;
    }

    if (format.config.includeAnalysis && context.source.analysis) {
      (baseData as any).analysis = context.source.analysis;
    }

    if (format.config.includeSecurity && context.source.security) {
      (baseData as any).security = context.source.security;
    }

    return baseData;
  }

  /**
   * Apply post-processing steps
   */
  private async applyPostProcessing(
    content: string | Buffer,
    steps: PostProcessingStep[],
    context: OutputContext
  ): Promise<string | Buffer> {
    let processedContent: unknown = content;

    for (const step of steps) {
      try {
        processedContent = await step.processor(processedContent);
      } catch (error) {
        console.warn(`[OutputFormatter] Post-processing step ${step.name} failed:`, error);
      }
    }

    return processedContent as string | Buffer;
  }

  /**
   * Compress content
   */
  private async compressContent(
    content: string | Buffer,
    config: CompressionSettings
  ): Promise<Buffer> {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');

    try {
      switch (config.algorithm) {
        case 'gzip':
          const { gzip } = await import('zlib');
          return new Promise((resolve, reject) => {
            gzip(buffer, { level: config.level }, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });

        case 'deflate':
          const { deflate } = await import('zlib');
          return new Promise((resolve, reject) => {
            deflate(buffer, { level: config.level }, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });

        case 'brotli':
          const { brotliCompress } = await import('zlib');
          return new Promise((resolve, reject) => {
            brotliCompress(buffer, { params: { [require('zlib').constants.BROTLI_PARAM_QUALITY]: config.level } }, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });

        default:
          return buffer;
      }
    } catch (error) {
      console.warn('[OutputFormatter] Compression failed, returning uncompressed content:', error);
      return buffer;
    }
  }

  /**
   * Generate output metadata
   */
  private generateOutputMetadata(
    content: string | Buffer,
    format: OutputFormat,
    context: OutputContext
  ): OutputMetadata {
    const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
    const checksum = require('crypto').createHash('sha256').update(contentBuffer).digest('hex');

    return {
      generatedAt: new Date(),
      contentType: this.getContentType(format.type),
      size: contentBuffer.length,
      compressed: format.config.compression?.enabled || false,
      encoding: format.config.formatting.encoding || 'utf-8',
      checksum,
      generator: {
        name: 'Advanced Output Formatter',
        version: '1.0.0',
        config: format.config
      }
    };
  }

  /**
   * Get content type for format
   */
  private getContentType(format: OutputFormatType): string {
    const contentTypes: Record<OutputFormatType, string> = {
      [OutputFormatType.JSON]: 'application/json',
      [OutputFormatType.XML]: 'application/xml',
      [OutputFormatType.CSV]: 'text/csv',
      [OutputFormatType.YAML]: 'application/yaml',
      [OutputFormatType.HTML]: 'text/html',
      [OutputFormatType.PDF]: 'application/pdf',
      [OutputFormatType.MARKDOWN]: 'text/markdown',
      [OutputFormatType.PLAIN_TEXT]: 'text/plain',
      [OutputFormatType.STRUCTURED_JSON]: 'application/json',
      [OutputFormatType.CUSTOM]: 'application/octet-stream'
    };

    return contentTypes[format] || 'application/octet-stream';
  }

  /**
   * Export outputs to configured destinations
   */
  private async exportOutputs(
    outputs: GeneratedOutput[],
    context: OutputContext
  ): Promise<void> {
    const destination = context.config.destination;
    const handler = this.exportHandlers.get(destination.type);

    if (!handler) {
      console.warn(`[OutputFormatter] No export handler found for destination type: ${destination.type}`);
      return;
    }

    for (const output of outputs) {
      try {
        const exportResult = await handler.export(output.content, destination.config, context);
        if (!output.exports) output.exports = [];
        output.exports.push(exportResult);

        console.log(`[OutputFormatter] Exported ${output.format} to ${destination.type}: ${exportResult.success ? 'success' : 'failed'}`);
      } catch (error) {
        console.error(`[OutputFormatter] Export failed for ${output.format}:`, error);
        if (!output.exports) output.exports = [];
        output.exports.push({
          destination: destination.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Send notifications
   */
  private async sendNotifications(
    outputs: GeneratedOutput[],
    context: OutputContext
  ): Promise<void> {
    if (!context.config.notifications?.enabled || !context.config.notifications.channels) {
      return;
    }

    const notifications = context.config.notifications;

    for (const trigger of notifications.triggers) {
      if (this.shouldTriggerNotification(trigger, outputs, context)) {
        await this.executeNotificationTrigger(trigger, outputs, context, notifications);
      }
    }
  }

  /**
   * Check if notification should be triggered
   */
  private shouldTriggerNotification(
    trigger: NotificationTrigger,
    outputs: GeneratedOutput[],
    context: OutputContext
  ): boolean {
    switch (trigger.event) {
      case 'processing_completed':
        return context.processingResults.success;
      case 'processing_failed':
        return !context.processingResults.success;
      case 'security_alert':
        return context.source.security && (context.source.security as any).status !== 'safe';
      case 'quality_alert':
        const analysis = context.source.analysis as any;
        return analysis?.quality?.score < 50;
      default:
        return true;
    }
  }

  /**
   * Execute notification trigger
   */
  private async executeNotificationTrigger(
    trigger: NotificationTrigger,
    outputs: GeneratedOutput[],
    context: OutputContext,
    notifications: NotificationSettings
  ): Promise<void> {
    for (const channelName of trigger.channels) {
      const channel = notifications.channels.find(c => c.type === channelName);
      if (!channel) {
        console.warn(`[OutputFormatter] Notification channel not found: ${channelName}`);
        continue;
      }

      // Check rate limiting
      if (notifications.rateLimit && !this.checkRateLimit(channelName, notifications.rateLimit)) {
        console.warn(`[OutputFormatter] Rate limit exceeded for channel: ${channelName}`);
        continue;
      }

      try {
        const result = await this.sendNotification(channel, trigger.content, outputs, context);

        // Add result to outputs
        outputs.forEach(output => {
          if (!output.notifications) output.notifications = [];
          output.notifications.push(result);
        });

        console.log(`[OutputFormatter] Notification sent to ${channelName}: ${result.success ? 'success' : 'failed'}`);
      } catch (error) {
        console.error(`[OutputFormatter] Notification failed for ${channelName}:`, error);
      }
    }
  }

  /**
   * Send individual notification
   */
  private async sendNotification(
    channel: NotificationChannel,
    content: NotificationContent,
    outputs: GeneratedOutput[],
    context: OutputContext
  ): Promise<NotificationResult> {
    try {
      switch (channel.type) {
        case 'webhook':
          return await this.sendWebhookNotification(channel, content, outputs, context);
        case 'email':
          return await this.sendEmailNotification(channel, content, outputs, context);
        default:
          throw new Error(`Unsupported notification channel type: ${channel.type}`);
      }
    } catch (error) {
      return {
        channel: channel.type,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    channel: NotificationChannel,
    content: NotificationContent,
    outputs: GeneratedOutput[],
    context: OutputContext
  ): Promise<NotificationResult> {
    const payload = {
      subject: content.subject,
      body: content.body,
      format: content.format,
      outputs: outputs.map(o => ({
        format: o.format,
        size: o.metadata.size,
        checksum: o.metadata.checksum
      })),
      context: {
        filename: context.source.filename,
        timestamp: context.timestamp,
        success: context.processingResults.success
      }
    };

    const response = await fetch(channel.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...channel.config.headers
      },
      body: JSON.stringify(payload)
    });

    return {
      channel: channel.type,
      success: response.ok,
      metadata: {
        status: response.status,
        statusText: response.statusText,
        url: channel.config.endpoint
      },
      timestamp: new Date()
    };
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    channel: NotificationChannel,
    content: NotificationContent,
    outputs: GeneratedOutput[],
    context: OutputContext
  ): Promise<NotificationResult> {
    // Email implementation would use a service like SendGrid, SES, etc.
    console.log(`[OutputFormatter] Email notification: ${content.subject}`);

    return {
      channel: channel.type,
      success: true,
      metadata: {
        to: channel.config.endpoint,
        subject: content.subject
      },
      timestamp: new Date()
    };
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(channelName: string, config: RateLimitConfig): boolean {
    let limiter = this.rateLimiters.get(channelName);
    if (!limiter) {
      limiter = new RateLimiter(config);
      this.rateLimiters.set(channelName, limiter);
    }

    return limiter.checkLimit();
  }

  /**
   * Initialize format processors
   */
  private initializeFormatProcessors(): void {
    this.formatProcessors.set(OutputFormatType.JSON, new JSONProcessor());
    this.formatProcessors.set(OutputFormatType.XML, new XMLProcessor());
    this.formatProcessors.set(OutputFormatType.CSV, new CSVProcessor());
    this.formatProcessors.set(OutputFormatType.YAML, new YAMLProcessor());
    this.formatProcessors.set(OutputFormatType.HTML, new HTMLProcessor());
    this.formatProcessors.set(OutputFormatType.MARKDOWN, new MarkdownProcessor());
    this.formatProcessors.set(OutputFormatType.PLAIN_TEXT, new PlainTextProcessor());
    this.formatProcessors.set(OutputFormatType.STRUCTURED_JSON, new StructuredJSONProcessor());
  }

  /**
   * Initialize export handlers
   */
  private initializeExportHandlers(): void {
    this.exportHandlers.set(DestinationType.FILE_SYSTEM, new FileSystemExportHandler());
    this.exportHandlers.set(DestinationType.WEBHOOK, new WebhookExportHandler());
    this.exportHandlers.set(DestinationType.API_ENDPOINT, new APIExportHandler());
  }
}

/**
 * Rate limiter implementation
 */
class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  checkLimit(): boolean {
    const now = Date.now();
    const windowStart = now - (this.config.period * 1000);

    // Remove old requests
    this.requests = this.requests.filter(time => time > windowStart);

    if (this.requests.length >= this.config.maxNotifications) {
      return false;
    }

    this.requests.push(now);
    return true;
  }
}

// Format processor implementations

class JSONProcessor implements FormatProcessor {
  async process(data: unknown, config: FormatConfig): Promise<string> {
    const formatted = config.formatting.prettyPrint
      ? JSON.stringify(data, null, config.formatting.indent as number || 2)
      : JSON.stringify(data);

    return formatted;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  getSupportedOptions(): string[] {
    return ['prettyPrint', 'indent'];
  }
}

class XMLProcessor implements FormatProcessor {
  async process(data: unknown, config: FormatConfig): Promise<string> {
    // Basic XML generation (would use a proper XML library in production)
    const xml = this.objectToXML(data, 'root');
    return config.formatting.prettyPrint ? this.formatXML(xml) : xml;
  }

  private objectToXML(obj: unknown, rootName: string): string {
    if (typeof obj !== 'object' || obj === null) {
      return `<${rootName}>${String(obj)}</${rootName}>`;
    }

    let xml = `<${rootName}>`;
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          xml += this.objectToXML(item, key);
        }
      } else {
        xml += this.objectToXML(value, key);
      }
    }
    xml += `</${rootName}>`;
    return xml;
  }

  private formatXML(xml: string): string {
    // Simple XML formatting
    return xml.replace(/></g, '>\n<');
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  getSupportedOptions(): string[] {
    return ['prettyPrint'];
  }
}

class CSVProcessor implements FormatProcessor {
  async process(data: unknown, config: FormatConfig): Promise<string> {
    if (!Array.isArray(data)) {
      throw new Error('CSV format requires array data');
    }

    if (data.length === 0) {
      return '';
    }

    // Get headers from first object
    const headers = Object.keys(data[0] as Record<string, unknown>);
    const rows = [headers.join(',')];

    // Add data rows
    for (const item of data) {
      const values = headers.map(header => {
        const value = (item as Record<string, unknown>)[header];
        return typeof value === 'string' && value.includes(',')
          ? `"${value.replace(/"/g, '""')}"` // Escape quotes and wrap in quotes
          : String(value);
      });
      rows.push(values.join(','));
    }

    return rows.join(config.formatting.lineEnding === 'crlf' ? '\r\n' : '\n');
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  getSupportedOptions(): string[] {
    return ['lineEnding'];
  }
}

class YAMLProcessor implements FormatProcessor {
  async process(data: unknown, config: FormatConfig): Promise<string> {
    // Basic YAML generation (would use a proper YAML library in production)
    return this.objectToYAML(data, 0);
  }

  private objectToYAML(obj: unknown, indent: number): string {
    const spaces = ' '.repeat(indent);

    if (typeof obj !== 'object' || obj === null) {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => `${spaces}- ${this.objectToYAML(item, indent + 2)}`).join('\n');
    }

    const lines: string[] = [];
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof value === 'object' && value !== null) {
        lines.push(`${spaces}${key}:`);
        lines.push(this.objectToYAML(value, indent + 2));
      } else {
        lines.push(`${spaces}${key}: ${this.objectToYAML(value, 0)}`);
      }
    }

    return lines.join('\n');
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  getSupportedOptions(): string[] {
    return ['indent'];
  }
}

class HTMLProcessor implements FormatProcessor {
  async process(data: unknown, config: FormatConfig): Promise<string> {
    const title = 'Processing Results';
    const content = this.objectToHTML(data);

    return `<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .object { margin: 10px 0; padding: 10px; border-left: 3px solid #ccc; }
        .key { font-weight: bold; }
        .array { list-style-type: none; padding-left: 20px; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${content}
</body>
</html>`;
  }

  private objectToHTML(obj: unknown): string {
    if (typeof obj !== 'object' || obj === null) {
      return `<span>${String(obj)}</span>`;
    }

    if (Array.isArray(obj)) {
      const items = obj.map(item => `<li>${this.objectToHTML(item)}</li>`).join('');
      return `<ul class="array">${items}</ul>`;
    }

    const fields = Object.entries(obj as Record<string, unknown>)
      .map(([key, value]) => `<div><span class="key">${key}:</span> ${this.objectToHTML(value)}</div>`)
      .join('');

    return `<div class="object">${fields}</div>`;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  getSupportedOptions(): string[] {
    return [];
  }
}

class MarkdownProcessor implements FormatProcessor {
  async process(data: unknown, config: FormatConfig): Promise<string> {
    return `# Processing Results\n\n${this.objectToMarkdown(data, 2)}`;
  }

  private objectToMarkdown(obj: unknown, level: number): string {
    if (typeof obj !== 'object' || obj === null) {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => `- ${this.objectToMarkdown(item, level)}`).join('\n');
    }

    const lines: string[] = [];
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const heading = '#'.repeat(level);
      lines.push(`${heading} ${key}`);
      lines.push('');
      lines.push(this.objectToMarkdown(value, level + 1));
      lines.push('');
    }

    return lines.join('\n');
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  getSupportedOptions(): string[] {
    return [];
  }
}

class PlainTextProcessor implements FormatProcessor {
  async process(data: unknown): Promise<string> {
    return this.objectToText(data, 0);
  }

  private objectToText(obj: unknown, indent: number): string {
    const spaces = ' '.repeat(indent);

    if (typeof obj !== 'object' || obj === null) {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) =>
        `${spaces}[${index}] ${this.objectToText(item, indent + 2)}`
      ).join('\n');
    }

    const lines: string[] = [];
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      lines.push(`${spaces}${key}: ${this.objectToText(value, indent + 2)}`);
    }

    return lines.join('\n');
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  getSupportedOptions(): string[] {
    return [];
  }
}

class StructuredJSONProcessor implements FormatProcessor {
  async process(data: unknown, config: FormatConfig): Promise<string> {
    // Create a structured format with metadata
    const structured = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: data,
      schema: this.generateSchema(data)
    };

    return config.formatting.prettyPrint
      ? JSON.stringify(structured, null, config.formatting.indent as number || 2)
      : JSON.stringify(structured);
  }

  private generateSchema(obj: unknown): Record<string, string> {
    if (typeof obj !== 'object' || obj === null) {
      return { type: typeof obj };
    }

    if (Array.isArray(obj)) {
      return {
        type: 'array',
        items: obj.length > 0 ? this.generateSchema(obj[0]) : { type: 'unknown' }
      };
    }

    const schema: Record<string, unknown> = { type: 'object', properties: {} };
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      (schema.properties as Record<string, unknown>)[key] = this.generateSchema(value);
    }

    return schema as Record<string, string>;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  getSupportedOptions(): string[] {
    return ['prettyPrint', 'indent'];
  }
}

// Export handler implementations

class FileSystemExportHandler implements ExportHandler {
  async export(
    content: string | Buffer,
    config: DestinationConfig,
    context: OutputContext
  ): Promise<ExportResult> {
    try {
      const { writeFile } = await import('fs/promises');
      const path = await import('path');

      const outputDir = config.connection.path as string || './output';
      const filename = `${context.source.filename}_${Date.now()}`;
      const filepath = path.join(outputDir, filename);

      await writeFile(filepath, content);

      return {
        destination: DestinationType.FILE_SYSTEM,
        success: true,
        location: filepath,
        metadata: { size: Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content) },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        destination: DestinationType.FILE_SYSTEM,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  validateConfig(config: DestinationConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.connection.path) {
      errors.push('File system path is required');
    }

    return { valid: errors.length === 0, errors };
  }

  async testConnection(config: DestinationConfig): Promise<boolean> {
    try {
      const { access } = await import('fs/promises');
      const path = config.connection.path as string;
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
}

class WebhookExportHandler implements ExportHandler {
  async export(
    content: string | Buffer,
    config: DestinationConfig,
    context: OutputContext
  ): Promise<ExportResult> {
    try {
      const response = await fetch(config.connection.url as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.connection.headers as Record<string, string>
        },
        body: JSON.stringify({
          filename: context.source.filename,
          content: Buffer.isBuffer(content) ? content.toString('base64') : content,
          timestamp: context.timestamp.toISOString()
        })
      });

      return {
        destination: DestinationType.WEBHOOK,
        success: response.ok,
        location: config.connection.url as string,
        metadata: {
          status: response.status,
          statusText: response.statusText
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        destination: DestinationType.WEBHOOK,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  validateConfig(config: DestinationConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.connection.url) {
      errors.push('Webhook URL is required');
    }

    return { valid: errors.length === 0, errors };
  }

  async testConnection(config: DestinationConfig): Promise<boolean> {
    try {
      const response = await fetch(config.connection.url as string, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
}

class APIExportHandler implements ExportHandler {
  async export(
    content: string | Buffer,
    config: DestinationConfig,
    context: OutputContext
  ): Promise<ExportResult> {
    try {
      const payload = {
        filename: context.source.filename,
        content: Buffer.isBuffer(content) ? content.toString('base64') : content,
        metadata: context.source.metadata,
        timestamp: context.timestamp.toISOString()
      };

      const response = await fetch(config.connection.endpoint as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': config.auth?.credentials.token as string,
          ...config.connection.headers as Record<string, string>
        },
        body: JSON.stringify(payload)
      });

      return {
        destination: DestinationType.API_ENDPOINT,
        success: response.ok,
        location: config.connection.endpoint as string,
        metadata: {
          status: response.status,
          responseId: response.headers.get('x-response-id')
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        destination: DestinationType.API_ENDPOINT,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  validateConfig(config: DestinationConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.connection.endpoint) {
      errors.push('API endpoint is required');
    }

    if (config.auth?.type === 'bearer' && !config.auth.credentials.token) {
      errors.push('Bearer token is required for authentication');
    }

    return { valid: errors.length === 0, errors };
  }

  async testConnection(config: DestinationConfig): Promise<boolean> {
    try {
      const response = await fetch(config.connection.endpoint as string, {
        method: 'HEAD',
        headers: {
          'Authorization': config.auth?.credentials.token as string
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}