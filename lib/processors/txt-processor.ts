/**
 * TXT Processor - Handles plain text file processing
 *
 * Processes plain text files with encoding detection and content analysis.
 */

import { BaseProcessor } from './base';
import {
  SupportedFileType,
  ProcessorConfig,
  ProcessingResult,
  ValidationResult
} from './types';
import { IngestionProgressCallback, IngestionWarning } from '@/lib/ingestion/types';

/**
 * Text processor implementation
 */
export class TxtProcessor extends BaseProcessor {
  readonly name = 'TxtProcessor';
  readonly supportedTypes = [SupportedFileType.TXT];
  readonly defaultConfig: ProcessorConfig = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    timeout: 30000, // 30 seconds
    extractMetadata: true,
    custom: {
      encoding: 'utf-8',
      fallbackEncodings: ['latin1', 'ascii', 'utf-16'],
      detectLanguage: true,
      analyzeStructure: true,
      preserveLineBreaks: true
    }
  };

  /**
   * Enhanced validation for text files
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

    // Text-specific validation
    try {
      // Check if file is completely binary
      const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
      const binaryBytes = sample.filter(byte => byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13));

      if (binaryBytes.length > sample.length * 0.3) {
        result.warnings.push('File appears to contain significant binary content');
      }

      // Check for very long lines (might indicate non-text content)
      const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
      const lines = content.split('\n');
      const longLines = lines.filter(line => line.length > 10000);

      if (longLines.length > 0) {
        result.warnings.push('File contains very long lines, which may indicate non-standard text format');
      }

    } catch (error) {
      result.warnings.push(`Text validation warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Process text file
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
        currentStep: 'Reading text file',
        progress: 10,
        details: 'Detecting encoding and reading content'
      });

      // Detect and read content with proper encoding
      const { content, encoding, encodingIssues } = await this.readTextWithEncoding(
        buffer,
        mergedConfig,
        warnings
      );

      progressCallback?.({
        currentStep: 'Analyzing content',
        progress: 40,
        details: 'Analyzing text structure and content'
      });

      // Perform content analysis
      const contentAnalysis = mergedConfig.custom?.analyzeStructure
        ? this.analyzeTextStructure(content, mergedConfig)
        : {};

      progressCallback?.({
        currentStep: 'Extracting metadata',
        progress: 70,
        details: 'Extracting metadata and language detection'
      });

      // Extract metadata
      const metadata = mergedConfig.extractMetadata
        ? await this.extractTextMetadata(content, filename, mergedConfig, contentAnalysis)
        : {};

      progressCallback?.({
        currentStep: 'Finalizing',
        progress: 90,
        details: 'Creating processing result'
      });

      const processingTime = Date.now() - startTime;
      const processedMetadata = this.createMetadata(buffer, processingTime, content.length, {
        extractionMethod: 'direct',
        formatSpecific: {
          encoding,
          encodingIssues,
          ...metadata,
          ...contentAnalysis
        }
      });

      progressCallback?.({
        currentStep: 'Complete',
        progress: 100,
        details: `Processed ${content.length} characters`
      });

      return {
        success: true,
        textContent: content,
        metadata: processedMetadata,
        warnings,
        structuredContent: {
          type: 'text',
          encoding,
          analysis: contentAnalysis,
          metadata
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
        error: `Text processing failed: ${errorMessage}`
      };
    }
  }

  /**
   * Read text with encoding detection and fallback
   */
  private async readTextWithEncoding(
    buffer: Buffer,
    config: ProcessorConfig,
    warnings: IngestionWarning[]
  ): Promise<{ content: string; encoding: string; encodingIssues: boolean }> {
    const primaryEncoding = (config.custom?.encoding as string) || 'utf-8';
    const fallbackEncodings = (config.custom?.fallbackEncodings as string[]) || ['latin1', 'ascii'];

    try {
      // Try primary encoding
      const content = buffer.toString(primaryEncoding as BufferEncoding);

      // Check for encoding issues (replacement characters)
      const hasReplacementChars = content.includes('\uFFFD');

      if (!hasReplacementChars) {
        return { content, encoding: primaryEncoding, encodingIssues: false };
      }

      warnings.push(this.createWarning(
        'encoding_issues',
        `Potential encoding issues detected with ${primaryEncoding}, trying fallback encodings`,
        'medium',
        ['Try saving the file as UTF-8', 'Check the original file encoding']
      ));

      // Try fallback encodings
      for (const encoding of fallbackEncodings) {
        try {
          const fallbackContent = buffer.toString(encoding as BufferEncoding);
          if (!fallbackContent.includes('\uFFFD')) {
            warnings.push(this.createWarning(
              'encoding_issues',
              `Successfully read file using ${encoding} encoding`,
              'low',
              [`File was read using ${encoding} instead of ${primaryEncoding}`]
            ));
            return { content: fallbackContent, encoding, encodingIssues: true };
          }
        } catch {
          // Continue to next encoding
        }
      }

      // If all encodings failed, use the primary with issues
      warnings.push(this.createWarning(
        'encoding_issues',
        'Could not find suitable encoding, some characters may be corrupted',
        'high',
        ['Check original file encoding', 'Try converting file to UTF-8']
      ));

      return { content, encoding: primaryEncoding, encodingIssues: true };

    } catch (error) {
      throw new Error(`Failed to read text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze text structure and patterns
   */
  private analyzeTextStructure(content: string, config: ProcessorConfig): Record<string, unknown> {
    const analysis: Record<string, unknown> = {};

    try {
      const lines = content.split('\n');
      const words = content.split(/\s+/).filter(word => word.length > 0);
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

      // Basic statistics
      analysis.statistics = {
        lineCount: lines.length,
        wordCount: words.length,
        sentenceCount: sentences.length,
        characterCount: content.length,
        averageWordsPerLine: lines.length > 0 ? Math.round(words.length / lines.length) : 0,
        averageWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0
      };

      // Line structure analysis
      const emptyLines = lines.filter(line => line.trim().length === 0).length;
      const shortLines = lines.filter(line => line.trim().length > 0 && line.trim().length < 50).length;
      const longLines = lines.filter(line => line.length > 200).length;

      analysis.lineStructure = {
        emptyLines,
        shortLines,
        longLines,
        averageLineLength: lines.length > 0 ? Math.round(content.length / lines.length) : 0
      };

      // Content patterns
      analysis.patterns = this.detectContentPatterns(content);

      // Format detection
      analysis.detectedFormat = this.detectTextFormat(content, lines);

    } catch (error) {
      analysis.analysisError = error instanceof Error ? error.message : 'Unknown error';
    }

    return analysis;
  }

  /**
   * Detect content patterns in text
   */
  private detectContentPatterns(content: string): Record<string, unknown> {
    const patterns: Record<string, unknown> = {};

    // Email addresses
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailPattern);
    patterns.emailCount = emails ? emails.length : 0;

    // URLs
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlPattern);
    patterns.urlCount = urls ? urls.length : 0;

    // Phone numbers (basic pattern)
    const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const phones = content.match(phonePattern);
    patterns.phoneCount = phones ? phones.length : 0;

    // Dates (basic patterns)
    const datePattern = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b|\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g;
    const dates = content.match(datePattern);
    patterns.dateCount = dates ? dates.length : 0;

    // Numbers
    const numberPattern = /\b\d+(?:\.\d+)?\b/g;
    const numbers = content.match(numberPattern);
    patterns.numberCount = numbers ? numbers.length : 0;

    // Uppercase words (possible names/titles)
    const uppercasePattern = /\b[A-Z][A-Z]+\b/g;
    const uppercaseWords = content.match(uppercasePattern);
    patterns.uppercaseWordCount = uppercaseWords ? uppercaseWords.length : 0;

    return patterns;
  }

  /**
   * Detect text format type
   */
  private detectTextFormat(content: string, lines: string[]): string {
    const lowerContent = content.toLowerCase();

    // Script format detection
    if (lowerContent.includes('fade in:') ||
        lowerContent.includes('ext.') ||
        lowerContent.includes('int.') ||
        lowerContent.includes('screenplay')) {
      return 'script';
    }

    // Code detection
    const codeIndicators = ['function', 'class', 'import', 'export', 'var', 'let', 'const', '{', '}', ';'];
    const codeCount = codeIndicators.filter(indicator => lowerContent.includes(indicator)).length;
    if (codeCount >= 3) {
      return 'code';
    }

    // CSV/Data detection
    const commaLines = lines.filter(line => line.split(',').length > 3).length;
    if (commaLines > lines.length * 0.5) {
      return 'csv';
    }

    // Markdown detection
    if (content.includes('# ') || content.includes('## ') || content.includes('```')) {
      return 'markdown';
    }

    // Configuration file detection
    if (content.includes('=') && lines.filter(line => line.includes('=')).length > lines.length * 0.3) {
      return 'config';
    }

    // Log file detection
    if (lines.some(line => /^\d{4}-\d{2}-\d{2}/.test(line)) ||
        lines.some(line => /\[(INFO|ERROR|WARN|DEBUG)\]/.test(line))) {
      return 'log';
    }

    // Poetry/verse detection
    const shortLines = lines.filter(line => line.trim().length > 0 && line.trim().length < 80).length;
    if (shortLines > lines.length * 0.7 && lines.length > 10) {
      return 'verse';
    }

    return 'prose';
  }

  /**
   * Extract metadata from text content
   */
  private async extractTextMetadata(
    content: string,
    filename: string,
    config: ProcessorConfig,
    analysis: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const metadata: Record<string, unknown> = {};

    try {
      const lines = content.split('\n').filter(line => line.trim().length > 0);

      // Extract title (first non-empty line if it looks like a title)
      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        if (firstLine.length > 3 && firstLine.length < 100 && !firstLine.includes('\t')) {
          metadata.detectedTitle = firstLine;
        }
      }

      // Look for author information
      const authorPatterns = [
        /(?:by|author|written by)[\s:]+([^\n\r]+)/i,
        /^([A-Z][a-z]+ [A-Z][a-z]+)$/m
      ];

      for (const pattern of authorPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          metadata.detectedAuthor = match[1].trim();
          break;
        }
      }

      // Language detection if enabled
      if (config.custom?.detectLanguage) {
        metadata.detectedLanguage = this.detectLanguage(content);
      }

      // Content type detection based on filename and content
      metadata.contentType = this.detectContentType(filename, content);

      // Reading statistics
      const words = content.split(/\s+/).filter(word => word.length > 0);
      metadata.readingStats = {
        estimatedReadingTimeMinutes: Math.ceil(words.length / 200), // 200 WPM average
        complexity: this.calculateTextComplexity(content),
        readabilityScore: this.calculateReadabilityScore(content)
      };

    } catch (error) {
      metadata.metadataExtractionError = error instanceof Error ? error.message : 'Unknown error';
    }

    return metadata;
  }

  /**
   * Basic language detection
   */
  private detectLanguage(content: string): string {
    const sample = content.toLowerCase().substring(0, 1000);

    // Common English words
    const englishWords = ['the', 'and', 'of', 'to', 'a', 'in', 'for', 'is', 'on', 'that', 'by', 'this', 'with', 'from', 'they', 'we', 'you', 'or', 'an', 'be'];
    const englishCount = englishWords.filter(word => sample.includes(` ${word} `)).length;

    // Common Spanish words
    const spanishWords = ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al'];
    const spanishCount = spanishWords.filter(word => sample.includes(` ${word} `)).length;

    // Common French words
    const frenchWords = ['le', 'de', 'et', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour', 'dans', 'ce', 'son', 'une', 'sur', 'avec', 'ne', 'se', 'pas'];
    const frenchCount = frenchWords.filter(word => sample.includes(` ${word} `)).length;

    if (englishCount >= spanishCount && englishCount >= frenchCount) {
      return 'en';
    } else if (spanishCount >= frenchCount) {
      return 'es';
    } else if (frenchCount > 0) {
      return 'fr';
    }

    return 'unknown';
  }

  /**
   * Detect content type from filename and content
   */
  private detectContentType(filename: string, content: string): string {
    const lowerFilename = filename.toLowerCase();
    const lowerContent = content.toLowerCase();

    if (lowerFilename.includes('readme') || lowerContent.includes('readme')) {
      return 'readme';
    }

    if (lowerFilename.includes('license') || lowerContent.includes('license')) {
      return 'license';
    }

    if (lowerFilename.includes('changelog') || lowerContent.includes('changelog')) {
      return 'changelog';
    }

    if (lowerContent.includes('script') || lowerContent.includes('screenplay')) {
      return 'script';
    }

    if (lowerContent.includes('treatment') || lowerContent.includes('logline')) {
      return 'treatment';
    }

    if (lowerContent.includes('synopsis') || lowerContent.includes('summary')) {
      return 'synopsis';
    }

    return 'text';
  }

  /**
   * Calculate basic text complexity
   */
  private calculateTextComplexity(content: string): number {
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length === 0) return 0;

    const avgWordsPerSentence = words.length / sentences.length;
    const avgCharsPerWord = content.replace(/\s+/g, '').length / words.length;

    // Simple complexity score (0-10)
    return Math.min(10, Math.round((avgWordsPerSentence / 20 + avgCharsPerWord / 5) * 3));
  }

  /**
   * Calculate basic readability score
   */
  private calculateReadabilityScore(content: string): number {
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0);

    if (sentences.length === 0 || words.length === 0) return 0;

    // Simplified Flesch Reading Ease Score
    const score = 206.835 - (1.015 * (words.length / sentences.length)) - (84.6 * (syllables / words.length));

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Count syllables in a word (basic approximation)
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    const vowels = 'aeiouy';
    let count = 0;
    let previousWasVowel = false;

    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }

    // Handle silent 'e'
    if (word.endsWith('e')) {
      count--;
    }

    return Math.max(1, count);
  }
}