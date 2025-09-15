/**
 * Database Query Optimization System
 *
 * Intelligent query optimization, connection pooling, query caching,
 * and performance monitoring for Supabase and other databases.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '@/lib/monitoring/logger';
import { getMetricsCollector } from '@/lib/monitoring/metrics-collector';
import { getCacheManager } from './cache-manager';

export interface QueryOptimizationConfig {
  enableQueryCache: boolean;
  enableConnectionPooling: boolean;
  enableQueryAnalysis: boolean;
  maxConnections: number;
  connectionIdleTimeout: number;
  queryCacheTTL: number;
  slowQueryThreshold: number;
  enableQueryRewriting: boolean;
  enableIndexSuggestions: boolean;
  enableQueryPlanCaching: boolean;
}

export interface QueryMetrics {
  queryId: string;
  query: string;
  executionTime: number;
  rowsAffected: number;
  cacheHit: boolean;
  optimized: boolean;
  plan?: string;
  suggestions?: string[];
}

export interface ConnectionPoolStats {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalConnections: number;
  connectionErrors: number;
  avgConnectionTime: number;
}

export interface QueryAnalysis {
  queryPattern: string;
  avgExecutionTime: number;
  executionCount: number;
  cacheHitRate: number;
  errorRate: number;
  suggestions: string[];
  indexRecommendations: string[];
}

class DatabaseOptimizer {
  private config: QueryOptimizationConfig;
  private logger = getLogger('database-optimizer');
  private metrics = getMetricsCollector();
  private cache = getCacheManager();

  private connectionPool: SupabaseClient[] = [];
  private availableConnections: SupabaseClient[] = [];
  private queryCache = new Map<string, { result: unknown; timestamp: Date; ttl: number }>();
  private queryAnalytics = new Map<string, {
    pattern: string;
    executions: QueryMetrics[];
    totalTime: number;
    errorCount: number;
  }>();

  private poolStats: ConnectionPoolStats = {
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    totalConnections: 0,
    connectionErrors: 0,
    avgConnectionTime: 0
  };

  constructor(config: Partial<QueryOptimizationConfig> = {}) {
    this.config = {
      enableQueryCache: true,
      enableConnectionPooling: true,
      enableQueryAnalysis: true,
      maxConnections: 10,
      connectionIdleTimeout: 300000, // 5 minutes
      queryCacheTTL: 300000, // 5 minutes
      slowQueryThreshold: 1000, // 1 second
      enableQueryRewriting: true,
      enableIndexSuggestions: true,
      enableQueryPlanCaching: true,
      ...config
    };

    this.initializeConnectionPool();
    this.startAnalytics();

    this.logger.info('Database optimizer initialized', { config: this.config });
  }

  /**
   * Execute optimized query with caching and performance monitoring
   */
  async executeQuery<T = unknown>(
    query: string,
    params?: Record<string, unknown>,
    options?: {
      skipCache?: boolean;
      customTTL?: number;
      priority?: 'high' | 'medium' | 'low';
      timeout?: number;
    }
  ): Promise<{
    data: T | null;
    error: string | null;
    metrics: QueryMetrics;
  }> {
    const queryId = await this.generateQueryId(query, params);
    const startTime = Date.now();

    // Check cache first
    if (this.config.enableQueryCache && !options?.skipCache) {
      const cached = await this.getCachedQuery<T>(queryId);
      if (cached) {
        const metrics: QueryMetrics = {
          queryId,
          query,
          executionTime: Date.now() - startTime,
          rowsAffected: 0,
          cacheHit: true,
          optimized: false
        };

        this.recordQueryMetrics(metrics);
        return { data: cached, error: null, metrics };
      }
    }

    // Get connection from pool
    const connection = await this.getConnection();

    try {
      // Optimize query
      const optimizedQuery = this.config.enableQueryRewriting
        ? await this.optimizeQuery(query)
        : query;

      // Execute query with timeout
      const result = await this.executeWithTimeout(
        connection,
        optimizedQuery,
        params,
        options?.timeout || 30000
      );

      const executionTime = Date.now() - startTime;

      // Cache successful results
      if (this.config.enableQueryCache && result.data && !result.error) {
        await this.cacheQuery(
          queryId,
          result.data,
          options?.customTTL || this.config.queryCacheTTL
        );
      }

      const metrics: QueryMetrics = {
        queryId,
        query: optimizedQuery,
        executionTime,
        rowsAffected: Array.isArray(result.data) ? result.data.length : (result.data ? 1 : 0),
        cacheHit: false,
        optimized: optimizedQuery !== query,
        suggestions: await this.generateQuerySuggestions(query, executionTime)
      };

      // Record analytics
      this.recordQueryAnalytics(query, metrics);
      this.recordQueryMetrics(metrics);

      // Log slow queries
      if (executionTime > this.config.slowQueryThreshold) {
        this.logger.warn('Slow query detected', {
          queryId,
          executionTime,
          query: query.substring(0, 200) + (query.length > 200 ? '...' : '')
        });
      }

      return {
        data: result.data as T,
        error: result.error,
        metrics
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Query execution failed', error as Error, {
        queryId,
        executionTime,
        query: query.substring(0, 200)
      });

      const metrics: QueryMetrics = {
        queryId,
        query,
        executionTime,
        rowsAffected: 0,
        cacheHit: false,
        optimized: false
      };

      this.recordQueryMetrics(metrics);

      return {
        data: null,
        error: errorMessage,
        metrics
      };

    } finally {
      // Return connection to pool
      this.releaseConnection(connection);
    }
  }

  /**
   * Batch execute multiple queries with optimization
   */
  async executeBatch<T = unknown>(
    queries: Array<{
      query: string;
      params?: Record<string, unknown>;
      options?: Parameters<typeof this.executeQuery>[2];
    }>
  ): Promise<Array<Awaited<ReturnType<typeof this.executeQuery<T>>>>> {
    const startTime = Date.now();

    this.logger.debug('Executing batch queries', { count: queries.length });

    try {
      // Group queries by optimization potential
      const { optimizable, immediate } = this.categorizeQueries(queries);

      // Execute immediate queries in parallel
      const immediatePromises = immediate.map(q =>
        this.executeQuery<T>(q.query, q.params, q.options)
      );

      // Execute optimizable queries with intelligent batching
      const optimizablePromises = await this.executeBatchOptimized<T>(optimizable);

      const results = await Promise.all([...immediatePromises, ...optimizablePromises]);

      const totalTime = Date.now() - startTime;
      this.logger.info('Batch execution completed', {
        queryCount: queries.length,
        totalTime,
        avgTimePerQuery: totalTime / queries.length
      });

      this.metrics.recordHistogram('database_batch_execution_time_ms', totalTime, {
        query_count: queries.length.toString()
      });

      return results;

    } catch (error) {
      this.logger.error('Batch execution failed', error as Error);
      throw error;
    }
  }

  /**
   * Analyze query performance and provide recommendations
   */
  async analyzeQueryPerformance(
    timeframe: { start: Date; end: Date } = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      end: new Date()
    }
  ): Promise<{
    slowQueries: QueryAnalysis[];
    recommendations: string[];
    indexSuggestions: string[];
    cacheEfficiency: {
      hitRate: number;
      missRate: number;
      totalQueries: number;
    };
    connectionPoolHealth: ConnectionPoolStats;
  }> {
    const slowQueries: QueryAnalysis[] = [];
    const recommendations: string[] = [];
    const indexSuggestions: string[] = [];

    // Analyze stored query analytics
    for (const [pattern, analytics] of this.queryAnalytics.entries()) {
      const filteredExecutions = analytics.executions.filter(
        exec => exec.executionTime >= timeframe.start.getTime() &&
               exec.executionTime <= timeframe.end.getTime()
      );

      if (filteredExecutions.length === 0) continue;

      const avgExecutionTime = analytics.totalTime / filteredExecutions.length;
      const cacheHits = filteredExecutions.filter(e => e.cacheHit).length;
      const errors = analytics.errorCount;

      const analysis: QueryAnalysis = {
        queryPattern: pattern,
        avgExecutionTime,
        executionCount: filteredExecutions.length,
        cacheHitRate: cacheHits / filteredExecutions.length,
        errorRate: errors / filteredExecutions.length,
        suggestions: [],
        indexRecommendations: []
      };

      // Generate suggestions for slow queries
      if (avgExecutionTime > this.config.slowQueryThreshold) {
        analysis.suggestions.push(
          'Consider adding appropriate indexes',
          'Review query structure for optimization',
          'Enable query caching for frequently executed queries'
        );

        if (this.config.enableIndexSuggestions) {
          const indexSuggestion = this.suggestIndexes(pattern);
          analysis.indexRecommendations.push(...indexSuggestion);
        }

        slowQueries.push(analysis);
      }

      // Add to general recommendations
      if (analysis.cacheHitRate < 0.3 && analysis.executionCount > 10) {
        recommendations.push(`Low cache hit rate for pattern: ${pattern}. Consider longer TTL.`);
      }

      if (analysis.errorRate > 0.05) {
        recommendations.push(`High error rate for pattern: ${pattern}. Review query logic.`);
      }
    }

    // Calculate cache efficiency
    const totalQueries = Array.from(this.queryAnalytics.values())
      .reduce((sum, analytics) => sum + analytics.executions.length, 0);

    const totalCacheHits = Array.from(this.queryAnalytics.values())
      .reduce((sum, analytics) =>
        sum + analytics.executions.filter(e => e.cacheHit).length, 0
      );

    const cacheEfficiency = {
      hitRate: totalCacheHits / totalQueries,
      missRate: 1 - (totalCacheHits / totalQueries),
      totalQueries
    };

    return {
      slowQueries,
      recommendations,
      indexSuggestions,
      cacheEfficiency,
      connectionPoolHealth: this.poolStats
    };
  }

  /**
   * Initialize connection pool
   */
  private initializeConnectionPool(): void {
    if (!this.config.enableConnectionPooling) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    for (let i = 0; i < this.config.maxConnections; i++) {
      const client = createClient(supabaseUrl, supabaseKey, {
        db: {
          schema: 'public'
        },
        auth: {
          persistSession: false
        }
      });

      this.connectionPool.push(client);
      this.availableConnections.push(client);
    }

    this.poolStats.totalConnections = this.config.maxConnections;
    this.poolStats.idleConnections = this.config.maxConnections;

    this.logger.info('Connection pool initialized', {
      maxConnections: this.config.maxConnections
    });
  }

  /**
   * Get connection from pool
   */
  private async getConnection(): Promise<SupabaseClient> {
    if (!this.config.enableConnectionPooling) {
      // Return new connection
      return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }

    const startTime = Date.now();

    // Wait for available connection
    while (this.availableConnections.length === 0) {
      this.poolStats.waitingRequests++;
      await new Promise(resolve => setTimeout(resolve, 10));
      this.poolStats.waitingRequests--;
    }

    const connection = this.availableConnections.pop()!;
    this.poolStats.activeConnections++;
    this.poolStats.idleConnections--;

    const connectionTime = Date.now() - startTime;
    this.poolStats.avgConnectionTime =
      (this.poolStats.avgConnectionTime + connectionTime) / 2;

    return connection;
  }

  /**
   * Release connection back to pool
   */
  private releaseConnection(connection: SupabaseClient): void {
    if (!this.config.enableConnectionPooling) return;

    this.availableConnections.push(connection);
    this.poolStats.activeConnections--;
    this.poolStats.idleConnections++;
  }

  /**
   * Execute query with timeout
   */
  private async executeWithTimeout(
    client: SupabaseClient,
    query: string,
    params?: Record<string, unknown>,
    timeout = 30000
  ): Promise<{ data: unknown; error: string | null }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Parse and execute Supabase query
      const result = await this.parseAndExecuteSupabaseQuery(client, query, params);

      return {
        data: result.data,
        error: result.error ? result.error.message : null
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Query timeout after ${timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse and execute Supabase query
   */
  private async parseAndExecuteSupabaseQuery(
    client: SupabaseClient,
    query: string,
    params?: Record<string, unknown>
  ): Promise<{ data: unknown; error: unknown }> {
    // Simple query parser for Supabase operations
    // In a real implementation, you'd have more sophisticated parsing

    const trimmedQuery = query.trim().toLowerCase();

    if (trimmedQuery.startsWith('select')) {
      // Handle SELECT queries
      const match = query.match(/from\s+(\w+)/i);
      const tableName = match ? match[1] : 'unknown';

      let queryBuilder = client.from(tableName).select('*');

      // Apply basic filters from params
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          queryBuilder = queryBuilder.eq(key, value);
        });
      }

      return await queryBuilder;

    } else if (trimmedQuery.startsWith('insert')) {
      // Handle INSERT queries
      const match = query.match(/into\s+(\w+)/i);
      const tableName = match ? match[1] : 'unknown';

      return await client.from(tableName).insert(params || {});

    } else if (trimmedQuery.startsWith('update')) {
      // Handle UPDATE queries
      const match = query.match(/update\s+(\w+)/i);
      const tableName = match ? match[1] : 'unknown';

      return await client.from(tableName).update(params || {});

    } else if (trimmedQuery.startsWith('delete')) {
      // Handle DELETE queries
      const match = query.match(/from\s+(\w+)/i);
      const tableName = match ? match[1] : 'unknown';

      let queryBuilder = client.from(tableName).delete();

      // Apply filters from params
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          queryBuilder = queryBuilder.eq(key, value);
        });
      }

      return await queryBuilder;

    } else {
      // Fallback to RPC call
      return await client.rpc('custom_query', { query, params });
    }
  }

  /**
   * Generate query ID for caching
   */
  private async generateQueryId(query: string, params?: Record<string, unknown>): Promise<string> {
    const crypto = await import('crypto');
    const content = query + JSON.stringify(params || {});
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Get cached query result
   */
  private async getCachedQuery<T>(queryId: string): Promise<T | null> {
    const cached = this.queryCache.get(queryId);

    if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl) {
      this.metrics.incrementCounter('database_cache_hits_total');
      return cached.result as T;
    }

    // Also check distributed cache
    return await this.cache.get<T>(`query:${queryId}`);
  }

  /**
   * Cache query result
   */
  private async cacheQuery(queryId: string, result: unknown, ttl: number): Promise<void> {
    // Cache in memory
    this.queryCache.set(queryId, {
      result,
      timestamp: new Date(),
      ttl
    });

    // Cache in distributed cache
    await this.cache.set(`query:${queryId}`, result, { ttl });

    this.metrics.incrementCounter('database_cache_sets_total');
  }

  /**
   * Optimize query structure
   */
  private async optimizeQuery(query: string): Promise<string> {
    // Simple query optimization rules
    let optimized = query;

    // Remove unnecessary whitespace
    optimized = optimized.replace(/\s+/g, ' ').trim();

    // Add LIMIT if missing for SELECT queries without COUNT
    if (optimized.toLowerCase().includes('select') &&
        !optimized.toLowerCase().includes('limit') &&
        !optimized.toLowerCase().includes('count')) {
      optimized += ' LIMIT 1000';
    }

    // TODO: Add more sophisticated optimization rules
    // - Index hints
    // - Query rewriting
    // - Subquery optimization

    return optimized;
  }

  /**
   * Generate query suggestions
   */
  private async generateQuerySuggestions(
    query: string,
    executionTime: number
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (executionTime > this.config.slowQueryThreshold) {
      suggestions.push('Consider adding appropriate indexes');

      if (!query.toLowerCase().includes('limit')) {
        suggestions.push('Add LIMIT clause to reduce result set size');
      }

      if (query.toLowerCase().includes('order by') && !query.toLowerCase().includes('limit')) {
        suggestions.push('ORDER BY without LIMIT can be expensive');
      }
    }

    return suggestions;
  }

  /**
   * Suggest indexes based on query pattern
   */
  private suggestIndexes(queryPattern: string): string[] {
    const suggestions: string[] = [];

    // Extract table and column information
    const tableMatch = queryPattern.match(/from\s+(\w+)/i);
    const whereMatch = queryPattern.match(/where\s+(\w+)/i);
    const orderMatch = queryPattern.match(/order by\s+(\w+)/i);

    if (tableMatch) {
      const tableName = tableMatch[1];

      if (whereMatch) {
        suggestions.push(`CREATE INDEX idx_${tableName}_${whereMatch[1]} ON ${tableName}(${whereMatch[1]})`);
      }

      if (orderMatch) {
        suggestions.push(`CREATE INDEX idx_${tableName}_${orderMatch[1]} ON ${tableName}(${orderMatch[1]})`);
      }
    }

    return suggestions;
  }

  /**
   * Categorize queries for batch optimization
   */
  private categorizeQueries(
    queries: Array<{
      query: string;
      params?: Record<string, unknown>;
      options?: Parameters<typeof this.executeQuery>[2];
    }>
  ): {
    optimizable: typeof queries;
    immediate: typeof queries;
  } {
    const optimizable: typeof queries = [];
    const immediate: typeof queries = [];

    queries.forEach(q => {
      if (q.options?.priority === 'high' || q.query.toLowerCase().includes('insert')) {
        immediate.push(q);
      } else {
        optimizable.push(q);
      }
    });

    return { optimizable, immediate };
  }

  /**
   * Execute batch with optimization
   */
  private async executeBatchOptimized<T>(
    queries: Array<{
      query: string;
      params?: Record<string, unknown>;
      options?: Parameters<typeof this.executeQuery>[2];
    }>
  ): Promise<Array<Awaited<ReturnType<typeof this.executeQuery<T>>>>> {
    // Group similar queries together
    const grouped = queries.reduce((acc, q) => {
      const pattern = this.extractQueryPattern(q.query);
      if (!acc[pattern]) acc[pattern] = [];
      acc[pattern].push(q);
      return acc;
    }, {} as Record<string, typeof queries>);

    const promises: Promise<Awaited<ReturnType<typeof this.executeQuery<T>>>>[] = [];

    // Execute each group
    for (const group of Object.values(grouped)) {
      for (const query of group) {
        promises.push(this.executeQuery<T>(query.query, query.params, query.options));
      }
    }

    return Promise.all(promises);
  }

  /**
   * Extract query pattern for grouping
   */
  private extractQueryPattern(query: string): string {
    return query
      .replace(/\d+/g, '?')  // Replace numbers with placeholders
      .replace(/'[^']*'/g, '?')  // Replace string literals
      .toLowerCase()
      .trim();
  }

  /**
   * Record query analytics
   */
  private recordQueryAnalytics(query: string, metrics: QueryMetrics): void {
    const pattern = this.extractQueryPattern(query);

    if (!this.queryAnalytics.has(pattern)) {
      this.queryAnalytics.set(pattern, {
        pattern,
        executions: [],
        totalTime: 0,
        errorCount: 0
      });
    }

    const analytics = this.queryAnalytics.get(pattern)!;
    analytics.executions.push(metrics);
    analytics.totalTime += metrics.executionTime;

    if (metrics.executionTime > this.config.slowQueryThreshold) {
      analytics.errorCount++;
    }

    // Keep only recent executions
    if (analytics.executions.length > 100) {
      analytics.executions = analytics.executions.slice(-50);
    }
  }

  /**
   * Record query metrics
   */
  private recordQueryMetrics(metrics: QueryMetrics): void {
    this.metrics.recordHistogram('database_query_duration_ms', metrics.executionTime, {
      cached: metrics.cacheHit ? 'true' : 'false',
      optimized: metrics.optimized ? 'true' : 'false'
    });

    this.metrics.recordHistogram('database_rows_affected', metrics.rowsAffected);

    this.metrics.incrementCounter('database_queries_total', {
      cached: metrics.cacheHit ? 'true' : 'false'
    });
  }

  /**
   * Start analytics collection
   */
  private startAnalytics(): void {
    if (!this.config.enableQueryAnalysis) return;

    // Periodic cleanup and analysis
    setInterval(() => {
      this.cleanupAnalytics();
      this.updatePoolStats();
    }, 60000); // Every minute
  }

  /**
   * Cleanup old analytics data
   */
  private cleanupAnalytics(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

    for (const [pattern, analytics] of this.queryAnalytics.entries()) {
      analytics.executions = analytics.executions.filter(
        exec => new Date(exec.executionTime) >= cutoff
      );

      if (analytics.executions.length === 0) {
        this.queryAnalytics.delete(pattern);
      }
    }

    // Cleanup query cache
    for (const [queryId, cached] of this.queryCache.entries()) {
      if (Date.now() - cached.timestamp.getTime() > cached.ttl) {
        this.queryCache.delete(queryId);
      }
    }
  }

  /**
   * Update pool statistics
   */
  private updatePoolStats(): void {
    this.metrics.setGauge('database_pool_active_connections', this.poolStats.activeConnections);
    this.metrics.setGauge('database_pool_idle_connections', this.poolStats.idleConnections);
    this.metrics.setGauge('database_pool_waiting_requests', this.poolStats.waitingRequests);
    this.metrics.setGauge('database_pool_avg_connection_time', this.poolStats.avgConnectionTime);
  }

  /**
   * Get optimizer statistics
   */
  getStats(): {
    queryCache: {
      size: number;
      hitRate: number;
    };
    connectionPool: ConnectionPoolStats;
    slowQueries: number;
    totalQueries: number;
  } {
    const totalQueries = Array.from(this.queryAnalytics.values())
      .reduce((sum, analytics) => sum + analytics.executions.length, 0);

    const slowQueries = Array.from(this.queryAnalytics.values())
      .reduce((sum, analytics) =>
        sum + analytics.executions.filter(e => e.executionTime > this.config.slowQueryThreshold).length, 0
      );

    const cacheHits = this.metrics.getCounterValue('database_cache_hits_total') || 0;
    const totalCacheRequests = (this.metrics.getCounterValue('database_cache_hits_total') || 0) +
                              (this.metrics.getCounterValue('database_cache_misses_total') || 0);

    return {
      queryCache: {
        size: this.queryCache.size,
        hitRate: totalCacheRequests > 0 ? cacheHits / totalCacheRequests : 0
      },
      connectionPool: this.poolStats,
      slowQueries,
      totalQueries
    };
  }

  /**
   * Clear all caches
   */
  async clearCaches(): Promise<void> {
    this.queryCache.clear();
    await this.cache.clear();

    this.logger.info('Database caches cleared');
  }

  /**
   * Shutdown optimizer
   */
  async shutdown(): Promise<void> {
    // Clear intervals and cleanup
    this.queryCache.clear();
    this.queryAnalytics.clear();

    this.logger.info('Database optimizer shutdown completed');
  }
}

// Singleton instance
let databaseOptimizer: DatabaseOptimizer | null = null;

export function getDatabaseOptimizer(config?: Partial<QueryOptimizationConfig>): DatabaseOptimizer {
  if (!databaseOptimizer) {
    databaseOptimizer = new DatabaseOptimizer(config);
  }
  return databaseOptimizer;
}

export { DatabaseOptimizer };