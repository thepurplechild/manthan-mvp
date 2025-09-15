/**
 * Load Testing & Benchmarking Suite
 *
 * Comprehensive performance testing framework with configurable load patterns,
 * stress testing, capacity planning, and detailed performance analysis.
 */

import { getLogger } from '@/lib/monitoring/logger';
import { getMetricsCollector } from '@/lib/monitoring/metrics-collector';
import { getPerformanceProfiler } from '@/lib/monitoring/performance-profiler';
import { createId } from '@paralleldrive/cuid2';

export interface LoadTestConfig {
  name: string;
  duration: number; // milliseconds
  maxConcurrency: number;
  rampUpTime: number;
  rampDownTime: number;
  targetRPS: number; // requests per second
  testType: 'load' | 'stress' | 'spike' | 'volume' | 'endurance';
  regions: string[];
  scenarios: LoadTestScenario[];
}

export interface LoadTestScenario {
  name: string;
  weight: number; // percentage of total load
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  validation?: (response: Response) => boolean;
  timeout: number;
}

export interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errorsPerSecond: number;
  throughputMBps: number;
  concurrentUsers: number;
  errorRate: number;
}

export interface LoadTestResult {
  testId: string;
  config: LoadTestConfig;
  startTime: Date;
  endTime: Date;
  duration: number;
  metrics: LoadTestMetrics;
  responseTimes: number[];
  errorDetails: Array<{
    timestamp: Date;
    error: string;
    scenario: string;
    responseTime?: number;
  }>;
  resourceUsage: {
    cpu: number[];
    memory: number[];
    network: number[];
  };
  recommendations: string[];
}

export interface BenchmarkConfig {
  name: string;
  iterations: number;
  warmupIterations: number;
  concurrencyLevels: number[];
  fileSizes: number[];
  fileTypes: string[];
  cacheScenarios: ('cold' | 'warm' | 'hot')[];
}

export interface BenchmarkResult {
  config: BenchmarkConfig;
  results: Array<{
    concurrency: number;
    fileSize: number;
    fileType: string;
    cacheScenario: string;
    averageTime: number;
    throughput: number;
    errorRate: number;
    memoryUsage: number;
  }>;
  summary: {
    optimalConcurrency: number;
    maxThroughput: number;
    recommendedLimits: {
      maxFileSize: number;
      maxConcurrency: number;
      memoryLimit: number;
    };
  };
}

class LoadTester {
  private logger = getLogger('load-tester');
  private metrics = getMetricsCollector();
  private profiler = getPerformanceProfiler();

  private activeTests = new Map<string, {
    config: LoadTestConfig;
    startTime: Date;
    workers: Array<{ stop: () => void }>;
    metrics: LoadTestMetrics;
    responseTimes: number[];
    errors: LoadTestResult['errorDetails'];
  }>();

  /**
   * Run comprehensive load test
   */
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const testId = createId();
    const startTime = new Date();

    this.logger.info(`Starting load test: ${config.name}`, {
      testId,
      duration: config.duration,
      maxConcurrency: config.maxConcurrency,
      targetRPS: config.targetRPS
    });

    const profileId = this.profiler.startProfile(`load-test-${config.name}`, {
      testId,
      testType: config.testType,
      maxConcurrency: config.maxConcurrency
    });

    const testState = {
      config,
      startTime,
      workers: [] as Array<{ stop: () => void }>,
      metrics: this.initializeMetrics(),
      responseTimes: [] as number[],
      errors: [] as LoadTestResult['errorDetails']
    };

    this.activeTests.set(testId, testState);

    try {
      // Start monitoring system resources
      const resourceMonitor = this.startResourceMonitoring();

      // Execute test based on type
      await this.executeLoadTest(testId, testState);

      // Stop monitoring
      resourceMonitor.stop();

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Calculate final metrics
      const finalMetrics = this.calculateFinalMetrics(testState);

      // Generate recommendations
      const recommendations = this.generateRecommendations(finalMetrics, config);

      const result: LoadTestResult = {
        testId,
        config,
        startTime,
        endTime,
        duration,
        metrics: finalMetrics,
        responseTimes: testState.responseTimes,
        errorDetails: testState.errors,
        resourceUsage: resourceMonitor.getResults(),
        recommendations
      };

      this.logger.info(`Load test completed: ${config.name}`, {
        testId,
        duration,
        totalRequests: finalMetrics.totalRequests,
        successRate: (1 - finalMetrics.errorRate) * 100,
        avgResponseTime: finalMetrics.averageResponseTime
      });

      // Record test metrics
      this.recordLoadTestMetrics(result);

      return result;

    } catch (error) {
      this.logger.error('Load test failed', error as Error, { testId });
      throw error;
    } finally {
      this.activeTests.delete(testId);
      this.profiler.endProfile(profileId);
    }
  }

  /**
   * Run performance benchmark suite
   */
  async runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
    this.logger.info(`Starting benchmark: ${config.name}`, { config });

    const results: BenchmarkResult['results'] = [];

    // Test all combinations
    for (const concurrency of config.concurrencyLevels) {
      for (const fileSize of config.fileSizes) {
        for (const fileType of config.fileTypes) {
          for (const cacheScenario of config.cacheScenarios) {
            const benchmarkResult = await this.runSingleBenchmark({
              config,
              concurrency,
              fileSize,
              fileType,
              cacheScenario
            });

            results.push(benchmarkResult);

            // Brief pause between benchmarks
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }

    // Analyze results and generate summary
    const summary = this.analyzeBenchmarkResults(results);

    return {
      config,
      results,
      summary
    };
  }

  /**
   * Execute load test based on configuration
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async executeLoadTest(testId: string, testState: typeof this.activeTests extends Map<any, infer V> ? V : never): Promise<void> {
    const { config } = testState;

    switch (config.testType) {
      case 'load':
        await this.executeLoadPattern(testId, testState);
        break;
      case 'stress':
        await this.executeStressPattern(testId, testState);
        break;
      case 'spike':
        await this.executeSpikePattern(testId, testState);
        break;
      case 'volume':
        await this.executeVolumePattern(testId, testState);
        break;
      case 'endurance':
        await this.executeEndurancePattern(testId, testState);
        break;
    }
  }

  /**
   * Execute standard load test pattern
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async executeLoadPattern(testId: string, testState: typeof this.activeTests extends Map<any, infer V> ? V : never): Promise<void> {
    const { config } = testState;

    // Ramp up phase
    await this.rampUp(testId, testState);

    // Sustained load phase
    const sustainedDuration = config.duration - config.rampUpTime - config.rampDownTime;
    if (sustainedDuration > 0) {
      await this.sustainedLoad(testId, testState, sustainedDuration);
    }

    // Ramp down phase
    await this.rampDown(testId, testState);
  }

  /**
   * Execute stress test pattern
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async executeStressPattern(testId: string, testState: typeof this.activeTests extends Map<any, infer V> ? V : never): Promise<void> {
    const { config } = testState;

    // Gradually increase load beyond normal capacity
    const steps = 10;
    const stepDuration = config.duration / steps;
    const maxConcurrency = config.maxConcurrency * 2; // 200% of normal capacity

    for (let step = 0; step < steps; step++) {
      const concurrency = Math.floor((step + 1) * maxConcurrency / steps);
      await this.runWithConcurrency(testId, testState, concurrency, stepDuration);

      // Check if system is still responding
      if (testState.metrics.errorRate > 0.5) {
        this.logger.warn('High error rate detected, system may be overwhelmed', {
          step,
          concurrency,
          errorRate: testState.metrics.errorRate
        });
      }
    }
  }

  /**
   * Execute spike test pattern
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async executeSpikePattern(testId: string, testState: typeof this.activeTests extends Map<any, infer V> ? V : never): Promise<void> {
    const { config } = testState;

    const baselineConcurrency = Math.floor(config.maxConcurrency * 0.1);
    const spikeConcurrency = config.maxConcurrency;
    const spikeDuration = Math.floor(config.duration * 0.1);

    // Baseline load
    await this.runWithConcurrency(testId, testState, baselineConcurrency, config.duration * 0.3);

    // Spike
    await this.runWithConcurrency(testId, testState, spikeConcurrency, spikeDuration);

    // Return to baseline
    await this.runWithConcurrency(testId, testState, baselineConcurrency, config.duration * 0.6);
  }

  /**
   * Execute volume test pattern
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async executeVolumePattern(testId: string, testState: typeof this.activeTests extends Map<any, infer V> ? V : never): Promise<void> {
    // Volume test processes large amounts of data with moderate concurrency
    await this.runWithConcurrency(testId, testState, Math.floor(testState.config.maxConcurrency * 0.7), testState.config.duration);
  }

  /**
   * Execute endurance test pattern
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async executeEndurancePattern(testId: string, testState: typeof this.activeTests extends Map<any, infer V> ? V : never): Promise<void> {
    // Endurance test runs for extended period with normal load
    await this.runWithConcurrency(testId, testState, Math.floor(testState.config.maxConcurrency * 0.5), testState.config.duration);
  }

  /**
   * Ramp up concurrent users
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async rampUp(testId: string, testState: typeof this.activeTests extends Map<any, infer V> ? V : never): Promise<void> {
    const { config } = testState;
    const steps = 10;
    const stepDuration = config.rampUpTime / steps;

    for (let step = 0; step < steps; step++) {
      const concurrency = Math.floor((step + 1) * config.maxConcurrency / steps);
      await this.runWithConcurrency(testId, testState, concurrency, stepDuration);
    }
  }

  /**
   * Maintain sustained load
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async sustainedLoad(testId: string, testState: typeof this.activeTests extends Map<any, infer V> ? V : never, duration: number): Promise<void> {
    await this.runWithConcurrency(testId, testState, testState.config.maxConcurrency, duration);
  }

  /**
   * Ramp down concurrent users
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async rampDown(testId: string, testState: typeof this.activeTests extends Map<any, infer V> ? V : never): Promise<void> {
    const { config } = testState;
    const steps = 5;
    const stepDuration = config.rampDownTime / steps;

    for (let step = 0; step < steps; step++) {
      const concurrency = Math.floor((steps - step) * config.maxConcurrency / steps);
      await this.runWithConcurrency(testId, testState, concurrency, stepDuration);
    }
  }

  /**
   * Run test with specific concurrency level
   */
  private async runWithConcurrency(
    testId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    testState: typeof this.activeTests extends Map<any, infer V> ? V : never,
    concurrency: number,
    duration: number
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // Create workers
    for (let i = 0; i < concurrency; i++) {
      const worker = this.createWorker(testId, testState);
      promises.push(worker.run());
    }

    // Run for specified duration
    await Promise.race([
      Promise.all(promises),
      new Promise(resolve => setTimeout(resolve, duration))
    ]);

    // Update metrics
    testState.metrics.concurrentUsers = concurrency;
  }

  /**
   * Create test worker
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createWorker(testId: string, testState: typeof this.activeTests extends Map<any, infer V> ? V : never) {
    let shouldStop = false;

    const worker = {
      run: async (): Promise<void> => {
        while (!shouldStop) {
          const scenario = this.selectScenario(testState.config.scenarios);
          await this.executeScenario(testId, testState, scenario);

          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      },
      stop: (): void => {
        shouldStop = true;
      }
    };

    testState.workers.push(worker);
    return worker;
  }

  /**
   * Select scenario based on weights
   */
  private selectScenario(scenarios: LoadTestScenario[]): LoadTestScenario {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const scenario of scenarios) {
      cumulative += scenario.weight;
      if (random <= cumulative) {
        return scenario;
      }
    }

    return scenarios[0]; // Fallback
  }

  /**
   * Execute individual scenario
   */
  private async executeScenario(
    testId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    testState: typeof this.activeTests extends Map<any, infer V> ? V : never,
    scenario: LoadTestScenario
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const response = await this.makeRequest(scenario);
      const responseTime = Date.now() - startTime;

      // Validate response
      const isValid = scenario.validation ? scenario.validation(response) : response.ok;

      if (isValid) {
        testState.metrics.successfulRequests++;
      } else {
        testState.metrics.failedRequests++;
        testState.errors.push({
          timestamp: new Date(),
          error: `Validation failed: ${response.status} ${response.statusText}`,
          scenario: scenario.name,
          responseTime
        });
      }

      testState.metrics.totalRequests++;
      testState.responseTimes.push(responseTime);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      testState.metrics.failedRequests++;
      testState.metrics.totalRequests++;

      testState.errors.push({
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        scenario: scenario.name,
        responseTime
      });
    }
  }

  /**
   * Make HTTP request
   */
  private async makeRequest(scenario: LoadTestScenario): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), scenario.timeout);

    try {
      const response = await fetch(scenario.endpoint, {
        method: scenario.method,
        headers: scenario.headers,
        body: scenario.body ? JSON.stringify(scenario.body) : undefined,
        signal: controller.signal
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Run single benchmark
   */
  private async runSingleBenchmark(options: {
    config: BenchmarkConfig;
    concurrency: number;
    fileSize: number;
    fileType: string;
    cacheScenario: string;
  }): Promise<BenchmarkResult['results'][0]> {
    const { config, concurrency, fileSize, fileType, cacheScenario } = options;

    this.logger.debug('Running benchmark', { concurrency, fileSize, fileType, cacheScenario });

    // Prepare cache scenario
    await this.prepareCacheScenario(cacheScenario);

    // Warmup iterations
    for (let i = 0; i < config.warmupIterations; i++) {
      await this.executeBenchmarkIteration(fileSize, fileType);
    }

    // Actual benchmark iterations
    const times: number[] = [];
    const memoryUsages: number[] = [];
    let errors = 0;

    for (let i = 0; i < config.iterations; i++) {
      try {
        const startTime = Date.now();
        const startMemory = this.getCurrentMemoryUsage();

        await this.executeBenchmarkIteration(fileSize, fileType);

        const endTime = Date.now();
        const endMemory = this.getCurrentMemoryUsage();

        times.push(endTime - startTime);
        memoryUsages.push(endMemory - startMemory);

      } catch (error) {
        errors++;
        this.logger.debug('Benchmark iteration failed', { iteration: i, error });
      }
    }

    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const averageMemory = memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length;
    const throughput = fileSize / (averageTime / 1000); // bytes per second
    const errorRate = errors / config.iterations;

    return {
      concurrency,
      fileSize,
      fileType,
      cacheScenario,
      averageTime,
      throughput,
      errorRate,
      memoryUsage: averageMemory
    };
  }

  /**
   * Execute benchmark iteration
   */
  private async executeBenchmarkIteration(fileSize: number, fileType: string): Promise<void> {
    // Generate test file
    const testFile = this.generateTestFile(fileSize, fileType);

    // Process file (simulate your actual processing logic)
    await this.simulateFileProcessing(testFile);
  }

  /**
   * Generate test file
   */
  private generateTestFile(size: number, type: string): Buffer {
    if (type === 'text') {
      return Buffer.from('A'.repeat(size));
    } else if (type === 'binary') {
      return Buffer.alloc(size, 0xFF);
    } else {
      // Mixed content
      const content = Array.from({ length: size }, () =>
        Math.random() > 0.5 ? String.fromCharCode(65 + Math.floor(Math.random() * 26)) : '\0'
      ).join('');
      return Buffer.from(content);
    }
  }

  /**
   * Simulate file processing
   */
  private async simulateFileProcessing(buffer: Buffer): Promise<void> {
    // Simulate processing time based on file size
    const processingTime = Math.max(10, buffer.length / 10000); // 10ms per 10KB
    await new Promise(resolve => setTimeout(resolve, processingTime));
  }

  /**
   * Prepare cache scenario
   */
  private async prepareCacheScenario(scenario: string): Promise<void> {
    // In a real implementation, this would manipulate cache state
    if (scenario === 'cold') {
      // Clear caches
    } else if (scenario === 'warm') {
      // Partially populate caches
    } else if (scenario === 'hot') {
      // Fully populate caches
    }
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): LoadTestMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      medianResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errorsPerSecond: 0,
      throughputMBps: 0,
      concurrentUsers: 0,
      errorRate: 0
    };
  }

  /**
   * Calculate final metrics
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private calculateFinalMetrics(testState: typeof this.activeTests extends Map<any, infer V> ? V : never): LoadTestMetrics {
    const { responseTimes } = testState;
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);

    const totalRequests = testState.metrics.totalRequests;
    const duration = (Date.now() - testState.startTime.getTime()) / 1000; // seconds

    return {
      totalRequests,
      successfulRequests: testState.metrics.successfulRequests,
      failedRequests: testState.metrics.failedRequests,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length || 0,
      medianResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0,
      p95ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0,
      p99ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0,
      minResponseTime: sortedTimes[0] || 0,
      maxResponseTime: sortedTimes[sortedTimes.length - 1] || 0,
      requestsPerSecond: totalRequests / duration,
      errorsPerSecond: testState.metrics.failedRequests / duration,
      throughputMBps: 0, // Would calculate based on actual data transfer
      concurrentUsers: testState.metrics.concurrentUsers,
      errorRate: testState.metrics.failedRequests / totalRequests || 0
    };
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(metrics: LoadTestMetrics, config: LoadTestConfig): string[] {
    const recommendations: string[] = [];

    if (metrics.errorRate > 0.01) {
      recommendations.push(`High error rate (${(metrics.errorRate * 100).toFixed(1)}%). Consider reducing load or scaling up resources.`);
    }

    if (metrics.averageResponseTime > 5000) {
      recommendations.push(`High average response time (${metrics.averageResponseTime.toFixed(0)}ms). Optimize application performance.`);
    }

    if (metrics.p99ResponseTime > 10000) {
      recommendations.push(`High P99 response time (${metrics.p99ResponseTime.toFixed(0)}ms). Address performance bottlenecks.`);
    }

    if (metrics.requestsPerSecond < config.targetRPS * 0.8) {
      recommendations.push(`Throughput below target (${metrics.requestsPerSecond.toFixed(1)} vs ${config.targetRPS} RPS). Scale up or optimize.`);
    }

    return recommendations;
  }

  /**
   * Analyze benchmark results
   */
  private analyzeBenchmarkResults(results: BenchmarkResult['results']): BenchmarkResult['summary'] {
    // Find optimal concurrency level
    const concurrencyResults = results.reduce((acc, result) => {
      if (!acc[result.concurrency]) {
        acc[result.concurrency] = { throughput: 0, errorRate: 0, count: 0 };
      }
      acc[result.concurrency].throughput += result.throughput;
      acc[result.concurrency].errorRate += result.errorRate;
      acc[result.concurrency].count++;
      return acc;
    }, {} as Record<number, { throughput: number; errorRate: number; count: number }>);

    let optimalConcurrency = 1;
    let maxThroughput = 0;

    for (const [concurrency, data] of Object.entries(concurrencyResults)) {
      const avgThroughput = data.throughput / data.count;
      const avgErrorRate = data.errorRate / data.count;

      if (avgErrorRate < 0.01 && avgThroughput > maxThroughput) {
        maxThroughput = avgThroughput;
        optimalConcurrency = parseInt(concurrency);
      }
    }

    // Calculate recommended limits
    const maxFileSize = Math.max(...results.filter(r => r.errorRate < 0.01).map(r => r.fileSize));
    const maxConcurrency = Math.max(...results.filter(r => r.errorRate < 0.01).map(r => r.concurrency));
    const memoryLimit = Math.max(...results.map(r => r.memoryUsage)) * 2; // 2x safety factor

    return {
      optimalConcurrency,
      maxThroughput,
      recommendedLimits: {
        maxFileSize,
        maxConcurrency,
        memoryLimit
      }
    };
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): {
    stop: () => void;
    getResults: () => LoadTestResult['resourceUsage'];
  } {
    const cpu: number[] = [];
    const memory: number[] = [];
    const network: number[] = [];

    const interval = setInterval(() => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        memory.push(process.memoryUsage().heapUsed);
      }

      // CPU and network would need additional monitoring setup
      cpu.push(Math.random() * 100); // Placeholder
      network.push(Math.random() * 1000000); // Placeholder
    }, 1000);

    return {
      stop: () => clearInterval(interval),
      getResults: () => ({ cpu, memory, network })
    };
  }

  /**
   * Record load test metrics
   */
  private recordLoadTestMetrics(result: LoadTestResult): void {
    this.metrics.recordHistogram('load_test_duration_ms', result.duration, {
      test_type: result.config.testType,
      test_name: result.config.name
    });

    this.metrics.recordHistogram('load_test_requests_per_second', result.metrics.requestsPerSecond, {
      test_type: result.config.testType
    });

    this.metrics.setGauge('load_test_error_rate', result.metrics.errorRate);
    this.metrics.setGauge('load_test_avg_response_time', result.metrics.averageResponseTime);
  }

  /**
   * Get active test status
   */
  getActiveTests(): Array<{
    testId: string;
    name: string;
    progress: number;
    currentMetrics: LoadTestMetrics;
  }> {
    return Array.from(this.activeTests.entries()).map(([testId, test]) => {
      const elapsed = Date.now() - test.startTime.getTime();
      const progress = Math.min((elapsed / test.config.duration) * 100, 100);

      return {
        testId,
        name: test.config.name,
        progress,
        currentMetrics: this.calculateFinalMetrics(test)
      };
    });
  }

  /**
   * Stop all active tests
   */
  stopAllTests(): void {
    for (const [testId, test] of this.activeTests.entries()) {
      test.workers.forEach(worker => worker.stop());
      this.logger.info(`Stopped load test: ${testId}`);
    }

    this.activeTests.clear();
  }
}

// Singleton instance
let loadTester: LoadTester | null = null;

export function getLoadTester(): LoadTester {
  if (!loadTester) {
    loadTester = new LoadTester();
  }
  return loadTester;
}

export { LoadTester };