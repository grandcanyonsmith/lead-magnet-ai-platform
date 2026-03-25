"use client";

import { useState, useCallback, useEffect } from "react";
import { WorkflowStep } from "@/types/workflow";
import {
  buildDefaultSteps,
  resolveServiceTier,
  resolveTextVerbosity,
  resolveToolChoice,
} from "@/utils/workflowDefaults";
import {
  normalizeEditedWorkflowSteps,
  normalizeLoadedWorkflowSteps,
} from "@/utils/workflowStepNormalization";

interface UseWorkflowStepsOptions {
  initialSteps?: WorkflowStep[];
  persistKey?: string;
  defaultToolChoice?: WorkflowStep["tool_choice"];
  defaultServiceTier?: WorkflowStep["service_tier"];
  defaultTextVerbosity?: WorkflowStep["text_verbosity"];
}

export function useWorkflowSteps(optionsOrSteps?: WorkflowStep[] | UseWorkflowStepsOptions) {
  // Handle both signatures for backward compatibility
  const options: UseWorkflowStepsOptions = Array.isArray(optionsOrSteps) 
    ? { initialSteps: optionsOrSteps } 
    : (optionsOrSteps || {});
    
  const {
    initialSteps,
    persistKey,
    defaultToolChoice,
    defaultServiceTier,
    defaultTextVerbosity,
  } = options;
  const resolvedDefaultToolChoice = resolveToolChoice(defaultToolChoice);
  const resolvedDefaultServiceTier = resolveServiceTier(defaultServiceTier);
  const resolvedDefaultTextVerbosity = resolveTextVerbosity(defaultTextVerbosity);

  const [steps, setStepsState] = useState<WorkflowStep[]>(
    normalizeLoadedWorkflowSteps(
      initialSteps ||
        buildDefaultSteps(
          resolvedDefaultToolChoice,
          resolvedDefaultServiceTier,
          resolvedDefaultTextVerbosity,
        ),
    ),
  );
  const [isLoaded, setIsLoaded] = useState(false);

  const setSteps = useCallback(
    (
      nextSteps:
        | WorkflowStep[]
        | ((prev: WorkflowStep[]) => WorkflowStep[]),
    ) => {
      setStepsState((prev) => {
        const resolved =
          typeof nextSteps === "function" ? nextSteps(prev) : nextSteps;
        return normalizeLoadedWorkflowSteps(resolved);
      });
    },
    [],
  );

  // Load from localStorage on mount
  useEffect(() => {
    if (persistKey && typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(persistKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setStepsState(normalizeLoadedWorkflowSteps(parsed));
          }
        }
      } catch (e) {
        console.error("Failed to load steps from localStorage", e);
      } finally {
        setIsLoaded(true);
      }
    } else {
      setIsLoaded(true);
    }
  }, [persistKey]);

  // Save to localStorage on change
  useEffect(() => {
    if (persistKey && isLoaded && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(persistKey, JSON.stringify(steps));
      } catch (e) {
        console.error("Failed to save steps to localStorage", e);
      }
    }
  }, [steps, persistKey, isLoaded]);

  const updateStep = useCallback((index: number, step: WorkflowStep) => {
    setStepsState((prev) => {
      const newSteps = [...prev];
      newSteps[index] = step;
      return normalizeEditedWorkflowSteps(newSteps);
    });
  }, []);

  const addStep = useCallback(() => {
    setStepsState((prev) =>
      normalizeEditedWorkflowSteps([
        ...prev,
        {
          step_name: `Step ${prev.length + 1}`,
          step_description: "",
          model: "gpt-5.2",
          instructions: "",
          step_order: prev.length,
          tools: [],
          tool_choice: resolvedDefaultToolChoice,
          service_tier: resolvedDefaultServiceTier,
          text_verbosity: resolvedDefaultTextVerbosity,
        },
      ]),
    );
  }, [resolvedDefaultToolChoice, resolvedDefaultServiceTier, resolvedDefaultTextVerbosity]);

  const deleteStep = useCallback((index: number) => {
    setStepsState((prev) => {
      const newSteps = prev.filter((_, i) => i !== index);
      return normalizeEditedWorkflowSteps(newSteps);
    });
  }, []);

  const moveStepUp = useCallback((index: number) => {
    if (index === 0) return;
    setStepsState((prev) => {
      const newSteps = [...prev];
      [newSteps[index - 1], newSteps[index]] = [
        newSteps[index],
        newSteps[index - 1],
      ];
      return normalizeEditedWorkflowSteps(newSteps);
    });
  }, []);

  const moveStepDown = useCallback((index: number) => {
    setStepsState((prev) => {
      if (index === prev.length - 1) return prev;
      const newSteps = [...prev];
      [newSteps[index], newSteps[index + 1]] = [
        newSteps[index + 1],
        newSteps[index],
      ];
      return normalizeEditedWorkflowSteps(newSteps);
    });
  }, []);

  const reorderSteps = useCallback((newSteps: WorkflowStep[]) => {
    setStepsState(normalizeEditedWorkflowSteps(newSteps));
  }, []);

  const setStepsFromAIGeneration = useCallback((aiSteps: WorkflowStep[]) => {
    if (aiSteps && Array.isArray(aiSteps) && aiSteps.length > 0) {
      setStepsState(
        normalizeLoadedWorkflowSteps(
          aiSteps.map((step: any) => ({
            step_name: step.step_name || "Step",
            step_description: step.step_description || "",
            model: step.model || "gpt-5.2",
            reasoning_effort: step.reasoning_effort,
            service_tier: resolvedDefaultServiceTier ?? step.service_tier,
            text_verbosity:
              resolvedDefaultTextVerbosity ?? resolveTextVerbosity(step.text_verbosity),
            max_output_tokens: step.max_output_tokens,
            output_format: step.output_format,
            instructions: step.instructions || "",
            step_order: step.step_order !== undefined ? step.step_order : 0,
            tools: step.tools || [],
            tool_choice: step.tool_choice || resolvedDefaultToolChoice,
            depends_on: step.depends_on,
            shell_settings: step.shell_settings,
            include_form_data: step.include_form_data,
          })),
        ),
      );
    }
  }, [resolvedDefaultToolChoice, resolvedDefaultServiceTier, resolvedDefaultTextVerbosity]);

  const updateFirstStepInstructions = useCallback((instructions: string) => {
    setSteps((prev) => {
      const newSteps = [...prev];
      if (newSteps.length > 0) {
        newSteps[0] = {
          ...newSteps[0],
          instructions,
        };
      }
      return newSteps;
    });
  }, [setSteps]);

  return {
    steps,
    updateStep,
    addStep,
    deleteStep,
    moveStepUp,
    moveStepDown,
    reorderSteps,
    setStepsFromAIGeneration,
    updateFirstStepInstructions,
    setSteps,
    isLoaded,
  };
}
