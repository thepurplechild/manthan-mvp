/**
 * Vercel Cron Job: Process Ingestion Queue
 *
 * This endpoint is called by Vercel Cron to process queued file ingestion jobs.
 * It runs every minute and processes pending jobs from the KV queue.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  dequeueJob,
  acquireProcessingLock,
  releaseProcessingLock,
  getQueueStats,
  updateStats
} from '@/lib/jobs/queue';
import { processJobBatch } from '@/lib/jobs/processor';
import { QUEUE_BATCH_SIZE } from '@/lib/jobs/types';

/**
 * Verify the request is from Vercel Cron
 */
function verifyVercelCron(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In production, always verify the cron secret
  if (process.env.NODE_ENV === 'production') {
    if (!cronSecret) {
      console.error('[cron] CRON_SECRET not configured in production');
      return false;
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.error('[cron] Invalid or missing authorization header');
      return false;
    }
  }

  // Additional verification: check if request is from Vercel
  const userAgent = request.headers.get('user-agent');
  const isFromVercel = userAgent?.includes('vercel-cron') ||
                      userAgent?.includes('vercel') ||
                      request.headers.get('x-vercel-cron') === '1';

  if (process.env.NODE_ENV === 'production' && !isFromVercel) {
    console.warn('[cron] Request may not be from Vercel cron');
    return false;
  }

  return true;
}

/**
 * Process jobs cron handler
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[cron] Job processing cron triggered');

    // Verify this is a legitimate cron request
    if (!verifyVercelCron(request)) {
      console.error('[cron] Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Try to acquire processing lock to prevent concurrent runs
    const lockAcquired = await acquireProcessingLock(300); // 5 minute lock
    if (!lockAcquired) {
      console.log('[cron] Processing lock already held, skipping this run');
      return NextResponse.json({
        success: true,
        message: 'Processing lock already held, skipping',
        processingTime: Date.now() - startTime
      });
    }

    let processedJobs = 0;
    let successfulJobs = 0;
    let failedJobs = 0;

    try {
      // Get queue statistics before processing
      const initialStats = await getQueueStats();
      console.log(`[cron] Queue stats: ${initialStats.pendingJobs} pending jobs`);

      if (initialStats.pendingJobs === 0) {
        console.log('[cron] No jobs in queue, nothing to process');
        return NextResponse.json({
          success: true,
          message: 'No jobs to process',
          stats: initialStats,
          processingTime: Date.now() - startTime
        });
      }

      // Dequeue jobs for processing (up to batch size)
      const jobsToProcess: string[] = [];
      for (let i = 0; i < QUEUE_BATCH_SIZE; i++) {
        const queueJob = await dequeueJob();
        if (!queueJob) break;

        jobsToProcess.push(queueJob.jobId);
        processedJobs++;
      }

      console.log(`[cron] Dequeued ${jobsToProcess.length} jobs for processing`);

      if (jobsToProcess.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No jobs dequeued (queue may be empty)',
          processingTime: Date.now() - startTime
        });
      }

      // Process the batch of jobs
      console.log(`[cron] Starting batch processing of ${jobsToProcess.length} jobs`);
      const results = await processJobBatch(jobsToProcess);

      // Count results
      successfulJobs = results.filter(r => r.success).length;
      failedJobs = results.filter(r => !r.success).length;

      console.log(`[cron] Batch complete: ${successfulJobs} successful, ${failedJobs} failed`);

      // Update statistics
      await updateStats({
        completedJobs: initialStats.completedJobs + successfulJobs,
        failedJobs: initialStats.failedJobs + failedJobs
      });

      // Get final statistics
      const finalStats = await getQueueStats();
      const processingTime = Date.now() - startTime;

      console.log(`[cron] Cron run completed in ${processingTime}ms`);

      return NextResponse.json({
        success: true,
        message: `Processed ${processedJobs} jobs`,
        results: {
          processed: processedJobs,
          successful: successfulJobs,
          failed: failedJobs
        },
        stats: {
          before: initialStats,
          after: finalStats
        },
        processingTime
      });

    } finally {
      // Always release the processing lock
      await releaseProcessingLock();
      console.log('[cron] Processing lock released');
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[cron] Fatal error during job processing after ${processingTime}ms:`, error);

    // Make sure to release lock on error
    try {
      await releaseProcessingLock();
    } catch (lockError) {
      console.error('[cron] Failed to release processing lock:', lockError);
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      },
      { status: 500 }
    );
  }
}

/**
 * Handle manual triggers via GET (for testing)
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Manual cron triggers not allowed in production' },
      { status: 403 }
    );
  }

  console.log('[cron] Manual cron trigger (development mode)');

  // Create a mock request for the POST handler
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: new Headers({
      'user-agent': 'manual-trigger',
      'x-vercel-cron': '1'
    })
  });

  return POST(mockRequest);
}

/**
 * Handle unsupported methods
 */
export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}