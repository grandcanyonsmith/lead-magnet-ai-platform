/**
 * Hook to track workflow generation status
 * Handles webhook completion events and polling fallback
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface GenerationJob {
  jobId: string;
  description: string;
  model: string;
  createdAt: string;
}

export function useWorkflowGenerationStatus(jobId: string | null) {
  const router = useRouter();
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listen for webhook completion events
  useEffect(() => {
    if (!jobId || typeof window === 'undefined') return;

    const handleWebhookMessage = (event: MessageEvent) => {
      if (event.data?.type === 'workflow_generation_completed') {
        const { job_id, workflow_id, status: eventStatus } = event.data;
        
        if (job_id === jobId) {
          console.log('[Workflow Generation Status] Webhook completion received', {
            jobId,
            workflowId: workflow_id,
            status: eventStatus,
          });

          if (eventStatus === 'completed' && workflow_id) {
            setStatus('completed');
            setWorkflowId(workflow_id);
            // Navigate to workflow edit page
            router.push(`/dashboard/workflows/${workflow_id}/edit`);
          } else if (eventStatus === 'failed') {
            setStatus('failed');
            setError(event.data.error_message || 'Workflow generation failed');
          }
        }
      }
    };

    window.addEventListener('message', handleWebhookMessage);

    return () => {
      window.removeEventListener('message', handleWebhookMessage);
    };
  }, [jobId, router]);

  // Polling fallback - check both webhook endpoint and API status
  const pollStatus = useCallback(async () => {
    if (!jobId) return;

    try {
      // First check webhook endpoint (faster if webhook was received)
      try {
        const webhookResponse = await fetch(`/api/webhooks/workflow-completion/${jobId}`);
        if (webhookResponse.ok) {
          const webhookData = await webhookResponse.json();
          if (webhookData.status === 'completed' && webhookData.workflow_id) {
            setStatus('completed');
            setWorkflowId(webhookData.workflow_id);
            router.push(`/dashboard/workflows/${webhookData.workflow_id}/edit`);
            return;
          } else if (webhookData.status === 'failed') {
            setStatus('failed');
            setError(webhookData.error_message || 'Workflow generation failed');
            return;
          }
        }
      } catch (webhookErr) {
        // Webhook endpoint not available, fall back to API
        console.debug('[Workflow Generation Status] Webhook endpoint not available, using API');
      }

      // Fall back to API status check
      const response = await api.getWorkflowGenerationStatus(jobId);
      
      if (response.status === 'completed') {
        setStatus('completed');
        // Check if workflow_id is in the response
        if ((response as any).workflow_id) {
          setWorkflowId((response as any).workflow_id);
          router.push(`/dashboard/workflows/${(response as any).workflow_id}/edit`);
        } else if (response.result) {
          // Legacy: workflow data is in result, need to load workflow
          // This shouldn't happen with new flow, but handle it
          console.warn('[Workflow Generation Status] No workflow_id in response, checking result');
        }
      } else if (response.status === 'failed') {
        setStatus('failed');
        setError(response.error_message || 'Workflow generation failed');
      } else {
        setStatus(response.status as any);
      }
    } catch (err: any) {
      console.error('[Workflow Generation Status] Error polling status', err);
      setError(err.message || 'Failed to check generation status');
    }
  }, [jobId, router]);

  // Start polling if webhook hasn't completed after a delay
  useEffect(() => {
    if (!jobId || status === 'completed' || status === 'failed') return;

    // Wait 5 seconds before starting to poll (give webhook time to arrive)
    const pollTimer = setTimeout(() => {
      if (status !== 'completed' && status !== 'failed') {
        // Poll every 2 seconds
        const interval = setInterval(() => {
          pollStatus();
        }, 2000);

        return () => clearInterval(interval);
      }
    }, 5000);

    return () => clearTimeout(pollTimer);
  }, [jobId, status, pollStatus]);

  return {
    status,
    workflowId,
    error,
    pollStatus,
  };
}

