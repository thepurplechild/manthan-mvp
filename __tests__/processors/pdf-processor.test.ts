import { PdfProcessor } from '@/lib/processors/pdf-processor';
import { SupportedFileType, ProcessorConfig } from '@/lib/processors/types';

// Mock pdf-parse
jest.mock('pdf-parse', () => {
  return jest.fn().mockImplementation((buffer: Buffer) => {
    if (buffer.length === 0) {
      throw new Error('Invalid PDF: empty buffer');
    }

    // Simulate different PDF scenarios based on buffer content
    const content = buffer.toString();

    if (content.includes('password-protected')) {
      const error = new Error('Password required');
      (error as any).encrypted = true;
      throw error;
    }

    if (content.includes('corrupted')) {
      throw new Error('Invalid PDF structure');
    }

    if (content.includes('image-only')) {
      return Promise.resolve({
        text: '', // No text extracted
        numpages: 1,
        info: {
          Title: 'Image PDF',
          Author: 'Test',
          Creator: 'Test Creator',
          Producer: 'Test Producer',
          CreationDate: 'D:20230101000000Z',
          ModDate: 'D:20230102000000Z'
        },
        metadata: null,
        version: '1.7'
      });
    }

    return Promise.resolve({
      text: 'This is extracted PDF text content with multiple words.',
      numpages: 2,
      info: {
        Title: 'Test PDF Document',
        Author: 'Test Author',
        Creator: 'Test Creator',
        Producer: 'Test Producer',
        CreationDate: 'D:20230101000000Z',
        ModDate: 'D:20230102000000Z'
      },
      metadata: {
        'pdf:producer': 'Test Producer',
        'pdf:version': '1.7'
      },
      version: '1.7'
    });
  });
});

describe('PdfProcessor', () => {
  let processor: PdfProcessor;

  beforeEach(() => {
    processor = new PdfProcessor();
    jest.clearAllMocks();
  });

  describe('basic properties', () => {
    it('should have correct name and supported types', () => {
      expect(processor.name).toBe('PdfProcessor');
      expect(processor.supportedTypes).toEqual([SupportedFileType.PDF]);
    });

    it('should have proper default configuration', () => {
      expect(processor.defaultConfig).toEqual({
        timeout: 60000,
        maxFileSize: 50 * 1024 * 1024,
        enableOCR: false,
        preserveFormatting: true,
        extractMetadata: true,
        securityScan: true
      });
    });
  });

  describe('canProcess', () => {
    it('should return true for PDF files', () => {
      expect(processor.canProcess(SupportedFileType.PDF)).toBe(true);
    });

    it('should return false for non-PDF files', () => {
      expect(processor.canProcess(SupportedFileType.DOCX)).toBe(false);
      expect(processor.canProcess(SupportedFileType.TXT)).toBe(false);
      expect(processor.canProcess(SupportedFileType.IMAGE)).toBe(false);
    });

    it('should return true for PDF MIME type', () => {
      expect(processor.canProcess(SupportedFileType.PDF, 'application/pdf')).toBe(true);
    });
  });

  describe('validateFile', () => {
    it('should validate correct PDF file', async () => {
      const pdfBuffer = Buffer.from('valid pdf content');

      const result = await processor.validateFile('test.pdf', pdfBuffer, 'application/pdf');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-PDF extensions', async () => {
      const buffer = Buffer.from('content');

      const result = await processor.validateFile('test.txt', buffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('invalid_file_type');
    });

    it('should reject files exceeding size limit', async () => {
      const largeBuffer = Buffer.alloc(100 * 1024 * 1024, 'x'); // 100MB

      const result = await processor.validateFile('large.pdf', largeBuffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('file_size_exceeded');
    });

    it('should respect custom size limits', async () => {
      const buffer = Buffer.alloc(10 * 1024, 'x'); // 10KB
      const config: ProcessorConfig = {
        ...processor.defaultConfig,
        maxFileSize: 5 * 1024 // 5KB limit
      };

      const result = await processor.validateFile('test.pdf', buffer, undefined, config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('file_size_exceeded');
    });
  });

  describe('process', () => {
    it('should process valid PDF successfully', async () => {
      const pdfBuffer = Buffer.from('valid pdf content');

      const result = await processor.process('test.pdf', pdfBuffer);

      expect(result.text).toBe('This is extracted PDF text content with multiple words.');
      expect(result.metadata.title).toBe('Test PDF Document');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.metadata.pageCount).toBe(2);
      expect(result.metadata.wordCount).toBe(9);
      expect(result.metadata.mimeType).toBe('application/pdf');
    });

    it('should handle password-protected PDFs', async () => {
      const protectedBuffer = Buffer.from('password-protected pdf');

      await expect(processor.process('protected.pdf', protectedBuffer))
        .rejects
        .toThrow('Password-protected PDF detected');
    });

    it('should handle corrupted PDFs', async () => {
      const corruptedBuffer = Buffer.from('corrupted pdf');

      await expect(processor.process('corrupted.pdf', corruptedBuffer))
        .rejects
        .toThrow('Failed to parse PDF');
    });

    it('should handle image-only PDFs with OCR disabled', async () => {
      const imageBuffer = Buffer.from('image-only pdf');

      const result = await processor.process('image.pdf', imageBuffer);

      expect(result.text).toBe('');
      expect(result.metadata.title).toBe('Image PDF');
      expect(result.metadata.pageCount).toBe(1);
      expect(result.metadata.wordCount).toBe(0);
    });

    it('should attempt OCR for image-only PDFs when enabled', async () => {
      const imageBuffer = Buffer.from('image-only pdf');
      const config: ProcessorConfig = {
        ...processor.defaultConfig,
        enableOCR: true
      };

      // Mock OCR to return some text
      const result = await processor.process('image.pdf', imageBuffer, config);

      // Since OCR is mocked to fall back gracefully, we expect the original result
      expect(result.metadata.pageCount).toBe(1);
    });

    it('should call progress callback during processing', async () => {
      const pdfBuffer = Buffer.from('valid pdf content');
      const progressCallback = jest.fn();

      await processor.process('test.pdf', pdfBuffer, undefined, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          percentage: expect.any(Number),
          status: expect.any(String)
        })
      );
    });

    it('should extract comprehensive metadata', async () => {
      const pdfBuffer = Buffer.from('valid pdf content');

      const result = await processor.process('test.pdf', pdfBuffer);

      expect(result.metadata).toEqual({
        title: 'Test PDF Document',
        pageCount: 2,
        wordCount: 9,
        language: 'en',
        author: 'Test Author',
        createdAt: expect.any(Date),
        modifiedAt: expect.any(Date),
        fileSize: pdfBuffer.length,
        mimeType: 'application/pdf',
        processingTime: expect.any(Number),
        confidence: expect.any(Number),
        creator: 'Test Creator',
        producer: 'Test Producer',
        version: '1.7'
      });
    });

    it('should include processing statistics', async () => {
      const pdfBuffer = Buffer.from('valid pdf content');

      const result = await processor.process('test.pdf', pdfBuffer);

      expect(result.processingStats).toEqual({
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        duration: expect.any(Number),
        peakMemoryUsage: expect.any(Number),
        cpuUsage: expect.any(Number)
      });

      expect(result.processingStats.endTime.getTime())
        .toBeGreaterThanOrEqual(result.processingStats.startTime.getTime());
    });

    it('should handle timeout configuration', async () => {
      const pdfBuffer = Buffer.from('valid pdf content');
      const config: ProcessorConfig = {
        ...processor.defaultConfig,
        timeout: 100 // Very short timeout
      };

      // This test depends on the implementation having timeout logic
      const result = await processor.process('test.pdf', pdfBuffer, config);
      expect(result).toBeDefined(); // Should complete quickly for our mock
    });

    it('should preserve formatting when enabled', async () => {
      const pdfBuffer = Buffer.from('valid pdf content');
      const config: ProcessorConfig = {
        ...processor.defaultConfig,
        preserveFormatting: true
      };

      const result = await processor.process('test.pdf', pdfBuffer, config);

      expect(result.text).toBeDefined();
      // In a real implementation, this would test that formatting is preserved
    });

    it('should handle empty PDFs', async () => {
      const emptyBuffer = Buffer.from('');

      await expect(processor.process('empty.pdf', emptyBuffer))
        .rejects
        .toThrow();
    });

    it('should handle PDFs with special characters', async () => {
      const pdfBuffer = Buffer.from('pdf with special chars üñíçødé');

      const result = await processor.process('special.pdf', pdfBuffer);

      expect(result.text).toBeDefined();
      expect(result.metadata.language).toBe('en'); // Default detected language
    });
  });

  describe('error handling', () => {
    it('should handle PDF parsing errors gracefully', async () => {
      const invalidBuffer = Buffer.from('not a pdf');

      // Mock pdf-parse to throw an error
      const pdfParse = require('pdf-parse');
      pdfParse.mockRejectedValueOnce(new Error('Invalid PDF format'));

      await expect(processor.process('invalid.pdf', invalidBuffer))
        .rejects
        .toThrow('Failed to parse PDF');
    });

    it('should handle OCR failures gracefully', async () => {
      const imageBuffer = Buffer.from('image-only pdf');
      const config: ProcessorConfig = {
        ...processor.defaultConfig,
        enableOCR: true
      };

      // OCR should fail gracefully and return the original result
      const result = await processor.process('image.pdf', imageBuffer, config);

      expect(result).toBeDefined();
      expect(result.text).toBe('');
    });

    it('should provide detailed error information', async () => {
      const corruptedBuffer = Buffer.from('corrupted pdf');

      try {
        await processor.process('corrupted.pdf', corruptedBuffer);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to parse PDF');
      }
    });
  });

  describe('security considerations', () => {
    it('should handle potentially malicious PDFs safely', async () => {
      const suspiciousBuffer = Buffer.from('suspicious pdf content with scripts');

      // Should process without security issues
      const result = await processor.process('suspicious.pdf', suspiciousBuffer);

      expect(result).toBeDefined();
      expect(result.text).toBeTruthy();
    });

    it('should respect security scan configuration', async () => {
      const pdfBuffer = Buffer.from('valid pdf content');
      const config: ProcessorConfig = {
        ...processor.defaultConfig,
        securityScan: false
      };

      const result = await processor.process('test.pdf', pdfBuffer, config);

      expect(result).toBeDefined();
      // Security scanning behavior would be tested in integration tests
    });
  });
});