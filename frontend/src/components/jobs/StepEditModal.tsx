"use client";

import { Fragment, useState, useEffect } from "react";
import { FiX, FiSave, FiAlertCircle } from "react-icons/fi";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { DEFAULT_AI_MODEL } from "@/constants/models";
import { useAIModelOptions } from "@/hooks/useAIModelOptions";
import { WorkflowStep, AIModel, ToolType, ToolChoice } from "@/types";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";

interface StepEditModalProps {
  step: WorkflowStep | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedStep: WorkflowStep) => Promise<void>;
  jobStatus?: string;
  allSteps?: WorkflowStep[]; // All steps for dependency selection
  currentStepIndex?: number; // Array index of the current step being edited (for consistent dependency indexing)
}

const TOOL_TYPES: ToolType[] = [
  "web_search",
  "image_generation",
  "computer_use_preview",
  "file_search",
  "code_interpreter",
];

const TOOL_CHOICES: ToolChoice[] = ["auto", "required", "none"];

export function StepEditModal({
  step,
  isOpen,
  onClose,
  onSave,
  jobStatus,
  allSteps = [],
  currentStepIndex,
}: StepEditModalProps) {
  const [formData, setFormData] = useState<WorkflowStep>({
    step_name: "",
    instructions: "",
    model: DEFAULT_AI_MODEL,
    reasoning_effort: "high",
    tools: [],
    tool_choice: "required",
    depends_on: [],
  });
  const {
    options: modelOptions,
    loading: modelsLoading,
    error: modelsError,
  } = useAIModelOptions({
    currentModel: formData.model,
    fallbackModel: DEFAULT_AI_MODEL,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when step changes or modal opens
  useEffect(() => {
    if (step && isOpen) {
      setFormData({
        step_name: step.step_name,
        step_description: step.step_description,
        instructions: step.instructions,
        model: DEFAULT_AI_MODEL,
        reasoning_effort: "high",
        step_order: step.step_order,
        tools: step.tools || [],
        tool_choice: step.tool_choice || "required",
        depends_on: step.depends_on || [],
      });
      setError(null);
    }
  }, [step, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.step_name.trim()) {
      setError("Step name is required");
      return;
    }

    if (!formData.instructions.trim()) {
      setError("Instructions are required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save step changes");
    } finally {
      setSaving(false);
    }
  };

  const handleToolToggle = (tool: ToolType) => {
    const currentTools = formData.tools || [];
    const toolStrings = currentTools.map((t) =>
      typeof t === "string" ? t : t.type,
    );

    if (toolStrings.includes(tool)) {
      // Remove the tool
      setFormData({
        ...formData,
        tools: currentTools.filter(
          (t) => (typeof t === "string" ? t : t.type) !== tool,
        ),
      });
    } else {
      // Add the tool as a simple string
      // (structured configs like ComputerUseToolConfig should be configured separately if needed)
      setFormData({
        ...formData,
        tools: [...currentTools, tool],
      });
    }
  };

  const isToolSelected = (tool: ToolType) => {
    const currentTools = formData.tools || [];
    const toolStrings = currentTools.map((t) =>
      typeof t === "string" ? t : t.type,
    );
    return toolStrings.includes(tool);
  };

  if (!step) {
    return null;
  }

  const isProcessing = jobStatus === "processing";

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 transition-opacity" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="relative z-50 w-full max-w-2xl bg-white dark:bg-card rounded-lg shadow-xl">
                {/* Header */}
                <PanelHeader className="px-6 py-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-card">
                  <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                    Edit Step
                  </DialogTitle>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </PanelHeader>

          {/* Warning for processing jobs */}
          {isProcessing && (
            <AlertBanner
              variant="warning"
              className="mx-6 mt-4"
              icon={<FiAlertCircle className="w-5 h-5" />}
              title="Job is currently processing"
              description="Changes will affect future jobs using this workflow template, not the current execution."
            />
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <AlertBanner variant="error" className="p-3" description={error} />
            )}

            {/* Step Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Step Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.step_name}
                onChange={(e) =>
                  setFormData({ ...formData, step_name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., Deep Research"
                required
              />
            </div>

            {/* Step Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Step Description
              </label>
              <input
                type="text"
                value={formData.step_description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, step_description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Brief description of this step"
              />
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Instructions <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.instructions}
                onChange={(e) =>
                  setFormData({ ...formData, instructions: e.target.value })
                }
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Detailed instructions for this step..."
                required
              />
            </div>

            {/* AI Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                AI Model <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.model}
                onChange={(nextValue) =>
                  setFormData({ ...formData, model: nextValue as AIModel })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={modelsLoading || !!modelsError}
                placeholder={modelsLoading ? "Loading models..." : undefined}
              >
                {modelsLoading && <option value="">Loading models...</option>}
                {modelsError && !modelsLoading && (
                  <option value="">Error loading models</option>
                )}
                {modelOptions.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Reasoning Effort (GPT-5 family) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reasoning Effort
              </label>
              <Select
                value={(formData as any).reasoning_effort || ""}
                onChange={(nextValue) =>
                  setFormData({
                    ...formData,
                    reasoning_effort: nextValue || undefined,
                  } as any)
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Default"
              >
                <option value="">Default</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Optional. Controls how much reasoning the model uses (mainly for
                GPT-5 models).
              </p>
            </div>

            {/* Tools */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tools
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TOOL_TYPES.map((tool) => (
                  <label
                    key={tool}
                    className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <Checkbox
                      checked={isToolSelected(tool)}
                      onChange={() => handleToolToggle(tool)}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-200">
                      {tool}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tool Choice */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tool Choice
              </label>
              <Select
                value={formData.tool_choice || "required"}
                onChange={(nextValue) =>
                  setFormData({
                    ...formData,
                    tool_choice: nextValue as ToolChoice,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {TOOL_CHOICES.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Controls how the AI uses the selected tools
              </p>
            </div>

            {/* Dependencies */}
            {allSteps.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dependencies (optional)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Select which steps must complete before this step runs. Leave
                  empty to auto-detect from step order.
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  {allSteps.map((otherStep, otherIndex) => {
                    // Use provided currentStepIndex, or fallback to finding by step reference
                    // This ensures we use array indices consistently, not step_order values
                    const editingIndex =
                      currentStepIndex !== undefined
                        ? currentStepIndex
                        : step
                          ? allSteps.findIndex((s) => s === step)
                          : -1;

                    // Can't depend on itself - skip if this is the current step being edited
                    if (otherIndex === editingIndex && editingIndex !== -1)
                      return null;

                    // depends_on stores array indices (0, 1, 2, ...), not step_order values
                    const isSelected = (formData.depends_on || []).includes(
                      otherIndex,
                    );
                    return (
                      <label
                        key={otherIndex}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={(checked) => {
                            const currentDeps = formData.depends_on || [];
                            const newDeps = checked
                              ? [...currentDeps, otherIndex]
                              : currentDeps.filter(
                                  (dep: number) => dep !== otherIndex,
                                );
                            setFormData({ ...formData, depends_on: newDeps });
                          }}
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-200">
                          Step {otherIndex + 1}: {otherStep.step_name}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {formData.depends_on && formData.depends_on.length > 0 && (
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    Depends on:{" "}
                    {formData.depends_on
                      .map((dep: number) => `Step ${dep + 1}`)
                      .join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-4 h-4" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
