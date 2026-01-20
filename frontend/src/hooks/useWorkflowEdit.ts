"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AIModel, Tool } from "@/types";
import { WorkflowStep, WorkflowTrigger } from "@/types/workflow";
import {
  resolveServiceTier,
  resolveTextVerbosity,
  resolveToolChoice,
} from "@/utils/workflowDefaults";
import { useWorkflowId } from "./useWorkflowId";

export interface WorkflowFormData {
  workflow_name: string;
  workflow_description: string;
  template_id: string;
  template_version: number;
  trigger?: WorkflowTrigger;
}


export function useWorkflowEdit(
  defaultToolChoice?: WorkflowStep["tool_choice"],
  defaultServiceTier?: WorkflowStep["service_tier"],
  defaultTextVerbosity?: WorkflowStep["text_verbosity"],
  workflowIdOverride?: string,
) {
  const router = useRouter();
  const routeWorkflowId = useWorkflowId();
  const workflowId =
    workflowIdOverride && workflowIdOverride.trim() !== ""
      ? workflowIdOverride
      : routeWorkflowId;
  const resolvedDefaultToolChoice = resolveToolChoice(defaultToolChoice);
  const resolvedDefaultServiceTier = resolveServiceTier(defaultServiceTier);
  const resolvedDefaultTextVerbosity = resolveTextVerbosity(defaultTextVerbosity);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowVersion, setWorkflowVersion] = useState<number>(1);

  const [formData, setFormData] = useState<WorkflowFormData>({
    workflow_name: "",
    workflow_description: "",
    template_id: "",
    template_version: 0,
  });

  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [formId, setFormId] = useState<string | null>(null);
  const [workflowForm, setWorkflowForm] = useState<any>(null);
  const [workflowStatus, setWorkflowStatus] = useState<
    "active" | "inactive" | "draft" | null
  >(null);

  useEffect(() => {
    if (workflowId) {
      loadWorkflow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  const loadWorkflow = async () => {
    setLoading(true);
    try {
      const workflow = await api.getWorkflow(workflowId);
      setFormData({
        workflow_name: workflow.workflow_name || "",
        workflow_description: workflow.workflow_description || "",
        template_id: workflow.template_id || "",
        template_version: workflow.template_version || 0,
        trigger: workflow.trigger || { type: "form" },
      });
      setWorkflowVersion(
        typeof workflow.version === "number" && Number.isFinite(workflow.version)
          ? workflow.version
          : 1,
      );

      // Load steps - all workflows must have steps
      if (!workflow.steps || workflow.steps.length === 0) {
        throw new Error(
          "Workflow has no steps. Legacy format is no longer supported.",
        );
      }

      const loadedSteps = workflow.steps.map((step: any, index: number) => {
        let defaultInstructions = "";
        if (step.step_name && step.step_name.toLowerCase().includes("html")) {
          defaultInstructions =
            "Rewrite the content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template's design and structure.";
        } else if (
          step.step_name &&
          step.step_name.toLowerCase().includes("research")
        ) {
          defaultInstructions =
            "Generate a comprehensive research report based on the form submission data.";
        } else {
          defaultInstructions =
            "Process the input data according to the workflow requirements.";
        }

        return {
          step_name: step.step_name || `Step ${index + 1}`,
          step_description: step.step_description || "",
          step_type: step.step_type || "ai_generation",
          model: step.model || "gpt-5.2",
          instructions: step.instructions?.trim() || defaultInstructions,
          service_tier: step.service_tier || resolvedDefaultServiceTier,
          text_verbosity:
            resolveTextVerbosity(step.text_verbosity) ?? resolvedDefaultTextVerbosity,
          step_order: step.step_order !== undefined ? step.step_order : index,
          tools: step.tools || ["web_search"],
          tool_choice: step.tool_choice || resolvedDefaultToolChoice,
          // Webhook step fields
          webhook_url: step.webhook_url || "",
          webhook_method: step.webhook_method || "POST",
          webhook_headers: step.webhook_headers || {},
          webhook_query_params: step.webhook_query_params || {},
          webhook_content_type: step.webhook_content_type || "application/json",
          webhook_body_mode:
            step.webhook_body_mode || (step.webhook_body ? "custom" : "auto"),
          webhook_body: step.webhook_body || "",
          webhook_save_response:
            step.webhook_save_response !== undefined
              ? step.webhook_save_response
              : true,
          webhook_data_selection: step.webhook_data_selection || undefined,

          // Lead magnet handoff step fields
          handoff_workflow_id: step.handoff_workflow_id || "",
          handoff_payload_mode: step.handoff_payload_mode,
          handoff_input_field: step.handoff_input_field || "",
          handoff_bypass_required_inputs: step.handoff_bypass_required_inputs,
          handoff_include_submission_data: step.handoff_include_submission_data,
          handoff_include_context: step.handoff_include_context,
        };
      });
      setSteps(loadedSteps);

      if (workflow.form) {
        setFormId(workflow.form.form_id);
        setWorkflowForm(workflow.form);
      }

      // Store workflow status
      setWorkflowStatus(workflow.status || "active");
    } catch (error: any) {
      console.error("Failed to load workflow:", error);
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to load workflow",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStepChange = (index: number, step: WorkflowStep) => {
    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[index] = { ...step, step_order: index };
      return newSteps;
    });
  };

  const handleAddStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        step_name: `Step ${prev.length + 1}`,
        step_description: "",
        model: "gpt-5.2",
        instructions: "",
        step_order: prev.length,
        tools: ["web_search"],
        tool_choice: resolvedDefaultToolChoice,
        service_tier: resolvedDefaultServiceTier,
        text_verbosity: resolvedDefaultTextVerbosity,
      },
    ]);
  };

  const handleDeleteStep = (index: number) => {
    setSteps((prev) => {
      const newSteps = prev.filter((_, i) => i !== index);
      return newSteps.map((step, i) => ({ ...step, step_order: i }));
    });
  };

  const handleMoveStepUp = (index: number) => {
    if (index === 0) return;
    setSteps((prev) => {
      const newSteps = [...prev];
      [newSteps[index - 1], newSteps[index]] = [
        newSteps[index],
        newSteps[index - 1],
      ];
      return newSteps.map((step, i) => ({ ...step, step_order: i }));
    });
  };

  const handleMoveStepDown = (index: number) => {
    if (index === steps.length - 1) return;
    setSteps((prev) => {
      const newSteps = [...prev];
      [newSteps[index], newSteps[index + 1]] = [
        newSteps[index + 1],
        newSteps[index],
      ];
      return newSteps.map((step, i) => ({ ...step, step_order: i }));
    });
  };

  return {
    workflowId,
    loading,
    submitting,
    setSubmitting,
    error,
    setError,
    workflowVersion,
    formData,
    setFormData,
    steps,
    setSteps,
    formId,
    workflowForm,
    workflowStatus,
    reloadWorkflow: loadWorkflow,
    handleChange,
    handleStepChange,
    handleAddStep,
    handleDeleteStep,
    handleMoveStepUp,
    handleMoveStepDown,
    router,
  };
}
