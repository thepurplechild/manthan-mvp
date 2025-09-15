/**
 * Processor Utilities - Convenience functions for common operations
 */

import { getDefaultProcessorFactory } from './factory';
import { ProcessorConfig, ValidationResult, ProcessingResult } from './types';
import { IngestionProgressCallback } from '@/lib/ingestion/types';

/**
 * Process a file using the default factory
 */
export async function processFileWithFactory(
  filename: string,
  buffer: Buffer,
  mimeType?: string,
  config?: ProcessorConfig,
  progressCallback?: IngestionProgressCallback
): Promise<ProcessingResult & { processor?: string }> {
  const factory = getDefaultProcessorFactory();
  return factory.processFile(filename, buffer, mimeType, config, progressCallback);
}

/**
 * Validate a file using the default factory
 */
export async function validateFileWithFactory(
  filename: string,
  buffer: Buffer,
  mimeType?: string,
  config?: ProcessorConfig
): Promise<ValidationResult & { processor?: string }> {
  const factory = getDefaultProcessorFactory();
  return factory.validateFile(filename, buffer, mimeType, config);
}