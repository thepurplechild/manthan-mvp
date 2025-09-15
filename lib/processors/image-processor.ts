/**
 * Image Processor - Handles image file processing with metadata extraction and OCR
 *
 * Uses sharp for image processing and metadata extraction, with optional OCR capability.
 */

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
 * Image processor implementation
 */
export class ImageProcessor extends BaseProcessor {
  readonly name = 'ImageProcessor';
  readonly supportedTypes = [
    SupportedFileType.PNG,
    SupportedFileType.JPG,
    SupportedFileType.JPEG,
    SupportedFileType.GIF,
    SupportedFileType.WEBP
  ];
  readonly defaultConfig: ProcessorConfig = {
    maxFileSize: 20 * 1024 * 1024, // 20MB
    timeout: 120000, // 2 minutes
    enableOCR: true,
    ocrLanguage: 'eng',
    extractMetadata: true,
    custom: {
      extractEXIF: true,
      generateThumbnail: false,
      thumbnailSize: 200,
      ocrPreprocessing: true,
      colorAnalysis: true,
      detectObjects: false
    }
  };

  /**
   * Enhanced validation for image files
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

    // Image-specific validation
    try {
      const sharp = await import('sharp');

      // Try to read image metadata to validate format
      const metadata = await sharp.default(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        result.isValid = false;
        result.errors.push('Image appears to be corrupted or invalid (no dimensions)');
        return result;
      }

      // Check for reasonable dimensions
      if (metadata.width > 50000 || metadata.height > 50000) {
        result.warnings.push('Image has very large dimensions, processing may be slow');
      }

      // Check for very small images
      if (metadata.width < 10 || metadata.height < 10) {
        result.warnings.push('Image has very small dimensions, may not contain useful content');
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Image validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Enhanced security validation for image files
   */
  async validateSecurity(
    filename: string,
    buffer: Buffer,
    config?: ProcessorConfig
  ): Promise<SecurityValidation> {
    const baseValidation = await super.validateSecurity(filename, buffer, config);

    try {
      // Image-specific security checks
      const sharp = await import('sharp');
      const metadata = await sharp.default(buffer).metadata();

      // Check for suspicious metadata
      if (metadata.exif) {
        const exifBuffer = metadata.exif;
        const exifString = exifBuffer.toString('ascii', 0, Math.min(exifBuffer.length, 1000));

        // Check for script injections in EXIF
        if (exifString.includes('<script') || exifString.includes('javascript:')) {
          baseValidation.threats.push('Suspicious script content detected in image metadata');
          baseValidation.riskLevel = 'high';
          baseValidation.isSecure = false;
        }
      }

      // Check for unreasonable file size vs dimensions ratio
      if (metadata.width && metadata.height) {
        const expectedSize = metadata.width * metadata.height * 3; // Rough estimate
        const actualSize = buffer.length;

        if (actualSize > expectedSize * 10) {
          baseValidation.threats.push('Image file size is unusually large for its dimensions');
          baseValidation.riskLevel = 'medium';
          baseValidation.recommendations.push('Image may contain hidden data or be specially crafted');
        }
      }

    } catch (error) {
      baseValidation.warnings?.push(`Image security validation incomplete: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return baseValidation;
  }

  /**
   * Process image file
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
        currentStep: 'Loading image',
        progress: 10,
        details: 'Reading image data and metadata'
      });

      const sharp = await import('sharp');
      const image = sharp.default(buffer);

      // Extract basic metadata
      const metadata = await image.metadata();

      progressCallback?.({
        currentStep: 'Extracting metadata',
        progress: 30,
        details: 'Analyzing image properties'
      });

      // Extract comprehensive metadata
      const imageMetadata = await this.extractImageMetadata(
        image,
        metadata,
        buffer,
        mergedConfig,
        warnings
      );

      progressCallback?.({
        currentStep: 'Analyzing content',
        progress: 50,
        details: 'Performing image analysis'
      });

      // Perform OCR if enabled
      let textContent = '';
      if (mergedConfig.enableOCR) {
        textContent = await this.performImageOCR(
          buffer,
          image,
          mergedConfig,
          progressCallback,
          warnings
        );
      }

      progressCallback?.({
        currentStep: 'Finalizing',
        progress: 90,
        details: 'Creating processing result'
      });

      const processingTime = Date.now() - startTime;
      const processedMetadata = this.createMetadata(buffer, processingTime, textContent.length, {
        dimensions: {
          width: metadata.width || 0,
          height: metadata.height || 0
        },
        extractionMethod: mergedConfig.enableOCR ? 'metadata + OCR' : 'metadata only',
        formatSpecific: imageMetadata
      });

      progressCallback?.({
        currentStep: 'Complete',
        progress: 100,
        details: `Processed ${metadata.width}x${metadata.height} image${textContent ? ' with OCR' : ''}`
      });

      return {
        success: true,
        textContent,
        metadata: processedMetadata,
        warnings,
        structuredContent: {
          type: 'image',
          dimensions: {
            width: metadata.width,
            height: metadata.height
          },
          format: metadata.format,
          metadata: imageMetadata,
          hasText: textContent.length > 0
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
        error: `Image processing failed: ${errorMessage}`
      };
    }
  }

  /**
   * Extract comprehensive image metadata
   */
  private async extractImageMetadata(
    image: unknown, // sharp instance
    basicMetadata: unknown,
    buffer: Buffer,
    config: ProcessorConfig,
    warnings: IngestionWarning[]
  ): Promise<Record<string, unknown>> {
    const metadata: Record<string, unknown> = {};

    try {
      // Basic image properties
      metadata.format = basicMetadata.format;
      metadata.width = basicMetadata.width;
      metadata.height = basicMetadata.height;
      metadata.channels = basicMetadata.channels;
      metadata.depth = basicMetadata.depth;
      metadata.density = basicMetadata.density;
      metadata.hasAlpha = basicMetadata.hasAlpha;
      metadata.hasProfile = basicMetadata.hasProfile;

      // Calculate aspect ratio
      if (basicMetadata.width && basicMetadata.height) {
        metadata.aspectRatio = Math.round((basicMetadata.width / basicMetadata.height) * 100) / 100;
        metadata.megapixels = Math.round((basicMetadata.width * basicMetadata.height) / 1000000 * 100) / 100;
      }

      // Extract EXIF data if enabled
      if (config.custom?.extractEXIF && basicMetadata.exif) {
        try {
          metadata.exif = await this.parseEXIFData(basicMetadata.exif);
        } catch {
          warnings.push(this.createWarning(
            'partial_extraction',
            'Could not parse EXIF data',
            'low',
            ['EXIF data may be corrupted or in unsupported format']
          ));
        }
      }

      // Color analysis if enabled
      if (config.custom?.colorAnalysis) {
        try {
          const stats = await image.stats();
          metadata.colorStats = {
            channels: stats.channels.map((channel: any) => ({
              min: channel.min,
              max: channel.max,
              mean: Math.round(channel.mean * 100) / 100,
              stdev: Math.round(channel.stdev * 100) / 100
            })),
            entropy: stats.entropy,
            sharpness: stats.sharpness
          };
        } catch (_error) {
          warnings.push(this.createWarning(
            'partial_extraction',
            'Could not perform color analysis',
            'low',
            ['Color analysis requires compatible image format']
          ));
        }
      }

      // Estimate image complexity
      metadata.complexity = this.estimateImageComplexity(basicMetadata, buffer.length);

      // Detect image type/purpose
      metadata.imageType = this.detectImageType(basicMetadata, buffer.length);

    } catch (error) {
      metadata.metadataExtractionError = error instanceof Error ? error.message : 'Unknown error';
    }

    return metadata;
  }

  /**
   * Parse EXIF data from buffer
   */
  private async parseEXIFData(exifBuffer: Buffer): Promise<Record<string, unknown>> {
    // Basic EXIF parsing - in a production environment, you might want to use
    // a dedicated EXIF library like 'exif-parser' or 'piexifjs'
    const exif: Record<string, unknown> = {};

    try {
      // Try to extract readable strings from EXIF data
      const exifString = exifBuffer.toString('ascii').replace(/[^\x20-\x7E]/g, '');

      // Look for camera make/model
      const makeMatch = exifString.match(/(?:Canon|Nikon|Sony|Apple|Samsung|Google|Olympus|Fuji|Panasonic|Leica)/i);
      if (makeMatch) {
        exif.cameraMake = makeMatch[0];
      }

      // Look for software
      const softwareMatch = exifString.match(/(?:Photoshop|GIMP|Lightroom|Instagram|VSCO)/i);
      if (softwareMatch) {
        exif.software = softwareMatch[0];
      }

      // Extract basic info
      exif.hasExifData = true;
      exif.exifSize = exifBuffer.length;

    } catch (error) {
      exif.parseError = error instanceof Error ? error.message : 'Unknown error';
    }

    return exif;
  }

  /**
   * Perform OCR on image
   */
  private async performImageOCR(
    buffer: Buffer,
    image: any, // sharp instance
    config: ProcessorConfig,
    progressCallback?: IngestionProgressCallback,
    warnings?: IngestionWarning[]
  ): Promise<string> {
    try {
      progressCallback?.({
        currentStep: 'OCR: preprocessing image',
        progress: 60,
        details: 'Optimizing image for text recognition'
      });

      // Preprocess image for better OCR results if enabled
      let processedBuffer = buffer;
      if (config.custom?.ocrPreprocessing) {
        try {
          // Enhance image for OCR: convert to grayscale, increase contrast
          processedBuffer = await image
            .grayscale()
            .normalize()
            .sharpen()
            .png()
            .toBuffer();
        } catch (_error) {
          warnings?.push(this.createWarning(
            'partial_extraction',
            'Image preprocessing for OCR failed, using original image',
            'low',
            ['OCR may be less accurate without preprocessing']
          ));
        }
      }

      progressCallback?.({
        currentStep: 'OCR: recognizing text',
        progress: 75,
        details: 'Running text recognition'
      });

      // Perform OCR using Tesseract
      const Tesseract = await import('tesseract.js') as {
        recognize: (image: Buffer, lang: string) => Promise<{ data: { text: string; confidence: number } }>;
      };

      const language = config.ocrLanguage || 'eng';
      const result = await Tesseract.recognize(processedBuffer, language);

      const extractedText = result?.data?.text || '';
      const confidence = result?.data?.confidence || 0;

      // Warn about low confidence
      if (confidence < 50 && extractedText.length > 0) {
        warnings?.push(this.createWarning(
          'partial_extraction',
          `OCR confidence is low (${confidence}%), text may be inaccurate`,
          'medium',
          ['Consider improving image quality', 'Verify extracted text accuracy']
        ));
      }

      // Filter out noise (very short or non-meaningful text)
      const cleanedText = this.cleanOCRText(extractedText);

      if (cleanedText.length === 0 && extractedText.length > 0) {
        warnings?.push(this.createWarning(
          'partial_extraction',
          'OCR detected characters but no meaningful text was extracted',
          'low',
          ['Image may contain non-text elements or low-quality text']
        ));
      }

      return cleanedText;

    } catch (_error) {
      warnings?.push(this.createWarning(
        'format_compatibility',
        'OCR processing failed',
        'medium',
        [
          'Verify OCR dependencies (tesseract.js) are installed',
          'Image may not contain readable text'
        ]
      ));
      return '';
    }
  }

  /**
   * Clean and validate OCR text output
   */
  private cleanOCRText(text: string): string {
    if (!text) return '';

    // Remove excessive whitespace and normalize line breaks
    const cleaned = text.replace(/\s+/g, ' ').trim();

    // Remove very short "words" that are likely noise
    const words = cleaned.split(' ').filter(word =>
      word.length > 1 || /[a-zA-Z0-9]/.test(word)
    );

    // Only return text if we have meaningful content
    if (words.length < 2) return '';

    // Check if text contains mostly meaningful characters
    const meaningfulChars = cleaned.replace(/[^a-zA-Z0-9\s.,!?;:()]/g, '').length;
    const totalChars = cleaned.length;

    if (meaningfulChars / totalChars < 0.5) return '';

    return words.join(' ');
  }

  /**
   * Estimate image complexity for processing hints
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private estimateImageComplexity(metadata: any, fileSize: number): string {
    const pixels = (metadata.width || 0) * (metadata.height || 0);
    const bytesPerPixel = pixels > 0 ? fileSize / pixels : 0;

    if (bytesPerPixel > 10) return 'high'; // Highly detailed or uncompressed
    if (bytesPerPixel > 3) return 'medium'; // Typical photos
    return 'low'; // Simple graphics or highly compressed
  }

  /**
   * Detect image type/purpose based on characteristics
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private detectImageType(metadata: any, fileSize: number): string {
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const aspectRatio = height > 0 ? width / height : 0;

    // Screenshot detection (common screen ratios)
    if ((aspectRatio > 1.6 && aspectRatio < 1.8) || // 16:9
        (aspectRatio > 1.3 && aspectRatio < 1.4) || // 4:3
        (aspectRatio > 1.7 && aspectRatio < 1.9)) { // 16:10
      return 'screenshot';
    }

    // Document scan detection (portrait orientation, high contrast expected)
    if (aspectRatio < 0.8 && width > 800) {
      return 'document';
    }

    // Photo detection (typical photo dimensions and file size)
    if (width > 1000 && height > 1000 && fileSize > 100000) {
      return 'photo';
    }

    // Icon/logo detection (small, square-ish)
    if (width < 512 && height < 512 && Math.abs(aspectRatio - 1) < 0.2) {
      return 'icon';
    }

    // Banner/header detection (wide aspect ratio)
    if (aspectRatio > 3) {
      return 'banner';
    }

    return 'image';
  }
}