/**
 * Modular File Processing System - Base Processor
 *
 * Abstract base class providing common functionality for all file processors.
 */

import {
  IFileProcessor,
  ProcessorConfig,
  ValidationResult,
  ProcessingResult,
  SecurityValidation,
  SupportedFileType,
  ProcessingMetadata,
  MIME_TYPE_MAP,
  EXTENSION_MAP
} from './types';
import { IngestionWarning, IngestionProgressCallback, IngestionErrorType } from '@/lib/ingestion/types';
import { createHash } from 'crypto';

/**
 * Abstract base processor class implementing common functionality
 */
export abstract class BaseProcessor implements IFileProcessor {
  abstract readonly name: string;
  abstract readonly supportedTypes: SupportedFileType[];
  abstract readonly defaultConfig: ProcessorConfig;

  /**
   * Check if this processor can handle the given file type
   */
  canProcess(fileType: SupportedFileType, mimeType?: string): boolean {
    if (this.supportedTypes.includes(fileType)) {
      return true;
    }

    // Check MIME type as fallback
    if (mimeType && MIME_TYPE_MAP[mimeType]) {
      return this.supportedTypes.includes(MIME_TYPE_MAP[mimeType]);
    }

    return false;
  }

  /**
   * Detect file type from filename and MIME type
   */
  protected detectFileType(filename: string, mimeType?: string): SupportedFileType | null {
    // Try extension first
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (EXTENSION_MAP[extension]) {
      return EXTENSION_MAP[extension];
    }

    // Fall back to MIME type
    if (mimeType && MIME_TYPE_MAP[mimeType]) {
      return MIME_TYPE_MAP[mimeType];
    }

    return null;
  }

  /**
   * Generate file checksum for integrity validation
   */
  protected generateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Create processing metadata
   */
  protected createMetadata(
    buffer: Buffer,
    processingTime: number,
    contentLength: number,
    additionalMetadata: Partial<ProcessingMetadata> = {}
  ): ProcessingMetadata {
    return {
      fileSize: buffer.length,
      processingTime,
      contentLength,
      ...additionalMetadata
    };
  }

  /**
   * Create standardized warning
   */
  protected createWarning(
    type: 'format_compatibility' | 'partial_extraction' | 'encoding_issues' | 'empty_content' | 'password_protected' | 'unsupported_features',
    message: string,
    severity: 'low' | 'medium' | 'high' = 'medium',
    suggestions: string[] = []
  ): IngestionWarning {
    return {
      type,
      message,
      severity,
      suggestions,
      timestamp: new Date()
    };
  }

  /**
   * Create standardized error
   */
  protected createError(
    type: IngestionErrorType,
    message: string,
    details?: string
  ): Error {
    const error = new Error(message);
    (error as Error & { type?: string; details?: string }).type = type;
    (error as Error & { type?: string; details?: string }).details = details;
    return error;
  }

  /**
   * Validate file size
   */
  protected validateFileSize(
    filename: string,
    buffer: Buffer,
    maxSize: number
  ): { valid: boolean; warnings: IngestionWarning[] } {
    const warnings: IngestionWarning[] = [];

    if (buffer.length > maxSize) {
      return {
        valid: false,
        warnings: []
      };
    }

    // Warn about large files (80% of max size)
    if (buffer.length > maxSize * 0.8) {
      warnings.push(this.createWarning(
        'format_compatibility',
        `File "${filename}" is quite large (${Math.round(buffer.length / (1024 * 1024) * 100) / 100}MB). Processing may take longer.`,
        'medium',
        ['Consider optimizing the file size for faster processing']
      ));
    }

    return { valid: true, warnings };
  }

  /**
   * Validate file before processing (common validation)
   */
  async validateFile(
    filename: string,
    buffer: Buffer,
    mimeType?: string,
    config?: ProcessorConfig
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      mimeType
    };

    // Detect file type
    const detectedType = this.detectFileType(filename, mimeType);
    if (!detectedType) {
      result.isValid = false;
      result.errors.push('Unable to detect file type from filename or MIME type');
      return result;
    }

    result.fileType = detectedType;

    // Check if this processor can handle the file type
    if (!this.canProcess(detectedType, mimeType)) {
      result.isValid = false;
      result.errors.push(`File type ${detectedType} is not supported by ${this.name} processor`);
      return result;
    }

    // Validate file size
    const maxSize = config?.maxFileSize || this.defaultConfig.maxFileSize || 100 * 1024 * 1024; // 100MB default
    const sizeValidation = this.validateFileSize(filename, buffer, maxSize);

    if (!sizeValidation.valid) {
      result.isValid = false;
      result.errors.push(`File size (${Math.round(buffer.length / (1024 * 1024) * 100) / 100}MB) exceeds maximum allowed size (${Math.round(maxSize / (1024 * 1024) * 100) / 100}MB)`);
    }

    result.warnings.push(...sizeValidation.warnings.map(w => w.message));

    return result;
  }

  /**
   * Basic security validation (can be overridden by specific processors)
   */
  async validateSecurity(
    filename: string,
    buffer: Buffer,
    _config?: ProcessorConfig
  ): Promise<SecurityValidation> {
    const validation: SecurityValidation = {
      isSecure: true,
      threats: [],
      riskLevel: 'low',
      recommendations: []
    };

    // Check for suspicious file patterns
    const suspiciousPatterns = [
      /javascript:/gi,
      /<script/gi,
      /eval\(/gi,
      /document\.write/gi
    ];

    const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 1024)); // Check first 1KB

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        validation.threats.push(`Suspicious pattern detected: ${pattern.source}`);
        validation.riskLevel = 'high';
        validation.isSecure = false;
      }
    }

    // Check file size anomalies
    if (buffer.length === 0) {
      validation.threats.push('File is empty');
      validation.riskLevel = 'medium';
    }

    if (validation.threats.length > 0) {
      validation.recommendations.push('Review file content before processing');
      validation.recommendations.push('Scan file with antivirus software');
    }

    return validation;
  }

  /**
   * Abstract method that must be implemented by concrete processors
   */
  abstract process(
    filename: string,
    buffer: Buffer,
    config?: ProcessorConfig,
    progressCallback?: IngestionProgressCallback
  ): Promise<ProcessingResult>;

  /**
   * Utility method to merge configurations
   */
  protected mergeConfig(config?: ProcessorConfig): ProcessorConfig {
    return {
      ...this.defaultConfig,
      ...config,
      custom: {
        ...this.defaultConfig.custom,
        ...config?.custom
      }
    };
  }

  /**
   * Utility method to validate buffer is not empty
   */
  protected validateBufferNotEmpty(buffer: Buffer, filename: string): void {
    if (buffer.length === 0) {
      throw this.createError('file_corrupted', `File "${filename}" is empty or corrupted`);
    }
  }

  /**
   * Utility method to handle processing timeout
   */
  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(this.createError('timeout_error', `${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}