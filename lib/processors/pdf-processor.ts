/**
 * PDF Processor - Handles PDF file processing with OCR fallback
 *
 * Uses pdf-parse for text extraction and falls back to OCR for image-based PDFs.
 */

import pdfParse from 'pdf-parse';
import { BaseProcessor } from './base';
import {
  SupportedFileType,
  ProcessorConfig,
  ProcessingResult,
  ValidationResult,
  SecurityValidation
} from './types';
import { IngestionProgressCallback, IngestionWarning } from '@/lib/ingestion/types';

// PDF.js types for OCR fallback
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface PDFDocument {
  numPages: number;
  getPage: (pageNum: number) => Promise<PDFPage>;
}

interface PDFPage {
  getViewport: (options: { scale: number }) => PDFViewport;
  render: (context: { canvasContext: unknown; viewport: PDFViewport }) => { promise: Promise<void> };
}

interface PDFViewport {
  width: number;
  height: number;
}

interface NodeCanvas {
  getContext(contextId: '2d'): NodeCanvasRenderingContext2D;
  toBuffer(mimeType?: string): Buffer;
  width: number;
  height: number;
}

interface NodeCanvasRenderingContext2D {
  canvas: NodeCanvas;
}

/**
 * PDF processor implementation
 */
export class PdfProcessor extends BaseProcessor {
  readonly name = 'PdfProcessor';
  readonly supportedTypes = [SupportedFileType.PDF];
  readonly defaultConfig: ProcessorConfig = {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    timeout: 300000, // 5 minutes
    enableOCR: true,
    ocrLanguage: 'eng',
    extractMetadata: true,
    custom: {
      ocrScale: 2.0,
      ocrQuality: 'high',
      enablePasswordDetection: true
    }
  };

  /**
   * Enhanced validation for PDF files
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

    // PDF-specific validation
    try {
      // Check PDF header
      const header = buffer.subarray(0, 8).toString('ascii');
      if (!header.startsWith('%PDF-')) {
        result.isValid = false;
        result.errors.push('File does not appear to be a valid PDF (invalid header)');
        return result;
      }

      // Try to parse basic PDF info to detect corruption
      const pdfInfo = await pdfParse(buffer, { max: 1 }); // Parse just one page for validation

      if (!pdfInfo.numpages || pdfInfo.numpages === 0) {
        result.warnings.push('PDF appears to have no pages');
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(`PDF validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Enhanced security validation for PDF files
   */
  async validateSecurity(
    filename: string,
    buffer: Buffer,
    config?: ProcessorConfig
  ): Promise<SecurityValidation> {
    const baseValidation = await super.validateSecurity(filename, buffer, config);

    try {
      // PDF-specific security checks
      const content = buffer.toString('ascii', 0, Math.min(buffer.length, 10000));

      // Check for JavaScript in PDF
      if (content.includes('/JavaScript') || content.includes('/JS')) {
        baseValidation.threats.push('PDF contains JavaScript content');
        baseValidation.riskLevel = 'high';
        baseValidation.isSecure = false;
        baseValidation.recommendations.push('Review PDF JavaScript content before processing');
      }

      // Check for forms
      if (content.includes('/AcroForm') || content.includes('/XFA')) {
        baseValidation.threats.push('PDF contains interactive forms');
        baseValidation.riskLevel = baseValidation.riskLevel === 'high' ? 'high' : 'medium';
        baseValidation.recommendations.push('Be cautious with PDFs containing forms');
      }

      // Check for embedded files
      if (content.includes('/EmbeddedFile') || content.includes('/Filespec')) {
        baseValidation.threats.push('PDF contains embedded files');
        baseValidation.riskLevel = 'medium';
        baseValidation.recommendations.push('Scan embedded files separately');
      }

    } catch (error) {
      baseValidation.warnings?.push(`Security validation incomplete: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return baseValidation;
  }

  /**
   * Process PDF file
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
        currentStep: 'Parsing PDF',
        progress: 10,
        details: 'Loading PDF document'
      });

      // Process with timeout
      const pdfData = await this.withTimeout(
        pdfParse(buffer),
        mergedConfig.timeout || this.defaultConfig.timeout!,
        'PDF parsing'
      );

      progressCallback?.({
        currentStep: 'Extracting text',
        progress: 40,
        details: `Processing ${pdfData.numpages} pages`
      });

      let textContent = pdfData.text;

      // Check if we need OCR fallback
      const hasMinimalText = !textContent || textContent.trim().length < 50;
      if (hasMinimalText && mergedConfig.enableOCR) {
        warnings.push(this.createWarning(
          'empty_content',
          'No or minimal text extracted from PDF; attempting OCR fallback',
          'high',
          ['PDF may be image-only (scanned)', 'OCR will be attempted for text extraction']
        ));

        const ocrText = await this.performOCR(buffer, mergedConfig, progressCallback, warnings);
        if (ocrText && ocrText.trim().length > 0) {
          textContent = textContent.trim() ? `${textContent}\n\n${ocrText}` : ocrText;
          warnings.push(this.createWarning(
            'partial_extraction',
            'OCR fallback used to extract text from image-only PDF',
            'medium',
            ['Review OCR text for accuracy', 'Consider higher-resolution originals']
          ));
        }
      }

      // Check for password protection
      if (mergedConfig.custom?.enablePasswordDetection && this.detectPasswordProtection(textContent)) {
        warnings.push(this.createWarning(
          'password_protected',
          'PDF may be password-protected or have limited text content',
          'medium',
          ['Remove password protection from the PDF', 'Check if the PDF is primarily composed of images']
        ));
      }

      progressCallback?.({
        currentStep: 'Finalizing',
        progress: 90,
        details: 'Creating processing result'
      });

      const processingTime = Date.now() - startTime;
      const metadata = this.createMetadata(buffer, processingTime, textContent.length, {
        pageCount: pdfData.numpages,
        extractionMethod: hasMinimalText && mergedConfig.enableOCR ? 'pdf-parse + OCR' : 'pdf-parse',
        formatSpecific: {
          pdfInfo: pdfData.info,
          version: pdfData.version,
          hasText: !hasMinimalText,
          ocrUsed: hasMinimalText && mergedConfig.enableOCR
        }
      });

      progressCallback?.({
        currentStep: 'Complete',
        progress: 100,
        details: `Extracted text from ${pdfData.numpages} pages`
      });

      return {
        success: true,
        textContent,
        metadata,
        warnings,
        structuredContent: {
          type: 'pdf',
          pages: pdfData.numpages,
          info: pdfData.info,
          extractionMethod: metadata.extractionMethod
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
        error: `PDF processing failed: ${errorMessage}`
      };
    }
  }

  /**
   * Perform OCR on PDF using PDF.js and Tesseract
   */
  private async performOCR(
    buffer: Buffer,
    config: ProcessorConfig,
    progressCallback?: IngestionProgressCallback,
    warnings?: IngestionWarning[]
  ): Promise<string> {
    // Only run OCR in server environment
    if (typeof window !== 'undefined') {
      warnings?.push(this.createWarning(
        'format_compatibility',
        'OCR processing is only available on server environment',
        'high',
        ['File processing should occur on the server side']
      ));
      return '';
    }

    try {
      // Dynamic imports for server-only dependencies
      const pdfjsLib = await this.loadPdfjsLibrary();
      const { createCanvas } = await import('canvas') as {
        createCanvas: (width: number, height: number) => NodeCanvas;
      };
      const Tesseract = await import('tesseract.js') as {
        recognize: (image: Buffer, lang: string) => Promise<{ data: { text: string } }>;
      };

      const loadingTask = pdfjsLib.getDocument({
        data: buffer,
        isEvalSupported: false,
        useSystemFonts: false
      });
      const pdf = await loadingTask.promise;

      let ocrText = '';
      const totalPages = pdf.numPages || 0;
      const scale = (config.custom?.ocrScale as number) || 2.0;
      const language = config.ocrLanguage || 'eng';

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        progressCallback?.({
          currentStep: `OCR: rendering page ${pageNum}/${totalPages}`,
          progress: Math.min(60 + Math.floor((pageNum - 1) / Math.max(1, totalPages) * 30), 95),
          details: 'Rendering page to image for OCR'
        });

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error(`Failed to create canvas context for page ${pageNum}`);
        }

        await page.render({
          canvasContext: ctx as unknown,
          viewport
        }).promise;

        const imgBuffer = canvas.toBuffer('image/png');

        progressCallback?.({
          currentStep: `OCR: recognizing page ${pageNum}/${totalPages}`,
          progress: Math.min(65 + Math.floor((pageNum - 1) / Math.max(1, totalPages) * 30), 98),
          details: 'Running Tesseract OCR'
        });

        const result = await Tesseract.recognize(imgBuffer, language);
        const pageText = result?.data?.text || '';

        if (!pageText.trim()) {
          warnings?.push(this.createWarning(
            'partial_extraction',
            `OCR produced little/no text for page ${pageNum}`,
            'low',
            ['Try increasing image resolution or contrast', 'Ensure the PDF page contains legible text']
          ));
        }

        ocrText += `\n\n--- OCR Page ${pageNum} ---\n${pageText.trim()}`;
      }

      return ocrText.trim();

    } catch (_error) {
      warnings?.push(this.createWarning(
        'format_compatibility',
        'OCR fallback failed while processing PDF pages',
        'medium',
        [
          'Verify OCR dependencies (pdfjs-dist, canvas, tesseract.js) are installed',
          'Try a different PDF or export as images before upload'
        ]
      ));
      return '';
    }
  }

  /**
   * Load PDF.js library with proper configuration
   */
  private async loadPdfjsLibrary() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjs = await import('pdfjs-dist/build/pdf.min.mjs') as any;

    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = '';
    }

    try {
      pdfjs.setPDFNetworkStreamFactory?.(null);
    } catch {
      // Ignore errors
    }

    return pdfjs;
  }

  /**
   * Detect password protection indicators
   */
  private detectPasswordProtection(content: string): boolean {
    const indicators = [
      'password',
      'encrypted',
      'protected',
      'access denied'
    ];

    const lowerContent = content.toLowerCase();
    return indicators.some(indicator => lowerContent.includes(indicator)) && content.length < 100;
  }
}