import { BaseProcessor } from '@/lib/processors/base';
import {
  SupportedFileType,
  ProcessorConfig,
  ValidationResult,
  ProcessingResult,
  IngestionErrorType,
  IngestionProgressCallback
} from '@/lib/processors/types';

class TestProcessor extends BaseProcessor {
  readonly name = 'TestProcessor';
  readonly supportedTypes = [SupportedFileType.TXT];
  readonly defaultConfig: ProcessorConfig = {
    timeout: 5000,
    maxFileSize: 1024 * 1024,
    enableOCR: false,
    preserveFormatting: true,
    extractMetadata: true,
    securityScan: true
  };

  canProcess(fileType: SupportedFileType): boolean {
    return this.supportedTypes.includes(fileType);
  }

  async validateFile(
    filename: string,
    buffer: Buffer,
    mimeType?: string,
    config?: ProcessorConfig
  ): Promise<ValidationResult> {
    return this.performValidation(filename, buffer, mimeType, config);
  }

  async process(
    filename: string,
    buffer: Buffer,
    config?: ProcessorConfig,
    progressCallback?: IngestionProgressCallback
  ): Promise<ProcessingResult> {
    await this.validateFile(filename, buffer, undefined, config);

    if (progressCallback) {
      progressCallback({
        percentage: 50,
        status: 'Processing file content',
        bytesProcessed: buffer.length / 2,
        totalBytes: buffer.length
      });
    }

    return {
      text: buffer.toString('utf-8'),
      metadata: {
        title: filename,
        pageCount: 1,
        wordCount: buffer.toString('utf-8').split(/\s+/).length,
        language: 'en',
        author: 'Unknown',
        createdAt: new Date(),
        modifiedAt: new Date(),
        fileSize: buffer.length,
        mimeType: 'text/plain',
        processingTime: 100,
        confidence: 1.0
      },
      structuredData: {},
      processingStats: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        peakMemoryUsage: 1024,
        cpuUsage: 0.1
      }
    };
  }
}

describe('BaseProcessor', () => {
  let processor: TestProcessor;
  let validBuffer: Buffer;
  let largeBuffer: Buffer;

  beforeEach(() => {
    processor = new TestProcessor();
    validBuffer = Buffer.from('This is test content');
    largeBuffer = Buffer.alloc(2 * 1024 * 1024, 'x'); // 2MB
  });

  describe('constructor', () => {
    it('should create processor with correct properties', () => {
      expect(processor.name).toBe('TestProcessor');
      expect(processor.supportedTypes).toEqual([SupportedFileType.TXT]);
      expect(processor.defaultConfig.timeout).toBe(5000);
    });
  });

  describe('canProcess', () => {
    it('should return true for supported file types', () => {
      expect(processor.canProcess(SupportedFileType.TXT)).toBe(true);
    });

    it('should return false for unsupported file types', () => {
      expect(processor.canProcess(SupportedFileType.PDF)).toBe(false);
    });
  });

  describe('validateFile', () => {
    it('should validate valid file successfully', async () => {
      const result = await processor.validateFile('test.txt', validBuffer);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject file exceeding size limit', async () => {
      const result = await processor.validateFile('large.txt', largeBuffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('file_size_exceeded');
    });

    it('should reject unsupported file extension', async () => {
      const result = await processor.validateFile('test.pdf', validBuffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('invalid_file_type');
    });

    it('should apply custom config', async () => {
      const customConfig: ProcessorConfig = {
        ...processor.defaultConfig,
        maxFileSize: 10 // Very small limit
      };

      const result = await processor.validateFile('test.txt', validBuffer, undefined, customConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('file_size_exceeded');
    });
  });

  describe('process', () => {
    it('should process valid file successfully', async () => {
      const result = await processor.process('test.txt', validBuffer);

      expect(result.text).toBe('This is test content');
      expect(result.metadata.title).toBe('test.txt');
      expect(result.metadata.wordCount).toBe(4);
      expect(result.metadata.fileSize).toBe(validBuffer.length);
    });

    it('should call progress callback during processing', async () => {
      const progressSpy = jest.fn();

      await processor.process('test.txt', validBuffer, undefined, progressSpy);

      expect(progressSpy).toHaveBeenCalledWith({
        percentage: 50,
        status: 'Processing file content',
        bytesProcessed: validBuffer.length / 2,
        totalBytes: validBuffer.length
      });
    });

    it('should throw error for invalid file', async () => {
      await expect(
        processor.process('large.txt', largeBuffer)
      ).rejects.toThrow();
    });

    it('should include processing stats', async () => {
      const result = await processor.process('test.txt', validBuffer);

      expect(result.processingStats).toBeDefined();
      expect(result.processingStats.startTime).toBeInstanceOf(Date);
      expect(result.processingStats.endTime).toBeInstanceOf(Date);
      expect(result.processingStats.duration).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should create error with correct type and message', () => {
      const error = (processor as any).createError(
        IngestionErrorType.PROCESSING_FAILED,
        'Test error message'
      );

      expect(error.message).toBe('Test error message');
      expect((error as any).type).toBe(IngestionErrorType.PROCESSING_FAILED);
    });

    it('should create error with details', () => {
      const error = (processor as any).createError(
        IngestionErrorType.CORRUPTED_FILE,
        'File is corrupted',
        'Additional details'
      );

      expect(error.message).toBe('File is corrupted');
      expect((error as any).type).toBe(IngestionErrorType.CORRUPTED_FILE);
      expect((error as any).details).toBe('Additional details');
    });
  });
});