"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  FiTrash2,
  FiChevronUp,
  FiChevronDown,
  FiGlobe,
  FiSettings,
  FiCpu,
  FiBox,
  FiMessageSquare,
  FiFileText,
  FiImage,
  FiMonitor,
  FiTerminal,
  FiCode,
  FiZap,
  FiAlignLeft,
  FiLayout,
  FiLink,
} from "react-icons/fi";
import { useWorkflowStepAI } from "@/hooks/useWorkflowStepAI";
import { useAIModels } from "@/hooks/api/useWorkflows";
import {
  WorkflowStep,
  AIModel,
  ComputerUseToolConfig,
  ImageGenerationToolConfig,
} from "@/types/workflow";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { CollapsibleSection } from "@/components/workflows/edit/CollapsibleSection";

import AIAssist from "./step-editor/AIAssist";
import WebhookConfig from "./step-editor/WebhookConfig";
import ComputerUseConfig from "./step-editor/ComputerUseConfig";
import ImageGenerationConfig from "./step-editor/ImageGenerationConfig";
import StepTester from "./step-editor/StepTester";

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

const AVAILABLE_TOOLS = [
  {
    value: "web_search",
    label: "Search the Web",
    description: "Look up real-time information",
    icon: FiGlobe,
  },
  {
    value: "image_generation",
    label: "Create Images",
    description: "Generate images from text",
    icon: FiImage,
  },
  {
    value: "computer_use_preview",
    label: "Computer Use",
    description: "Interact with interfaces (Beta)",
    icon: FiMonitor,
  },
  {
    value: "file_search",
    label: "Search Files",
    description: "Search uploaded files",
    icon: FiFileText,
  },
  {
    value: "code_interpreter",
    label: "Run Code",
    description: "Execute Python code",
    icon: FiCode,
  },
  {
    value: "shell",
    label: "Shell Commands",
    description: "Run system commands",
    icon: FiTerminal,
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

const SERVICE_TIER_OPTIONS = [
  {
    value: "",
    label: "Auto",
    description: "Project Default",
    icon: FiZap,
  },
  {
    value: "priority",
    label: "Priority",
    description: "Fastest Response",
    icon: FiZap,
  },
  {
    value: "default",
    label: "Default",
    description: "Standard Speed",
    icon: FiCpu,
  },
  {
    value: "flex",
    label: "Flex",
    description: "Lower Cost",
    icon: FiBox,
  },
  {
    value: "scale",
    label: "Scale",
    description: "High Volume",
    icon: FiBox,
  },
];

const OUTPUT_TYPE_OPTIONS = [
  {
    value: "text",
    label: "Text",
    description: "Standard text response",
    icon: FiAlignLeft,
  },
  {
    value: "json_schema",
    label: "Structured JSON",
    description: "Strict schema validation",
    icon: FiLayout,
  },
  {
    value: "json_object",
    label: "JSON Object",
    description: "Raw JSON output",
    icon: FiCode,
  },
];

const SECTION_HEADER = "flex items-center gap-2 mb-4 pb-2 border-b border-border/40";
const SECTION_TITLE = "text-sm font-semibold text-foreground flex items-center gap-2";
const SECTION_SUBTITLE = "text-xs text-muted-foreground ml-auto";

const FIELD_LABEL =
  "flex items-center gap-1.5 text-sm font-medium text-foreground/90 mb-1.5";
const FIELD_OPTIONAL = "text-xs font-normal text-muted-foreground";
const FIELD_REQUIRED = "text-destructive";

const CONTROL_BASE =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm transition-all hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50";
const SELECT_CONTROL = `${CONTROL_BASE} pr-9`;
const HELP_TEXT = "mt-2 text-xs leading-relaxed text-muted-foreground";

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
  const [outputSchemaJson, setOutputSchemaJson] = useState<string>("");
  const [outputSchemaError, setOutputSchemaError] = useState<string | null>(null);
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
  
  const [isWebhookCollapsed, setIsWebhookCollapsed] = useState(true);
  const [showAdvancedAI, setShowAdvancedAI] = useState(false);

  // Track if we've already converted string tools to objects to prevent infinite loops
  const hasConvertedToolsRef = useRef<boolean>(false);

  // Always call hook unconditionally to comply with Rules of Hooks
  const workflowStepAI = useWorkflowStepAI(workflowId);

  const { models, loading: modelsLoading, error: modelsError } = useAIModels();

  // Sync localStep when step prop changes
  useEffect(() => {
    // Reset conversion tracking when step prop changes (new step or step updated externally)
    hasConvertedToolsRef.current = false;

    setLocalStep({ ...step });

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

  // Keep the JSON Schema editor text in sync when the underlying schema changes.
  // We only update the actual schema in `localStep` when JSON parses successfully,
  // so this won't overwrite user typing for invalid JSON.
  useEffect(() => {
    if (localStep.output_format?.type === "json_schema") {
      const schemaObj = localStep.output_format.schema || {};
      setOutputSchemaJson(JSON.stringify(schemaObj, null, 2));
      setOutputSchemaError(null);
    } else {
      setOutputSchemaJson("");
      setOutputSchemaError(null);
    }
  }, [
    localStep.output_format?.type,
    localStep.output_format?.type === "json_schema"
      ? localStep.output_format.schema
      : undefined,
  ]);

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
        <div className="border border-red-300 dark:border-red-900 rounded-lg p-6 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-800 dark:text-red-200 font-medium">
            Error loading step editor
          </p>
          <p className="text-red-600 dark:text-red-300 text-sm mt-1">
            Please refresh the page or try again.
          </p>
        </div>
      }
    >
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/5">
        <div className="flex items-start justify-between pb-4 mb-6 border-b border-border/60">
          <div
            className="flex items-center gap-3"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="text-xs">⋮⋮</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground select-none">
              Step {index + 1}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onMoveUp(index)}
              disabled={index === 0}
              className="rounded-lg border border-border bg-background/60 p-2 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed touch-target"
              aria-label="Move step up"
            >
              <FiChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => onMoveDown(index)}
              disabled={index === totalSteps - 1}
              className="rounded-lg border border-border bg-background/60 p-2 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed touch-target"
              aria-label="Move step down"
            >
              <FiChevronDown className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(index)}
              className="rounded-lg border border-destructive/30 bg-background/60 p-2 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive touch-target"
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

        <div className="space-y-8">
          <div>
            <div className={SECTION_HEADER}>
              <h4 className={SECTION_TITLE}>
                <FiSettings className="w-4 h-4 text-primary" />
                Step Information
              </h4>
              <p className={SECTION_SUBTITLE}>
                Basic details about this workflow step
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  className={FIELD_LABEL}
                  htmlFor={`step-name-${index}`}
                >
                  <span>Step Name</span>
                  <span className={FIELD_REQUIRED}>*</span>
                </label>
                <input
                  id={`step-name-${index}`}
                  type="text"
                  value={localStep.step_name}
                  onChange={(e) => handleChange("step_name", e.target.value)}
                  className="w-full text-xl font-semibold bg-transparent border-none px-0 py-2 placeholder:text-muted-foreground/50 focus:ring-0 focus:outline-none"
                  placeholder="e.g., Deep Research"
                  required
                  aria-label="Instruction name"
                  aria-required="true"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className={FIELD_LABEL}
                  htmlFor={`step-description-${index}`}
                >
                  <span>Description</span>
                  <span className={FIELD_OPTIONAL}>(Optional)</span>
                </label>
                <textarea
                  id={`step-description-${index}`}
                  value={localStep.step_description || ""}
                  onChange={(e) =>
                    handleChange("step_description", e.target.value)
                  }
                  className={`${CONTROL_BASE} min-h-[80px] resize-y leading-relaxed bg-muted/30 border-transparent hover:bg-background hover:border-input focus:bg-background focus:border-ring`}
                  placeholder="Brief description of what this step does"
                  rows={2}
                  aria-label="Instruction description"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className={SECTION_HEADER}>
              <h4 className={SECTION_TITLE}>
                <FiCpu className="w-4 h-4 text-primary" />
                AI Configuration
              </h4>
              <div className="ml-auto flex items-center gap-2">
                 <button
                  type="button"
                  onClick={() => setShowAdvancedAI(!showAdvancedAI)}
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                >
                  {showAdvancedAI ? "Hide Advanced" : "Show Advanced"}
                  {showAdvancedAI ? (
                    <FiChevronUp className="w-3 h-3" />
                  ) : (
                    <FiChevronDown className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Basic AI Settings */}
              <div className="space-y-1.5">
                <label
                  className={FIELD_LABEL}
                  htmlFor={`ai-model-${index}`}
                >
                  <span>AI Model</span>
                  <span className={FIELD_REQUIRED}>*</span>
                </label>
                <select
                  id={`ai-model-${index}`}
                  value={localStep.model}
                  onChange={(e) =>
                    handleChange("model", e.target.value as AIModel)
                  }
                  className={SELECT_CONTROL}
                  required
                  aria-label="AI model"
                  aria-required="true"
                  disabled={modelsLoading || !!modelsError}
                >
                  {modelsLoading ? (
                    <option>Loading models...</option>
                  ) : modelsError ? (
                     <option>Error loading models</option>
                  ) : models.length > 0 ? (
                    models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))
                  ) : (
                    <option value="gpt-5.2">GPT-5.2 (Default)</option>
                  )}
                </select>
              </div>

              {/* Advanced AI Settings */}
              {showAdvancedAI && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1.5">
                    <label
                      className={FIELD_LABEL}
                      htmlFor={`reasoning-effort-${index}`}
                    >
                      <span>Reasoning Depth</span>
                      <span className={FIELD_OPTIONAL}>(Optional)</span>
                    </label>
                    <select
                      id={`reasoning-effort-${index}`}
                      value={localStep.reasoning_effort || ""}
                      onChange={(e) =>
                        handleChange("reasoning_effort", e.target.value || undefined)
                      }
                      className={SELECT_CONTROL}
                      aria-label="Reasoning effort"
                    >
                      <option value="">Standard (Auto)</option>
                      <option value="none">None - Fastest</option>
                      <option value="low">Low - Quick</option>
                      <option value="medium">Medium - Balanced</option>
                      <option value="high">High - Thorough</option>
                      <option value="xhigh">Extra High - Maximum</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <label
                      className={FIELD_LABEL}
                      htmlFor={`service-tier-${index}`}
                    >
                      <span>Service Tier</span>
                      <span className={FIELD_OPTIONAL}>(Optional)</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {SERVICE_TIER_OPTIONS.map((option) => {
                        const isSelected = (localStep.service_tier || "") === option.value;
                        const Icon = option.icon;
                        return (
                          <div
                            key={option.value}
                            onClick={() => handleChange("service_tier", option.value || undefined)}
                            className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border cursor-pointer transition-all text-center h-full ${
                              isSelected 
                                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/10" 
                                : "border-border/40 hover:border-border hover:bg-muted/20 bg-background"
                            }`}
                          >
                            <div className={`p-1.5 rounded-md ${isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 w-full">
                              <div className={`text-sm font-medium leading-none mb-1 ${isSelected ? "text-primary" : "text-foreground"}`}>{option.label}</div>
                              <div className="text-[10px] text-muted-foreground truncate w-full">{option.description}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className={HELP_TEXT}>
                      Controls cost/latency for this step. Use Priority for fastest responses.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className={SECTION_HEADER}>
              <h4 className={SECTION_TITLE}>
                <FiMessageSquare className="w-4 h-4 text-primary" />
                Output Settings
              </h4>
              <p className={SECTION_SUBTITLE}>
                Control the length and detail level of AI responses
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <div className="space-y-1.5 md:col-span-2">
                <label
                  className={FIELD_LABEL}
                  htmlFor={`output-format-${index}`}
                >
                  <span>Output Type</span>
                  <span className={FIELD_OPTIONAL}>(Optional)</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {OUTPUT_TYPE_OPTIONS.map((option) => {
                    const isSelected =
                      (localStep.output_format?.type || "text") === option.value;
                    const Icon = option.icon;
                    return (
                      <div
                        key={option.value}
                        onClick={() => {
                          const t = option.value;
                          if (t === "text") {
                            handleChange("output_format", undefined);
                            return;
                          }
                          if (t === "json_object") {
                            handleChange("output_format", { type: "json_object" });
                            return;
                          }
                          if (t === "json_schema") {
                            const existing = localStep.output_format;
                            const defaultSchema = {
                              type: "object",
                              properties: {},
                              additionalProperties: true,
                            };
                            const next =
                              existing && existing.type === "json_schema"
                                ? existing
                                : {
                                    type: "json_schema",
                                    name: `step_${index + 1}_output`,
                                    strict: true,
                                    schema: defaultSchema,
                                  };
                            handleChange("output_format", next as any);
                            return;
                          }
                        }}
                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/10"
                            : "border-border/40 hover:border-primary/20 hover:bg-muted/30 bg-background"
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg transition-colors ${
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "bg-muted/50 text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="text-center">
                          <div
                            className={`text-sm font-semibold mb-0.5 ${
                              isSelected ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {option.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {option.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {localStep.output_format?.type === "json_schema" && (
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 rounded-xl border border-border/60 bg-background/40 p-4">
                  <div className="space-y-1">
                    <label
                      className={FIELD_LABEL}
                      htmlFor={`output-schema-name-${index}`}
                    >
                      <span>Schema Name</span>
                      <span className={FIELD_REQUIRED}>*</span>
                    </label>
                    <input
                      id={`output-schema-name-${index}`}
                      type="text"
                      value={localStep.output_format.name || ""}
                      onChange={(e) =>
                        handleChange("output_format", {
                          ...localStep.output_format,
                          name: e.target.value,
                        } as any)
                      }
                      className={CONTROL_BASE}
                      placeholder="e.g., step_output"
                    />
                    <p className={HELP_TEXT}>
                      Used by OpenAI to label the structured output format (max 64 chars).
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label
                      className={FIELD_LABEL}
                      htmlFor={`output-schema-strict-${index}`}
                    >
                      <span>Strict</span>
                      <span className={FIELD_OPTIONAL}>(Optional)</span>
                    </label>
                    <select
                      id={`output-schema-strict-${index}`}
                      value={String(localStep.output_format.strict !== false)}
                      onChange={(e) =>
                        handleChange("output_format", {
                          ...localStep.output_format,
                          strict: e.target.value === "true",
                        } as any)
                      }
                      className={SELECT_CONTROL}
                    >
                      <option value="true">true (recommended)</option>
                      <option value="false">false</option>
                    </select>
                    <p className={HELP_TEXT}>
                      When true, the model must adhere to the schema (subset of JSON Schema supported).
                    </p>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label
                      className={FIELD_LABEL}
                      htmlFor={`output-schema-description-${index}`}
                    >
                      <span>Description</span>
                      <span className={FIELD_OPTIONAL}>(Optional)</span>
                    </label>
                    <input
                      id={`output-schema-description-${index}`}
                      type="text"
                      value={localStep.output_format.description || ""}
                      onChange={(e) =>
                        handleChange("output_format", {
                          ...localStep.output_format,
                          description: e.target.value || undefined,
                        } as any)
                      }
                      className={CONTROL_BASE}
                      placeholder="What the output represents"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label
                      className={FIELD_LABEL}
                      htmlFor={`output-schema-json-${index}`}
                    >
                      <span>JSON Schema</span>
                      <span className={FIELD_REQUIRED}>*</span>
                    </label>
                    <div className="relative rounded-lg overflow-hidden border border-input shadow-sm">
                      <div className="absolute top-0 right-0 p-2 pointer-events-none">
                        <span className="text-[10px] font-mono text-muted-foreground bg-background/80 backdrop-blur px-1.5 py-0.5 rounded border border-border/50">JSON</span>
                      </div>
                      <textarea
                        id={`output-schema-json-${index}`}
                        className="w-full min-h-[240px] bg-slate-950 text-slate-50 p-4 font-mono text-xs leading-relaxed resize-y focus:outline-none"
                        value={outputSchemaJson}
                        onChange={(e) => {
                          const next = e.target.value;
                          setOutputSchemaJson(next);
                          try {
                            const parsed = JSON.parse(next || "{}");
                            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                              setOutputSchemaError("Schema must be a JSON object");
                              return;
                            }
                            setOutputSchemaError(null);
                            handleChange("output_format", {
                              ...localStep.output_format,
                              schema: parsed,
                            } as any);
                          } catch (err: any) {
                            setOutputSchemaError("Invalid JSON (will apply once it parses)");
                          }
                        }}
                        placeholder='{\n  "type": "object",\n  "properties": {\n    "example": { "type": "string" }\n  },\n  "required": ["example"]\n}'
                        rows={10}
                        spellCheck={false}
                      />
                    </div>
                    {outputSchemaError && (
                      <p className="mt-2 text-xs text-destructive font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                        {outputSchemaError}
                      </p>
                    )}
                    <p className={HELP_TEXT}>
                      Paste a valid JSON Schema object. Invalid JSON won&apos;t be applied until it parses.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label
                  className={FIELD_LABEL}
                  htmlFor={`text-verbosity-${index}`}
                >
                  <span>Output Verbosity</span>
                  <span className={FIELD_OPTIONAL}>(Optional)</span>
                </label>
                <select
                  id={`text-verbosity-${index}`}
                  value={localStep.text_verbosity || ""}
                  onChange={(e) =>
                    handleChange("text_verbosity", e.target.value || undefined)
                  }
                  className={SELECT_CONTROL}
                  aria-label="Text verbosity"
                >
                  <option value="">Default</option>
                  <option value="low">Low - Concise</option>
                  <option value="medium">Medium - Balanced</option>
                  <option value="high">High - Detailed</option>
                </select>
                <p className={HELP_TEXT}>
                  Adjusts how detailed and verbose the AI&apos;s output will be.
                </p>
              </div>

              <div className="space-y-1">
                <label
                  className={FIELD_LABEL}
                  htmlFor={`max-output-tokens-${index}`}
                >
                  <span>Max Output Tokens</span>
                  <span className={FIELD_OPTIONAL}>(Optional)</span>
                </label>
                <input
                  id={`max-output-tokens-${index}`}
                  type="number"
                  min="1"
                  step="100"
                  value={localStep.max_output_tokens || ""}
                  onChange={(e) =>
                    handleChange(
                      "max_output_tokens",
                      e.target.value ? parseInt(e.target.value, 10) : undefined
                    )
                  }
                  className={CONTROL_BASE}
                  placeholder="e.g., 4000"
                  aria-label="Max output tokens"
                />
                <p className={HELP_TEXT}>
                  Maximum number of tokens the AI can generate. Leave empty for no limit.
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className={SECTION_HEADER}>
              <label
                className="flex items-center gap-2 text-sm font-semibold text-foreground cursor-pointer"
                htmlFor={`instructions-${index}`}
              >
                <FiFileText className="w-4 h-4 text-primary" />
                <span>Instructions</span>
                <span className={FIELD_REQUIRED}>*</span>
              </label>
              <p className={SECTION_SUBTITLE}>
                Detailed instructions for the AI model
              </p>
            </div>
            <textarea
              id={`instructions-${index}`}
              value={localStep.instructions}
              onChange={(e) => handleChange("instructions", e.target.value)}
              className="w-full min-h-[320px] resize-y rounded-lg border border-input bg-background px-5 py-4 font-mono text-[13px] leading-7 text-foreground shadow-sm transition-all hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40"
              placeholder="Enter detailed instructions for what this step should do..."
              rows={12}
              required
              aria-label="Step instructions"
              aria-required="true"
            />
          </div>

          <div>
            <div className={SECTION_HEADER}>
              <h4 className={SECTION_TITLE}>
                <FiBox className="w-4 h-4 text-primary" />
                Capabilities
              </h4>
              <p className={SECTION_SUBTITLE}>
                Select tools the AI model can use to complete this step
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {AVAILABLE_TOOLS.map((tool) => {
                const selected = isToolSelected(tool.value);
                const Icon = tool.icon;
                return (
                  <label
                    key={tool.value}
                    className={`relative flex items-start gap-4 rounded-xl border p-4 cursor-pointer transition-all duration-200 ${
                      selected
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/10"
                        : "border-border/40 bg-background hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm"
                    }`}
                  >
                    <div className={`shrink-0 p-2.5 rounded-lg transition-colors ${selected ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground group-hover:bg-background/80"}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-sm font-semibold transition-colors ${selected ? "text-primary" : "text-foreground"}`}>
                          {tool.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => handleToolToggle(tool.value)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {isToolSelected("computer_use_preview") && (
              <div className="mt-6 pl-1">
                <ComputerUseConfig
                  config={computerUseConfig}
                  onChange={handleComputerUseConfigChange}
                  index={index}
                />
              </div>
            )}

            {isToolSelected("image_generation") && (
              <div className="mt-6 pl-1">
                <ImageGenerationConfig
                  config={imageGenerationConfig}
                  onChange={(field, value) =>
                    handleImageGenerationConfigChange(field, value)
                  }
                />
              </div>
            )}
          </div>

          <div>
            <div className={SECTION_HEADER}>
              <h4 className={SECTION_TITLE}>
                <FiSettings className="w-4 h-4 text-primary" />
                Tool Usage
              </h4>
              <p className={SECTION_SUBTITLE}>
                Control how the AI model uses the selected tools
              </p>
            </div>
            <div className="space-y-1.5">
              <label
                className={FIELD_LABEL}
                htmlFor={`tool-choice-${index}`}
              >
                <span>Tool Choice</span>
                <span className={FIELD_OPTIONAL}>(Optional)</span>
              </label>
              <select
                id={`tool-choice-${index}`}
                value={localStep.tool_choice || "auto"}
                onChange={(e) =>
                  handleChange(
                    "tool_choice",
                    e.target.value as "auto" | "required" | "none",
                  )
                }
                className={SELECT_CONTROL}
              >
                {TOOL_CHOICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
              <p className={HELP_TEXT}>
                Determines whether the model must use tools, can choose to use them, or should not use them.
              </p>
            </div>
          </div>

          <CollapsibleSection
            title="Webhook / API Request"
            isCollapsed={isWebhookCollapsed}
            onToggle={() => setIsWebhookCollapsed(!isWebhookCollapsed)}
          >
            <WebhookConfig
              step={localStep}
              index={index}
              allSteps={allSteps}
              workflowId={workflowId}
              onChange={handleChange}
            />
          </CollapsibleSection>

          <div className="pt-6 border-t border-border/40">
            <div className={SECTION_HEADER}>
              <h4 className={SECTION_TITLE}>
                <FiLink className="w-4 h-4 text-primary" />
                Dependencies
              </h4>
              <p className={SECTION_SUBTITLE}>
                (Optional)
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allSteps.length > 0 ? (
                allSteps.map((otherStep, otherIndex) => {
                  if (otherIndex === index) return null; // Can't depend on itself
                  const isSelected = (localStep.depends_on || []).includes(
                    otherIndex,
                  );
                  return (
                    <label
                      key={otherIndex}
                      className={`relative flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/10"
                          : "border-border/40 hover:border-primary/20 hover:bg-muted/30 bg-background"
                      }`}
                    >
                      <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium border ${
                        isSelected 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {otherIndex + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {otherStep.step_name}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const currentDeps = localStep.depends_on || [];
                          const newDeps = e.target.checked
                            ? [...currentDeps, otherIndex]
                            : currentDeps.filter(
                                (dep: number) => dep !== otherIndex,
                              );
                          handleChange("depends_on", newDeps);
                        }}
                        className="hidden" // Hide default checkbox
                      />
                      {isSelected && (
                        <div className="absolute top-0 right-0 -mt-1 -mr-1 w-3 h-3 bg-primary rounded-full ring-2 ring-background" />
                      )}
                    </label>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/60">
                  <p className="text-sm">No other steps available to depend on</p>
                </div>
              )}
            </div>
          </div>
          
          <StepTester step={localStep} index={index} />
        </div>
      </div>
    </ErrorBoundary>
  );
}


