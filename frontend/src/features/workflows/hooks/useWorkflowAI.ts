import { useState } from 'react';
import { api } from '@/shared/lib/api';

export interface WorkflowAIEditRequest {
  userPrompt: string;
}

export interface WorkflowAIEditResponse {
  workflow_name?: string;
  workflow_description?: string;
  html_enabled?: boolean;
  steps: any[];
  changes_summary: string;
}

export function useWorkflowAI(workflowId: string) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<WorkflowAIEditResponse | null>(null);

  const generateWorkflowEdit = async (userPrompt: string) => {
    setIsGenerating(true);
    setError(null);
    setProposal(null);

    try {
      const response = await api.editWorkflowWithAI(workflowId, { userPrompt });

      setProposal(response);
      return response;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to generate workflow edit';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const clearProposal = () => {
    setProposal(null);
    setError(null);
  };

  return {
    generateWorkflowEdit,
    clearProposal,
    isGenerating,
    error,
    proposal,
  };
}
