import { SupportedFileType, IngestionErrorType, ValidationErrorType } from '@/lib/processors/types';

describe('Processor Types', () => {
  describe('SupportedFileType', () => {
    it('should contain all expected file types', () => {
      expect(SupportedFileType.PDF).toBe('pdf');
      expect(SupportedFileType.DOCX).toBe('docx');
      expect(SupportedFileType.TXT).toBe('txt');
      expect(SupportedFileType.IMAGE).toBe('image');
    });

    it('should have unique values', () => {
      const values = Object.values(SupportedFileType);
      const uniqueValues = new Set(values);
      expect(values.length).toBe(uniqueValues.size);
    });
  });

  describe('IngestionErrorType', () => {
    it('should contain all expected error types', () => {
      expect(IngestionErrorType.UNSUPPORTED_FILE_TYPE).toBe('unsupported_file_type');
      expect(IngestionErrorType.FILE_TOO_LARGE).toBe('file_too_large');
      expect(IngestionErrorType.CORRUPTED_FILE).toBe('corrupted_file');
      expect(IngestionErrorType.PROCESSING_FAILED).toBe('processing_failed');
      expect(IngestionErrorType.TIMEOUT).toBe('timeout');
      expect(IngestionErrorType.SECURITY_VIOLATION).toBe('security_violation');
    });
  });

  describe('ValidationErrorType', () => {
    it('should contain all expected validation error types', () => {
      expect(ValidationErrorType.INVALID_FILE_TYPE).toBe('invalid_file_type');
      expect(ValidationErrorType.INVALID_MIME_TYPE).toBe('invalid_mime_type');
      expect(ValidationErrorType.FILE_SIZE_EXCEEDED).toBe('file_size_exceeded');
      expect(ValidationErrorType.SECURITY_THREAT_DETECTED).toBe('security_threat_detected');
      expect(ValidationErrorType.CORRUPTED_CONTENT).toBe('corrupted_content');
    });
  });
});