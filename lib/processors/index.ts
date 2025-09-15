/**
 * Modular File Processing System - Main Export
 *
 * Central export point for the modular file processing system.
 */

// Core types and interfaces
export * from './types';

// Base processor class
export { BaseProcessor } from './base';

// Individual processors
export { PdfProcessor } from './pdf-processor';
export { DocxProcessor } from './docx-processor';
export { TxtProcessor } from './txt-processor';
export { ImageProcessor } from './image-processor';

// Factory and management
export {
  ProcessorFactory,
  createProcessorFactory,
  getDefaultProcessorFactory,
  resetDefaultProcessorFactory
} from './factory';

// Convenience functions
export { processFileWithFactory, validateFileWithFactory } from './utils';