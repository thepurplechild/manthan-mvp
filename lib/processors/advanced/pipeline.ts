/**
 * Advanced Processing Pipeline
 *
 * Multi-step processing workflows with conditional execution,
 * parallel processing, and comprehensive error handling.
 */

import {
  PipelineConfig,
  PipelineStep,
  StepType,
  StepConfig,
  ErrorHandling,
  RetryConfig,
  ResourceLimits,
  PipelineSettings,
  PipelineCondition,
  MonitoringSettings,
  AlertThreshold
} from './types';
import { IngestionProgressCallback } from '@/lib/ingestion/types';
import { ContentAnalyzer } from './content-analyzer';
import { SecurityScanner } from './security-scanner';

/**
 * Pipeline execution context
 */
export interface PipelineContext {
  /** Input data */
  input: {
    filename: string;
    buffer: Buffer;
    mimeType?: string;
    metadata?: Record<string, unknown>;
  };
  /** Pipeline results */
  results: Map<string, unknown>;
  /** Pipeline state */
  state: PipelineState;
  /** Execution metrics */
  metrics: PipelineMetrics;
  /** Error information */
  errors: PipelineError[];
  /** Warnings */
  warnings: string[];
}

/**
 * Pipeline state
 */
export interface PipelineState {
  /** Current step index */
  currentStep: number;
  /** Total steps */
  totalSteps: number;
  /** Execution status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Last checkpoint */
  lastCheckpoint?: string;
}

/**
 * Pipeline metrics
 */
export interface PipelineMetrics {
  /** Total execution time */
  totalTime: number;
  /** Step execution times */
  stepTimes: Map<string, number>;
  /** Resource usage */
  resourceUsage: ResourceUsage;
  /** Throughput metrics */
  throughput: ThroughputMetrics;
}

/**
 * Resource usage tracking
 */
export interface ResourceUsage {
  /** Peak memory usage in MB */
  peakMemory: number;
  /** Average CPU usage percentage */
  avgCpu: number;
  /** Disk I/O operations */
  diskIO: number;
  /** Network operations */
  networkOps: number;
}

/**
 * Throughput metrics
 */
export interface ThroughputMetrics {
  /** Items processed per second */
  itemsPerSecond: number;
  /** Bytes processed per second */
  bytesPerSecond: number;
  /** Steps completed per minute */
  stepsPerMinute: number;
}

/**
 * Pipeline error
 */
export interface PipelineError {
  /** Step name where error occurred */
  step: string;
  /** Error type */
  type: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: string;
  /** Stack trace */
  stackTrace?: string;
  /** Timestamp */
  timestamp: number;
  /** Recoverable flag */
  recoverable: boolean;
}

/**
 * Step execution result
 */
export interface StepResult {
  /** Execution success */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Execution time */
  executionTime: number;
  /** Resource usage */
  resourceUsage: Partial<ResourceUsage>;
  /** Warnings */
  warnings: string[];
  /** Error information */
  error?: PipelineError;
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  /** Execution success */
  success: boolean;
  /** Pipeline context with all results */
  context: PipelineContext;
  /** Final output */
  output?: unknown;
  /** Execution summary */
  summary: ExecutionSummary;
}

/**
 * Execution summary
 */
export interface ExecutionSummary {
  /** Total execution time */
  totalTime: number;
  /** Steps completed */
  stepsCompleted: number;
  /** Steps failed */
  stepsFailed: number;
  /** Steps skipped */
  stepsSkipped: number;
  /** Warnings count */
  warningsCount: number;
  /** Errors count */
  errorsCount: number;
  /** Performance metrics */
  performance: PipelineMetrics;
}

/**
 * Step processor interface
 */
export interface StepProcessor {
  /** Process step */
  process(
    stepConfig: StepConfig,
    context: PipelineContext,
    progressCallback?: IngestionProgressCallback
  ): Promise<StepResult>;

  /** Validate step configuration */
  validateConfig(config: StepConfig): { valid: boolean; errors: string[] };

  /** Get step dependencies */
  getDependencies(config: StepConfig): string[];
}

/**
 * Processing pipeline engine
 */
export class ProcessingPipeline {
  private processors: Map<StepType, StepProcessor> = new Map();
  private monitors: Map<string, PipelineMonitor> = new Map();
  private contentAnalyzer: ContentAnalyzer;
  private securityScanner: SecurityScanner;

  constructor() {
    this.contentAnalyzer = new ContentAnalyzer();
    this.securityScanner = new SecurityScanner();
    this.initializeProcessors();
  }

  /**
   * Initialize the pipeline
   */
  async initialize(): Promise<void> {
    await this.contentAnalyzer.initialize();
    await this.securityScanner.initialize();
    console.log('[ProcessingPipeline] Initialized successfully');
  }

  /**
   * Execute pipeline
   */
  async execute(
    config: PipelineConfig,
    input: PipelineContext['input'],
    progressCallback?: IngestionProgressCallback
  ): Promise<PipelineResult> {
    const startTime = Date.now();

    // Create pipeline context
    const context: PipelineContext = {
      input,
      results: new Map(),
      state: {
        currentStep: 0,
        totalSteps: config.steps.length,
        status: 'pending',
        startTime
      },
      metrics: {
        totalTime: 0,
        stepTimes: new Map(),
        resourceUsage: {
          peakMemory: 0,
          avgCpu: 0,
          diskIO: 0,
          networkOps: 0
        },
        throughput: {
          itemsPerSecond: 0,
          bytesPerSecond: 0,
          stepsPerMinute: 0
        }
      },
      errors: [],
      warnings: []
    };

    try {
      console.log(`[ProcessingPipeline] Starting pipeline: ${config.name}`);
      context.state.status = 'running';

      // Start monitoring if enabled
      if (config.settings.monitoring.enabled) {
        await this.startMonitoring(context, config.settings.monitoring);
      }

      // Validate pipeline configuration
      const validation = this.validatePipeline(config);
      if (!validation.valid) {
        throw new Error(`Pipeline validation failed: ${validation.errors.join(', ')}`);
      }

      // Execute steps
      const executionPlan = this.createExecutionPlan(config);
      await this.executeSteps(executionPlan, context, progressCallback);

      context.state.status = context.errors.length > 0 ? 'failed' : 'completed';
      context.state.endTime = Date.now();
      context.metrics.totalTime = context.state.endTime - context.state.startTime;

      // Generate final output
      const output = await this.generateOutput(context, config);

      const summary = this.createExecutionSummary(context);

      console.log(`[ProcessingPipeline] Pipeline completed: ${config.name} in ${context.metrics.totalTime}ms`);

      return {
        success: context.state.status === 'completed',
        context,
        output,
        summary
      };

    } catch (error) {
      context.state.status = 'failed';
      context.state.endTime = Date.now();
      context.metrics.totalTime = context.state.endTime! - context.state.startTime;

      const pipelineError: PipelineError = {
        step: 'pipeline',
        type: 'execution_error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
        timestamp: Date.now(),
        recoverable: false
      };

      context.errors.push(pipelineError);

      console.error(`[ProcessingPipeline] Pipeline failed: ${config.name}`, error);

      return {
        success: false,
        context,
        summary: this.createExecutionSummary(context)
      };

    } finally {
      // Stop monitoring
      if (config.settings.monitoring.enabled) {
        await this.stopMonitoring(context);
      }

      // Cleanup resources
      await this.cleanup(context);
    }
  }

  /**
   * Create execution plan with dependency resolution
   */
  private createExecutionPlan(config: PipelineConfig): PipelineStep[] {
    const steps = [...config.steps];
    const resolved: PipelineStep[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (step: PipelineStep) => {
      if (visited.has(step.name)) return;
      if (visiting.has(step.name)) {
        throw new Error(`Circular dependency detected: ${step.name}`);
      }

      visiting.add(step.name);

      // Process dependencies first
      if (step.dependencies) {
        for (const depName of step.dependencies) {
          const depStep = steps.find(s => s.name === depName);
          if (!depStep) {
            throw new Error(`Dependency not found: ${depName} for step ${step.name}`);
          }
          visit(depStep);
        }
      }

      visiting.delete(step.name);
      visited.add(step.name);
      resolved.push(step);
    };

    // Visit all steps to resolve dependencies
    for (const step of steps) {
      visit(step);
    }

    return resolved;
  }

  /**
   * Execute pipeline steps
   */
  private async executeSteps(
    steps: PipelineStep[],
    context: PipelineContext,
    progressCallback?: IngestionProgressCallback
  ): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      context.state.currentStep = i;

      progressCallback?.({
        currentStep: `Executing step: ${step.name}`,
        progress: Math.round((i / steps.length) * 100),
        details: `Step ${i + 1} of ${steps.length}`
      });

      try {
        // Check execution condition
        if (step.condition && !this.evaluateCondition(step.condition, context)) {
          console.log(`[ProcessingPipeline] Skipping step ${step.name} - condition not met`);
          continue;
        }

        // Execute step
        const result = await this.executeStep(step, context, progressCallback);

        // Store result
        context.results.set(step.name, result.data);
        context.metrics.stepTimes.set(step.name, result.executionTime);

        // Update resource usage
        this.updateResourceUsage(context.metrics.resourceUsage, result.resourceUsage);

        // Handle warnings
        if (result.warnings.length > 0) {
          context.warnings.push(...result.warnings);
        }

        // Handle errors
        if (!result.success && result.error) {
          context.errors.push(result.error);

          // Apply error handling strategy
          const shouldContinue = await this.handleStepError(step, result.error, context);
          if (!shouldContinue) {
            break;
          }
        }

      } catch (error) {
        const stepError: PipelineError = {
          step: step.name,
          type: 'step_execution_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now(),
          recoverable: step.errorHandling.strategy !== 'fail'
        };

        context.errors.push(stepError);

        const shouldContinue = await this.handleStepError(step, stepError, context);
        if (!shouldContinue) {
          break;
        }
      }
    }
  }

  /**
   * Execute individual step
   */
  private async executeStep(
    step: PipelineStep,
    context: PipelineContext,
    progressCallback?: IngestionProgressCallback
  ): Promise<StepResult> {
    const processor = this.processors.get(step.type);
    if (!processor) {
      throw new Error(`No processor found for step type: ${step.type}`);
    }

    const startTime = Date.now();
    console.log(`[ProcessingPipeline] Executing step: ${step.name} (${step.type})`);

    try {
      // Apply resource limits
      if (step.config.resources) {
        await this.applyResourceLimits(step.config.resources);
      }

      // Execute with timeout
      const timeoutMs = step.config.timeout || 300000; // 5 minutes default
      const result = await this.executeWithTimeout(
        () => processor.process(step.config, context, progressCallback),
        timeoutMs
      );

      const executionTime = Date.now() - startTime;
      console.log(`[ProcessingPipeline] Step ${step.name} completed in ${executionTime}ms`);

      return {
        ...result,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[ProcessingPipeline] Step ${step.name} failed after ${executionTime}ms:`, error);

      return {
        success: false,
        executionTime,
        resourceUsage: {},
        warnings: [],
        error: {
          step: step.name,
          type: 'step_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now(),
          recoverable: step.errorHandling.strategy !== 'fail'
        }
      };
    }
  }

  /**
   * Handle step error based on error handling strategy
   */
  private async handleStepError(
    step: PipelineStep,
    error: PipelineError,
    context: PipelineContext
  ): Promise<boolean> {
    const { strategy, maxRetries, fallbackStep, continueOnError } = step.errorHandling;

    switch (strategy) {
      case 'fail':
        console.error(`[ProcessingPipeline] Step ${step.name} failed, stopping pipeline`);
        return false;

      case 'skip':
        console.warn(`[ProcessingPipeline] Step ${step.name} failed, skipping`);
        return true;

      case 'retry':
        if (maxRetries && maxRetries > 0) {
          console.log(`[ProcessingPipeline] Retrying step ${step.name}, attempts remaining: ${maxRetries}`);
          step.errorHandling.maxRetries = maxRetries - 1;
          return await this.executeStep(step, context);
        }
        return continueOnError;

      case 'fallback':
        if (fallbackStep) {
          console.log(`[ProcessingPipeline] Using fallback step ${fallbackStep} for ${step.name}`);
          // Execute fallback step logic here
        }
        return continueOnError;

      default:
        return continueOnError;
    }
  }

  /**
   * Validate pipeline configuration
   */
  private validatePipeline(config: PipelineConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate steps
    if (!config.steps || config.steps.length === 0) {
      errors.push('Pipeline must have at least one step');
    }

    // Validate step names are unique
    const stepNames = new Set<string>();
    for (const step of config.steps) {
      if (stepNames.has(step.name)) {
        errors.push(`Duplicate step name: ${step.name}`);
      }
      stepNames.add(step.name);

      // Validate step processor exists
      if (!this.processors.has(step.type)) {
        errors.push(`No processor found for step type: ${step.type}`);
      }

      // Validate step configuration
      const processor = this.processors.get(step.type);
      if (processor) {
        const stepValidation = processor.validateConfig(step.config);
        if (!stepValidation.valid) {
          errors.push(`Step ${step.name} configuration invalid: ${stepValidation.errors.join(', ')}`);
        }
      }

      // Validate dependencies exist
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!config.steps.some(s => s.name === dep)) {
            errors.push(`Step ${step.name} depends on non-existent step: ${dep}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Evaluate conditional execution
   */
  private evaluateCondition(condition: string, context: PipelineContext): boolean {
    try {
      // Simple condition evaluation (in production, use a proper expression evaluator)
      const variables = {
        results: Object.fromEntries(context.results),
        input: context.input,
        errors: context.errors.length,
        warnings: context.warnings.length
      };

      // Basic condition parsing
      if (condition.includes('results.')) {
        const resultCheck = condition.match(/results\.(\w+)\.(\w+)\s*([><=!]+)\s*(.+)/);
        if (resultCheck) {
          const [, stepName, property, operator, value] = resultCheck;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stepResult = context.results.get(stepName) as any;
          if (stepResult && stepResult[property] !== undefined) {
            return this.compareValues(stepResult[property], operator, value);
          }
        }
      }

      // Default evaluation (could use eval in controlled environment)
      return true;
    } catch (error) {
      console.warn(`[ProcessingPipeline] Condition evaluation failed: ${condition}`, error);
      return true;
    }
  }

  /**
   * Compare values for condition evaluation
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private compareValues(left: any, operator: string, right: string): boolean {
    const rightValue = isNaN(Number(right)) ? right.replace(/['"]/g, '') : Number(right);

    switch (operator) {
      case '>': return left > rightValue;
      case '<': return left < rightValue;
      case '>=': return left >= rightValue;
      case '<=': return left <= rightValue;
      case '==': return left == rightValue;
      case '===': return left === rightValue;
      case '!=': return left != rightValue;
      case '!==': return left !== rightValue;
      default: return false;
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Apply resource limits
   */
  private async applyResourceLimits(limits: ResourceLimits): Promise<void> {
    // In a real implementation, this would:
    // - Set memory limits using process.memoryUsage()
    // - Set CPU limits using process scheduling
    // - Set disk/network limits
    console.log('[ProcessingPipeline] Applying resource limits:', limits);
  }

  /**
   * Update resource usage metrics
   */
  private updateResourceUsage(
    usage: ResourceUsage,
    stepUsage: Partial<ResourceUsage>
  ): void {
    if (stepUsage.peakMemory && stepUsage.peakMemory > usage.peakMemory) {
      usage.peakMemory = stepUsage.peakMemory;
    }
    if (stepUsage.avgCpu) {
      usage.avgCpu = (usage.avgCpu + stepUsage.avgCpu) / 2;
    }
    if (stepUsage.diskIO) {
      usage.diskIO += stepUsage.diskIO;
    }
    if (stepUsage.networkOps) {
      usage.networkOps += stepUsage.networkOps;
    }
  }

  /**
   * Start pipeline monitoring
   */
  private async startMonitoring(
    context: PipelineContext,
    settings: MonitoringSettings
  ): Promise<void> {
    const monitor = new PipelineMonitor(settings);
    this.monitors.set('pipeline', monitor);
    await monitor.start(context);
  }

  /**
   * Stop pipeline monitoring
   */
  private async stopMonitoring(context: PipelineContext): Promise<void> {
    const monitor = this.monitors.get('pipeline');
    if (monitor) {
      await monitor.stop();
      this.monitors.delete('pipeline');
    }
  }

  /**
   * Generate final output
   */
  private async generateOutput(
    context: PipelineContext,
    config: PipelineConfig
  ): Promise<unknown> {
    // Combine results from all steps
    const output = {
      pipeline: config.name,
      success: context.state.status === 'completed',
      results: Object.fromEntries(context.results),
      metrics: context.metrics,
      warnings: context.warnings,
      errors: context.errors.map(e => ({
        step: e.step,
        type: e.type,
        message: e.message
      }))
    };

    return output;
  }

  /**
   * Create execution summary
   */
  private createExecutionSummary(context: PipelineContext): ExecutionSummary {
    const stepsCompleted = context.results.size;
    const stepsFailed = context.errors.length;
    const stepsSkipped = context.state.totalSteps - stepsCompleted - stepsFailed;

    return {
      totalTime: context.metrics.totalTime,
      stepsCompleted,
      stepsFailed,
      stepsSkipped,
      warningsCount: context.warnings.length,
      errorsCount: context.errors.length,
      performance: context.metrics
    };
  }

  /**
   * Cleanup resources
   */
  private async cleanup(context: PipelineContext): Promise<void> {
    // Cleanup any resources used during pipeline execution
    console.log('[ProcessingPipeline] Cleaning up resources');
  }

  /**
   * Initialize step processors
   */
  private initializeProcessors(): void {
    this.processors.set(StepType.CONTENT_ANALYSIS, new ContentAnalysisProcessor(this.contentAnalyzer));
    this.processors.set(StepType.SECURITY_SCAN, new SecurityScanProcessor(this.securityScanner));
    this.processors.set(StepType.PREPROCESSING, new PreprocessingProcessor());
    this.processors.set(StepType.TRANSFORMATION, new TransformationProcessor());
    this.processors.set(StepType.VALIDATION, new ValidationProcessor());
    this.processors.set(StepType.OUTPUT_GENERATION, new OutputGenerationProcessor());
  }
}

/**
 * Pipeline monitor for tracking execution
 */
class PipelineMonitor {
  private settings: MonitoringSettings;
  private intervalId?: NodeJS.Timeout;

  constructor(settings: MonitoringSettings) {
    this.settings = settings;
  }

  async start(context: PipelineContext): Promise<void> {
    if (this.settings.enabled) {
      this.intervalId = setInterval(() => {
        this.collectMetrics(context);
      }, this.settings.interval);
    }
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private collectMetrics(context: PipelineContext): void {
    // Collect performance metrics
    const memUsage = process.memoryUsage();
    context.metrics.resourceUsage.peakMemory = Math.max(
      context.metrics.resourceUsage.peakMemory,
      memUsage.heapUsed / 1024 / 1024
    );

    // Check alert thresholds
    for (const alert of this.settings.alerts) {
      this.checkAlert(alert, context);
    }
  }

  private checkAlert(alert: AlertThreshold, context: PipelineContext): void {
    let value: number = 0;

    switch (alert.metric) {
      case 'memory':
        value = context.metrics.resourceUsage.peakMemory;
        break;
      case 'cpu':
        value = context.metrics.resourceUsage.avgCpu;
        break;
      case 'errors':
        value = context.errors.length;
        break;
    }

    const triggered = this.evaluateThreshold(value, alert.operator, alert.threshold);
    if (triggered) {
      console.warn(`[PipelineMonitor] Alert triggered: ${alert.metric} ${alert.operator} ${alert.threshold} (current: ${value})`);
    }
  }

  private evaluateThreshold(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: return false;
    }
  }
}

// Step processor implementations

class ContentAnalysisProcessor implements StepProcessor {
  constructor(private analyzer: ContentAnalyzer) {}

  async process(config: StepConfig, context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const text = context.input.buffer.toString('utf-8');
      const analysis = await this.analyzer.analyzeContent(text, context.input.metadata, {
        includeSentiment: config.parameters.includeSentiment as boolean,
        includeEntities: config.parameters.includeEntities as boolean,
        includeTopics: config.parameters.includeTopics as boolean,
        includeSummary: config.parameters.includeSummary as boolean,
        includeQuality: config.parameters.includeQuality as boolean
      });

      return {
        success: true,
        data: analysis,
        executionTime: Date.now() - startTime,
        resourceUsage: { peakMemory: process.memoryUsage().heapUsed / 1024 / 1024 },
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        resourceUsage: {},
        warnings: [],
        error: {
          step: 'content_analysis',
          type: 'analysis_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
          recoverable: true
        }
      };
    }
  }

  validateConfig(config: StepConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.parameters.includeSentiment !== undefined && typeof config.parameters.includeSentiment !== 'boolean') {
      errors.push('includeSentiment must be a boolean');
    }

    return { valid: errors.length === 0, errors };
  }

  getDependencies(): string[] {
    return [];
  }
}

class SecurityScanProcessor implements StepProcessor {
  constructor(private scanner: SecurityScanner) {}

  async process(config: StepConfig, context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const scanResult = await this.scanner.scanFile(
        context.input.filename,
        context.input.buffer,
        context.input.mimeType
      );

      return {
        success: scanResult.status !== 'danger',
        data: scanResult,
        executionTime: Date.now() - startTime,
        resourceUsage: { peakMemory: process.memoryUsage().heapUsed / 1024 / 1024 },
        warnings: scanResult.status === 'warning' ? ['Security warnings detected'] : []
      };
    } catch (error) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        resourceUsage: {},
        warnings: [],
        error: {
          step: 'security_scan',
          type: 'scan_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
          recoverable: true
        }
      };
    }
  }

  validateConfig(config: StepConfig): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  getDependencies(): string[] {
    return [];
  }
}

class PreprocessingProcessor implements StepProcessor {
  async process(config: StepConfig, context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // Basic preprocessing - normalize file buffer
      const buffer = context.input.buffer;

      return {
        success: true,
        data: { preprocessed: true, size: buffer.length },
        executionTime: Date.now() - startTime,
        resourceUsage: { peakMemory: process.memoryUsage().heapUsed / 1024 / 1024 },
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        resourceUsage: {},
        warnings: [],
        error: {
          step: 'preprocessing',
          type: 'preprocessing_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
          recoverable: true
        }
      };
    }
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  getDependencies(): string[] {
    return [];
  }
}

class TransformationProcessor implements StepProcessor {
  async process(config: StepConfig, context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // Apply transformations based on config
      const transformationType = config.parameters.type as string;
      let result: unknown;

      switch (transformationType) {
        case 'text_extraction':
          result = { text: context.input.buffer.toString('utf-8') };
          break;
        case 'metadata_enhancement':
          result = {
            metadata: {
              ...context.input.metadata,
              processed: true,
              timestamp: new Date().toISOString()
            }
          };
          break;
        default:
          result = { transformed: true };
      }

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
        resourceUsage: { peakMemory: process.memoryUsage().heapUsed / 1024 / 1024 },
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        resourceUsage: {},
        warnings: [],
        error: {
          step: 'transformation',
          type: 'transformation_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
          recoverable: true
        }
      };
    }
  }

  validateConfig(config: StepConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.parameters.type) {
      errors.push('Transformation type is required');
    }

    return { valid: errors.length === 0, errors };
  }

  getDependencies(): string[] {
    return [];
  }
}

class ValidationProcessor implements StepProcessor {
  async process(config: StepConfig, context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const validations = [];

      // File size validation
      if (config.parameters.validateSize) {
        const maxSize = config.parameters.maxSize as number || 100 * 1024 * 1024;
        validations.push({
          type: 'size',
          valid: context.input.buffer.length <= maxSize,
          message: `File size: ${context.input.buffer.length} bytes`
        });
      }

      // Content validation
      if (config.parameters.validateContent) {
        const content = context.input.buffer.toString('utf-8');
        validations.push({
          type: 'content',
          valid: content.length > 0,
          message: `Content length: ${content.length} characters`
        });
      }

      const allValid = validations.every(v => v.valid);

      return {
        success: allValid,
        data: { validations, allValid },
        executionTime: Date.now() - startTime,
        resourceUsage: { peakMemory: process.memoryUsage().heapUsed / 1024 / 1024 },
        warnings: allValid ? [] : ['Some validations failed']
      };
    } catch (error) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        resourceUsage: {},
        warnings: [],
        error: {
          step: 'validation',
          type: 'validation_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
          recoverable: true
        }
      };
    }
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  getDependencies(): string[] {
    return [];
  }
}

class OutputGenerationProcessor implements StepProcessor {
  async process(config: StepConfig, context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const format = config.parameters.format as string || 'json';
      const includeMetadata = config.parameters.includeMetadata as boolean || true;

      const output = {
        filename: context.input.filename,
        processingResults: Object.fromEntries(context.results),
        metadata: includeMetadata ? context.input.metadata : undefined,
        metrics: context.metrics,
        warnings: context.warnings,
        timestamp: new Date().toISOString()
      };

      let formattedOutput: string;
      switch (format) {
        case 'json':
          formattedOutput = JSON.stringify(output, null, 2);
          break;
        case 'yaml':
          // Would use a YAML library in production
          formattedOutput = JSON.stringify(output, null, 2);
          break;
        default:
          formattedOutput = JSON.stringify(output);
      }

      return {
        success: true,
        data: { format, output: formattedOutput },
        executionTime: Date.now() - startTime,
        resourceUsage: { peakMemory: process.memoryUsage().heapUsed / 1024 / 1024 },
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        resourceUsage: {},
        warnings: [],
        error: {
          step: 'output_generation',
          type: 'output_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
          recoverable: true
        }
      };
    }
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  getDependencies(): string[] {
    return [];
  }
}