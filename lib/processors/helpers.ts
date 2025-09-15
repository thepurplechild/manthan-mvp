/**
 * Helper functions for the modular processor system
 */

import { createHash } from 'crypto';

/**
 * Generate a unique ingestion ID
 */
export function generateIngestionId(): string {
  const timestamp = Date.now().toString(36);
  const randomBytes = createHash('sha256')
    .update(Math.random().toString() + timestamp)
    .digest('hex')
    .substring(0, 8);
  return `ing_${timestamp}_${randomBytes}`;
}

/**
 * Generate a unique content ID
 */
export function generateContentId(): string {
  return createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .substring(0, 16);
}

/**
 * Generate checksum for content integrity
 */
export function generateChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}