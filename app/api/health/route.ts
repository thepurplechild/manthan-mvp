import { NextResponse } from 'next/server'
import { getServerEnv } from '@/lib/env.server'

export async function GET() {
  try {
    // Test environment configuration
    const env = getServerEnv()

    // Basic health checks
    const checks = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      environment: process.env.NODE_ENV,
      region: process.env.VERCEL_REGION || 'unknown',
      deployment: process.env.VERCEL_URL || 'local',
      node_version: process.version,
      memory_usage: process.memoryUsage(),
      uptime: process.uptime(),
      config: {
        file_max_size_mb: env.FILE_MAX_SIZE_MB,
        pipeline_max_tokens: env.PIPELINE_MAX_TOKENS,
        file_processing_timeout: env.FILE_PROCESSING_TIMEOUT,
        log_level: env.LOG_LEVEL,
        security_scan_enabled: env.ENABLE_FILE_SECURITY_SCAN,
        processing_logs_enabled: env.ENABLE_PROCESSING_LOGS,
        performance_monitoring_enabled: env.ENABLE_PERFORMANCE_MONITORING,
      }
    }

    return NextResponse.json(checks, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV,
      },
      { status: 500 }
    )
  }
}