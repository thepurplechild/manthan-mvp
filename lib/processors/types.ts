/**
 * Modular File Processing System - Types and Interfaces
 *
 * Core types and interfaces for the extensible file processing system.
 */

import { IngestionWarning, IngestionProgressCallback } from '@/lib/ingestion/types';

/**
 * Supported file types for processing
 */
export enum SupportedFileType {
  PDF = 'pdf',
  DOCX = 'docx',
  TXT = 'txt',
  PNG = 'png',
  JPG = 'jpg',
  JPEG = 'jpeg',
  GIF = 'gif',
  WEBP = 'webp'
}

/**
 * MIME type mappings for file type detection
 */
export const MIME_TYPE_MAP: Record<string, SupportedFileType> = {
  'application/pdf': SupportedFileType.PDF,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': SupportedFileType.DOCX,
  'text/plain': SupportedFileType.TXT,
  'image/png': SupportedFileType.PNG,
  'image/jpeg': SupportedFileType.JPG,
  'image/jpg': SupportedFileType.JPG,
  'image/gif': SupportedFileType.GIF,
  'image/webp': SupportedFileType.WEBP
};

/**
 * File extension mappings
 */
export const EXTENSION_MAP: Record<string, SupportedFileType> = {
  '.pdf': SupportedFileType.PDF,
  '.docx': SupportedFileType.DOCX,
  '.txt': SupportedFileType.TXT,
  '.png': SupportedFileType.PNG,
  '.jpg': SupportedFileType.JPG,
  '.jpeg': SupportedFileType.JPEG,
  '.gif': SupportedFileType.GIF,
  '.webp': SupportedFileType.WEBP
};

/**
 * Processor configuration options
 */
export interface ProcessorConfig {
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Processing timeout in milliseconds */
  timeout?: number;
  /** Enable OCR for image-based content */
  enableOCR?: boolean;
  /** OCR language */
  ocrLanguage?: string;
  /** Extract metadata */
  extractMetadata?: boolean;
  /** Custom processor-specific options */
  custom?: Record<string, unknown>;
}

/**
 * Processing result metadata
 */
export interface ProcessingMetadata {
  /** File size in bytes */
  fileSize: number;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Content length in characters */
  contentLength: number;
  /** Number of pages (if applicable) */
  pageCount?: number;
  /** Image dimensions (if applicable) */
  dimensions?: {
    width: number;
    height: number;
  };
  /** File format specific metadata */
  formatSpecific?: Record<string, unknown>;
  /** Extraction method used */
  extractionMethod?: string;
}

/**
 * Security validation result
 */
export interface SecurityValidation {
  /** Whether the file passed security checks */
  isSecure: boolean;
  /** Security threats detected */
  threats: string[];
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high';
  /** Recommendations */
  recommendations: string[];
}

/**
 * File processing result
 */
export interface ProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  /** Extracted text content */
  textContent: string;
  /** Processing metadata */
  metadata: ProcessingMetadata;
  /** Processing warnings */
  warnings: IngestionWarning[];
  /** Security validation result */
  security?: SecurityValidation;
  /** Error message if processing failed */
  error?: string;
  /** Structured content (processor-specific) */
  structuredContent?: unknown;
}

/**
 * File validation result
 */
export interface ValidationResult {
  /** Whether the file is valid */
  isValid: boolean;
  /** File type detected */
  fileType?: SupportedFileType;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** MIME type detected */
  mimeType?: string;
}

/**
 * Base processor interface that all file processors must implement
 */
export interface IFileProcessor {
  /** Processor name for identification */
  readonly name: string;

  /** Supported file types */
  readonly supportedTypes: SupportedFileType[];

  /** Default configuration */
  readonly defaultConfig: ProcessorConfig;

  /**
   * Validate if the processor can handle the given file
   */
  canProcess(fileType: SupportedFileType, mimeType?: string): boolean;

  /**
   * Validate file before processing
   */
  validateFile(
    filename: string,
    buffer: Buffer,
    mimeType?: string,
    config?: ProcessorConfig
  ): Promise<ValidationResult>;

  /**
   * Process the file and extract content
   */
  process(
    filename: string,
    buffer: Buffer,
    config?: ProcessorConfig,
    progressCallback?: IngestionProgressCallback
  ): Promise<ProcessingResult>;

  /**
   * Perform security validation on the file
   */
  validateSecurity(
    filename: string,
    buffer: Buffer,
    config?: ProcessorConfig
  ): Promise<SecurityValidation>;
}

/**
 * Processor factory configuration
 */
export interface ProcessorFactoryConfig {
  /** Default processor configuration */
  defaultConfig: ProcessorConfig;
  /** Enable security validation */
  enableSecurity: boolean;
  /** Fallback processor for unsupported types */
  fallbackProcessor?: IFileProcessor;
}

/**
 * Processor registration information
 */
export interface ProcessorRegistration {
  /** Processor instance */
  processor: IFileProcessor;
  /** Priority for type conflicts (higher wins) */
  priority: number;
  /** Whether this is enabled */
  enabled: boolean;
}