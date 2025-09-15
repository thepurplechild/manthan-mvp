import { ProcessorIntegrationAdapter } from '@/lib/processors/integration';
import { ProcessorFactory } from '@/lib/processors/factory';
import { IngestionResult, IngestionOptions } from '@/lib/jobs/types';

// Mock the ProcessorFactory
jest.mock('@/lib/processors/factory');

describe('ProcessorIntegrationAdapter', () => {
  let adapter: ProcessorIntegrationAdapter;
  let mockFactory: jest.Mocked<ProcessorFactory>;

  beforeEach(() => {
    mockFactory = new ProcessorFactory() as jest.Mocked<ProcessorFactory>;
    adapter = new ProcessorIntegrationAdapter(mockFactory);
    jest.clearAllMocks();
  });

  describe('ingestFile', () => {
    const mockBuffer = Buffer.from('Test content for ingestion');
    const mockProgressCallback = jest.fn();

    beforeEach(() => {
      // Setup default mock responses
      mockFactory.processFile.mockResolvedValue({
        text: 'Extracted text content',
        metadata: {
          title: 'Test Document',
          pageCount: 1,
          wordCount: 4,
          language: 'en',
          author: 'Test Author',
          createdAt: new Date('2023-01-01'),
          modifiedAt: new Date('2023-01-02'),
          fileSize: mockBuffer.length,
          mimeType: 'text/plain',
          processingTime: 150,
          confidence: 0.95
        },
        structuredData: {
          headings: ['Introduction', 'Content'],
          tables: [],
          images: []
        },
        processingStats: {
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T10:00:01Z'),
          duration: 1000,
          peakMemoryUsage: 1024,
          cpuUsage: 0.25
        }
      });
    });

    it('should successfully ingest a text file', async () => {
      const result = await adapter.ingestFile(
        'test.txt',
        mockBuffer,
        'text/plain',
        {},
        mockProgressCallback
      );

      expect(result.success).toBe(true);
      expect(result.text).toBe('Extracted text content');
      expect(result.metadata.title).toBe('Test Document');
      expect(result.metadata.wordCount).toBe(4);
      expect(result.metadata.pageCount).toBe(1);

      expect(mockFactory.processFile).toHaveBeenCalledWith(
        'test.txt',
        mockBuffer,
        'text/plain',
        expect.any(Object),
        mockProgressCallback
      );
    });

    it('should handle PDF files with OCR', async () => {
      const pdfBuffer = Buffer.from('PDF content');

      const result = await adapter.ingestFile(
        'document.pdf',
        pdfBuffer,
        'application/pdf',
        { enableOCR: true },
        mockProgressCallback
      );

      expect(result.success).toBe(true);
      expect(mockFactory.processFile).toHaveBeenCalledWith(
        'document.pdf',
        pdfBuffer,
        'application/pdf',
        expect.objectContaining({
          enableOCR: true
        }),
        mockProgressCallback
      );
    });

    it('should handle Word documents', async () => {
      const docxBuffer = Buffer.from('DOCX content');

      const result = await adapter.ingestFile(
        'document.docx',
        docxBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        { preserveFormatting: true },
        mockProgressCallback
      );

      expect(result.success).toBe(true);
      expect(mockFactory.processFile).toHaveBeenCalledWith(
        'document.docx',
        docxBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        expect.objectContaining({
          preserveFormatting: true
        }),
        mockProgressCallback
      );
    });

    it('should apply default options when none provided', async () => {
      await adapter.ingestFile('test.txt', mockBuffer);

      expect(mockFactory.processFile).toHaveBeenCalledWith(
        'test.txt',
        mockBuffer,
        undefined,
        expect.objectContaining({
          timeout: 60000,
          maxFileSize: 50 * 1024 * 1024,
          enableOCR: false,
          preserveFormatting: true,
          extractMetadata: true,
          securityScan: true
        }),
        undefined
      );
    });

    it('should merge custom options with defaults', async () => {
      const customOptions: IngestionOptions = {
        enableOCR: true,
        timeout: 30000,
        preserveFormatting: false
      };

      await adapter.ingestFile('test.txt', mockBuffer, 'text/plain', customOptions);

      expect(mockFactory.processFile).toHaveBeenCalledWith(
        'test.txt',
        mockBuffer,
        'text/plain',
        expect.objectContaining({
          timeout: 30000,
          enableOCR: true,
          preserveFormatting: false,
          extractMetadata: true, // Should keep default
          securityScan: true // Should keep default
        }),
        undefined
      );
    });

    it('should handle processing errors gracefully', async () => {
      const processingError = new Error('Processing failed');
      mockFactory.processFile.mockRejectedValue(processingError);

      const result = await adapter.ingestFile('failing.txt', mockBuffer);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Processing failed');
      expect(result.text).toBe('');
      expect(result.metadata.title).toBe('failing.txt');
    });

    it('should handle timeout errors specifically', async () => {
      const timeoutError = new Error('Processing timeout');
      (timeoutError as any).type = 'timeout';
      mockFactory.processFile.mockRejectedValue(timeoutError);

      const result = await adapter.ingestFile('slow.txt', mockBuffer);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Processing timeout');
      expect(result.errorType).toBe('timeout');
    });

    it('should handle security violations', async () => {
      const securityError = new Error('Security threat detected');
      (securityError as any).type = 'security_violation';
      mockFactory.processFile.mockRejectedValue(securityError);

      const result = await adapter.ingestFile('malicious.txt', mockBuffer);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Security threat detected');
      expect(result.errorType).toBe('security_violation');
    });

    it('should pass progress callbacks correctly', async () => {
      const progressCallback = jest.fn();

      await adapter.ingestFile('test.txt', mockBuffer, 'text/plain', {}, progressCallback);

      expect(mockFactory.processFile).toHaveBeenCalledWith(
        'test.txt',
        mockBuffer,
        'text/plain',
        expect.any(Object),
        progressCallback
      );
    });

    it('should convert structured data correctly', async () => {
      mockFactory.processFile.mockResolvedValue({
        text: 'Content with structure',
        metadata: {
          title: 'Structured Document',
          pageCount: 2,
          wordCount: 100,
          language: 'en',
          author: 'Author',
          createdAt: new Date(),
          modifiedAt: new Date(),
          fileSize: 1024,
          mimeType: 'text/plain',
          processingTime: 200,
          confidence: 0.9
        },
        structuredData: {
          headings: [
            { level: 1, text: 'Chapter 1', page: 1 },
            { level: 2, text: 'Section 1.1', page: 1 }
          ],
          tables: [
            { page: 1, rows: 5, columns: 3 }
          ],
          images: [
            { page: 2, width: 800, height: 600 }
          ]
        },
        processingStats: {
          startTime: new Date(),
          endTime: new Date(),
          duration: 2000,
          peakMemoryUsage: 2048,
          cpuUsage: 0.4
        }
      });

      const result = await adapter.ingestFile('structured.txt', mockBuffer);

      expect(result.success).toBe(true);
      expect(result.structuredData).toBeDefined();
      expect(result.structuredData.headings).toHaveLength(2);
      expect(result.structuredData.tables).toHaveLength(1);
      expect(result.structuredData.images).toHaveLength(1);
    });

    it('should handle files without MIME type', async () => {
      await adapter.ingestFile('unknown', mockBuffer);

      expect(mockFactory.processFile).toHaveBeenCalledWith(
        'unknown',
        mockBuffer,
        undefined,
        expect.any(Object),
        undefined
      );
    });

    it('should respect file size limits', async () => {
      const largeBuffer = Buffer.alloc(100 * 1024 * 1024, 'x'); // 100MB

      const result = await adapter.ingestFile('large.txt', largeBuffer, 'text/plain', {
        maxFileSize: 50 * 1024 * 1024 // 50MB limit
      });

      // Should pass the limit to the processor factory
      expect(mockFactory.processFile).toHaveBeenCalledWith(
        'large.txt',
        largeBuffer,
        'text/plain',
        expect.objectContaining({
          maxFileSize: 50 * 1024 * 1024
        }),
        undefined
      );
    });
  });

  describe('configuration mapping', () => {
    it('should map ingestion options to processor config correctly', async () => {
      const options: IngestionOptions = {
        enableOCR: true,
        preserveFormatting: false,
        extractMetadata: false,
        timeout: 45000,
        maxFileSize: 25 * 1024 * 1024,
        securityScan: false
      };

      await adapter.ingestFile('test.txt', Buffer.from('test'), 'text/plain', options);

      expect(mockFactory.processFile).toHaveBeenCalledWith(
        'test.txt',
        expect.any(Buffer),
        'text/plain',
        {
          enableOCR: true,
          preserveFormatting: false,
          extractMetadata: false,
          timeout: 45000,
          maxFileSize: 25 * 1024 * 1024,
          securityScan: false
        },
        undefined
      );
    });
  });

  describe('result conversion', () => {
    it('should convert processing results to ingestion results', async () => {
      const processingResult = {
        text: 'Processed text',
        metadata: {
          title: 'Test',
          pageCount: 3,
          wordCount: 150,
          language: 'en',
          author: 'Test Author',
          createdAt: new Date('2023-01-01'),
          modifiedAt: new Date('2023-01-02'),
          fileSize: 1024,
          mimeType: 'application/pdf',
          processingTime: 300,
          confidence: 0.85
        },
        structuredData: {
          headings: [{ level: 1, text: 'Title', page: 1 }],
          tables: [],
          images: [{ page: 2, width: 400, height: 300 }]
        },
        processingStats: {
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T10:00:05Z'),
          duration: 5000,
          peakMemoryUsage: 4096,
          cpuUsage: 0.6
        }
      };

      mockFactory.processFile.mockResolvedValue(processingResult);

      const result = await adapter.ingestFile('test.pdf', Buffer.from('test'));

      expect(result).toEqual({
        success: true,
        text: 'Processed text',
        metadata: {
          title: 'Test',
          pageCount: 3,
          wordCount: 150,
          language: 'en',
          author: 'Test Author',
          createdAt: new Date('2023-01-01'),
          modifiedAt: new Date('2023-01-02'),
          fileSize: 1024,
          mimeType: 'application/pdf',
          processingTime: 300,
          confidence: 0.85
        },
        structuredData: {
          headings: [{ level: 1, text: 'Title', page: 1 }],
          tables: [],
          images: [{ page: 2, width: 400, height: 300 }]
        },
        processingStats: {
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T10:00:05Z'),
          duration: 5000,
          peakMemoryUsage: 4096,
          cpuUsage: 0.6
        }
      });
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalResult = {
        text: 'Minimal text',
        metadata: {
          title: 'Minimal',
          pageCount: 1,
          wordCount: 2,
          language: 'en',
          author: 'Unknown',
          createdAt: new Date(),
          modifiedAt: new Date(),
          fileSize: 12,
          mimeType: 'text/plain',
          processingTime: 50,
          confidence: 1.0
        },
        structuredData: {},
        processingStats: {
          startTime: new Date(),
          endTime: new Date(),
          duration: 50,
          peakMemoryUsage: 512,
          cpuUsage: 0.1
        }
      };

      mockFactory.processFile.mockResolvedValue(minimalResult);

      const result = await adapter.ingestFile('minimal.txt', Buffer.from('hi'));

      expect(result.success).toBe(true);
      expect(result.text).toBe('Minimal text');
      expect(result.structuredData).toEqual({});
    });
  });

  describe('backward compatibility', () => {
    it('should maintain compatibility with existing ingestion interface', async () => {
      // Test that the adapter maintains the same interface as the original ingestion system
      const result = await adapter.ingestFile(
        'compat.txt',
        Buffer.from('compatibility test'),
        'text/plain'
      );

      // Check that result has all expected properties
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('metadata.title');
      expect(result).toHaveProperty('metadata.pageCount');
      expect(result).toHaveProperty('metadata.wordCount');
      expect(result).toHaveProperty('metadata.language');

      // Verify types are compatible with IngestionResult
      const ingestionResult: IngestionResult = result;
      expect(ingestionResult).toBeDefined();
    });
  });
});