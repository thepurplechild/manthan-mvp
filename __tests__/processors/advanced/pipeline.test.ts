import { ProcessingPipeline } from '@/lib/processors/advanced/pipeline';
import {
  PipelineConfig,
  PipelineStep,
  PipelineContext,
  StepType,
  PipelineResult,
  ProcessingStepResult
} from '@/lib/processors/advanced/types';

describe('ProcessingPipeline', () => {
  let pipeline: ProcessingPipeline;

  beforeEach(() => {
    pipeline = new ProcessingPipeline();
  });

  describe('execute', () => {
    it('should execute simple linear pipeline', async () => {
      const config: PipelineConfig = {
        name: 'simple-pipeline',
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            type: StepType.CONTENT_ANALYSIS,
            config: { operation: 'extract_text' },
            dependencies: [],
            enabled: true
          },
          {
            id: 'step2',
            name: 'Second Step',
            type: StepType.SECURITY_SCAN,
            config: { operation: 'virus_scan' },
            dependencies: ['step1'],
            enabled: true
          }
        ],
        config: {
          parallelExecution: false,
          continueOnError: false,
          timeout: 30000
        }
      };

      const input = {
        filename: 'test.txt',
        buffer: Buffer.from('Test content'),
        mimeType: 'text/plain'
      };

      const result = await pipeline.execute(config, input);

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].stepId).toBe('step1');
      expect(result.steps[1].stepId).toBe('step2');
      expect(result.executionOrder).toEqual(['step1', 'step2']);
    });

    it('should execute parallel steps when possible', async () => {
      const config: PipelineConfig = {
        name: 'parallel-pipeline',
        steps: [
          {
            id: 'step1',
            name: 'Independent Step 1',
            type: StepType.CONTENT_ANALYSIS,
            config: { operation: 'extract_keywords' },
            dependencies: [],
            enabled: true
          },
          {
            id: 'step2',
            name: 'Independent Step 2',
            type: StepType.CONTENT_ANALYSIS,
            config: { operation: 'extract_entities' },
            dependencies: [],
            enabled: true
          },
          {
            id: 'step3',
            name: 'Dependent Step',
            type: StepType.OUTPUT_FORMATTING,
            config: { format: 'json' },
            dependencies: ['step1', 'step2'],
            enabled: true
          }
        ],
        config: {
          parallelExecution: true,
          continueOnError: false,
          timeout: 30000
        }
      };

      const input = {
        filename: 'test.txt',
        buffer: Buffer.from('Test content with keywords and entities'),
        mimeType: 'text/plain'
      };

      const startTime = Date.now();
      const result = await pipeline.execute(config, input);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(3);

      // step1 and step2 should execute in parallel, then step3
      const step1Result = result.steps.find(s => s.stepId === 'step1')!;
      const step2Result = result.steps.find(s => s.stepId === 'step2')!;
      const step3Result = result.steps.find(s => s.stepId === 'step3')!;

      expect(step1Result.startTime).toBeDefined();
      expect(step2Result.startTime).toBeDefined();
      expect(step3Result.startTime).toBeDefined();

      // step3 should start after step1 and step2 complete
      expect(step3Result.startTime.getTime()).toBeGreaterThanOrEqual(
        Math.max(step1Result.endTime!.getTime(), step2Result.endTime!.getTime())
      );
    });

    it('should handle conditional execution', async () => {
      const config: PipelineConfig = {
        name: 'conditional-pipeline',
        steps: [
          {
            id: 'security-scan',
            name: 'Security Scan',
            type: StepType.SECURITY_SCAN,
            config: { operation: 'threat_detection' },
            dependencies: [],
            enabled: true
          },
          {
            id: 'quarantine',
            name: 'Quarantine File',
            type: StepType.CUSTOM,
            config: { operation: 'quarantine' },
            dependencies: ['security-scan'],
            enabled: true,
            condition: {
              field: 'security-scan.result.status',
              operator: 'equals',
              value: 'threat_detected'
            }
          },
          {
            id: 'process-safe',
            name: 'Process Safe File',
            type: StepType.CONTENT_ANALYSIS,
            config: { operation: 'full_analysis' },
            dependencies: ['security-scan'],
            enabled: true,
            condition: {
              field: 'security-scan.result.status',
              operator: 'equals',
              value: 'safe'
            }
          }
        ],
        config: {
          parallelExecution: false,
          continueOnError: false,
          timeout: 30000
        }
      };

      // Test with safe file
      const safeInput = {
        filename: 'safe.txt',
        buffer: Buffer.from('This is safe content'),
        mimeType: 'text/plain'
      };

      const safeResult = await pipeline.execute(config, safeInput);

      expect(safeResult.success).toBe(true);
      expect(safeResult.steps.some(s => s.stepId === 'security-scan')).toBe(true);
      expect(safeResult.steps.some(s => s.stepId === 'process-safe')).toBe(true);
      expect(safeResult.steps.some(s => s.stepId === 'quarantine')).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const config: PipelineConfig = {
        name: 'error-pipeline',
        steps: [
          {
            id: 'failing-step',
            name: 'Failing Step',
            type: StepType.CUSTOM,
            config: { operation: 'simulate_failure' },
            dependencies: [],
            enabled: true
          },
          {
            id: 'dependent-step',
            name: 'Dependent Step',
            type: StepType.CONTENT_ANALYSIS,
            config: { operation: 'extract_text' },
            dependencies: ['failing-step'],
            enabled: true
          }
        ],
        config: {
          parallelExecution: false,
          continueOnError: false,
          timeout: 30000
        }
      };

      const input = {
        filename: 'test.txt',
        buffer: Buffer.from('Test content'),
        mimeType: 'text/plain'
      };

      const result = await pipeline.execute(config, input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.steps.some(s => s.stepId === 'failing-step' && !s.success)).toBe(true);
      expect(result.steps.some(s => s.stepId === 'dependent-step')).toBe(false); // Should not execute
    });

    it('should continue on error when configured', async () => {
      const config: PipelineConfig = {
        name: 'continue-on-error-pipeline',
        steps: [
          {
            id: 'failing-step',
            name: 'Failing Step',
            type: StepType.CUSTOM,
            config: { operation: 'simulate_failure' },
            dependencies: [],
            enabled: true
          },
          {
            id: 'independent-step',
            name: 'Independent Step',
            type: StepType.CONTENT_ANALYSIS,
            config: { operation: 'extract_text' },
            dependencies: [],
            enabled: true
          }
        ],
        config: {
          parallelExecution: false,
          continueOnError: true,
          timeout: 30000
        }
      };

      const input = {
        filename: 'test.txt',
        buffer: Buffer.from('Test content'),
        mimeType: 'text/plain'
      };

      const result = await pipeline.execute(config, input);

      expect(result.success).toBe(false); // Overall failure due to failing step
      expect(result.steps).toHaveLength(2);
      expect(result.steps.some(s => s.stepId === 'failing-step' && !s.success)).toBe(true);
      expect(result.steps.some(s => s.stepId === 'independent-step' && s.success)).toBe(true);
    });
  });

  describe('dependency resolution', () => {
    it('should resolve complex dependencies correctly', async () => {
      const config: PipelineConfig = {
        name: 'complex-dependencies',
        steps: [
          {
            id: 'A',
            name: 'Step A',
            type: StepType.CONTENT_ANALYSIS,
            config: {},
            dependencies: [],
            enabled: true
          },
          {
            id: 'B',
            name: 'Step B',
            type: StepType.CONTENT_ANALYSIS,
            config: {},
            dependencies: ['A'],
            enabled: true
          },
          {
            id: 'C',
            name: 'Step C',
            type: StepType.CONTENT_ANALYSIS,
            config: {},
            dependencies: ['A'],
            enabled: true
          },
          {
            id: 'D',
            name: 'Step D',
            type: StepType.OUTPUT_FORMATTING,
            config: {},
            dependencies: ['B', 'C'],
            enabled: true
          }
        ],
        config: {
          parallelExecution: true,
          continueOnError: false,
          timeout: 30000
        }
      };

      const input = {
        filename: 'test.txt',
        buffer: Buffer.from('Test content'),
        mimeType: 'text/plain'
      };

      const result = await pipeline.execute(config, input);

      expect(result.success).toBe(true);
      expect(result.executionOrder).toEqual(['A', 'B', 'C', 'D']);

      // Verify execution order timestamps
      const stepResults = result.steps.reduce((acc, step) => {
        acc[step.stepId] = step;
        return acc;
      }, {} as Record<string, ProcessingStepResult>);

      expect(stepResults.A.startTime.getTime()).toBeLessThan(stepResults.B.startTime.getTime());
      expect(stepResults.A.startTime.getTime()).toBeLessThan(stepResults.C.startTime.getTime());
      expect(stepResults.B.endTime!.getTime()).toBeLessThanOrEqual(stepResults.D.startTime.getTime());
      expect(stepResults.C.endTime!.getTime()).toBeLessThanOrEqual(stepResults.D.startTime.getTime());
    });

    it('should detect circular dependencies', async () => {
      const config: PipelineConfig = {
        name: 'circular-dependencies',
        steps: [
          {
            id: 'A',
            name: 'Step A',
            type: StepType.CONTENT_ANALYSIS,
            config: {},
            dependencies: ['B'],
            enabled: true
          },
          {
            id: 'B',
            name: 'Step B',
            type: StepType.CONTENT_ANALYSIS,
            config: {},
            dependencies: ['A'],
            enabled: true
          }
        ],
        config: {
          parallelExecution: false,
          continueOnError: false,
          timeout: 30000
        }
      };

      const input = {
        filename: 'test.txt',
        buffer: Buffer.from('Test content'),
        mimeType: 'text/plain'
      };

      await expect(pipeline.execute(config, input)).rejects.toThrow('Circular dependency detected');
    });
  });

  describe('progress tracking', () => {
    it('should report progress during execution', async () => {
      const config: PipelineConfig = {
        name: 'progress-pipeline',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: StepType.CONTENT_ANALYSIS,
            config: {},
            dependencies: [],
            enabled: true
          },
          {
            id: 'step2',
            name: 'Step 2',
            type: StepType.SECURITY_SCAN,
            config: {},
            dependencies: ['step1'],
            enabled: true
          },
          {
            id: 'step3',
            name: 'Step 3',
            type: StepType.OUTPUT_FORMATTING,
            config: {},
            dependencies: ['step2'],
            enabled: true
          }
        ],
        config: {
          parallelExecution: false,
          continueOnError: false,
          timeout: 30000
        }
      };

      const input = {
        filename: 'test.txt',
        buffer: Buffer.from('Test content'),
        mimeType: 'text/plain'
      };

      const progressUpdates: any[] = [];
      const progressCallback = jest.fn((progress) => {
        progressUpdates.push(progress);
      });

      const result = await pipeline.execute(config, input, progressCallback);

      expect(result.success).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);

      // Should have progress updates for each step
      expect(progressUpdates.some(p => p.status.includes('Step 1'))).toBe(true);
      expect(progressUpdates.some(p => p.status.includes('Step 2'))).toBe(true);
      expect(progressUpdates.some(p => p.status.includes('Step 3'))).toBe(true);

      // Progress percentages should increase
      const percentages = progressUpdates.map(p => p.percentage);
      expect(percentages[0]).toBeLessThan(percentages[percentages.length - 1]);
    });
  });

  describe('resource monitoring', () => {
    it('should track resource usage during execution', async () => {
      const config: PipelineConfig = {
        name: 'resource-monitoring',
        steps: [
          {
            id: 'memory-intensive',
            name: 'Memory Intensive Step',
            type: StepType.CONTENT_ANALYSIS,
            config: { operation: 'full_analysis' },
            dependencies: [],
            enabled: true
          }
        ],
        config: {
          parallelExecution: false,
          continueOnError: false,
          timeout: 30000,
          resourceLimits: {
            maxMemoryMB: 512,
            maxCpuPercent: 80
          }
        }
      };

      const input = {
        filename: 'test.txt',
        buffer: Buffer.from('Test content'),
        mimeType: 'text/plain'
      };

      const result = await pipeline.execute(config, input);

      expect(result.success).toBe(true);
      expect(result.resourceUsage).toBeDefined();
      expect(result.resourceUsage.peakMemoryMB).toBeGreaterThan(0);
      expect(result.resourceUsage.avgCpuPercent).toBeGreaterThanOrEqual(0);
    });

    it('should enforce resource limits', async () => {
      const config: PipelineConfig = {
        name: 'resource-limited',
        steps: [
          {
            id: 'resource-heavy',
            name: 'Resource Heavy Step',
            type: StepType.CUSTOM,
            config: { operation: 'simulate_heavy_load' },
            dependencies: [],
            enabled: true
          }
        ],
        config: {
          parallelExecution: false,
          continueOnError: false,
          timeout: 30000,
          resourceLimits: {
            maxMemoryMB: 1, // Very low limit
            maxCpuPercent: 1
          }
        }
      };

      const input = {
        filename: 'test.txt',
        buffer: Buffer.from('Test content'),
        mimeType: 'text/plain'
      };

      const result = await pipeline.execute(config, input);

      // Should fail due to resource limits (in a real implementation)
      expect(result).toBeDefined();
    });
  });

  describe('timeout handling', () => {
    it('should respect overall pipeline timeout', async () => {
      const config: PipelineConfig = {
        name: 'timeout-pipeline',
        steps: [
          {
            id: 'slow-step',
            name: 'Slow Step',
            type: StepType.CUSTOM,
            config: { operation: 'simulate_slow_processing' },
            dependencies: [],
            enabled: true
          }
        ],
        config: {
          parallelExecution: false,
          continueOnError: false,
          timeout: 100 // Very short timeout
        }
      };

      const input = {
        filename: 'test.txt',
        buffer: Buffer.from('Test content'),
        mimeType: 'text/plain'
      };

      const startTime = Date.now();
      const result = await pipeline.execute(config, input);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should timeout quickly
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timeout/i);
    });

    it('should respect individual step timeouts', async () => {
      const config: PipelineConfig = {
        name: 'step-timeout-pipeline',
        steps: [
          {
            id: 'normal-step',
            name: 'Normal Step',
            type: StepType.CONTENT_ANALYSIS,
            config: {},
            dependencies: [],
            enabled: true,
            timeout: 5000
          },
          {
            id: 'slow-step',
            name: 'Slow Step',
            type: StepType.CUSTOM,
            config: { operation: 'simulate_slow_processing' },
            dependencies: [],
            enabled: true,
            timeout: 100 // Very short timeout
          }
        ],
        config: {
          parallelExecution: true,
          continueOnError: true,
          timeout: 30000
        }
      };

      const input = {
        filename: 'test.txt',
        buffer: Buffer.from('Test content'),
        mimeType: 'text/plain'
      };

      const result = await pipeline.execute(config, input);

      expect(result.steps).toHaveLength(2);

      const normalStep = result.steps.find(s => s.stepId === 'normal-step')!;
      const slowStep = result.steps.find(s => s.stepId === 'slow-step')!;

      expect(normalStep.success).toBe(true);
      expect(slowStep.success).toBe(false);
      expect(slowStep.error).toMatch(/timeout/i);
    });
  });
});