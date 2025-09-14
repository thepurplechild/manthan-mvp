/**
 * Job Queue Management using Vercel KV
 *
 * This module handles job queuing, status tracking, and queue operations
 * using Vercel's KV store for reliable job processing.
 */

import { kv } from '@vercel/kv';
import { createId } from '@paralleldrive/cuid2';
import {
  JobMetadata,
  QueueJob,
  IngestionStats,
  KV_KEYS,
  JOB_PRIORITIES,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_BASE
} from './types';

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  return `job_${createId()}`;
}

/**
 * Add a job to the processing queue
 */
export async function enqueueJob(jobMetadata: JobMetadata): Promise<void> {
  const queueJob: QueueJob = {
    jobId: jobMetadata.jobId,
    priority: JOB_PRIORITIES[jobMetadata.options.priority],
    createdAt: jobMetadata.createdAt,
    retryCount: 0
  };

  // Add to sorted set with priority as score (lower score = higher priority)
  await kv.zadd(KV_KEYS.QUEUE, {
    score: queueJob.priority,
    member: JSON.stringify(queueJob)
  });

  // Store job metadata
  await kv.hset(KV_KEYS.JOB_STATUS(jobMetadata.jobId), jobMetadata as unknown as Record<string, unknown>);

  console.log(`[queue] Job ${jobMetadata.jobId} enqueued with priority ${jobMetadata.options.priority}`);
}

/**
 * Get the next job from the queue
 */
export async function dequeueJob(): Promise<QueueJob | null> {
  // Get the highest priority job (lowest score)
  const result = await kv.zrange(KV_KEYS.QUEUE, 0, 0, { withScores: true });

  if (!result || result.length === 0) {
    return null;
  }

  const jobData = result[0] as string;
  const job: QueueJob = JSON.parse(jobData);

  // Remove from queue
  await kv.zrem(KV_KEYS.QUEUE, jobData);

  console.log(`[queue] Dequeued job ${job.jobId} (priority: ${job.priority})`);
  return job;
}

/**
 * Get job metadata from KV store
 */
export async function getJobMetadata(jobId: string): Promise<JobMetadata | null> {
  const metadata = await kv.hgetall(KV_KEYS.JOB_STATUS(jobId));
  return metadata as JobMetadata | null;
}

/**
 * Update job status and metadata
 */
export async function updateJobStatus(
  jobId: string,
  updates: Partial<JobMetadata>
): Promise<void> {
  const existing = await getJobMetadata(jobId);
  if (!existing) {
    throw new Error(`Job ${jobId} not found`);
  }

  const updated: JobMetadata = {
    ...existing,
    ...updates,
    progress: {
      ...existing.progress,
      ...updates.progress
    }
  };

  await kv.hset(KV_KEYS.JOB_STATUS(jobId), updated as unknown as Record<string, unknown>);

  console.log(`[queue] Updated job ${jobId} status to ${updated.status}`);
}

/**
 * Mark job as processing
 */
export async function startJobProcessing(jobId: string): Promise<void> {
  await updateJobStatus(jobId, {
    status: 'processing',
    startedAt: new Date().toISOString(),
    progress: {
      currentStep: 'Starting processing',
      percentage: 0,
      details: 'Initializing job processing'
    }
  });
}

/**
 * Mark job as completed
 */
export async function completeJob(
  jobId: string,
  result: JobMetadata['result']
): Promise<void> {
  await updateJobStatus(jobId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    progress: {
      currentStep: 'Completed',
      percentage: 100,
      details: 'Processing completed successfully'
    },
    result
  });
}

/**
 * Mark job as failed
 */
export async function failJob(
  jobId: string,
  error: {
    type: string;
    message: string;
    stackTrace?: string;
    retryable: boolean;
  }
): Promise<void> {
  const existing = await getJobMetadata(jobId);
  const retryCount = (existing?.error?.retryCount || 0) + 1;

  const shouldRetry = error.retryable && retryCount <= MAX_RETRY_ATTEMPTS;

  if (shouldRetry) {
    // Re-queue for retry with exponential backoff
    const retryDelay = RETRY_DELAY_BASE * Math.pow(2, retryCount - 1);
    const retryAt = new Date(Date.now() + retryDelay * 1000);

    await updateJobStatus(jobId, {
      status: 'retrying',
      error: {
        ...error,
        retryCount,
        lastRetryAt: new Date().toISOString()
      },
      progress: {
        currentStep: 'Retrying',
        percentage: 0,
        details: `Retry ${retryCount}/${MAX_RETRY_ATTEMPTS} scheduled for ${retryAt.toLocaleTimeString()}`
      }
    });

    // Re-queue the job for retry
    if (existing) {
      const queueJob: QueueJob = {
        jobId,
        priority: JOB_PRIORITIES[existing.options.priority],
        createdAt: existing.createdAt,
        retryCount
      };

      // Add back to queue with slight delay score
      await kv.zadd(KV_KEYS.QUEUE, {
        score: queueJob.priority + (retryCount * 0.1), // Slight penalty for retries
        member: JSON.stringify(queueJob)
      });
    }

    console.log(`[queue] Job ${jobId} scheduled for retry ${retryCount}/${MAX_RETRY_ATTEMPTS}`);
  } else {
    // Mark as permanently failed
    await updateJobStatus(jobId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: {
        ...error,
        retryCount
      },
      progress: {
        currentStep: 'Failed',
        percentage: 0,
        details: shouldRetry ? 'Maximum retries exceeded' : 'Processing failed'
      }
    });

    console.log(`[queue] Job ${jobId} marked as failed after ${retryCount} attempts`);
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<IngestionStats> {
  const queueLength = await kv.zcard(KV_KEYS.QUEUE);

  // This is a simplified version - in production you'd maintain counters
  const existingStats = await kv.hgetall(KV_KEYS.STATS) as IngestionStats | null;

  return {
    totalJobs: existingStats?.totalJobs || 0,
    completedJobs: existingStats?.completedJobs || 0,
    failedJobs: existingStats?.failedJobs || 0,
    pendingJobs: queueLength || 0,
    lastProcessedAt: existingStats?.lastProcessedAt || new Date().toISOString()
  };
}

/**
 * Update processing statistics
 */
export async function updateStats(updates: Partial<IngestionStats>): Promise<void> {
  const existing = await getQueueStats();
  const updated = {
    ...existing,
    ...updates,
    lastProcessedAt: new Date().toISOString()
  };

  await kv.hset(KV_KEYS.STATS, updated);
}

/**
 * Clean up old job data (for maintenance)
 */
export async function cleanupOldJobs(olderThanDays: number = 7): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const cleaned = 0;

  // This is a simplified cleanup - in production you'd use job timestamps
  // and potentially scan through job keys more efficiently
  console.log(`[queue] Cleanup would remove jobs older than ${cutoff}`);

  return cleaned;
}

/**
 * Acquire processing lock to prevent concurrent processing
 */
export async function acquireProcessingLock(ttlSeconds: number = 300): Promise<boolean> {
  const lockKey = KV_KEYS.PROCESSING_LOCK;
  const lockValue = `lock_${Date.now()}_${createId()}`;

  // Try to set lock with TTL
  const result = await kv.set(lockKey, lockValue, {
    ex: ttlSeconds,
    nx: true // Only set if key doesn't exist
  });

  return result === 'OK';
}

/**
 * Release processing lock
 */
export async function releaseProcessingLock(): Promise<void> {
  await kv.del(KV_KEYS.PROCESSING_LOCK);
}