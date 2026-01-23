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
  FiMaximize2,
  FiX,
} from "react-icons/fi";
import { useWorkflowStepAI } from "@/hooks/useWorkflowStepAI";
import { useAIModels } from "@/hooks/api/useWorkflows";
import {
  WorkflowStep,
  AIModel,
  ComputerUseToolConfig,
  ImageGenerationToolConfig,
  ShellSettings,
} from "@/types/workflow";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { CollapsibleSection } from "@/components/workflows/edit/CollapsibleSection";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";

import AIAssist from "./step-editor/AIAssist";
import WebhookConfig from "./step-editor/WebhookConfig";
import HandoffConfig from "./step-editor/HandoffConfig";
import ComputerUseConfig from "./step-editor/ComputerUseConfig";
import ImageGenerationConfig from "./step-editor/ImageGenerationConfig";
import StepTester from "./step-editor/StepTester";
import StepEditorNav from "./step-editor/StepEditorNav";
import StepEditorSection from "./step-editor/StepEditorSection";

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
    value: "auto",
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

type StepEditorSectionId =
  | "basics"
  | "integrations";

const STEP_EDITOR_SECTIONS: Array<{
  id: StepEditorSectionId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "basics",
    label: "Basics",
    description: "Name, model, and defaults",
    icon: FiSettings,
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Webhooks and handoff",
    icon: FiGlobe,
  },
];

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
  const [activeSection, setActiveSection] = useState<StepEditorSectionId>("basics");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const previousSectionRef = useRef<StepEditorSectionId>("basics");
  const activeSectionMeta = STEP_EDITOR_SECTIONS.find(
    (section) => section.id === activeSection,
  );
  const ActiveSectionIcon = activeSectionMeta?.icon;

  const [isWebhookCollapsed, setIsWebhookCollapsed] = useState(true);
  const [isHandoffCollapsed, setIsHandoffCollapsed] = useState(true);
  const [isAssistCollapsed, setIsAssistCollapsed] = useState(true);
  const [isShellSettingsCollapsed, setIsShellSettingsCollapsed] = useState(true);
  const [isOutputSchemaCollapsed, setIsOutputSchemaCollapsed] = useState(true);
  const [isDependenciesCollapsed, setIsDependenciesCollapsed] = useState(true);
  const [isInstructionsExpanded, setIsInstructionsExpanded] = useState(false);

  // Track if we've already converted string tools to objects to prevent infinite loops
  const hasConvertedToolsRef = useRef<boolean>(false);

  // Always call hook unconditionally to comply with Rules of Hooks
  const workflowStepAI = useWorkflowStepAI(workflowId);

  const { models, loading: modelsLoading, error: modelsError } = useAIModels();

  const handleToggleFocusMode = () => {
    if (!isFocusMode) {
      previousSectionRef.current = activeSection;
      setActiveSection("basics");
      setIsFocusMode(true);
      return;
    }

    setIsFocusMode(false);
    setActiveSection(previousSectionRef.current);
  };

  // Reset section state when switching steps.
  useEffect(() => {
    setActiveSection("basics");
    setIsFocusMode(false);
    previousSectionRef.current = "basics";
  }, [index]);

  // Sync localStep when step prop changes.
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

  const outputFormatType = localStep.output_format?.type;
  const outputFormatSchema =
    outputFormatType === "json_schema" &&
    localStep.output_format &&
    "schema" in localStep.output_format
      ? localStep.output_format.schema
      : undefined;

  // Keep the JSON Schema editor text in sync when the underlying schema changes.
  // We only update the actual schema in `localStep` when JSON parses successfully,
  // so this won't overwrite user typing for invalid JSON.
  useEffect(() => {
    if (outputFormatType === "json_schema") {
      const schemaObj = outputFormatSchema || {};
      setOutputSchemaJson(JSON.stringify(schemaObj, null, 2));
      setOutputSchemaError(null);
    } else {
      setOutputSchemaJson("");
      setOutputSchemaError(null);
    }
  }, [outputFormatType, outputFormatSchema]);

  useEffect(() => {
    if (outputFormatType !== "json_schema") {
      setIsOutputSchemaCollapsed(true);
    }
  }, [outputFormatType]);

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
    setLocalStep((prev) => {
      const updated = { ...prev, [field]: value };
      onChange(index, updated);
      return updated;
    });
  };

  const handleShellSettingChange = (
    field: keyof ShellSettings,
    value: string,
  ) => {
    const trimmed = value.trim();
    const parsed = trimmed === "" ? undefined : Number(trimmed);
    const normalized =
      parsed !== undefined && Number.isFinite(parsed) && parsed > 0
        ? Math.floor(parsed)
        : undefined;

    setLocalStep((prev) => {
      const nextSettings = { ...(prev.shell_settings || {}) };
      if (normalized === undefined) {
        delete nextSettings[field];
      } else {
        nextSettings[field] = normalized;
      }
      const hasSettings = Object.keys(nextSettings).length > 0;
      const updated = {
        ...prev,
        shell_settings: hasSettings ? nextSettings : undefined,
      };
      onChange(index, updated);
      return updated;
    });
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

  // Render the step editor with error boundary
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
      <div className="rounded-2xl border border-border/60 bg-background p-6 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-border/60">
          <div
            className="flex items-center gap-4"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold shadow-inner">
              {index + 1}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground select-none">
                  {localStep.step_name || "Untitled step"}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                  Step {index + 1}
                </span>
                {isFocusMode && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    <FiMaximize2 className="h-3 w-3" aria-hidden />
                    Focus
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Drag in the flowchart to reorder or edit below.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleFocusMode}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors shadow-sm ${
                isFocusMode
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={isFocusMode}
            >
              <FiMaximize2 className="h-4 w-4" aria-hidden />
              {isFocusMode ? "Exit Focus" : "Focus Mode"}
            </button>
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

        <div className="mt-6">
          <StepTester step={localStep} index={index} />
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <div className="rounded-2xl border border-border/60 bg-background/90 shadow-sm">
            <div className="p-6 space-y-8">
          {activeSection === "basics" && (
            <StepEditorSection
              title="Step basics"
              description="Name, description, and model defaults"
              icon={FiSettings}
              showHeader={false}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  {ActiveSectionIcon && (
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
                      <ActiveSectionIcon className="h-5 w-5" aria-hidden />
                    </span>
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Active section
                    </p>
                    <h4 className="text-lg font-semibold text-foreground">
                      {activeSectionMeta?.label ?? "Basics"}
                    </h4>
                    {activeSectionMeta?.description && (
                      <p className="text-sm text-muted-foreground">
                        {activeSectionMeta.description}
                      </p>
                    )}
                  </div>
                </div>
                {!isFocusMode && (
                  <span className="text-xs text-muted-foreground">
                    Step {index + 1}
                  </span>
                )}
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL} htmlFor={`step-name-${index}`}>
                    <span>Step Name</span>
                    <span className={FIELD_REQUIRED}>*</span>
                  </label>
                  <input
                    id={`step-name-${index}`}
                    type="text"
                    value={localStep.step_name}
                    onChange={(e) => handleChange("step_name", e.target.value)}
                    className={`${CONTROL_BASE} text-base font-semibold`}
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

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-sm font-semibold text-foreground">
                    Instructions
                  </h5>
                  <button
                    type="button"
                    onClick={() => setIsInstructionsExpanded(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-border/60 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Expand instructions"
                  >
                    <FiMaximize2 className="h-3.5 w-3.5" />
                    Expand
                  </button>
                </div>
                <textarea
                  id={`instructions-${index}`}
                  value={localStep.instructions}
                  onChange={(e) => handleChange("instructions", e.target.value)}
                  className={`w-full resize-y rounded-lg border border-input bg-background px-5 py-4 font-mono text-[13px] leading-7 text-foreground shadow-sm transition-all hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 ${
                    isFocusMode ? "min-h-[55vh]" : "min-h-[320px]"
                  }`}
                  placeholder="Enter detailed instructions for what this step should do..."
                  rows={12}
                  required
                  aria-label="Step instructions"
                  aria-required="true"
                />
                <p className="text-xs text-muted-foreground">
                  Use clear steps and include any formatting or data requirements.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL} htmlFor={`ai-model-${index}`}>
                    <span>AI Model</span>
                    <span className={FIELD_REQUIRED}>*</span>
                  </label>
                  <Select
                    id={`ai-model-${index}`}
                    value={localStep.model}
                    onChange={(nextValue) =>
                      handleChange("model", nextValue as AIModel)
                    }
                    className={SELECT_CONTROL}
                    placeholder="Select model"
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
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-foreground">
                    Advanced AI settings
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label
                        className={FIELD_LABEL}
                        htmlFor={`reasoning-effort-${index}`}
                      >
                        <span>Reasoning Depth</span>
                        <span className={FIELD_OPTIONAL}>(Optional)</span>
                      </label>
                      <Select
                        id={`reasoning-effort-${index}`}
                        value={localStep.reasoning_effort || ""}
                        onChange={(nextValue) =>
                          handleChange("reasoning_effort", nextValue || undefined)
                        }
                        className={SELECT_CONTROL}
                        placeholder="Standard (Auto)"
                      >
                        <option value="">Standard (Auto)</option>
                        <option value="none">None - Fastest</option>
                        <option value="low">Low - Quick</option>
                        <option value="medium">Medium - Balanced</option>
                        <option value="high">High - Thorough</option>
                        <option value="xhigh">Extra High - Maximum</option>
                      </Select>
                    </div>

                    <div className="md:col-span-2 space-y-1.5">
                      <label
                        className={FIELD_LABEL}
                        htmlFor={`service-tier-${index}`}
                      >
                        <span>Service Tier</span>
                        <span className={FIELD_OPTIONAL}>(Optional)</span>
                      </label>
                      <Select
                        id={`service-tier-${index}`}
                        value={localStep.service_tier || "auto"}
                        onChange={(nextValue) =>
                          handleChange("service_tier", nextValue as ServiceTier)
                        }
                        className={SELECT_CONTROL}
                        placeholder="Project Default"
                      >
                        {SERVICE_TIER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                            {option.description ? ` — ${option.description}` : ""}
                          </option>
                        ))}
                      </Select>
                      <p className={HELP_TEXT}>
                        Controls cost/latency for this step. Use Priority for fastest
                        responses.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-foreground">
                    Output settings
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className={FIELD_LABEL}
                      htmlFor={`output-format-${index}`}
                    >
                      <span>Output Type</span>
                      <span className={FIELD_OPTIONAL}>(Optional)</span>
                    </label>
                    <Select
                      id={`output-format-${index}`}
                      value={localStep.output_format?.type || "text"}
                      onChange={(nextValue) => {
                        const t = nextValue as
                          | "text"
                          | "json_object"
                          | "json_schema";
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
                        }
                      }}
                      className={SELECT_CONTROL}
                    >
                      {OUTPUT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} - {option.description}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                    <div className="space-y-1">
                      <label
                        className={FIELD_LABEL}
                        htmlFor={`text-verbosity-${index}`}
                      >
                        <span>Output Verbosity</span>
                        <span className={FIELD_OPTIONAL}>(Optional)</span>
                      </label>
                      <Select
                        id={`text-verbosity-${index}`}
                        value={localStep.text_verbosity || ""}
                        onChange={(nextValue) =>
                          handleChange("text_verbosity", nextValue || undefined)
                        }
                        className={SELECT_CONTROL}
                        placeholder="Default"
                      >
                        <option value="">Default</option>
                        <option value="low">Low - Concise</option>
                        <option value="medium">Medium - Balanced</option>
                        <option value="high">High - Detailed</option>
                      </Select>
                      <p className={HELP_TEXT}>
                        Adjusts how detailed and verbose the AI&apos;s output will
                        be.
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
                            e.target.value ? parseInt(e.target.value, 10) : undefined,
                          )
                        }
                        className={CONTROL_BASE}
                        placeholder="e.g., 4000"
                        aria-label="Max output tokens"
                      />
                      <p className={HELP_TEXT}>
                        Maximum number of tokens the AI can generate. Leave empty for
                        no limit.
                      </p>
                    </div>
                  </div>
                </div>

                <CollapsibleSection
                  title="AI Assist (Beta)"
                  isCollapsed={isAssistCollapsed}
                  onToggle={() => setIsAssistCollapsed(!isAssistCollapsed)}
                >
                  <AIAssist
                    workflowId={workflowId}
                    step={localStep}
                    index={index}
                    useWorkflowStepAI={workflowStepAI}
                    onAccept={(proposed) => {
                      setLocalStep(proposed);
                      onChange(index, proposed);
                    }}
                    collapsible={false}
                    allSteps={allSteps}
                  />
                </CollapsibleSection>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-foreground">Tools</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {AVAILABLE_TOOLS.map((tool) => {
                      const selected = isToolSelected(tool.value);
                      const Icon = tool.icon;
                      return (
                        <div
                          key={tool.value}
                          className={`rounded-xl border p-4 transition-all ${
                            selected
                              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/10"
                              : "border-border/40 bg-background hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`shrink-0 p-2.5 rounded-lg transition-colors ${
                                selected
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted/50 text-muted-foreground"
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleToolToggle(tool.value)}
                                  className="text-left"
                                >
                                  <div
                                    className={`text-sm font-semibold ${
                                      selected ? "text-primary" : "text-foreground"
                                    }`}
                                  >
                                    {tool.label}
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {tool.description}
                                  </p>
                                </button>
                                <Checkbox
                                  checked={selected}
                                  onChange={() => handleToolToggle(tool.value)}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          </div>

                          {selected && tool.value === "computer_use_preview" && (
                            <div className="mt-3 border-t border-border/40 pt-3">
                              <ComputerUseConfig
                                config={computerUseConfig}
                                onChange={handleComputerUseConfigChange}
                                index={index}
                                variant="inline"
                              />
                            </div>
                          )}

                          {selected && tool.value === "image_generation" && (
                            <div className="mt-3 border-t border-border/40 pt-3">
                              <ImageGenerationConfig
                                config={imageGenerationConfig}
                                onChange={(field, value) =>
                                  handleImageGenerationConfigChange(field, value)
                                }
                                variant="inline"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="text-sm font-semibold text-foreground">
                      Tool usage
                    </div>
                    <div className="space-y-1.5">
                      <label className={FIELD_LABEL} htmlFor={`tool-choice-${index}`}>
                        <span>Tool Choice</span>
                        <span className={FIELD_OPTIONAL}>(Optional)</span>
                      </label>
                      <Select
                        id={`tool-choice-${index}`}
                        value={localStep.tool_choice || "required"}
                        onChange={(nextValue) =>
                          handleChange(
                            "tool_choice",
                            nextValue as "auto" | "required" | "none",
                          )
                        }
                        className={SELECT_CONTROL}
                      >
                        {TOOL_CHOICE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label} - {option.description}
                          </option>
                        ))}
                      </Select>
                      <p className={HELP_TEXT}>
                        Determines whether the model must use tools, can choose to use
                        them, or should not use them.
                      </p>
                    </div>
                  </div>

                  {isToolSelected("shell") && (
                    <CollapsibleSection
                      title="Shell runtime"
                      isCollapsed={isShellSettingsCollapsed}
                      onToggle={() =>
                        setIsShellSettingsCollapsed(!isShellSettingsCollapsed)
                      }
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label
                            className={FIELD_LABEL}
                            htmlFor={`shell-max-iterations-${index}`}
                          >
                            <span>Max iterations</span>
                            <span className={FIELD_OPTIONAL}>(Optional)</span>
                          </label>
                          <input
                            id={`shell-max-iterations-${index}`}
                            type="number"
                            min={1}
                            max={100}
                            value={localStep.shell_settings?.max_iterations ?? ""}
                            onChange={(e) =>
                              handleShellSettingChange("max_iterations", e.target.value)
                            }
                            className={CONTROL_BASE}
                            placeholder="Default"
                          />
                          <p className={HELP_TEXT}>
                            Upper bound for shell tool loop cycles (leave blank for
                            server default).
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <label
                            className={FIELD_LABEL}
                            htmlFor={`shell-timeout-${index}`}
                          >
                            <span>Command timeout (seconds)</span>
                            <span className={FIELD_OPTIONAL}>(Optional)</span>
                          </label>
                          <input
                            id={`shell-timeout-${index}`}
                            type="number"
                            min={1}
                            max={1200}
                            value={localStep.shell_settings?.command_timeout ?? ""}
                            onChange={(e) =>
                              handleShellSettingChange("command_timeout", e.target.value)
                            }
                            className={CONTROL_BASE}
                            placeholder="Default"
                          />
                          <p className={HELP_TEXT}>
                            Max time per command (seconds).
                          </p>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <label
                            className={FIELD_LABEL}
                            htmlFor={`shell-command-output-${index}`}
                          >
                            <span>Command output limit (chars)</span>
                            <span className={FIELD_OPTIONAL}>(Optional)</span>
                          </label>
                          <input
                            id={`shell-command-output-${index}`}
                            type="number"
                            min={256}
                            max={10000000}
                            value={
                              localStep.shell_settings?.command_max_output_length ?? ""
                            }
                            onChange={(e) =>
                              handleShellSettingChange(
                                "command_max_output_length",
                                e.target.value,
                              )
                            }
                            className={CONTROL_BASE}
                            placeholder="Default"
                          />
                          <p className={HELP_TEXT}>
                            Cap stdout/stderr to avoid huge tool outputs.
                          </p>
                        </div>
                      </div>
                    </CollapsibleSection>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-foreground">
                    Dependencies
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    {(localStep.depends_on || []).length > 0
                      ? `Depends on: ${(localStep.depends_on || [])
                          .map((dep) => allSteps[dep]?.step_name || `Step ${dep + 1}`)
                          .join(", ")}`
                      : "No dependencies configured"}
                  </div>

                  <CollapsibleSection
                    title="Manage dependencies"
                    isCollapsed={isDependenciesCollapsed}
                    onToggle={() => setIsDependenciesCollapsed(!isDependenciesCollapsed)}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {allSteps.length > 0 ? (
                        allSteps.map((otherStep, otherIndex) => {
                          if (otherIndex === index) return null;
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
                              <div
                                className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium border ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {otherIndex + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`text-sm font-medium truncate ${
                                    isSelected ? "text-primary" : "text-foreground"
                                  }`}
                                >
                                  {otherStep.step_name}
                                </div>
                              </div>
                              <Checkbox
                                checked={isSelected}
                                onChange={(checked) => {
                                  const currentDeps = localStep.depends_on || [];
                                  const newDeps = checked
                                    ? [...currentDeps, otherIndex]
                                    : currentDeps.filter((dep: number) => dep !== otherIndex);
                                  handleChange("depends_on", newDeps);
                                }}
                                className="sr-only"
                              />
                              {isSelected && (
                                <div className="absolute top-0 right-0 -mt-1 -mr-1 w-3 h-3 bg-primary rounded-full ring-2 ring-background" />
                              )}
                            </label>
                          );
                        })
                      ) : (
                        <div className="col-span-full text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/60">
                          <p className="text-sm">
                            No other steps available to depend on
                          </p>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                </div>
              </div>
            </StepEditorSection>
          )}


          {activeSection === "integrations" && (
            <StepEditorSection
              title="Integrations"
              description="Send data to APIs or another workflow"
              icon={FiGlobe}
              showHeader={false}
            >
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-1">
                  Webhook:{" "}
                  {localStep.webhook_url || localStep.step_type === "webhook"
                    ? "Configured"
                    : "Not set"}
                </span>
                <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-1">
                  Handoff:{" "}
                  {localStep.handoff_workflow_id?.trim() ? "Configured" : "Not set"}
                </span>
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

              <CollapsibleSection
                title="Send to another Lead Magnet"
                isCollapsed={isHandoffCollapsed}
                onToggle={() => setIsHandoffCollapsed(!isHandoffCollapsed)}
              >
                <HandoffConfig
                  step={localStep}
                  workflowId={workflowId}
                  onChange={handleChange}
                />
              </CollapsibleSection>
            </StepEditorSection>
          )}


            </div>
          </div>
          <div>
            <StepEditorNav
              sections={STEP_EDITOR_SECTIONS}
              activeSection={activeSection}
              onChange={setActiveSection}
              isCompact={isFocusMode}
              layout="horizontal"
            />
          </div>
        </div>

        {/* Expanded Instructions Modal */}
        {isInstructionsExpanded && (
          <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="w-full max-w-5xl h-[90vh] flex flex-col bg-card border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 ring-1 ring-border/50">
              <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20 rounded-t-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FiFileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Instructions Editor
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Step {index + 1}: {localStep.step_name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsInstructionsExpanded(false)}
                  className="p-2 hover:bg-muted hover:text-foreground text-muted-foreground rounded-lg transition-colors"
                  title="Close editor"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 p-0 overflow-hidden relative group">
                <textarea
                  value={localStep.instructions}
                  onChange={(e) => handleChange("instructions", e.target.value)}
                  className="w-full h-full resize-none bg-card p-6 font-mono text-sm leading-relaxed focus:outline-none text-foreground"
                  placeholder="Enter detailed instructions..."
                  autoFocus
                  spellCheck={false}
                />
              </div>
              <div className="p-4 bg-muted/20 border-t border-border flex justify-between items-center rounded-b-xl">
                <span className="text-xs text-muted-foreground">
                  {localStep.instructions?.length || 0} characters
                </span>
                <button
                  onClick={() => setIsInstructionsExpanded(false)}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium text-sm shadow-sm transition-all hover:shadow-md active:scale-95"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}


