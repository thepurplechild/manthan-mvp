/**
 * Test utilities for the file processing system
 */

import {
  ProcessingResult,
  ValidationResult,
  ProcessorConfig,
  SupportedFileType,
  IngestionProgressCallback
} from '@/lib/processors/types';

/**
 * Create a mock processing result
 */
export function createMockProcessingResult(overrides: Partial<ProcessingResult> = {}): ProcessingResult {
  return {
    text: 'Mock extracted text content',
    metadata: {
      title: 'Mock Document',
      pageCount: 1,
      wordCount: 4,
      language: 'en',
      author: 'Mock Author',
      createdAt: new Date('2023-01-01'),
      modifiedAt: new Date('2023-01-02'),
      fileSize: 1024,
      mimeType: 'text/plain',
      processingTime: 100,
      confidence: 0.95,
      ...overrides.metadata
    },
    structuredData: {
      headings: [],
      tables: [],
      images: [],
      ...overrides.structuredData
    },
    processingStats: {
      startTime: new Date('2023-01-01T10:00:00Z'),
      endTime: new Date('2023-01-01T10:00:01Z'),
      duration: 1000,
      peakMemoryUsage: 1024,
      cpuUsage: 0.25,
      ...overrides.processingStats
    },
    ...overrides
  };
}

/**
 * Create a mock validation result
 */
export function createMockValidationResult(
  isValid: boolean = true,
  errors: string[] = [],
  warnings: string[] = []
): ValidationResult {
  return {
    isValid,
    errors,
    warnings,
    metadata: {
      fileSize: 1024,
      detectedMimeType: 'text/plain',
      encoding: 'utf-8'
    }
  };
}

/**
 * Create a mock processor configuration
 */
export function createMockProcessorConfig(overrides: Partial<ProcessorConfig> = {}): ProcessorConfig {
  return {
    timeout: 30000,
    maxFileSize: 10 * 1024 * 1024,
    enableOCR: false,
    preserveFormatting: true,
    extractMetadata: true,
    securityScan: true,
    ...overrides
  };
}

/**
 * Create test buffers for different file types
 */
export const TestBuffers = {
  text: Buffer.from('This is a test text file with some content.'),

  pdf: Buffer.from('Mock PDF content for testing'),

  docx: Buffer.from('Mock DOCX content for testing'),

  image: Buffer.from('Mock image content for testing'),

  large: Buffer.alloc(50 * 1024 * 1024, 'x'), // 50MB

  empty: Buffer.alloc(0),

  malicious: Buffer.from('<script>alert("xss")</script>'),

  binary: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) // PNG header
};

/**
 * Mock progress callback for testing
 */
export function createMockProgressCallback(): jest.MockedFunction<IngestionProgressCallback> {
  return jest.fn((progress) => {
    // Validate progress structure
    expect(progress).toHaveProperty('percentage');
    expect(progress).toHaveProperty('status');
    expect(progress.percentage).toBeGreaterThanOrEqual(0);
    expect(progress.percentage).toBeLessThanOrEqual(100);
    expect(typeof progress.status).toBe('string');
  });
}

/**
 * Test data generators
 */
export const TestData = {
  /**
   * Generate test text with specified word count
   */
  generateText(wordCount: number): string {
    const words = ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'and', 'runs'];
    return Array.from({ length: wordCount }, (_, i) => words[i % words.length]).join(' ');
  },

  /**
   * Generate structured document content
   */
  generateStructuredContent(): string {
    return `
# Main Title

This is the introduction paragraph with important information.

## Section 1

Content for section one with some **bold text** and *italic text*.

### Subsection 1.1

More detailed content here.

## Section 2

Another section with different content.

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |

## Conclusion

Final thoughts and summary.
    `.trim();
  },

  /**
   * Generate content with security threats
   */
  generateMaliciousContent(): string {
    return `
<script>alert('XSS attack')</script>
SELECT * FROM users WHERE id = 1 OR 1=1;
rm -rf /
javascript:void(0)
    `.trim();
  },

  /**
   * Generate multilingual content
   */
  generateMultilingualContent(): string {
    return `
English: Hello world, this is a test document.
Spanish: Hola mundo, este es un documento de prueba.
French: Bonjour le monde, ceci est un document de test.
German: Hallo Welt, das ist ein Testdokument.
    `.trim();
  }
};

/**
 * File type helpers
 */
export const FileTypeHelpers = {
  /**
   * Get file extension for supported file type
   */
  getExtension(fileType: SupportedFileType): string {
    const extensions = {
      [SupportedFileType.PDF]: 'pdf',
      [SupportedFileType.DOCX]: 'docx',
      [SupportedFileType.TXT]: 'txt',
      [SupportedFileType.IMAGE]: 'jpg'
    };
    return extensions[fileType];
  },

  /**
   * Get MIME type for supported file type
   */
  getMimeType(fileType: SupportedFileType): string {
    const mimeTypes = {
      [SupportedFileType.PDF]: 'application/pdf',
      [SupportedFileType.DOCX]: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      [SupportedFileType.TXT]: 'text/plain',
      [SupportedFileType.IMAGE]: 'image/jpeg'
    };
    return mimeTypes[fileType];
  },

  /**
   * Generate filename for file type
   */
  generateFilename(fileType: SupportedFileType, baseName: string = 'test'): string {
    return `${baseName}.${this.getExtension(fileType)}`;
  }
};

/**
 * Async test helpers
 */
export const AsyncHelpers = {
  /**
   * Wait for specified milliseconds
   */
  wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Wait for condition to be true with timeout
   */
  waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 5000,
    intervalMs: number = 100
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = async () => {
        try {
          const result = await condition();
          if (result) {
            resolve();
            return;
          }
        } catch (error) {
          // Continue checking
        }

        if (Date.now() - startTime >= timeoutMs) {
          reject(new Error(`Condition not met within ${timeoutMs}ms`));
          return;
        }

        setTimeout(check, intervalMs);
      };

      check();
    });
  },

  /**
   * Test timeout functionality
   */
  expectTimeout(promise: Promise<any>, maxTime: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation should have timed out after ${maxTime}ms`));
      }, maxTime + 1000); // Give extra time for timeout to trigger

      promise
        .then(() => {
          clearTimeout(timeout);
          reject(new Error('Promise should have been rejected due to timeout'));
        })
        .catch((error) => {
          clearTimeout(timeout);
          if (error.message.toLowerCase().includes('timeout')) {
            resolve();
          } else {
            reject(error);
          }
        });
    });
  }
};

/**
 * Error testing helpers
 */
export const ErrorHelpers = {
  /**
   * Create a mock error with specific type
   */
  createTypedError(message: string, type: string, details?: string): Error {
    const error = new Error(message);
    (error as any).type = type;
    if (details) {
      (error as any).details = details;
    }
    return error;
  },

  /**
   * Test that an async function throws an error with specific message
   */
  async expectError(
    fn: () => Promise<any>,
    expectedMessage?: string | RegExp,
    expectedType?: string
  ): Promise<Error> {
    try {
      await fn();
      throw new Error('Expected function to throw an error');
    } catch (error) {
      if (!(error instanceof Error)) {
        throw new Error('Expected thrown value to be an Error instance');
      }

      if (expectedMessage) {
        if (typeof expectedMessage === 'string') {
          expect(error.message).toBe(expectedMessage);
        } else {
          expect(error.message).toMatch(expectedMessage);
        }
      }

      if (expectedType) {
        expect((error as any).type).toBe(expectedType);
      }

      return error;
    }
  }
};

/**
 * Performance testing helpers
 */
export const PerformanceHelpers = {
  /**
   * Measure execution time of a function
   */
  async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = process.hrtime.bigint();
    const result = await fn();
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

    return { result, duration };
  },

  /**
   * Test that operation completes within time limit
   */
  async expectWithinTime<T>(
    fn: () => Promise<T>,
    maxTimeMs: number,
    description?: string
  ): Promise<T> {
    const { result, duration } = await this.measureTime(fn);

    expect(duration).toBeLessThan(maxTimeMs);

    if (description) {
      console.log(`${description}: ${duration.toFixed(2)}ms`);
    }

    return result;
  },

  /**
   * Run performance benchmark
   */
  async benchmark<T>(
    fn: () => Promise<T>,
    iterations: number = 10,
    description?: string
  ): Promise<{ avg: number; min: number; max: number; results: T[] }> {
    const durations: number[] = [];
    const results: T[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, duration } = await this.measureTime(fn);
      durations.push(duration);
      results.push(result);
    }

    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    if (description) {
      console.log(`${description} benchmark (${iterations} iterations):`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);
      console.log(`  Min: ${min.toFixed(2)}ms`);
      console.log(`  Max: ${max.toFixed(2)}ms`);
    }

    return { avg, min, max, results };
  }
};