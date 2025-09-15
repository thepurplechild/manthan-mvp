/**
 * Processor Configuration System
 *
 * Centralized configuration management for processor-specific settings,
 * environment variables, and runtime configuration.
 */

import { ProcessorConfig, ProcessorFactoryConfig, SupportedFileType } from './types';

/**
 * Default configurations for different environments
 */
const DEFAULT_CONFIGS = {
  development: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    timeout: 120000, // 2 minutes
    enableOCR: true,
    extractMetadata: true,
    enableSecurity: false, // Disabled for faster development
    custom: {
      ocrQuality: 'medium',
      logLevel: 'debug'
    }
  },
  production: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    timeout: 300000, // 5 minutes
    enableOCR: true,
    extractMetadata: true,
    enableSecurity: true,
    custom: {
      ocrQuality: 'high',
      logLevel: 'info'
    }
  },
  test: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    timeout: 30000, // 30 seconds
    enableOCR: false, // Disabled for faster tests
    extractMetadata: false,
    enableSecurity: false,
    custom: {
      logLevel: 'error'
    }
  }
} as const;

/**
 * File type specific configurations
 */
const FILE_TYPE_CONFIGS: Partial<Record<SupportedFileType, Partial<ProcessorConfig>>> = {
  [SupportedFileType.PDF]: {
    timeout: 600000, // 10 minutes for complex PDFs
    custom: {
      ocrScale: 2.0,
      enablePasswordDetection: true
    }
  },
  [SupportedFileType.DOCX]: {
    timeout: 120000, // 2 minutes
    custom: {
      preserveFormatting: false,
      extractImages: false
    }
  },
  [SupportedFileType.TXT]: {
    timeout: 30000, // 30 seconds
    custom: {
      detectLanguage: true,
      analyzeStructure: true
    }
  },
  [SupportedFileType.PNG]: {
    timeout: 180000, // 3 minutes for OCR
    custom: {
      ocrPreprocessing: true,
      colorAnalysis: true
    }
  },
  [SupportedFileType.JPG]: {
    timeout: 180000, // 3 minutes for OCR
    custom: {
      ocrPreprocessing: true,
      extractEXIF: true
    }
  }
};

/**
 * Configuration manager for processors
 */
export class ProcessorConfigManager {
  private baseConfig: ProcessorConfig;
  private environment: 'development' | 'production' | 'test';

  constructor(environment?: 'development' | 'production' | 'test') {
    this.environment = environment || this.detectEnvironment();
    this.baseConfig = this.loadBaseConfig();
  }

  /**
   * Detect current environment
   */
  private detectEnvironment(): 'development' | 'production' | 'test' {
    if (process.env.NODE_ENV === 'test') return 'test';
    if (process.env.NODE_ENV === 'production') return 'production';
    return 'development';
  }

  /**
   * Load base configuration for current environment
   */
  private loadBaseConfig(): ProcessorConfig {
    const envConfig = DEFAULT_CONFIGS[this.environment];

    // Override with environment variables if present
    const config: ProcessorConfig = {
      maxFileSize: this.parseEnvNumber('MAX_FILE_SIZE_BYTES') || envConfig.maxFileSize,
      timeout: this.parseEnvNumber('PROCESSOR_TIMEOUT_MS') || envConfig.timeout,
      enableOCR: this.parseEnvBoolean('ENABLE_OCR') ?? envConfig.enableOCR,
      ocrLanguage: process.env.OCR_LANGUAGE || 'eng',
      extractMetadata: this.parseEnvBoolean('EXTRACT_METADATA') ?? envConfig.extractMetadata,
      custom: {
        ...envConfig.custom,
        logLevel: process.env.LOG_LEVEL || envConfig.custom.logLevel,
        ocrQuality: process.env.OCR_QUALITY || envConfig.custom.ocrQuality
      }
    };

    return config;
  }

  /**
   * Get configuration for a specific file type
   */
  getConfigForFileType(fileType: SupportedFileType, overrides?: Partial<ProcessorConfig>): ProcessorConfig {
    const fileTypeConfig = FILE_TYPE_CONFIGS[fileType] || {};

    return {
      ...this.baseConfig,
      ...fileTypeConfig,
      ...overrides,
      custom: {
        ...this.baseConfig.custom,
        ...fileTypeConfig.custom,
        ...overrides?.custom
      }
    };
  }

  /**
   * Get factory configuration
   */
  getFactoryConfig(overrides?: Partial<ProcessorFactoryConfig>): ProcessorFactoryConfig {
    const factoryConfig: ProcessorFactoryConfig = {
      defaultConfig: this.baseConfig,
      enableSecurity: this.parseEnvBoolean('ENABLE_PROCESSOR_SECURITY') ??
                     (this.environment === 'production'),
      ...overrides
    };

    return factoryConfig;
  }

  /**
   * Update base configuration
   */
  updateBaseConfig(updates: Partial<ProcessorConfig>): void {
    this.baseConfig = {
      ...this.baseConfig,
      ...updates,
      custom: {
        ...this.baseConfig.custom,
        ...updates.custom
      }
    };
  }

  /**
   * Get current base configuration
   */
  getBaseConfig(): ProcessorConfig {
    return { ...this.baseConfig };
  }

  /**
   * Get environment-specific configuration recommendations
   */
  getRecommendedConfig(): {
    description: string;
    config: ProcessorConfig;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let description = `Configuration optimized for ${this.environment} environment`;

    // Check for potential issues
    if (this.baseConfig.maxFileSize && this.baseConfig.maxFileSize > 200 * 1024 * 1024) {
      warnings.push('Very large max file size may cause memory issues');
    }

    if (this.baseConfig.timeout && this.baseConfig.timeout > 600000) {
      warnings.push('Very long timeout may cause job queue buildup');
    }

    if (this.environment === 'production' && !this.baseConfig.enableOCR) {
      warnings.push('OCR is disabled in production, image processing will be limited');
    }

    if (this.environment === 'development' && this.baseConfig.enableOCR) {
      description += ' (OCR enabled for testing - may be slow)';
    }

    return {
      description,
      config: this.getBaseConfig(),
      warnings
    };
  }

  /**
   * Validate configuration
   */
  validateConfig(config: ProcessorConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!config.maxFileSize || config.maxFileSize <= 0) {
      errors.push('maxFileSize must be a positive number');
    }

    if (!config.timeout || config.timeout <= 0) {
      errors.push('timeout must be a positive number');
    }

    // Validate reasonable limits
    if (config.maxFileSize && config.maxFileSize > 1024 * 1024 * 1024) { // 1GB
      warnings.push('maxFileSize is very large and may cause memory issues');
    }

    if (config.timeout && config.timeout > 1800000) { // 30 minutes
      warnings.push('timeout is very long and may cause performance issues');
    }

    // Validate OCR language
    if (config.ocrLanguage && !/^[a-z]{3}$/.test(config.ocrLanguage)) {
      warnings.push('ocrLanguage should be a 3-letter language code (e.g., "eng")');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Parse environment variable as number
   */
  private parseEnvNumber(envVar: string): number | undefined {
    const value = process.env[envVar];
    if (!value) return undefined;

    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Parse environment variable as boolean
   */
  private parseEnvBoolean(envVar: string): boolean | undefined {
    const value = process.env[envVar];
    if (!value) return undefined;

    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Get configuration summary for debugging
   */
  getConfigSummary(): {
    environment: string;
    baseConfig: ProcessorConfig;
    fileTypeOverrides: Record<string, Partial<ProcessorConfig>>;
    envOverrides: Record<string, string>;
  } {
    const envOverrides: Record<string, string> = {};

    // Collect relevant environment variables
    const envVars = [
      'MAX_FILE_SIZE_BYTES',
      'PROCESSOR_TIMEOUT_MS',
      'ENABLE_OCR',
      'OCR_LANGUAGE',
      'EXTRACT_METADATA',
      'LOG_LEVEL',
      'OCR_QUALITY',
      'ENABLE_PROCESSOR_SECURITY'
    ];

    for (const envVar of envVars) {
      if (process.env[envVar]) {
        envOverrides[envVar] = process.env[envVar]!;
      }
    }

    return {
      environment: this.environment,
      baseConfig: this.baseConfig,
      fileTypeOverrides: FILE_TYPE_CONFIGS as Record<string, Partial<ProcessorConfig>>,
      envOverrides
    };
  }
}

/**
 * Global configuration manager instance
 */
let globalConfigManager: ProcessorConfigManager | null = null;

/**
 * Get the global configuration manager
 */
export function getConfigManager(): ProcessorConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ProcessorConfigManager();
  }
  return globalConfigManager;
}

/**
 * Reset the global configuration manager (useful for testing)
 */
export function resetConfigManager(): void {
  globalConfigManager = null;
}

/**
 * Convenience function to get configuration for a file type
 */
export function getConfigForFileType(
  fileType: SupportedFileType,
  overrides?: Partial<ProcessorConfig>
): ProcessorConfig {
  return getConfigManager().getConfigForFileType(fileType, overrides);
}

/**
 * Convenience function to get factory configuration
 */
export function getFactoryConfig(
  overrides?: Partial<ProcessorFactoryConfig>
): ProcessorFactoryConfig {
  return getConfigManager().getFactoryConfig(overrides);
}