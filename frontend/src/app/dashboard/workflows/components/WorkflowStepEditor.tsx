"use client";

import React, { useEffect, useRef, useState } from "react";
import { FiTrash2, FiChevronUp, FiChevronDown } from "react-icons/fi";
import { useWorkflowStepAI } from "@/hooks/useWorkflowStepAI";
import {
  WorkflowStep,
  AIModel,
  ComputerUseToolConfig,
  ImageGenerationToolConfig,
} from "@/types/workflow";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

import AIAssist from "./step-editor/AIAssist";
import WebhookConfig from "./step-editor/WebhookConfig";
import ComputerUseConfig from "./step-editor/ComputerUseConfig";
import ImageGenerationConfig from "./step-editor/ImageGenerationConfig";

interface WorkflowStepEditorProps {
  step: WorkflowStep;
  index: number;
  totalSteps: number;
  allSteps?: WorkflowStep[]; // All steps for dependency selection
  onChange: (index: number, step: WorkflowStep) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  workflowId?: string; // Required for AI features
}

const MODEL_OPTIONS = [
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-5.1", label: "GPT-5.1" },
  { value: "gpt-5.2", label: "GPT-5.2" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "computer-use-preview", label: "Computer Use Preview" },
  { value: "o4-mini-deep-research", label: "O4-Mini-Deep-Research" },
];

const AVAILABLE_TOOLS = [
  {
    value: "web_search",
    label: "Search the Web",
    description: "Look up real-time information",
  },
  {
    value: "image_generation",
    label: "Create Images",
    description: "Generate images from text descriptions",
  },
  {
    value: "computer_use_preview",
    label: "Computer Use (Beta)",
    description: "Interact with computer interfaces",
  },
  {
    value: "file_search",
    label: "Search Files",
    description: "Search uploaded files for context",
  },
  {
    value: "code_interpreter",
    label: "Run Code",
    description: "Execute Python code for calculations",
  },
  {
    value: "shell",
    label: "Run Shell Commands",
    description: "Advanced: Run system commands",
  },
];

const TOOL_CHOICE_OPTIONS = [
  {
    value: "auto",
    label: "Auto",
    description: "Model decides when to use tools",
  },
  {
    value: "required",
    label: "Required",
    description: "Model must use at least one tool",
  },
  { value: "none", label: "None", description: "Disable tools entirely" },
];

type ComputerUseConfigState = {
  display_width: number;
  display_height: number;
  environment: "browser" | "mac" | "windows" | "ubuntu";
};

type ImageGenerationConfigState = {
  model: string;
  size: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality: "low" | "medium" | "high" | "auto";
  format?: "png" | "jpeg" | "webp";
  compression?: number;
  background: "transparent" | "opaque" | "auto";
  input_fidelity?: "low" | "high";
};

export default function WorkflowStepEditor({
  step,
  index,
  totalSteps,
  allSteps = [],
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  workflowId,
}: WorkflowStepEditorProps) {
  const [localStep, setLocalStep] = useState<WorkflowStep>(step);
  const [computerUseConfig, setComputerUseConfig] = useState<ComputerUseConfigState>({
    display_width: 1024,
    display_height: 768,
    environment: "browser",
  });
  const [imageGenerationConfig, setImageGenerationConfig] =
    useState<ImageGenerationConfigState>({
      model: "gpt-image-1.5",
      size: "auto",
      quality: "auto",
      format: undefined,
      compression: undefined,
      background: "auto",
      input_fidelity: undefined,
    });

  // Track if we've already converted string tools to objects to prevent infinite loops
  const hasConvertedToolsRef = useRef<boolean>(false);

  // Always call hook unconditionally to comply with Rules of Hooks
  const workflowStepAI = useWorkflowStepAI(workflowId);

  // Sync localStep when step prop changes
  useEffect(() => {
    // Reset conversion tracking when step prop changes (new step or step updated externally)
    hasConvertedToolsRef.current = false;

    // Preserve webhook step type if webhook_url exists but step_type is missing
    const stepWithType = { ...step };
    if (!stepWithType.step_type && stepWithType.webhook_url) {
      stepWithType.step_type = "webhook";
    }

    setLocalStep(stepWithType);

    // Extract computer_use_preview config if present
    const computerUseTool = (step.tools || []).find(
      (t) =>
        (typeof t === "object" && t.type === "computer_use_preview") ||
        t === "computer_use_preview",
    );
    if (
      computerUseTool &&
      typeof computerUseTool === "object" &&
      (computerUseTool as ComputerUseToolConfig).type === "computer_use_preview"
    ) {
      const config = computerUseTool as ComputerUseToolConfig;
      setComputerUseConfig({
        display_width: config.display_width || 1024,
        display_height: config.display_height || 768,
        environment: config.environment || "browser",
      });
    }

    // Extract image_generation config if present
    const imageGenTool = (step.tools || []).find(
      (t) =>
        (typeof t === "object" && t.type === "image_generation") ||
        t === "image_generation",
    );
    if (
      imageGenTool &&
      typeof imageGenTool === "object" &&
      (imageGenTool as ImageGenerationToolConfig).type === "image_generation"
    ) {
      const config = imageGenTool as ImageGenerationToolConfig;
      setImageGenerationConfig({
        model: config.model || "gpt-image-1.5",
        size: config.size || "auto",
        quality: config.quality || "auto",
        format: config.format,
        compression: config.compression,
        background: config.background || "auto",
        input_fidelity: config.input_fidelity,
      });
    } else {
      // Check if image_generation tool is selected (as string)
      const hasImageGenTool = (step.tools || []).some((t) => {
        if (typeof t === "string") return t === "image_generation";
        return t.type === "image_generation";
      });

      if (hasImageGenTool) {
        // Tool is selected but no config - use defaults
        const defaultConfig: ImageGenerationConfigState = {
          model: "gpt-image-1.5",
          size: "auto",
          quality: "auto",
          format: undefined,
          compression: undefined,
          background: "auto",
          input_fidelity: undefined,
        };
        setImageGenerationConfig(defaultConfig);

        // Convert string tool to object immediately if needed (only if not already converted)
        const tools = step.tools || [];
        const hasStringTool = tools.some((t) => t === "image_generation");
        const hasObjectTool = tools.some(
          (t) => typeof t === "object" && t.type === "image_generation",
        );

        if (hasStringTool && !hasObjectTool && !hasConvertedToolsRef.current) {
          hasConvertedToolsRef.current = true;

          const updatedTools = tools.map((t) => {
            if (t === "image_generation") {
              const cfg: ImageGenerationToolConfig = {
                type: "image_generation",
                model: defaultConfig.model,
                size: defaultConfig.size,
                quality: defaultConfig.quality,
                background: defaultConfig.background,
              };
              return cfg;
            }
            return t;
          }) as typeof step.tools;

          const updatedStep = { ...step, tools: updatedTools };
          setLocalStep(updatedStep);
          onChange(index, updatedStep);
        } else if (!hasStringTool && hasObjectTool) {
          hasConvertedToolsRef.current = false;
        }
      } else {
        // Tool not selected - reset to defaults
        setImageGenerationConfig({
          model: "gpt-image-1.5",
          size: "auto",
          quality: "auto",
          format: undefined,
          compression: undefined,
          background: "auto",
          input_fidelity: undefined,
        });
      }
    }
  }, [step, onChange, index]);

  // Ensure image generation config is initialized when tool is selected
  // Using functional setState form to avoid needing imageGenerationConfig in dependencies
  useEffect(() => {
    const hasImageGenTool = (localStep.tools || []).some((t) => {
      if (typeof t === "string") return t === "image_generation";
      return typeof t === "object" && t.type === "image_generation";
    });

    if (hasImageGenTool) {
      setImageGenerationConfig((prev) => {
        if (!prev.size) {
          return {
            model: "gpt-image-1.5",
            size: "auto",
            quality: "auto",
            format: undefined,
            compression: undefined,
            background: "auto",
            input_fidelity: undefined,
          };
        }
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStep.tools]);

  const handleChange = (field: keyof WorkflowStep, value: any) => {
    const updated = { ...localStep, [field]: value };
    setLocalStep(updated);
    onChange(index, updated);
  };

  const isToolSelected = (toolValue: string): boolean => {
    const currentTools = localStep.tools || [];
    return currentTools.some((t) => {
      if (typeof t === "string") return t === toolValue;
      return t.type === toolValue;
    });
  };

  const handleToolToggle = (toolValue: string) => {
    const currentTools = localStep.tools || [];
    const isSelected = isToolSelected(toolValue);

    let updatedTools: (string | { type: string; [key: string]: any })[];

    if (isSelected) {
      updatedTools = currentTools.filter((t) => {
        if (typeof t === "string") return t !== toolValue;
        return t.type !== toolValue;
      });
    } else {
      if (toolValue === "computer_use_preview") {
        updatedTools = [
          ...currentTools,
          {
            type: "computer_use_preview",
            display_width: computerUseConfig.display_width,
            display_height: computerUseConfig.display_height,
            environment: computerUseConfig.environment,
          },
        ];
      } else if (toolValue === "image_generation") {
        const currentConfig: ImageGenerationConfigState = imageGenerationConfig.size
          ? imageGenerationConfig
          : {
              model: "gpt-image-1.5",
              size: "auto",
              quality: "auto",
              format: undefined,
              compression: undefined,
              background: "auto",
              input_fidelity: undefined,
            };

        const config: any = {
          type: "image_generation",
          model: currentConfig.model || "gpt-image-1.5",
          size: currentConfig.size,
          quality: currentConfig.quality,
          background: currentConfig.background,
        };
        if (currentConfig.format) config.format = currentConfig.format;
        if (currentConfig.compression !== undefined)
          config.compression = currentConfig.compression;
        if (currentConfig.input_fidelity)
          config.input_fidelity = currentConfig.input_fidelity;

        updatedTools = [...currentTools, config];

        if (!imageGenerationConfig.size) {
          setImageGenerationConfig(currentConfig);
        }
      } else {
        updatedTools = [...currentTools, toolValue];
      }
    }

    handleChange("tools", updatedTools);
  };

  const handleComputerUseConfigChange = (
    field: keyof ComputerUseConfigState,
    value: number | string,
  ) => {
    const newConfig = { ...computerUseConfig, [field]: value } as ComputerUseConfigState;
    setComputerUseConfig(newConfig);

    const currentTools = localStep.tools || [];
    const updatedTools = currentTools.map((t) => {
      if (typeof t === "object" && t.type === "computer_use_preview") {
        return {
          ...t,
          display_width: newConfig.display_width,
          display_height: newConfig.display_height,
          environment: newConfig.environment,
        };
      }
      return t;
    });

    if (
      isToolSelected("computer_use_preview") &&
      !updatedTools.some(
        (t) => typeof t === "object" && t.type === "computer_use_preview",
      )
    ) {
      updatedTools.push({
        type: "computer_use_preview",
        display_width: newConfig.display_width,
        display_height: newConfig.display_height,
        environment: newConfig.environment,
      });
    }

    handleChange("tools", updatedTools);
  };

  const handleImageGenerationConfigChange = (
    field: keyof ImageGenerationConfigState,
    value: any,
  ) => {
    const newConfig = { ...imageGenerationConfig, [field]: value } as ImageGenerationConfigState;
    setImageGenerationConfig(newConfig);

    const currentTools = localStep.tools || [];
    const updatedTools = currentTools.map((t) => {
      if (t === "image_generation") {
        const cfg: any = {
          type: "image_generation",
          model: newConfig.model || "gpt-image-1.5",
          size: newConfig.size,
          quality: newConfig.quality,
          background: newConfig.background,
        };
        if (newConfig.format) cfg.format = newConfig.format;
        if (newConfig.compression !== undefined) cfg.compression = newConfig.compression;
        if (newConfig.input_fidelity) cfg.input_fidelity = newConfig.input_fidelity;
        return cfg;
      }

      if (typeof t === "object" && t.type === "image_generation") {
        const updated: any = {
          ...t,
          model:
            newConfig.model ||
            (t as ImageGenerationToolConfig).model ||
            "gpt-image-1.5",
          size: newConfig.size,
          quality: newConfig.quality,
          background: newConfig.background,
        };

        if (newConfig.format) updated.format = newConfig.format;
        else delete updated.format;

        if (newConfig.compression !== undefined) updated.compression = newConfig.compression;
        else delete updated.compression;

        if (newConfig.input_fidelity) updated.input_fidelity = newConfig.input_fidelity;
        else delete updated.input_fidelity;

        return updated;
      }

      return t;
    });

    if (
      isToolSelected("image_generation") &&
      !updatedTools.some((t) => typeof t === "object" && t.type === "image_generation")
    ) {
      const cfg: any = {
        type: "image_generation",
        model: newConfig.model || "gpt-image-1.5",
        size: newConfig.size,
        quality: newConfig.quality,
        background: newConfig.background,
      };
      if (newConfig.format) cfg.format = newConfig.format;
      if (newConfig.compression !== undefined) cfg.compression = newConfig.compression;
      if (newConfig.input_fidelity) cfg.input_fidelity = newConfig.input_fidelity;
      updatedTools.push(cfg);
    }

    handleChange("tools", updatedTools);
  };

  return (
    <ErrorBoundary
      fallback={
        <div className="border border-red-300 rounded-lg p-6 bg-red-50">
          <p className="text-red-800 font-medium">Error loading step editor</p>
          <p className="text-red-600 text-sm mt-1">
            Please refresh the page or try again.
          </p>
        </div>
      }
    >
      <div className="border border-gray-300 rounded-lg p-6 bg-white shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div
            className="flex items-center gap-3"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1 text-gray-400">
              <span className="text-xs">⋮⋮</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 select-none">
              Step {index + 1}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onMoveUp(index)}
              disabled={index === 0}
              className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed touch-target"
              aria-label="Move step up"
            >
              <FiChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => onMoveDown(index)}
              disabled={index === totalSteps - 1}
              className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed touch-target"
              aria-label="Move step down"
            >
              <FiChevronDown className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(index)}
              className="p-2 text-red-600 hover:text-red-700 touch-target"
              aria-label="Delete step"
            >
              <FiTrash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <AIAssist
          workflowId={workflowId}
          step={localStep}
          index={index}
          useWorkflowStepAI={workflowStepAI}
          onAccept={(proposed) => {
            setLocalStep(proposed);
            onChange(index, proposed);
          }}
        />

        <div className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor={`step-name-${index}`}
            >
              Instruction Name *
            </label>
            <input
              id={`step-name-${index}`}
              type="text"
              value={localStep.step_name}
              onChange={(e) => handleChange("step_name", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., Deep Research"
              required
              aria-label="Instruction name"
              aria-required="true"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor={`step-description-${index}`}
            >
              Description (optional)
            </label>
            <textarea
              id={`step-description-${index}`}
              value={localStep.step_description || ""}
              onChange={(e) => handleChange("step_description", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Brief description of what this does"
              rows={2}
              aria-label="Instruction description"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor={`step-type-${index}`}
            >
              Action Type *
            </label>
            <select
              id={`step-type-${index}`}
              value={
                localStep.step_type ||
                (localStep.webhook_url ? "webhook" : "ai_generation")
              }
              onChange={(e) => {
                const newStepType = e.target.value as "ai_generation" | "webhook";
                if (newStepType === "webhook") {
                  const updated = {
                    ...localStep,
                    step_type: newStepType,
                    webhook_url: localStep.webhook_url || "",
                    webhook_method: localStep.webhook_method || "POST",
                    webhook_query_params: localStep.webhook_query_params || {},
                    webhook_content_type:
                      localStep.webhook_content_type || "application/json",
                    webhook_body_mode: localStep.webhook_body_mode || "auto",
                    webhook_body: localStep.webhook_body || "",
                    webhook_save_response:
                      localStep.webhook_save_response !== undefined
                        ? localStep.webhook_save_response
                        : true,
                    webhook_data_selection:
                      localStep.webhook_data_selection || {
                        include_submission: true,
                        exclude_step_indices: [],
                        include_job_info: true,
                      },
                  };
                  setLocalStep(updated);
                  onChange(index, updated);
                } else {
                  const updated = { ...localStep, step_type: newStepType };
                  setLocalStep(updated);
                  onChange(index, updated);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Action type"
              aria-required="true"
            >
              <option value="ai_generation">Generate Content (AI)</option>
              <option value="webhook">Send Webhook / API Request</option>
            </select>
          </div>

          {/* AI Generation Step Fields */}
          {(localStep.step_type === "ai_generation" ||
            (!localStep.step_type && !localStep.webhook_url)) && (
            <>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor={`ai-model-${index}`}
                >
                  AI Brain *
                </label>
                <select
                  id={`ai-model-${index}`}
                  value={localStep.model}
                  onChange={(e) => handleChange("model", e.target.value as AIModel)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  aria-label="AI model"
                  aria-required="true"
                >
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor={`reasoning-effort-${index}`}
                >
                  Thinking Power
                </label>
                <select
                  id={`reasoning-effort-${index}`}
                  value={localStep.reasoning_effort || ""}
                  onChange={(e) =>
                    handleChange("reasoning_effort", e.target.value || undefined)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="Reasoning effort"
                >
                  <option value="">Standard</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Optional. Controls how much the AI thinks before answering.
                </p>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor={`instructions-${index}`}
                >
                  Instructions *
                </label>
                <textarea
                  id={`instructions-${index}`}
                  value={localStep.instructions}
                  onChange={(e) => handleChange("instructions", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Detailed instructions for what this step should do..."
                  rows={6}
                  required
                  aria-label="Step instructions"
                  aria-required="true"
                />
                <p className="mt-1 text-sm text-gray-500">
                  These instructions will be passed to the AI model along with
                  context from previous steps.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capabilities
                </label>
                <div className="space-y-2 mb-3">
                  {AVAILABLE_TOOLS.map((tool) => (
                    <label
                      key={tool.value}
                      className="flex items-start space-x-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isToolSelected(tool.value)}
                        onChange={() => handleToolToggle(tool.value)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {tool.label}
                        </span>
                        <p className="text-xs text-gray-500">{tool.description}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {isToolSelected("computer_use_preview") && (
                  <ComputerUseConfig
                    config={computerUseConfig}
                    onChange={handleComputerUseConfigChange}
                    index={index}
                  />
                )}

                {isToolSelected("image_generation") && (
                  <ImageGenerationConfig
                    config={imageGenerationConfig}
                    onChange={(field, value) =>
                      handleImageGenerationConfigChange(field, value)
                    }
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tool Choice
                </label>
                <select
                  value={localStep.tool_choice || "auto"}
                  onChange={(e) =>
                    handleChange(
                      "tool_choice",
                      e.target.value as "auto" | "required" | "none",
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {TOOL_CHOICE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} - {option.description}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Webhook Step Fields */}
          {localStep.step_type === "webhook" && (
            <WebhookConfig
              step={localStep}
              index={index}
              allSteps={allSteps}
              workflowId={workflowId}
              onChange={handleChange}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dependencies (optional)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Select which steps must complete before this step runs. Leave empty
              to auto-detect from step order.
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {allSteps.length > 0 ? (
                allSteps.map((otherStep, otherIndex) => {
                  if (otherIndex === index) return null; // Can't depend on itself
                  const isSelected = (localStep.depends_on || []).includes(otherIndex);
                  return (
                    <label
                      key={otherIndex}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const currentDeps = localStep.depends_on || [];
                          const newDeps = e.target.checked
                            ? [...currentDeps, otherIndex]
                            : currentDeps.filter((dep: number) => dep !== otherIndex);
                          handleChange("depends_on", newDeps);
                        }}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-900">
                        Step {otherIndex + 1}: {otherStep.step_name}
                      </span>
                    </label>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">No other steps available</p>
              )}
            </div>
            {localStep.depends_on && localStep.depends_on.length > 0 && (
              <p className="mt-2 text-xs text-gray-600">
                Depends on:{" "}
                {localStep.depends_on.map((dep: number) => `Step ${dep + 1}`).join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}


