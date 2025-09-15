/**
 * Processor Factory - Intelligent processor selection and management
 *
 * Provides centralized processor management with MIME type detection,
 * validation, and extensible registry for adding new processors.
 */

import {
  IFileProcessor,
  SupportedFileType,
  ProcessorConfig,
  ProcessorFactoryConfig,
  ProcessorRegistration,
  ValidationResult,
  ProcessingResult,
  MIME_TYPE_MAP,
  EXTENSION_MAP
} from './types';
import { IngestionProgressCallback } from '@/lib/ingestion/types';

// Import all processors
import { PdfProcessor } from './pdf-processor';
import { DocxProcessor } from './docx-processor';
import { TxtProcessor } from './txt-processor';
import { ImageProcessor } from './image-processor';

/**
 * File processor factory with intelligent selection and registry management
 */
export class ProcessorFactory {
  private registry: Map<string, ProcessorRegistration> = new Map();
  private typeToProcessorMap: Map<SupportedFileType, string[]> = new Map();
  private config: ProcessorFactoryConfig;

  constructor(config?: Partial<ProcessorFactoryConfig>) {
    this.config = {
      defaultConfig: {
        maxFileSize: 100 * 1024 * 1024, // 100MB default
        timeout: 300000, // 5 minutes default
        extractMetadata: true,
        enableOCR: true
      },
      enableSecurity: true,
      ...config
    };

    this.initializeDefaultProcessors();
  }

  /**
   * Initialize default processors
   */
  private initializeDefaultProcessors(): void {
    // Register built-in processors with default priorities
    this.registerProcessor(new PdfProcessor(), 100);
    this.registerProcessor(new DocxProcessor(), 100);
    this.registerProcessor(new TxtProcessor(), 100);
    this.registerProcessor(new ImageProcessor(), 100);
  }

  /**
   * Register a new processor
   */
  registerProcessor(
    processor: IFileProcessor,
    priority: number = 50,
    enabled: boolean = true
  ): void {
    const registration: ProcessorRegistration = {
      processor,
      priority,
      enabled
    };

    this.registry.set(processor.name, registration);

    // Update type mapping
    for (const type of processor.supportedTypes) {
      if (!this.typeToProcessorMap.has(type)) {
        this.typeToProcessorMap.set(type, []);
      }

      const processors = this.typeToProcessorMap.get(type)!;

      // Remove existing entry if it exists
      const existingIndex = processors.indexOf(processor.name);
      if (existingIndex !== -1) {
        processors.splice(existingIndex, 1);
      }

      // Insert in priority order (higher priority first)
      let insertIndex = processors.length;
      for (let i = 0; i < processors.length; i++) {
        const existingProcessor = this.registry.get(processors[i]);
        if (existingProcessor && existingProcessor.priority < priority) {
          insertIndex = i;
          break;
        }
      }

      processors.splice(insertIndex, 0, processor.name);
    }
  }

  /**
   * Unregister a processor
   */
  unregisterProcessor(processorName: string): boolean {
    const registration = this.registry.get(processorName);
    if (!registration) {
      return false;
    }

    // Remove from registry
    this.registry.delete(processorName);

    // Remove from type mapping
    for (const [type, processors] of this.typeToProcessorMap) {
      const index = processors.indexOf(processorName);
      if (index !== -1) {
        processors.splice(index, 1);
      }

      // Clean up empty arrays
      if (processors.length === 0) {
        this.typeToProcessorMap.delete(type);
      }
    }

    return true;
  }

  /**
   * Enable or disable a processor
   */
  setProcessorEnabled(processorName: string, enabled: boolean): boolean {
    const registration = this.registry.get(processorName);
    if (!registration) {
      return false;
    }

    registration.enabled = enabled;
    return true;
  }

  /**
   * Get list of registered processors
   */
  getRegisteredProcessors(): Array<{
    name: string;
    supportedTypes: SupportedFileType[];
    priority: number;
    enabled: boolean;
  }> {
    return Array.from(this.registry.entries()).map(([name, registration]) => ({
      name,
      supportedTypes: registration.processor.supportedTypes,
      priority: registration.priority,
      enabled: registration.enabled
    }));
  }

  /**
   * Detect file type from filename and MIME type
   */
  detectFileType(filename: string, mimeType?: string): {
    fileType: SupportedFileType | null;
    confidence: 'high' | 'medium' | 'low';
    detectionMethod: 'extension' | 'mime_type' | 'fallback';
  } {
    // Try extension first (highest confidence)
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (EXTENSION_MAP[extension]) {
      return {
        fileType: EXTENSION_MAP[extension],
        confidence: 'high',
        detectionMethod: 'extension'
      };
    }

    // Try MIME type (medium confidence)
    if (mimeType && MIME_TYPE_MAP[mimeType]) {
      return {
        fileType: MIME_TYPE_MAP[mimeType],
        confidence: 'medium',
        detectionMethod: 'mime_type'
      };
    }

    // Fallback heuristics (low confidence)
    const fallbackType = this.detectTypeByHeuristics(filename, mimeType);
    if (fallbackType) {
      return {
        fileType: fallbackType,
        confidence: 'low',
        detectionMethod: 'fallback'
      };
    }

    return {
      fileType: null,
      confidence: 'low',
      detectionMethod: 'fallback'
    };
  }

  /**
   * Detect file type using heuristics
   */
  private detectTypeByHeuristics(filename: string, mimeType?: string): SupportedFileType | null {
    const lowerFilename = filename.toLowerCase();

    // Text file heuristics
    if (mimeType?.startsWith('text/') ||
        lowerFilename.includes('readme') ||
        lowerFilename.includes('changelog') ||
        lowerFilename.includes('license')) {
      return SupportedFileType.TXT;
    }

    // Image heuristics
    if (mimeType?.startsWith('image/')) {
      if (mimeType.includes('png')) return SupportedFileType.PNG;
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return SupportedFileType.JPG;
      if (mimeType.includes('gif')) return SupportedFileType.GIF;
      if (mimeType.includes('webp')) return SupportedFileType.WEBP;
    }

    return null;
  }

  /**
   * Select best processor for a file type
   */
  selectProcessor(
    fileType: SupportedFileType,
    mimeType?: string
  ): IFileProcessor | null {
    const candidates = this.typeToProcessorMap.get(fileType);
    if (!candidates || candidates.length === 0) {
      return this.config.fallbackProcessor || null;
    }

    // Find first enabled processor
    for (const candidateName of candidates) {
      const registration = this.registry.get(candidateName);
      if (registration && registration.enabled) {
        // Double-check that processor can handle this specific case
        if (registration.processor.canProcess(fileType, mimeType)) {
          return registration.processor;
        }
      }
    }

    return this.config.fallbackProcessor || null;
  }

  /**
   * Get supported file types across all processors
   */
  getSupportedFileTypes(): SupportedFileType[] {
    return Array.from(this.typeToProcessorMap.keys());
  }

  /**
   * Check if a file type is supported
   */
  isFileTypeSupported(fileType: SupportedFileType): boolean {
    return this.typeToProcessorMap.has(fileType);
  }

  /**
   * Validate a file using appropriate processor
   */
  async validateFile(
    filename: string,
    buffer: Buffer,
    mimeType?: string,
    config?: ProcessorConfig
  ): Promise<ValidationResult & { processor?: string }> {
    // Detect file type
    const detection = this.detectFileType(filename, mimeType);

    if (!detection.fileType) {
      return {
        isValid: false,
        errors: ['Unable to detect supported file type'],
        warnings: [],
        mimeType
      };
    }

    // Select processor
    const processor = this.selectProcessor(detection.fileType, mimeType);
    if (!processor) {
      return {
        isValid: false,
        errors: [`No processor available for file type: ${detection.fileType}`],
        warnings: [],
        fileType: detection.fileType,
        mimeType
      };
    }

    // Validate with selected processor
    const mergedConfig = this.mergeConfig(config);
    const result = await processor.validateFile(filename, buffer, mimeType, mergedConfig);

    return {
      ...result,
      processor: processor.name
    };
  }

  /**
   * Process a file using appropriate processor
   */
  async processFile(
    filename: string,
    buffer: Buffer,
    mimeType?: string,
    config?: ProcessorConfig,
    progressCallback?: IngestionProgressCallback
  ): Promise<ProcessingResult & { processor?: string }> {
    // First validate the file
    const validation = await this.validateFile(filename, buffer, mimeType, config);

    if (!validation.isValid) {
      return {
        success: false,
        textContent: '',
        metadata: {
          fileSize: buffer.length,
          processingTime: 0,
          contentLength: 0
        },
        warnings: [],
        error: `File validation failed: ${validation.errors.join(', ')}`,
        processor: validation.processor
      };
    }

    // Get processor (we know it exists from validation)
    const processor = this.selectProcessor(validation.fileType!, mimeType)!;
    const mergedConfig = this.mergeConfig(config);

    try {
      // Perform security validation if enabled
      if (this.config.enableSecurity) {
        progressCallback?.({
          currentStep: 'Security validation',
          progress: 5,
          details: 'Performing security checks'
        });

        const securityResult = await processor.validateSecurity(filename, buffer, mergedConfig);
        if (!securityResult.isSecure) {
          return {
            success: false,
            textContent: '',
            metadata: {
              fileSize: buffer.length,
              processingTime: 0,
              contentLength: 0
            },
            warnings: [],
            error: `Security validation failed: ${securityResult.threats.join(', ')}`,
            security: securityResult,
            processor: processor.name
          };
        }
      }

      // Process the file
      const result = await processor.process(filename, buffer, mergedConfig, progressCallback);

      return {
        ...result,
        processor: processor.name
      };

    } catch (error) {
      return {
        success: false,
        textContent: '',
        metadata: {
          fileSize: buffer.length,
          processingTime: 0,
          contentLength: 0
        },
        warnings: [],
        error: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processor: processor.name
      };
    }
  }

  /**
   * Process multiple files in batch
   */
  async processFileBatch(
    files: Array<{
      filename: string;
      buffer: Buffer;
      mimeType?: string;
    }>,
    config?: ProcessorConfig,
    progressCallback?: (overall: number, current: string) => void
  ): Promise<Array<ProcessingResult & { processor?: string; filename: string }>> {
    const results: Array<ProcessingResult & { processor?: string; filename: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileProgress = (i / files.length) * 100;

      progressCallback?.(fileProgress, `Processing ${file.filename}`);

      const result = await this.processFile(
        file.filename,
        file.buffer,
        file.mimeType,
        config,
        (progress) => {
          const overallProgress = fileProgress + (progress.progress / files.length);
          progressCallback?.(overallProgress, `${file.filename}: ${progress.currentStep}`);
        }
      );

      results.push({
        ...result,
        filename: file.filename
      });
    }

    progressCallback?.(100, 'Batch processing complete');
    return results;
  }

  /**
   * Get processor statistics
   */
  getStatistics(): {
    totalProcessors: number;
    enabledProcessors: number;
    supportedTypes: number;
    processorsByType: Record<string, string[]>;
  } {
    const totalProcessors = this.registry.size;
    const enabledProcessors = Array.from(this.registry.values())
      .filter(reg => reg.enabled).length;
    const supportedTypes = this.typeToProcessorMap.size;

    const processorsByType: Record<string, string[]> = {};
    for (const [type, processors] of this.typeToProcessorMap) {
      processorsByType[type] = processors.filter(name => {
        const reg = this.registry.get(name);
        return reg && reg.enabled;
      });
    }

    return {
      totalProcessors,
      enabledProcessors,
      supportedTypes,
      processorsByType
    };
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config?: ProcessorConfig): ProcessorConfig {
    return {
      ...this.config.defaultConfig,
      ...config,
      custom: {
        ...this.config.defaultConfig.custom,
        ...config?.custom
      }
    };
  }

  /**
   * Update factory configuration
   */
  updateConfig(config: Partial<ProcessorFactoryConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      defaultConfig: {
        ...this.config.defaultConfig,
        ...config.defaultConfig
      }
    };
  }
}

/**
 * Create a default processor factory instance
 */
export function createProcessorFactory(config?: Partial<ProcessorFactoryConfig>): ProcessorFactory {
  return new ProcessorFactory(config);
}

/**
 * Singleton factory instance for convenience
 */
let defaultFactory: ProcessorFactory | null = null;

/**
 * Get the default processor factory instance
 */
export function getDefaultProcessorFactory(): ProcessorFactory {
  if (!defaultFactory) {
    defaultFactory = createProcessorFactory();
  }
  return defaultFactory;
}

/**
 * Reset the default factory (useful for testing)
 */
export function resetDefaultProcessorFactory(): void {
  defaultFactory = null;
}