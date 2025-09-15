/**
 * Modular File Processing System - Usage Examples
 *
 * Comprehensive examples demonstrating how to use the modular processor system.
 */

import {
  ProcessorFactory,
  createProcessorFactory,
  getDefaultProcessorFactory,
  PdfProcessor,
  DocxProcessor,
  TxtProcessor,
  ImageProcessor,
  SupportedFileType,
  ProcessorConfig
} from './index';
import { getConfigManager } from './config';
import { IngestionProgressCallback } from '@/lib/ingestion/types';

/**
 * Example 1: Basic file processing using the default factory
 */
export async function basicProcessingExample() {
  console.log('=== Basic Processing Example ===');

  // Get the default factory (comes pre-configured with all processors)
  const factory = getDefaultProcessorFactory();

  // Example file data (in practice, this would come from user upload)
  const filename = 'sample.pdf';
  const fileBuffer = Buffer.from('Sample file content'); // Replace with actual file buffer
  const mimeType = 'application/pdf';

  try {
    // Process the file
    const result = await factory.processFile(
      filename,
      fileBuffer,
      mimeType,
      undefined, // Use default config
      (progress) => {
        console.log(`Progress: ${progress.progress}% - ${progress.currentStep}`);
      }
    );

    if (result.success) {
      console.log('✅ Processing successful!');
      console.log(`📄 Extracted ${result.textContent.length} characters`);
      console.log(`⚙️ Used processor: ${result.processor}`);
      console.log(`⏱️ Processing time: ${result.metadata.processingTime}ms`);
    } else {
      console.log('❌ Processing failed:', result.error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 2: Custom processor configuration
 */
export async function customConfigExample() {
  console.log('=== Custom Configuration Example ===');

  const factory = getDefaultProcessorFactory();

  // Custom configuration for this processing job
  const customConfig: ProcessorConfig = {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    timeout: 120000, // 2 minutes
    enableOCR: true,
    ocrLanguage: 'eng',
    extractMetadata: true,
    custom: {
      // PDF-specific settings
      ocrScale: 2.0,
      enablePasswordDetection: true,
      // Image-specific settings
      extractEXIF: true,
      colorAnalysis: false
    }
  };

  const filename = 'document.pdf';
  const fileBuffer = Buffer.from('Sample content');

  try {
    const result = await factory.processFile(
      filename,
      fileBuffer,
      'application/pdf',
      customConfig
    );

    console.log('Processing completed with custom config');
    console.log('Metadata extracted:', result.metadata.formatSpecific);
  } catch (error) {
    console.error('Error with custom config:', error);
  }
}

/**
 * Example 3: Processing multiple files in batch
 */
export async function batchProcessingExample() {
  console.log('=== Batch Processing Example ===');

  const factory = getDefaultProcessorFactory();

  // Multiple files to process
  const files = [
    {
      filename: 'document1.pdf',
      buffer: Buffer.from('PDF content 1'),
      mimeType: 'application/pdf'
    },
    {
      filename: 'document2.docx',
      buffer: Buffer.from('DOCX content 2'),
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    },
    {
      filename: 'image.png',
      buffer: Buffer.from('PNG content'),
      mimeType: 'image/png'
    }
  ];

  try {
    const results = await factory.processFileBatch(
      files,
      undefined, // Use default config
      (progress, currentFile) => {
        console.log(`Batch progress: ${Math.round(progress)}% - ${currentFile}`);
      }
    );

    console.log(`✅ Processed ${results.length} files`);
    results.forEach((result, index) => {
      if (result.success) {
        console.log(`  📄 ${result.filename}: ${result.textContent.length} chars (${result.processor})`);
      } else {
        console.log(`  ❌ ${result.filename}: ${result.error}`);
      }
    });
  } catch (error) {
    console.error('Batch processing error:', error);
  }
}

/**
 * Example 4: Creating a custom factory with specific processors
 */
export async function customFactoryExample() {
  console.log('=== Custom Factory Example ===');

  // Create a factory with only specific processors
  const factory = createProcessorFactory({
    defaultConfig: {
      maxFileSize: 20 * 1024 * 1024, // 20MB limit
      timeout: 60000, // 1 minute timeout
      enableOCR: false, // Disable OCR for speed
      extractMetadata: true
    },
    enableSecurity: true
  });

  // Register only the processors we want
  factory.registerProcessor(new PdfProcessor(), 100);
  factory.registerProcessor(new TxtProcessor(), 90);

  // The factory now only supports PDF and TXT files
  console.log('Supported types:', factory.getSupportedFileTypes());

  const filename = 'test.txt';
  const fileBuffer = Buffer.from('This is a test text file content');

  try {
    const result = await factory.processFile(filename, fileBuffer);
    console.log('Custom factory result:', {
      success: result.success,
      processor: result.processor,
      contentLength: result.textContent.length
    });
  } catch (error) {
    console.error('Custom factory error:', error);
  }
}

/**
 * Example 5: File type detection and validation
 */
export async function fileDetectionExample() {
  console.log('=== File Detection Example ===');

  const factory = getDefaultProcessorFactory();

  // Test different file detection scenarios
  const testCases = [
    { filename: 'document.pdf', mimeType: 'application/pdf' },
    { filename: 'image.jpg', mimeType: 'image/jpeg' },
    { filename: 'unknown.xyz', mimeType: 'application/octet-stream' },
    { filename: 'README.txt', mimeType: undefined },
    { filename: 'presentation.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
  ];

  for (const testCase of testCases) {
    const detection = factory.detectFileType(testCase.filename, testCase.mimeType);
    console.log(`📁 ${testCase.filename}:`, {
      detected: detection.fileType,
      confidence: detection.confidence,
      method: detection.detectionMethod,
      supported: detection.fileType ? factory.isFileTypeSupported(detection.fileType) : false
    });
  }
}

/**
 * Example 6: Environment-specific configuration
 */
export async function environmentConfigExample() {
  console.log('=== Environment Configuration Example ===');

  const configManager = getConfigManager();

  // Get configuration summary
  const summary = configManager.getConfigSummary();
  console.log('Current environment:', summary.environment);
  console.log('Base config:', summary.baseConfig);

  // Get file-type specific configuration
  const pdfConfig = configManager.getConfigForFileType(SupportedFileType.PDF);
  console.log('PDF-specific config:', pdfConfig);

  // Get recommended configuration
  const recommended = configManager.getRecommendedConfig();
  console.log('Recommended config:', recommended.description);
  if (recommended.warnings.length > 0) {
    console.log('⚠️ Warnings:', recommended.warnings);
  }

  // Validate a custom configuration
  const customConfig: ProcessorConfig = {
    maxFileSize: -100, // Invalid
    timeout: 0, // Invalid
    enableOCR: true,
    extractMetadata: true
  };

  const validation = configManager.validateConfig(customConfig);
  console.log('Config validation:', {
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: validation.warnings
  });
}

/**
 * Example 7: Advanced processor usage with custom progress tracking
 */
export async function advancedProcessingExample() {
  console.log('=== Advanced Processing Example ===');

  const factory = getDefaultProcessorFactory();

  // Advanced progress callback with detailed logging
  const progressCallback: IngestionProgressCallback = (progress) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${progress.progress}% - ${progress.currentStep}: ${progress.details || 'Processing...'}`);
  };

  // Configuration optimized for high-quality processing
  const highQualityConfig: ProcessorConfig = {
    maxFileSize: 100 * 1024 * 1024,
    timeout: 600000, // 10 minutes for complex files
    enableOCR: true,
    ocrLanguage: 'eng',
    extractMetadata: true,
    custom: {
      // High-quality OCR settings
      ocrScale: 3.0,
      ocrQuality: 'high',
      ocrPreprocessing: true,

      // Comprehensive metadata extraction
      extractEXIF: true,
      colorAnalysis: true,
      analyzeStructure: true,
      detectLanguage: true,

      // Security and validation
      enablePasswordDetection: true,
      performDeepValidation: true
    }
  };

  const filename = 'complex-document.pdf';
  const fileBuffer = Buffer.from('Complex document content');

  try {
    console.log('🚀 Starting advanced processing...');
    const startTime = Date.now();

    const result = await factory.processFile(
      filename,
      fileBuffer,
      'application/pdf',
      highQualityConfig,
      progressCallback
    );

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    if (result.success) {
      console.log('✅ Advanced processing completed successfully!');
      console.log(`📊 Results:
        - Processor used: ${result.processor}
        - Content length: ${result.textContent.length} characters
        - Processing time: ${totalTime}ms
        - Metadata extracted: ${Object.keys(result.metadata.formatSpecific || {}).length} fields
        - Warnings: ${result.warnings.length}
        - File size: ${result.metadata.fileSize} bytes
        - Extraction method: ${result.metadata.extractionMethod}`);

      if (result.warnings.length > 0) {
        console.log('⚠️ Warnings:');
        result.warnings.forEach((warning, index) => {
          console.log(`  ${index + 1}. ${warning.message} (${warning.severity})`);
        });
      }

      if (result.structuredContent) {
        console.log('📋 Structured content available:', Object.keys(result.structuredContent));
      }
    } else {
      console.log('❌ Advanced processing failed:', result.error);
    }
  } catch (error) {
    console.error('Advanced processing error:', error);
  }
}

/**
 * Example 8: Error handling and recovery
 */
export async function errorHandlingExample() {
  console.log('=== Error Handling Example ===');

  const factory = getDefaultProcessorFactory();

  // Test various error conditions
  const errorTestCases = [
    {
      name: 'Empty file',
      filename: 'empty.pdf',
      buffer: Buffer.alloc(0),
      mimeType: 'application/pdf'
    },
    {
      name: 'Unsupported file type',
      filename: 'unknown.xyz',
      buffer: Buffer.from('Unknown content'),
      mimeType: 'application/unknown'
    },
    {
      name: 'Corrupted file',
      filename: 'corrupted.pdf',
      buffer: Buffer.from('Not a real PDF file'),
      mimeType: 'application/pdf'
    }
  ];

  for (const testCase of errorTestCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);

    try {
      // First validate the file
      const validation = await factory.validateFile(
        testCase.filename,
        testCase.buffer,
        testCase.mimeType
      );

      if (!validation.isValid) {
        console.log('❌ Validation failed:', validation.errors);
        console.log('⚠️ Validation warnings:', validation.warnings);
        continue;
      }

      // If validation passes, try processing
      const result = await factory.processFile(
        testCase.filename,
        testCase.buffer,
        testCase.mimeType,
        { timeout: 5000 } // Short timeout for error cases
      );

      if (result.success) {
        console.log('✅ Unexpectedly succeeded');
      } else {
        console.log('❌ Processing failed as expected:', result.error);
      }
    } catch (error) {
      console.log('💥 Exception caught:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🎯 Running Modular File Processing System Examples\n');

  const examples = [
    basicProcessingExample,
    fileDetectionExample,
    environmentConfigExample,
    customConfigExample,
    customFactoryExample,
    errorHandlingExample,
    batchProcessingExample,
    advancedProcessingExample
  ];

  for (let i = 0; i < examples.length; i++) {
    try {
      await examples[i]();
      console.log('\n' + '─'.repeat(60) + '\n');
    } catch (error) {
      console.error(`Example ${i + 1} failed:`, error);
      console.log('\n' + '─'.repeat(60) + '\n');
    }
  }

  console.log('🏁 All examples completed!');
}

// Export for easy testing
export const examples = {
  basic: basicProcessingExample,
  customConfig: customConfigExample,
  batch: batchProcessingExample,
  customFactory: customFactoryExample,
  detection: fileDetectionExample,
  environment: environmentConfigExample,
  advanced: advancedProcessingExample,
  errorHandling: errorHandlingExample,
  all: runAllExamples
};