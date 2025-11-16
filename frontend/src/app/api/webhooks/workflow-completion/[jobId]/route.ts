/**
 * Webhook endpoint for workflow generation completion
 * Receives webhook from backend when workflow generation completes
 * Stores completion data in memory for client polling
 * 
 * NOTE: This route does not work with static export (output: 'export').
 * In production, webhooks should be handled by the backend API.
 */

import { NextRequest, NextResponse } from 'next/server';

// Required for static export (but this route won't work in static export)
export async function generateStaticParams() {
  // Return empty array - this route won't be statically generated
  // In production, webhooks should go to the backend API
  return [];
}

// In-memory store for webhook completion data
// In production, consider using Redis or a database
const completionStore = new Map<string, {
  job_id: string;
  workflow_id?: string;
  status: 'completed' | 'failed';
  error_message?: string;
  completed_at?: string;
  failed_at?: string;
}>();

// Clean up old entries (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [jobId, data] of completionStore.entries()) {
    const timestamp = data.completed_at || data.failed_at;
    if (timestamp) {
      const completedTime = new Date(timestamp).getTime();
      if (completedTime < oneHourAgo) {
        completionStore.delete(jobId);
      }
    }
  }
}, 60 * 60 * 1000); // Run every hour

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    const body = await request.json();

    console.log('[Webhook] Workflow generation completion received', {
      jobId,
      status: body.status,
      hasWorkflowId: !!body.workflow_id,
    });

    // Store completion data
    if (body.status === 'completed' && body.workflow_id) {
      completionStore.set(jobId, {
        job_id: jobId,
        workflow_id: body.workflow_id,
        status: 'completed',
        completed_at: body.completed_at || new Date().toISOString(),
      });
      
      return NextResponse.json({
        success: true,
        job_id: jobId,
        workflow_id: body.workflow_id,
        status: 'completed',
      });
    } else if (body.status === 'failed') {
      completionStore.set(jobId, {
        job_id: jobId,
        status: 'failed',
        error_message: body.error_message,
        failed_at: body.failed_at || new Date().toISOString(),
      });
      
      return NextResponse.json({
        success: false,
        job_id: jobId,
        status: 'failed',
        error_message: body.error_message,
      });
    }

    return NextResponse.json({
      success: true,
      job_id: jobId,
      status: body.status,
    });
  } catch (error: any) {
    console.error('[Webhook] Error processing workflow completion', {
      error: error.message,
    });
    
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to check completion status
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    const completion = completionStore.get(jobId);

    if (completion) {
      return NextResponse.json({
        success: true,
        ...completion,
      });
    }

    return NextResponse.json({
      success: false,
      job_id: jobId,
      status: 'pending',
    });
  } catch (error: any) {
    console.error('[Webhook] Error checking completion status', {
      error: error.message,
    });
    
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

