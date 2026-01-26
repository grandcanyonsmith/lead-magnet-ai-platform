"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { WorkflowStep } from "@/types/workflow";
import { logger } from "@/utils/logger";

export interface AIStepGenerationResult {
  action: "update" | "add";
  step_index?: number;
  step: WorkflowStep;
}

export interface AIStepProposal {
  original?: WorkflowStep;
  proposed: WorkflowStep;
  action: "update" | "add";
  step_index?: number;
}

export function useWorkflowStepAI(workflowId?: string) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<AIStepProposal | null>(null);
  const [streamedText, setStreamedText] = useState<string>("");

  const generateStep = async (
    userPrompt: string,
    currentStep?: WorkflowStep,
    currentStepIndex?: number,
    suggestedAction?: "update" | "add",
  ) => {
    if (!workflowId) {
      setError("Workflow ID is required for AI generation");
      return null;
    }

    setIsGenerating(true);
    setError(null);
    setProposal(null);
    setStreamedText("");

    try {
      logger.debug("Generating step", {
        context: "useWorkflowStepAI",
        data: {
          workflowId,
          promptLength: userPrompt.length,
          action: suggestedAction,
          hasCurrentStep: !!currentStep,
        },
      });

      let streamError: string | null = null;
      let streamResult: AIStepGenerationResult | undefined;

      const shouldFallbackToNonStreaming = (message?: string | null) =>
        Boolean(
          message &&
            (message.includes("Failed to start streaming: 503") ||
              /service unavailable/i.test(message)),
        );

      const streamResponse = await api.streamGenerateStepWithAI(
        workflowId,
        {
          userPrompt,
          action: suggestedAction,
          currentStep,
          currentStepIndex,
        },
        {
          onDelta: (text) => {
            setStreamedText((prev) => prev + text);
          },
          onComplete: (result) => {
            streamResult = result as AIStepGenerationResult | undefined;
          },
          onError: (streamingError) => {
            streamError = streamingError || "Failed to stream step generation";
          },
        },
      );

      if (streamError) {
        if (shouldFallbackToNonStreaming(streamError)) {
          const fallbackResult = await api.generateStepWithAI(workflowId, {
            userPrompt,
            action: suggestedAction,
            currentStep,
            currentStepIndex,
          });
          streamResult = fallbackResult as AIStepGenerationResult;
        } else {
          throw new Error(streamError);
        }
      }

      const result = (streamResult || streamResponse?.result) as
        | AIStepGenerationResult
        | undefined;
      if (!result) {
        throw new Error("No response from AI");
      }

      logger.debug("Generation successful", {
        context: "useWorkflowStepAI",
        data: { action: result.action, stepName: result.step.step_name },
      });

      // Create proposal for review
      const aiProposal: AIStepProposal = {
        original: currentStep,
        proposed: result.step,
        action: result.action,
        step_index: result.step_index,
      };

      setProposal(aiProposal);
      return aiProposal;
    } catch (err: any) {
      logger.debug("Generation failed", {
        context: "useWorkflowStepAI",
        error: err,
      });
      setError(err.message || "Failed to generate step. Please try again.");
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const acceptProposal = () => {
    const currentProposal = proposal;
    setProposal(null);
    setStreamedText("");
    return currentProposal;
  };

  const rejectProposal = () => {
    setProposal(null);
    setStreamedText("");
  };

  const retry = async (
    userPrompt: string,
    currentStep?: WorkflowStep,
    currentStepIndex?: number,
    suggestedAction?: "update" | "add",
  ) => {
    return await generateStep(
      userPrompt,
      currentStep,
      currentStepIndex,
      suggestedAction,
    );
  };

  return {
    isGenerating,
    error,
    proposal,
    streamedText,
    generateStep,
    acceptProposal,
    rejectProposal,
    retry,
  };
}
