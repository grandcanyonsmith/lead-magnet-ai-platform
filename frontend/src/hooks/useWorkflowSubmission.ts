"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { AIModel } from "@/types";
import {
  WorkflowFormData,
  FormFieldsData,
} from "./useWorkflowForm";
import { WorkflowStep } from "@/types/workflow";

export function useWorkflowSubmission() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitWorkflow = useCallback(
    async (
      formData: WorkflowFormData,
      steps: WorkflowStep[],
      formFieldsData: FormFieldsData,
      autoSave: boolean = false,
    ) => {
      setError(null);

      if (!autoSave) {
        setIsSubmitting(true);
      }

      try {
        // Validate required fields before submission
        const workflowName = formData.workflow_name.trim();
        if (!workflowName) {
          throw new Error("Workflow name is required");
        }

        if (steps.length === 0) {
          throw new Error("At least one workflow step is required");
        }

        // Ensure all steps have required fields
        steps.forEach((step, index) => {
          if (!step.step_name?.trim()) {
            throw new Error(`Step ${index + 1} name is required`);
          }
          if (!step.instructions?.trim()) {
            throw new Error(`Step ${index + 1} instructions are required`);
          }
        });

        // All workflows must use steps format - no legacy fields needed

        // Then create the workflow with steps
        const workflow = await api.createWorkflow({
          workflow_name: workflowName,
          workflow_description: formData.workflow_description?.trim() || "",
          steps: steps.map((step, index) => ({
            ...step,
            step_order: index,
            model: step.model,
            tools: step.tools,
            instructions: step.instructions.trim(), // Ensure instructions are trimmed
          })),
        });

        // Update or create the form if form fields are provided
        if (formFieldsData.form_fields_schema.fields.length > 0) {
          // Check if workflow already has a form (from auto-creation)
          if (workflow.form?.form_id) {
            // Update existing form with all fields
            await api.updateForm(workflow.form.form_id, {
              form_name:
                formFieldsData.form_name ||
                `Form for ${formData.workflow_name}`,
              public_slug:
                formFieldsData.public_slug ||
                formData.workflow_name
                  .toLowerCase()
                  .replace(/\s+/g, "-")
                  .replace(/[^a-z0-9-]/g, ""),
              form_fields_schema: formFieldsData.form_fields_schema,
            });
          } else {
            // Create new form if it doesn't exist
            await api.createForm({
              workflow_id: workflow.workflow_id,
              form_name:
                formFieldsData.form_name ||
                `Form for ${formData.workflow_name}`,
              public_slug:
                formFieldsData.public_slug ||
                formData.workflow_name
                  .toLowerCase()
                  .replace(/\s+/g, "-")
                  .replace(/[^a-z0-9-]/g, ""),
              form_fields_schema: formFieldsData.form_fields_schema,
              rate_limit_enabled: true,
              rate_limit_per_hour: 10,
              captcha_enabled: false,
            });
          }
        }

        return workflow;
      } catch (err: any) {
        console.error("Failed to create workflow:", err);
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to create workflow",
        );
        return null;
      } finally {
        if (!autoSave) {
          setIsSubmitting(false);
        }
      }
    },
    [],
  );

  return {
    submitWorkflow,
    isSubmitting,
    error,
  };
}
