import { ProcessorFactory } from '@/lib/processors/factory';
import { PdfProcessor } from '@/lib/processors/pdf-processor';
import { DocxProcessor } from '@/lib/processors/docx-processor';
import { TxtProcessor } from '@/lib/processors/txt-processor';
import { ImageProcessor } from '@/lib/processors/image-processor';
import { SupportedFileType } from '@/lib/processors/types';

// Mock the actual processors to avoid external dependencies
jest.mock('@/lib/processors/pdf-processor');
jest.mock('@/lib/processors/docx-processor');
jest.mock('@/lib/processors/txt-processor');
jest.mock('@/lib/processors/image-processor');

describe('ProcessorFactory', () => {
  let factory: ProcessorFactory;

  beforeEach(() => {
    factory = new ProcessorFactory();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should register default processors', () => {
      expect(factory.getRegisteredProcessors()).toContain('pdf');
      expect(factory.getRegisteredProcessors()).toContain('docx');
      expect(factory.getRegisteredProcessors()).toContain('txt');
      expect(factory.getRegisteredProcessors()).toContain('image');
    });

    it('should have correct processor count', () => {
      expect(factory.getRegisteredProcessors()).toHaveLength(4);
    });
  });

  describe('detectFileType', () => {
    it('should detect PDF files by extension', () => {
      const result = factory.detectFileType('document.pdf');

      expect(result.fileType).toBe(SupportedFileType.PDF);
      expect(result.confidence).toBe('high');
      expect(result.detectionMethod).toBe('extension');
    });

    it('should detect DOCX files by extension', () => {
      const result = factory.detectFileType('document.docx');

      expect(result.fileType).toBe(SupportedFileType.DOCX);
      expect(result.confidence).toBe('high');
      expect(result.detectionMethod).toBe('extension');
    });

    it('should detect text files by extension', () => {
      const result = factory.detectFileType('document.txt');

      expect(result.fileType).toBe(SupportedFileType.TXT);
      expect(result.confidence).toBe('high');
      expect(result.detectionMethod).toBe('extension');
    });

    it('should detect image files by extension', () => {
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'];

      imageExtensions.forEach(ext => {
        const result = factory.detectFileType(`image.${ext}`);
        expect(result.fileType).toBe(SupportedFileType.IMAGE);
        expect(result.confidence).toBe('high');
        expect(result.detectionMethod).toBe('extension');
      });
    });

    it('should detect by MIME type when extension is unclear', () => {
      const result = factory.detectFileType('document', 'application/pdf');

      expect(result.fileType).toBe(SupportedFileType.PDF);
      expect(result.confidence).toBe('medium');
      expect(result.detectionMethod).toBe('mime_type');
    });

    it('should prioritize extension over MIME type', () => {
      const result = factory.detectFileType('document.pdf', 'text/plain');

      expect(result.fileType).toBe(SupportedFileType.PDF);
      expect(result.confidence).toBe('high');
      expect(result.detectionMethod).toBe('extension');
    });

    it('should return null for unsupported files', () => {
      const result = factory.detectFileType('document.xyz');

      expect(result.fileType).toBeNull();
      expect(result.confidence).toBe('low');
      expect(result.detectionMethod).toBe('fallback');
    });

    it('should be case insensitive', () => {
      const result = factory.detectFileType('DOCUMENT.PDF');

      expect(result.fileType).toBe(SupportedFileType.PDF);
      expect(result.confidence).toBe('high');
    });
  });

  describe('getProcessor', () => {
    it('should return correct processor for PDF files', () => {
      const processor = factory.getProcessor(SupportedFileType.PDF);
      expect(processor).toBeInstanceOf(PdfProcessor);
    });

    it('should return correct processor for DOCX files', () => {
      const processor = factory.getProcessor(SupportedFileType.DOCX);
      expect(processor).toBeInstanceOf(DocxProcessor);
    });

    it('should return correct processor for text files', () => {
      const processor = factory.getProcessor(SupportedFileType.TXT);
      expect(processor).toBeInstanceOf(TxtProcessor);
    });

    it('should return correct processor for image files', () => {
      const processor = factory.getProcessor(SupportedFileType.IMAGE);
      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    it('should throw error for unsupported file type', () => {
      expect(() => {
        factory.getProcessor('unsupported' as SupportedFileType);
      }).toThrow('No processor found for file type: unsupported');
    });
  });

  describe('processFile', () => {
    const mockBuffer = Buffer.from('test content');
    const mockProgressCallback = jest.fn();

    beforeEach(() => {
      // Mock processor methods
      const mockProcess = jest.fn().mockResolvedValue({
        text: 'processed content',
        metadata: { title: 'test' },
        structuredData: {},
        processingStats: { duration: 100 }
      });

      (PdfProcessor as jest.MockedClass<typeof PdfProcessor>).prototype.process = mockProcess;
      (DocxProcessor as jest.MockedClass<typeof DocxProcessor>).prototype.process = mockProcess;
      (TxtProcessor as jest.MockedClass<typeof TxtProcessor>).prototype.process = mockProcess;
      (ImageProcessor as jest.MockedClass<typeof ImageProcessor>).prototype.process = mockProcess;
    });

    it('should process PDF file successfully', async () => {
      const result = await factory.processFile(
        'test.pdf',
        mockBuffer,
        'application/pdf',
        undefined,
        mockProgressCallback
      );

      expect(result.text).toBe('processed content');
      expect(result.metadata.title).toBe('test');
    });

    it('should process file with auto-detected type', async () => {
      const result = await factory.processFile(
        'test.txt',
        mockBuffer,
        undefined,
        undefined,
        mockProgressCallback
      );

      expect(result.text).toBe('processed content');
    });

    it('should throw error for unsupported file type', async () => {
      await expect(
        factory.processFile('test.xyz', mockBuffer)
      ).rejects.toThrow('Unsupported file type');
    });

    it('should pass progress callback to processor', async () => {
      await factory.processFile(
        'test.pdf',
        mockBuffer,
        'application/pdf',
        undefined,
        mockProgressCallback
      );

      const mockProcessor = (PdfProcessor as jest.MockedClass<typeof PdfProcessor>).prototype;
      expect(mockProcessor.process).toHaveBeenCalledWith(
        'test.pdf',
        mockBuffer,
        undefined,
        mockProgressCallback
      );
    });
  });

  describe('processBatch', () => {
    const mockFiles = [
      { filename: 'test1.pdf', buffer: Buffer.from('content1'), mimeType: 'application/pdf' },
      { filename: 'test2.txt', buffer: Buffer.from('content2'), mimeType: 'text/plain' },
      { filename: 'test3.docx', buffer: Buffer.from('content3'), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    ];

    beforeEach(() => {
      // Mock processor methods
      const mockProcess = jest.fn().mockResolvedValue({
        text: 'processed content',
        metadata: { title: 'test' },
        structuredData: {},
        processingStats: { duration: 100 }
      });

      (PdfProcessor as jest.MockedClass<typeof PdfProcessor>).prototype.process = mockProcess;
      (DocxProcessor as jest.MockedClass<typeof DocxProcessor>).prototype.process = mockProcess;
      (TxtProcessor as jest.MockedClass<typeof TxtProcessor>).prototype.process = mockProcess;
    });

    it('should process multiple files successfully', async () => {
      const results = await factory.processBatch(mockFiles);

      expect(results).toHaveLength(3);
      expect(results[0].filename).toBe('test1.pdf');
      expect(results[1].filename).toBe('test2.txt');
      expect(results[2].filename).toBe('test3.docx');

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.result?.text).toBe('processed content');
      });
    });

    it('should handle processing errors gracefully', async () => {
      // Mock one processor to throw an error
      (PdfProcessor as jest.MockedClass<typeof PdfProcessor>).prototype.process = jest.fn()
        .mockRejectedValue(new Error('Processing failed'));

      const results = await factory.processBatch(mockFiles);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Processing failed');
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
    });

    it('should call progress callback for batch processing', async () => {
      const progressCallback = jest.fn();

      await factory.processBatch(mockFiles, undefined, progressCallback);

      expect(progressCallback).toHaveBeenCalledWith({
        percentage: expect.any(Number),
        status: expect.stringContaining('Processing'),
        bytesProcessed: expect.any(Number),
        totalBytes: expect.any(Number)
      });
    });
  });

  describe('registerProcessor', () => {
    const mockCustomProcessor = {
      name: 'CustomProcessor',
      supportedTypes: [SupportedFileType.TXT],
      canProcess: jest.fn().mockReturnValue(true),
      process: jest.fn()
    };

    it('should register custom processor successfully', () => {
      factory.registerProcessor('custom', mockCustomProcessor as any);

      expect(factory.getRegisteredProcessors()).toContain('custom');
    });

    it('should throw error when registering duplicate processor', () => {
      factory.registerProcessor('custom', mockCustomProcessor as any);

      expect(() => {
        factory.registerProcessor('custom', mockCustomProcessor as any);
      }).toThrow('Processor with name custom is already registered');
    });
  });

  describe('unregisterProcessor', () => {
    it('should unregister processor successfully', () => {
      factory.unregisterProcessor('pdf');

      expect(factory.getRegisteredProcessors()).not.toContain('pdf');
    });

    it('should throw error when unregistering non-existent processor', () => {
      expect(() => {
        factory.unregisterProcessor('nonexistent');
      }).toThrow('Processor with name nonexistent is not registered');
    });
  });
});