/**
 * Integration Adapter - Connects the modular processor system with existing job system
 *
 * Provides a bridge between the new modular processor system and the existing
 * ingestion core, allowing gradual migration and compatibility.
 */

import { getDefaultProcessorFactory } from './factory';
import { ProcessorConfig } from './types';
import {
  IngestionResult,
  IngestedContent,
  IngestionOptions,
  IngestionProgressCallback,
  SupportedFileType,
  ContentType
} from '@/lib/ingestion/types';
import { generateIngestionId, generateContentId, generateChecksum } from './helpers';

/**
 * Adapter class that implements the existing ingestion interface using the new modular system
 */
export class ProcessorIntegrationAdapter {
  private factory = getDefaultProcessorFactory();

  /**
   * Process file using the modular system but return results in the format expected by the existing system
   */
  async ingestFile(
    filename: string,
    fileBuffer: Buffer,
    mimeType?: string,
    options: IngestionOptions = {},
    progressCallback?: IngestionProgressCallback
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    const ingestionId = generateIngestionId();

    const result: IngestionResult = {
      ingestionId,
      content: null,
      warnings: [],
      error: null,
      success: false,
      processingTime: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      debug: {
        steps: ['Modular processor integration'],
        metrics: {},
        internal: {}
      }
    };

    try {
      // Convert options to processor config
      const processorConfig: ProcessorConfig = {
        maxFileSize: options.maxFileSize,
        timeout: options.timeout,
        extractMetadata: options.extractMetadata,
        enableOCR: true, // Enable OCR by default for compatibility
        custom: {
          priority: options.priority,
          userContext: options.userContext
        }
      };

      // Process using the modular system
      const processingResult = await this.factory.processFile(
        filename,
        fileBuffer,
        mimeType,
        processorConfig,
        progressCallback
      );

      if (!processingResult.success) {
        result.error = {
          type: 'processing_failed',
          message: processingResult.error || 'File processing failed',
          timestamp: new Date(),
          retryable: false,
          suggestions: ['Check file format and try again']
        };
        return result;
      }

      // Convert processor warnings to ingestion warnings
      result.warnings = processingResult.warnings;

      // Create ingested content in the format expected by the existing system
      const contentType = this.detectContentType(filename, processingResult.textContent);
      const metadata = this.convertMetadata(processingResult.metadata, filename, processingResult.textContent);

      const ingestedContent: IngestedContent = {
        id: generateContentId(),
        filename,
        fileType: this.mapFileType(filename, mimeType),
        fileSize: fileBuffer.length,
        mimeType: mimeType || 'application/octet-stream',
        textContent: processingResult.textContent,
        contentType,
        priority: options.priority || 'medium',
        status: 'completed',
        metadata,
        ingestedAt: new Date(),
        processedAt: new Date(),
        checksum: generateChecksum(processingResult.textContent)
      };

      result.content = ingestedContent;
      result.success = true;

      // Add debug information
      result.debug!.metrics = {
        processingTime: processingResult.metadata.processingTime,
        fileSize: fileBuffer.length,
        contentLength: processingResult.textContent.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        processor: (processingResult as any).processor || 'unknown'
      };

      result.debug!.internal = {
        modularSystemUsed: true,
        processorMetadata: processingResult.metadata,
        structuredContent: processingResult.structuredContent
      };

    } catch (error) {
      result.error = {
        type: 'unknown_error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        retryable: true,
        retryDelay: 10000,
        suggestions: ['Try again later', 'Check file format']
      };
    } finally {
      const endTime = Date.now();
      result.processingTime = endTime - startTime;
      result.completedAt = new Date();
    }

    return result;
  }

  /**
   * Map processor file types to the format expected by the existing system
   */
  private mapFileType(filename: string, mimeType?: string): SupportedFileType {
    // Use the factory's file type detection
    const detection = this.factory.detectFileType(filename, mimeType);

    // Map to existing system format
    const typeMap: Record<string, SupportedFileType> = {
      'pdf': '.pdf',
      'docx': '.docx',
      'txt': '.txt',
      'png': '.png',
      'jpg': '.jpg',
      'jpeg': '.jpg',
      'gif': '.gif',
      'webp': '.webp'
    };

    if (detection.fileType && typeMap[detection.fileType]) {
      return typeMap[detection.fileType];
    }

    // Fallback to extension detection
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return (extension as SupportedFileType) || '.txt';
  }

  /**
   * Detect content type using the existing logic
   */
  private detectContentType(filename: string, content: string): ContentType {
    const lowerFilename = filename.toLowerCase();
    const lowerContent = content.toLowerCase();

    // Script formats
    if (lowerFilename.includes('.fdx') || lowerFilename.includes('.celtx')) {
      return 'script';
    }

    // Look for script indicators in content
    if (lowerContent.includes('fade in:') ||
        lowerContent.includes('ext.') ||
        lowerContent.includes('int.') ||
        lowerContent.includes('screenplay') ||
        lowerContent.includes('written by')) {
      return 'script';
    }

    // Treatment indicators
    if (lowerContent.includes('treatment') ||
        lowerContent.includes('logline') ||
        lowerFilename.includes('treatment')) {
      return 'treatment';
    }

    // Synopsis indicators
    if (lowerContent.includes('synopsis') ||
        lowerFilename.includes('synopsis') ||
        lowerFilename.includes('summary')) {
      return 'synopsis';
    }

    // Presentation formats
    if (lowerFilename.includes('.ppt') || lowerFilename.includes('.pptx')) {
      return 'pitch_deck';
    }

    // Default to document
    if (lowerFilename.includes('.docx') || lowerFilename.includes('.doc')) {
      return 'document';
    }

    return 'unknown';
  }

  /**
   * Convert processor metadata to the format expected by the existing system
   */
  private convertMetadata(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    processorMetadata: any,
    filename: string,
    content: string
  ): IngestedContent['metadata'] {
    const words = content.split(/\s+/).filter(word => word.length > 0);

    // Extract basic metadata similar to the existing system
    const lines = content.split('\n');
    let title: string | undefined;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line && line.length > 3 && line.length < 100) {
        title = line;
        break;
      }
    }

    let author: string | undefined;
    const authorPatterns = [
      /(?:by|written by|author|created by)[\s:]+([^\n\r]+)/i,
      /^([A-Z][a-z]+ [A-Z][a-z]+)$/m
    ];

    for (const pattern of authorPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        author = match[1].trim();
        break;
      }
    }

    return {
      title: title || processorMetadata.formatSpecific?.detectedTitle,
      author: author || processorMetadata.formatSpecific?.detectedAuthor,
      pageCount: processorMetadata.pageCount || Math.ceil(content.length / 2500),
      wordCount: words.length,
      charCount: content.length,
      language: processorMetadata.formatSpecific?.detectedLanguage || 'en',
      formatVersion: '2.0', // Mark as using the new modular system
      // Include additional metadata from the modular system
      processorUsed: processorMetadata.extractionMethod,
      processingTime: processorMetadata.processingTime,
      dimensions: processorMetadata.dimensions,
      modularSystemMetadata: processorMetadata.formatSpecific
    };
  }

  /**
   * Get processor factory for advanced usage
   */
  getProcessorFactory() {
    return this.factory;
  }

  /**
   * Check if a file type is supported by the modular system
   */
  isFileTypeSupported(filename: string, mimeType?: string): boolean {
    const detection = this.factory.detectFileType(filename, mimeType);
    return detection.fileType !== null;
  }

  /**
   * Get list of supported file types
   */
  getSupportedFileTypes() {
    return this.factory.getSupportedFileTypes();
  }
}

/**
 * Create a singleton instance of the integration adapter
 */
let integrationAdapter: ProcessorIntegrationAdapter | null = null;

export function getIntegrationAdapter(): ProcessorIntegrationAdapter {
  if (!integrationAdapter) {
    integrationAdapter = new ProcessorIntegrationAdapter();
  }
  return integrationAdapter;
}

/**
 * Convenience function to use the modular system as a drop-in replacement
 */
export async function ingestFileWithModularSystem(
  filename: string,
  fileBuffer: Buffer,
  mimeType?: string,
  options: IngestionOptions = {},
  progressCallback?: IngestionProgressCallback
): Promise<IngestionResult> {
  const adapter = getIntegrationAdapter();
  return adapter.ingestFile(filename, fileBuffer, mimeType, options, progressCallback);
}