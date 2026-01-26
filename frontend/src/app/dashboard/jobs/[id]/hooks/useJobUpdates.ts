import { useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api";
import { WorkflowStep } from "@/types";
import { ImageGenerationToolConfig } from "@/types/workflow";
import { QuickUpdateStepInput } from "@/types/jobUpdates";

interface UseJobUpdatesProps {
  workflow: any;
  editingStepIndex: number | null;
  setEditingStepIndex: (index: number | null) => void;
  setIsSidePanelOpen: (isOpen: boolean) => void;
  setStepIndexForRerun: (index: number | null) => void;
  setShowRerunDialog: (show: boolean) => void;
  refreshJob: () => Promise<void>;
  setUpdatingStepIndex: (index: number | null) => void;
}

export function useJobUpdates({
  workflow,
  editingStepIndex,
  setEditingStepIndex,
  setIsSidePanelOpen,
  setStepIndexForRerun,
  setShowRerunDialog,
  refreshJob,
  setUpdatingStepIndex,
}: UseJobUpdatesProps) {
  const router = useRouter();
  const latestStepUpdateRef = useRef<WorkflowStep | null>(null);
  const savingStepRef = useRef(false);

  const handleSaveStep = async (updatedStep: WorkflowStep) => {
    if (savingStepRef.current) {
      return;
    }
    if (!workflow || editingStepIndex === null || !workflow.steps) {
      toast.error("Unable to save: Workflow data not available");
      return;
    }

    savingStepRef.current = true;
    try {
      const updatedSteps = [...workflow.steps];
      const originalStep = updatedSteps[editingStepIndex];

      updatedSteps[editingStepIndex] = {
        ...originalStep,
        ...updatedStep,
      };

      await api.updateWorkflow(workflow.workflow_id, {
        steps: updatedSteps,
      });

      toast.success("Step updated successfully");

      setStepIndexForRerun(editingStepIndex);

      setEditingStepIndex(null);
      setIsSidePanelOpen(false);

      setShowRerunDialog(true);

      router.refresh();
    } catch (error: any) {
      console.error("Failed to save step:", error);
      toast.error("Failed to save step. Please try again.");
    } finally {
      savingStepRef.current = false;
    }
  };

  const handleQuickUpdateStep = async (
    stepIndex: number,
    update: QuickUpdateStepInput,
  ) => {
    if (!workflow || !workflow.steps) {
      toast.error("Unable to update: Workflow data not available");
      return;
    }

    const originalStep = workflow.steps[stepIndex];
    if (!originalStep) {
      toast.error("Unable to update: Step not found");
      return;
    }

    const updatedStep: WorkflowStep = { ...originalStep };

    if (update.model) {
      updatedStep.model = update.model;
    }

    if ("service_tier" in update) {
      if (update.service_tier === null) {
        delete updatedStep.service_tier;
      } else if (update.service_tier !== undefined) {
        updatedStep.service_tier = update.service_tier;
      }
    }

    if ("reasoning_effort" in update) {
      if (update.reasoning_effort === null) {
        delete updatedStep.reasoning_effort;
      } else if (update.reasoning_effort !== undefined) {
        updatedStep.reasoning_effort = update.reasoning_effort;
      }
    }

    if (update.image_generation) {
      const imageConfig = update.image_generation;
      const normalizedConfig: ImageGenerationToolConfig = {
        type: "image_generation",
        model: imageConfig.model || "gpt-image-1.5",
        size: imageConfig.size || "auto",
        quality: imageConfig.quality || "auto",
        background: imageConfig.background || "auto",
      };
      if (imageConfig.format) {
        normalizedConfig.format = imageConfig.format;
      }
      const supportsCompression =
        imageConfig.format === "jpeg" || imageConfig.format === "webp";
      if (
        supportsCompression &&
        typeof imageConfig.compression === "number" &&
        Number.isFinite(imageConfig.compression)
      ) {
        normalizedConfig.compression = Math.min(
          100,
          Math.max(0, imageConfig.compression),
        );
      }
      if (imageConfig.input_fidelity) {
        normalizedConfig.input_fidelity = imageConfig.input_fidelity;
      }

      const existingTools = Array.isArray(updatedStep.tools)
        ? updatedStep.tools
        : [];
      let replaced = false;
      const nextTools = existingTools.map((tool) => {
        if (tool === "image_generation") {
          replaced = true;
          return normalizedConfig;
        }
        if (
          tool &&
          typeof tool === "object" &&
          "type" in tool &&
          (tool as { type?: string }).type === "image_generation"
        ) {
          replaced = true;
          return normalizedConfig;
        }
        return tool;
      });
      if (!replaced) {
        nextTools.push(normalizedConfig);
      }
      updatedStep.tools = nextTools;
    }

    if ("tools" in update) {
      if (update.tools === null) {
        delete updatedStep.tools;
      } else if (update.tools !== undefined) {
        updatedStep.tools = update.tools;
      }
    }

    const updatedSteps = [...workflow.steps];
    updatedSteps[stepIndex] = updatedStep;

    setUpdatingStepIndex(stepIndex);
    try {
      await api.updateWorkflow(workflow.workflow_id, {
        steps: updatedSteps,
      });
      toast.success("Step updated successfully");
      setStepIndexForRerun(stepIndex);
      setShowRerunDialog(true);
      refreshJob().catch((refreshError) => {
        console.error("Failed to refresh job after step update:", refreshError);
      });
    } catch (error) {
      console.error("Failed to update step:", error);
      toast.error("Failed to update step. Please try again.");
    } finally {
      setUpdatingStepIndex(null);
    }
  };

  const handleCancelEdit = async () => {
    if (latestStepUpdateRef.current && editingStepIndex !== null) {
      const currentStep = workflow?.steps?.[editingStepIndex];
      const hasChanges =
        currentStep &&
        JSON.stringify(currentStep) !==
          JSON.stringify(latestStepUpdateRef.current);

      if (hasChanges) {
        try {
          await handleSaveStep(latestStepUpdateRef.current);
        } catch (error) {
          throw error;
        }
      }

      latestStepUpdateRef.current = null;
    }

    setEditingStepIndex(null);
    setIsSidePanelOpen(false);
  };

  return {
    handleSaveStep,
    handleQuickUpdateStep,
    handleCancelEdit,
    latestStepUpdateRef,
  };
}
