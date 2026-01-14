"use client";

import { useState, useCallback, useEffect } from "react";
import { WorkflowStep } from "@/types/workflow";

const defaultSteps: WorkflowStep[] = [
  {
    step_name: "Deep Research",
    step_description: "Generate comprehensive research report",
    model: "gpt-5.2",
    instructions: "",
    step_order: 0,
    tools: ["web_search"],
    tool_choice: "auto",
  },
  {
    step_name: "HTML Rewrite",
    step_description: "Rewrite content into styled HTML matching template",
    model: "gpt-5.2",
    instructions:
      "Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template's design and structure.",
    step_order: 1,
    tools: [],
    tool_choice: "none",
  },
];

interface UseWorkflowStepsOptions {
  initialSteps?: WorkflowStep[];
  persistKey?: string;
}

export function useWorkflowSteps(optionsOrSteps?: WorkflowStep[] | UseWorkflowStepsOptions) {
  // Handle both signatures for backward compatibility
  const options: UseWorkflowStepsOptions = Array.isArray(optionsOrSteps) 
    ? { initialSteps: optionsOrSteps } 
    : (optionsOrSteps || {});
    
  const { initialSteps, persistKey } = options;

  const [steps, setSteps] = useState<WorkflowStep[]>(
    initialSteps || defaultSteps,
  );
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (persistKey && typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(persistKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSteps(parsed);
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
    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[index] = { ...step, step_order: index };
      return newSteps;
    });
  }, []);

  const addStep = useCallback(() => {
    setSteps((prev) => [
      ...prev,
      {
        step_name: `Step ${prev.length + 1}`,
        step_description: "",
        model: "gpt-5.2",
        instructions: "",
        step_order: prev.length,
        tools: [],
        tool_choice: "auto",
      },
    ]);
  }, []);

  const deleteStep = useCallback((index: number) => {
    setSteps((prev) => {
      const newSteps = prev.filter((_, i) => i !== index);
      return newSteps.map((step, i) => ({ ...step, step_order: i }));
    });
  }, []);

  const moveStepUp = useCallback((index: number) => {
    if (index === 0) return;
    setSteps((prev) => {
      const newSteps = [...prev];
      [newSteps[index - 1], newSteps[index]] = [
        newSteps[index],
        newSteps[index - 1],
      ];
      return newSteps.map((step, i) => ({ ...step, step_order: i }));
    });
  }, []);

  const moveStepDown = useCallback((index: number) => {
    setSteps((prev) => {
      if (index === prev.length - 1) return prev;
      const newSteps = [...prev];
      [newSteps[index], newSteps[index + 1]] = [
        newSteps[index + 1],
        newSteps[index],
      ];
      return newSteps.map((step, i) => ({ ...step, step_order: i }));
    });
  }, []);

  const reorderSteps = useCallback((newSteps: WorkflowStep[]) => {
    setSteps(newSteps.map((step, i) => ({ ...step, step_order: i })));
  }, []);

  const setStepsFromAIGeneration = useCallback((aiSteps: WorkflowStep[]) => {
    if (aiSteps && Array.isArray(aiSteps) && aiSteps.length > 0) {
      setSteps(
        aiSteps.map((step: any) => ({
          step_name: step.step_name || "Step",
          step_description: step.step_description || "",
          model: step.model || "gpt-5.2",
          reasoning_effort: step.reasoning_effort,
          service_tier: step.service_tier,
          text_verbosity: step.text_verbosity,
          max_output_tokens: step.max_output_tokens,
          output_format: step.output_format,
          instructions: step.instructions || "",
          step_order: step.step_order !== undefined ? step.step_order : 0,
          tools: step.tools || [],
          tool_choice: step.tool_choice || "auto",
          depends_on: step.depends_on,
        })),
      );
    }
  }, []);

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
  }, []);

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
