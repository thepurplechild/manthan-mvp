# Modular File Processing System

A comprehensive, extensible file processing system that provides intelligent processor selection, security validation, and standardized metadata extraction for various file types.

## Features

- **🔧 Modular Architecture**: Extensible processor system with clean interfaces
- **📁 Multiple File Types**: PDF, DOCX, TXT, PNG, JPG, GIF, WEBP support
- **🤖 Intelligent Selection**: Automatic processor selection based on MIME type and file extension
- **🔍 OCR Support**: Built-in OCR for image-based content extraction
- **🛡️ Security Validation**: Comprehensive security checks for uploaded files
- **⚙️ Configurable**: Environment-specific and processor-specific configurations
- **📊 Rich Metadata**: Detailed metadata extraction and content analysis
- **🚀 Performance**: Timeout handling, progress tracking, and batch processing
- **🔗 Integration**: Seamless integration with existing job system

## Quick Start

### Basic Usage

```typescript
import { getDefaultProcessorFactory } from '@/lib/processors';

const factory = getDefaultProcessorFactory();

// Process a file
const result = await factory.processFile(
  'document.pdf',
  fileBuffer,
  'application/pdf'
);

if (result.success) {
  console.log('Extracted text:', result.textContent);
  console.log('Metadata:', result.metadata);
}
```

### Custom Configuration

```typescript
import { ProcessorConfig, SupportedFileType } from '@/lib/processors';

const config: ProcessorConfig = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  timeout: 120000, // 2 minutes
  enableOCR: true,
  extractMetadata: true,
  custom: {
    ocrScale: 2.0,
    extractEXIF: true
  }
};

const result = await factory.processFile(
  filename,
  buffer,
  mimeType,
  config
);
```

### Batch Processing

```typescript
const files = [
  { filename: 'doc1.pdf', buffer: buffer1, mimeType: 'application/pdf' },
  { filename: 'doc2.docx', buffer: buffer2, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
];

const results = await factory.processFileBatch(files);
```

## Architecture

### Core Components

1. **Base Processor (`BaseProcessor`)**: Abstract base class providing common functionality
2. **Processor Factory (`ProcessorFactory`)**: Manages processor registration and intelligent selection
3. **File Type Processors**: Specialized processors for each supported format
4. **Configuration Manager**: Environment and processor-specific configuration
5. **Integration Adapter**: Bridge with existing ingestion system

### Supported Processors

#### PdfProcessor
- Uses `pdf-parse` for text extraction
- OCR fallback for image-based PDFs
- Password protection detection
- Comprehensive metadata extraction

#### DocxProcessor
- Uses `mammoth` for Word document processing
- Handles complex formatting and embedded objects
- Document structure analysis
- Author and title extraction

#### TxtProcessor
- Encoding detection and fallback
- Language detection
- Content pattern analysis (emails, URLs, dates)
- Format detection (code, CSV, markdown, etc.)

#### ImageProcessor
- Uses `sharp` for image processing
- OCR text extraction with `tesseract.js`
- EXIF metadata extraction
- Color analysis and image classification

### File Type Detection

The system uses a multi-layered approach for file type detection:

1. **File Extension** (highest confidence)
2. **MIME Type** (medium confidence)
3. **Content Heuristics** (lowest confidence)

```typescript
const detection = factory.detectFileType('document.pdf', 'application/pdf');
// Returns: { fileType: 'pdf', confidence: 'high', detectionMethod: 'extension' }
```

## Configuration

### Environment-Based Configuration

The system automatically adjusts based on the environment:

- **Development**: Lower limits, OCR enabled, security disabled
- **Production**: Higher limits, full security, optimized settings
- **Test**: Minimal limits, OCR disabled for speed

### Environment Variables

```bash
# File processing limits
MAX_FILE_SIZE_BYTES=104857600  # 100MB
PROCESSOR_TIMEOUT_MS=300000    # 5 minutes

# OCR settings
ENABLE_OCR=true
OCR_LANGUAGE=eng
OCR_QUALITY=high

# Security
ENABLE_PROCESSOR_SECURITY=true

# Logging
LOG_LEVEL=info
```

### Processor-Specific Configuration

```typescript
import { getConfigForFileType, SupportedFileType } from '@/lib/processors';

// Get optimized config for PDF processing
const pdfConfig = getConfigForFileType(SupportedFileType.PDF, {
  custom: {
    ocrScale: 3.0,
    enablePasswordDetection: true
  }
});
```

## Integration with Job System

The modular system integrates seamlessly with the existing job processing system:

```typescript
// In lib/jobs/processor.ts
import { ingestFileWithModularSystem } from '@/lib/processors/integration';

// Use modular system when enabled
const useModularSystem = process.env.USE_MODULAR_PROCESSORS === 'true';

if (useModularSystem) {
  const result = await ingestFileWithModularSystem(
    filename,
    buffer,
    mimeType,
    options,
    progressCallback
  );
}
```

## Security Features

### Validation Checks

- File size limits and validation
- MIME type verification
- Content pattern analysis
- Malicious script detection
- Embedded content scanning

### Security Configuration

```typescript
const secureConfig = {
  enableSecurity: true,
  maxFileSize: 50 * 1024 * 1024,
  custom: {
    enablePasswordDetection: true,
    performDeepValidation: true,
    scanEmbeddedContent: true
  }
};
```

## Error Handling

### Validation Errors

```typescript
const validation = await factory.validateFile(filename, buffer, mimeType);

if (!validation.isValid) {
  console.log('Validation errors:', validation.errors);
  console.log('Warnings:', validation.warnings);
}
```

### Processing Errors

```typescript
const result = await factory.processFile(filename, buffer, mimeType);

if (!result.success) {
  console.log('Processing failed:', result.error);
  console.log('Warnings:', result.warnings);
}
```

### Retry Logic

The system provides information about whether errors are retryable:

```typescript
if (!result.success && result.error) {
  const isRetryable = result.error.includes('timeout') ||
                     result.error.includes('network');

  if (isRetryable) {
    // Implement retry logic
  }
}
```

## Performance Optimization

### Timeout Management

```typescript
const config = {
  timeout: 300000, // 5 minutes
  custom: {
    // Processor-specific timeouts
    ocrTimeout: 180000, // 3 minutes for OCR
    metadataTimeout: 30000 // 30 seconds for metadata
  }
};
```

### Progress Tracking

```typescript
const result = await factory.processFile(
  filename,
  buffer,
  mimeType,
  config,
  (progress) => {
    console.log(`${progress.progress}% - ${progress.currentStep}`);
    updateUI(progress);
  }
);
```

### Memory Management

- Streaming processing for large files
- Buffer management and cleanup
- Configurable memory limits per processor

## Extending the System

### Creating a Custom Processor

```typescript
import { BaseProcessor, SupportedFileType, ProcessorConfig } from '@/lib/processors';

class CustomProcessor extends BaseProcessor {
  readonly name = 'CustomProcessor';
  readonly supportedTypes = [SupportedFileType.CUSTOM];
  readonly defaultConfig: ProcessorConfig = {
    maxFileSize: 10 * 1024 * 1024,
    timeout: 60000,
    extractMetadata: true
  };

  async process(filename, buffer, config, progressCallback) {
    // Implement custom processing logic
    return {
      success: true,
      textContent: 'extracted text',
      metadata: this.createMetadata(buffer, Date.now(), 0),
      warnings: []
    };
  }
}
```

### Registering a Custom Processor

```typescript
import { createProcessorFactory } from '@/lib/processors';

const factory = createProcessorFactory();
factory.registerProcessor(new CustomProcessor(), 100);
```

## Testing

### Running Examples

```typescript
import { examples } from '@/lib/processors/examples';

// Run all examples
await examples.all();

// Run specific example
await examples.basic();
await examples.batch();
```

### Unit Testing

```typescript
import { resetDefaultProcessorFactory } from '@/lib/processors';

describe('ProcessorFactory', () => {
  beforeEach(() => {
    resetDefaultProcessorFactory();
  });

  it('should process PDF files', async () => {
    const factory = getDefaultProcessorFactory();
    const result = await factory.processFile('test.pdf', buffer);
    expect(result.success).toBe(true);
  });
});
```

## Best Practices

### Configuration Management

1. Use environment-specific configurations
2. Override defaults only when necessary
3. Validate configurations before use
4. Monitor configuration warnings

### Error Handling

1. Always validate files before processing
2. Handle timeouts gracefully
3. Implement retry logic for network errors
4. Log detailed error information

### Performance

1. Use appropriate timeout values
2. Enable progress tracking for long operations
3. Consider batch processing for multiple files
4. Monitor memory usage

### Security

1. Enable security validation in production
2. Scan uploaded files for malicious content
3. Implement file size limits
4. Validate MIME types and extensions

## Migration Guide

### From Legacy System

1. **Phase 1**: Enable modular system alongside legacy
   ```bash
   USE_MODULAR_PROCESSORS=true
   ```

2. **Phase 2**: Test with subset of file types
   ```typescript
   const allowedTypes = [SupportedFileType.PDF, SupportedFileType.TXT];
   ```

3. **Phase 3**: Full migration
   - Update all processing calls
   - Remove legacy code
   - Update configurations

### Configuration Migration

```typescript
// Legacy configuration
const legacyOptions = {
  priority: 'high',
  extractMetadata: true,
  timeout: 300000
};

// Modular system configuration
const modularConfig: ProcessorConfig = {
  maxFileSize: 100 * 1024 * 1024,
  timeout: legacyOptions.timeout,
  extractMetadata: legacyOptions.extractMetadata,
  custom: {
    priority: legacyOptions.priority
  }
};
```

## API Reference

### ProcessorFactory

- `processFile(filename, buffer, mimeType?, config?, progressCallback?)`: Process a single file
- `processFileBatch(files, config?, progressCallback?)`: Process multiple files
- `validateFile(filename, buffer, mimeType?, config?)`: Validate a file
- `detectFileType(filename, mimeType?)`: Detect file type
- `registerProcessor(processor, priority?, enabled?)`: Register a processor
- `getSupportedFileTypes()`: Get supported file types

### ProcessorConfig

```typescript
interface ProcessorConfig {
  maxFileSize?: number;
  timeout?: number;
  enableOCR?: boolean;
  ocrLanguage?: string;
  extractMetadata?: boolean;
  custom?: Record<string, unknown>;
}
```

### ProcessingResult

```typescript
interface ProcessingResult {
  success: boolean;
  textContent: string;
  metadata: ProcessingMetadata;
  warnings: IngestionWarning[];
  security?: SecurityValidation;
  error?: string;
  structuredContent?: unknown;
}
```

## Troubleshooting

### Common Issues

1. **OCR Dependencies**: Ensure `tesseract.js` and `canvas` are installed
2. **Memory Issues**: Reduce `maxFileSize` or increase Node.js memory limit
3. **Timeout Errors**: Increase timeout values for complex files
4. **Security Blocks**: Review and adjust security validation settings

### Debugging

```typescript
import { getConfigManager } from '@/lib/processors/config';

// Get configuration summary
const summary = getConfigManager().getConfigSummary();
console.log('Current config:', summary);

// Enable debug logging
process.env.LOG_LEVEL = 'debug';
```

## Support

For issues, feature requests, or questions:

1. Check the examples in `lib/processors/examples.ts`
2. Review configuration options in `lib/processors/config.ts`
3. Examine processor implementations for specific file types
4. Use the debugging utilities provided