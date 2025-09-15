/**
 * DOCX Processor - Handles Word document processing
 *
 * Uses mammoth.js for text extraction from Word documents.
 */

import * as mammoth from 'mammoth';
import { BaseProcessor } from './base';
import {
  SupportedFileType,
  ProcessorConfig,
  ProcessingResult,
  ValidationResult,
  SecurityValidation
} from './types';
import { IngestionProgressCallback, IngestionWarning } from '@/lib/ingestion/types';

/**
 * DOCX processor implementation
 */
export class DocxProcessor extends BaseProcessor {
  readonly name = 'DocxProcessor';
  readonly supportedTypes = [SupportedFileType.DOCX];
  readonly defaultConfig: ProcessorConfig = {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    timeout: 120000, // 2 minutes
    extractMetadata: true,
    custom: {
      includeHeaders: true,
      includeFooters: true,
      preserveFormatting: false,
      extractImages: false,
      convertToHtml: false
    }
  };

  /**
   * Enhanced validation for DOCX files
   */
  async validateFile(
    filename: string,
    buffer: Buffer,
    mimeType?: string,
    config?: ProcessorConfig
  ): Promise<ValidationResult> {
    const result = await super.validateFile(filename, buffer, mimeType, config);

    if (!result.isValid) {
      return result;
    }

    // DOCX-specific validation
    try {
      // Check ZIP header (DOCX files are ZIP archives)
      const header = buffer.subarray(0, 4);
      const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // ZIP file signature

      if (!header.equals(zipSignature)) {
        result.isValid = false;
        result.errors.push('File does not appear to be a valid DOCX file (invalid ZIP structure)');
        return result;
      }

      // Try to extract a small portion to test file integrity
      await mammoth.extractRawText({ buffer: buffer.subarray(0, Math.min(buffer.length, 1024 * 100)) });

    } catch (error) {
      result.isValid = false;
      result.errors.push(`DOCX validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Enhanced security validation for DOCX files
   */
  async validateSecurity(
    filename: string,
    buffer: Buffer,
    config?: ProcessorConfig
  ): Promise<SecurityValidation> {
    const baseValidation = await super.validateSecurity(filename, buffer, config);

    try {
      // DOCX-specific security checks
      const content = buffer.toString('ascii', 0, Math.min(buffer.length, 10000));

      // Check for macros
      if (content.includes('vbaProject') || content.includes('macros')) {
        baseValidation.threats.push('Document may contain macros');
        baseValidation.riskLevel = 'high';
        baseValidation.isSecure = false;
        baseValidation.recommendations.push('Review document macros before processing');
        baseValidation.recommendations.push('Consider disabling macros if not needed');
      }

      // Check for external links
      if (content.includes('http://') || content.includes('https://') || content.includes('ftp://')) {
        baseValidation.threats.push('Document contains external links');
        baseValidation.riskLevel = baseValidation.riskLevel === 'high' ? 'high' : 'medium';
        baseValidation.recommendations.push('Review external links before processing');
      }

      // Check for embedded objects
      if (content.includes('oleObject') || content.includes('embeddings')) {
        baseValidation.threats.push('Document contains embedded objects');
        baseValidation.riskLevel = 'medium';
        baseValidation.recommendations.push('Scan embedded objects separately');
      }

    } catch (error) {
      baseValidation.warnings?.push(`Security validation incomplete: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return baseValidation;
  }

  /**
   * Process DOCX file
   */
  async process(
    filename: string,
    buffer: Buffer,
    config?: ProcessorConfig,
    progressCallback?: IngestionProgressCallback
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const mergedConfig = this.mergeConfig(config);
    const warnings: IngestionWarning[] = [];

    this.validateBufferNotEmpty(buffer, filename);

    try {
      progressCallback?.({
        currentStep: 'Loading DOCX file',
        progress: 10,
        details: 'Parsing Word document structure'
      });

      // Configure mammoth options based on config
      const mammothOptions: mammoth.ConvertToTextOptions = {
        ...this.buildMammothOptions(mergedConfig)
      };

      progressCallback?.({
        currentStep: 'Extracting text',
        progress: 30,
        details: 'Processing document content'
      });

      // Process with timeout
      const result = await this.withTimeout(
        mammoth.extractRawText({ buffer }, mammothOptions),
        mergedConfig.timeout || this.defaultConfig.timeout!,
        'DOCX text extraction'
      );

      const textContent = result.value;

      progressCallback?.({
        currentStep: 'Analyzing content',
        progress: 60,
        details: 'Processing extraction messages'
      });

      // Process mammoth messages and warnings
      if (result.messages && result.messages.length > 0) {
        this.processMammothMessages(result.messages, warnings);
      }

      // Check for empty content
      if (!textContent || textContent.trim().length === 0) {
        warnings.push(this.createWarning(
          'empty_content',
          'No text content found in the Word document',
          'high',
          [
            'Check if the document contains only images or objects',
            'Ensure the document is not corrupted',
            'Try opening the document in Microsoft Word to verify content'
          ]
        ));
      }

      progressCallback?.({
        currentStep: 'Extracting metadata',
        progress: 80,
        details: 'Analyzing document metadata'
      });

      // Extract additional metadata if requested
      const additionalMetadata = mergedConfig.extractMetadata
        ? await this.extractDocumentMetadata(textContent, buffer, mergedConfig)
        : {};

      progressCallback?.({
        currentStep: 'Finalizing',
        progress: 90,
        details: 'Creating processing result'
      });

      const processingTime = Date.now() - startTime;
      const metadata = this.createMetadata(buffer, processingTime, textContent.length, {
        extractionMethod: 'mammoth',
        formatSpecific: {
          ...additionalMetadata,
          mammothMessages: result.messages?.length || 0,
          extractionOptions: mammothOptions
        }
      });

      progressCallback?.({
        currentStep: 'Complete',
        progress: 100,
        details: `Extracted ${textContent.length} characters`
      });

      return {
        success: true,
        textContent,
        metadata,
        warnings,
        structuredContent: {
          type: 'docx',
          extractionMethod: 'mammoth',
          metadata: additionalMetadata,
          messages: result.messages
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        textContent: '',
        metadata: this.createMetadata(buffer, processingTime, 0),
        warnings,
        error: `DOCX processing failed: ${errorMessage}`
      };
    }
  }

  /**
   * Build mammoth options based on processor configuration
   */
  private buildMammothOptions(config: ProcessorConfig): mammoth.ConvertToTextOptions {
    const options: mammoth.ConvertToTextOptions = {};

    // Configure based on custom options
    if (config.custom) {
      // Note: mammoth.extractRawText doesn't support many options,
      // but we can prepare for future enhancements or use mammoth.convertToHtml
      // if more advanced options are needed
    }

    return options;
  }

  /**
   * Process mammoth extraction messages
   */
  private processMammothMessages(
    messages: mammoth.Message[],
    warnings: IngestionWarning[]
  ): void {
    const errors = messages.filter(msg => msg.type === 'error');
    const messageWarnings = messages.filter(msg => msg.type === 'warning');

    if (errors.length > 0) {
      warnings.push(this.createWarning(
        'partial_extraction',
        'Some document elements could not be processed',
        'medium',
        [
          'Try saving the document in a newer format',
          'Check if the document has complex formatting or embedded objects'
        ]
      ));
    }

    if (messageWarnings.length > 0) {
      warnings.push(this.createWarning(
        'unsupported_features',
        'Some document features are not fully supported',
        'low',
        ['Document content extracted but some formatting may be lost']
      ));
    }
  }

  /**
   * Extract additional document metadata
   */
  private async extractDocumentMetadata(
    textContent: string,
    buffer: Buffer,
    config: ProcessorConfig
  ): Promise<Record<string, unknown>> {
    const metadata: Record<string, unknown> = {};

    try {
      // Extract basic content analysis
      const lines = textContent.split('\n').filter(line => line.trim());
      const words = textContent.split(/\s+/).filter(word => word.length > 0);

      // Try to extract title from first few lines
      if (lines.length > 0) {
        metadata.detectedTitle = lines[0].trim();
      }

      // Look for author information
      const authorLine = lines.find(line =>
        line.toLowerCase().includes('by ') ||
        line.toLowerCase().includes('author:') ||
        line.toLowerCase().includes('written by')
      );

      if (authorLine) {
        const authorMatch = authorLine.match(/(?:by|author:|written by)\s*([^\n\r]+)/i);
        if (authorMatch) {
          metadata.detectedAuthor = authorMatch[1].trim();
        }
      }

      // Content statistics
      metadata.statistics = {
        lineCount: lines.length,
        wordCount: words.length,
        characterCount: textContent.length,
        averageWordsPerLine: lines.length > 0 ? Math.round(words.length / lines.length) : 0
      };

      // Try to detect document type
      metadata.documentType = this.detectDocumentType(textContent);

      // If configured, try to extract more advanced metadata
      if (config.custom?.convertToHtml) {
        const htmlResult = await mammoth.convertToHtml({ buffer });
        metadata.htmlLength = htmlResult.value.length;
        metadata.hasComplexFormatting = this.hasComplexFormatting(htmlResult.value);
      }

    } catch (error) {
      metadata.metadataExtractionError = error instanceof Error ? error.message : 'Unknown error';
    }

    return metadata;
  }

  /**
   * Detect document type based on content
   */
  private detectDocumentType(content: string): string {
    const lowerContent = content.toLowerCase();

    // Script indicators
    if (lowerContent.includes('fade in:') ||
        lowerContent.includes('ext.') ||
        lowerContent.includes('int.') ||
        lowerContent.includes('screenplay')) {
      return 'script';
    }

    // Treatment indicators
    if (lowerContent.includes('treatment') ||
        lowerContent.includes('logline')) {
      return 'treatment';
    }

    // Synopsis indicators
    if (lowerContent.includes('synopsis') ||
        lowerContent.includes('summary')) {
      return 'synopsis';
    }

    // Business document indicators
    if (lowerContent.includes('proposal') ||
        lowerContent.includes('contract') ||
        lowerContent.includes('agreement')) {
      return 'business';
    }

    // Academic indicators
    if (lowerContent.includes('abstract') ||
        lowerContent.includes('methodology') ||
        lowerContent.includes('bibliography')) {
      return 'academic';
    }

    return 'document';
  }

  /**
   * Check if HTML content has complex formatting
   */
  private hasComplexFormatting(html: string): boolean {
    const complexElements = [
      '<table',
      '<img',
      '<style',
      '<div',
      '<span',
      'style=',
      'class='
    ];

    return complexElements.some(element => html.includes(element));
  }
}