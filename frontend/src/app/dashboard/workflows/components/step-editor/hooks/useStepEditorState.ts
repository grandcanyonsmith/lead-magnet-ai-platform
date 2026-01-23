import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  WorkflowStep,
  ComputerUseToolConfig,
  ImageGenerationToolConfig,
  ShellSettings,
} from "@/types/workflow";
import { useSettings } from "@/hooks/api/useSettings";
import { resolveImageSettingsDefaults } from "@/utils/imageSettings";
import {
  ComputerUseConfigState,
  ImageGenerationConfigState,
} from "../types";

interface UseStepEditorStateProps {
  step: WorkflowStep;
  index: number;
  onChange: (index: number, step: WorkflowStep) => void;
}

export function useStepEditorState({
  step,
  index,
  onChange,
}: UseStepEditorStateProps) {
  const [localStep, setLocalStep] = useState<WorkflowStep>(step);
  const [computerUseConfig, setComputerUseConfig] = useState<ComputerUseConfigState>({
    display_width: 1024,
    display_height: 768,
    environment: "browser",
  });

  const { settings } = useSettings();
  const resolvedImageDefaults = useMemo(
    () => resolveImageSettingsDefaults(settings?.default_image_settings),
    [settings?.default_image_settings]
  );

  const resolveImageConfigState = useCallback((
    config?: Partial<ImageGenerationConfigState>
  ): ImageGenerationConfigState => {
    const format = config?.format ?? resolvedImageDefaults.format;
    const supportsCompression = format === "jpeg" || format === "webp";
    const compression = supportsCompression
      ? typeof config?.compression === "number"
        ? config.compression
        : resolvedImageDefaults.compression
      : undefined;

    return {
      model: config?.model || resolvedImageDefaults.model,
      size: config?.size || resolvedImageDefaults.size,
      quality: config?.quality || resolvedImageDefaults.quality,
      format,
      compression,
      background: config?.background || resolvedImageDefaults.background,
      input_fidelity: config?.input_fidelity ?? resolvedImageDefaults.input_fidelity,
    };
  }, [resolvedImageDefaults]);

  const [imageGenerationConfig, setImageGenerationConfig] =
    useState<ImageGenerationConfigState>(() => resolveImageConfigState());

  // Track if we've already converted string tools to objects to prevent infinite loops
  const hasConvertedToolsRef = useRef<boolean>(false);

  // Sync localStep when step prop changes.
  useEffect(() => {
    // Reset conversion tracking when step prop changes (new step or step updated externally)
    hasConvertedToolsRef.current = false;

    setLocalStep({ ...step });

    // Extract computer_use_preview config if present
    const computerUseTool = (step.tools || []).find(
      (t) =>
        (typeof t === "object" && t.type === "computer_use_preview") ||
        t === "computer_use_preview"
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
        t === "image_generation"
    );
    if (
      imageGenTool &&
      typeof imageGenTool === "object" &&
      (imageGenTool as ImageGenerationToolConfig).type === "image_generation"
    ) {
      const config = imageGenTool as ImageGenerationToolConfig;
      setImageGenerationConfig(resolveImageConfigState(config));
    } else {
      // Check if image_generation tool is selected (as string)
      const hasImageGenTool = (step.tools || []).some((t) => {
        if (typeof t === "string") return t === "image_generation";
        return t.type === "image_generation";
      });

      if (hasImageGenTool) {
        // Tool is selected but no config - use defaults
        const defaultConfig = resolveImageConfigState();
        setImageGenerationConfig(defaultConfig);

        // Convert string tool to object immediately if needed (only if not already converted)
        const tools = step.tools || [];
        const hasStringTool = tools.some((t) => t === "image_generation");
        const hasObjectTool = tools.some(
          (t) => typeof t === "object" && t.type === "image_generation"
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
        setImageGenerationConfig(resolveImageConfigState());
      }
    }
  }, [step, onChange, index, resolvedImageDefaults, resolveImageConfigState]);

  // Ensure image generation config is initialized when tool is selected
  useEffect(() => {
    const hasImageGenTool = (localStep.tools || []).some((t) => {
      if (typeof t === "string") return t === "image_generation";
      return typeof t === "object" && t.type === "image_generation";
    });

    if (hasImageGenTool) {
      setImageGenerationConfig((prev) => {
        if (!prev.size) {
          return resolveImageConfigState();
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
    value: string
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
          : resolveImageConfigState();

        const config: any = {
          type: "image_generation",
          model: currentConfig.model || resolvedImageDefaults.model,
          size: currentConfig.size || resolvedImageDefaults.size,
          quality: currentConfig.quality || resolvedImageDefaults.quality,
          background: currentConfig.background || resolvedImageDefaults.background,
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
    value: number | string
  ) => {
    const newConfig = {
      ...computerUseConfig,
      [field]: value,
    } as ComputerUseConfigState;
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
        (t) => typeof t === "object" && t.type === "computer_use_preview"
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
    value: any
  ) => {
    const newConfig = {
      ...imageGenerationConfig,
      [field]: value,
    } as ImageGenerationConfigState;
    if (field === "format") {
      if (value !== "jpeg" && value !== "webp") {
        newConfig.compression = undefined;
      }
    }
    if (field === "compression") {
      if (typeof value === "number" && Number.isFinite(value)) {
        newConfig.compression = Math.min(100, Math.max(0, value));
      } else {
        newConfig.compression = undefined;
      }
    }
    setImageGenerationConfig(newConfig);

    const currentTools = localStep.tools || [];
    const updatedTools = currentTools.map((t) => {
      if (t === "image_generation") {
        const cfg: any = {
          type: "image_generation",
          model: newConfig.model || resolvedImageDefaults.model,
          size: newConfig.size || resolvedImageDefaults.size,
          quality: newConfig.quality || resolvedImageDefaults.quality,
          background: newConfig.background || resolvedImageDefaults.background,
        };
        if (newConfig.format) cfg.format = newConfig.format;
        if (newConfig.compression !== undefined)
          cfg.compression = newConfig.compression;
        if (newConfig.input_fidelity)
          cfg.input_fidelity = newConfig.input_fidelity;
        return cfg;
      }

      if (typeof t === "object" && t.type === "image_generation") {
        const updated: any = {
          ...t,
          model:
            newConfig.model ||
            (t as ImageGenerationToolConfig).model ||
            resolvedImageDefaults.model,
          size: newConfig.size || resolvedImageDefaults.size,
          quality: newConfig.quality || resolvedImageDefaults.quality,
          background: newConfig.background || resolvedImageDefaults.background,
        };

        if (newConfig.format) updated.format = newConfig.format;
        else delete updated.format;

        if (newConfig.compression !== undefined)
          updated.compression = newConfig.compression;
        else delete updated.compression;

        if (newConfig.input_fidelity)
          updated.input_fidelity = newConfig.input_fidelity;
        else delete updated.input_fidelity;

        return updated;
      }

      return t;
    });

    if (
      isToolSelected("image_generation") &&
      !updatedTools.some(
        (t) => typeof t === "object" && t.type === "image_generation"
      )
    ) {
      const cfg: any = {
        type: "image_generation",
        model: newConfig.model || resolvedImageDefaults.model,
        size: newConfig.size || resolvedImageDefaults.size,
        quality: newConfig.quality || resolvedImageDefaults.quality,
        background: newConfig.background || resolvedImageDefaults.background,
      };
      if (newConfig.format) cfg.format = newConfig.format;
      if (newConfig.compression !== undefined)
        cfg.compression = newConfig.compression;
      if (newConfig.input_fidelity) cfg.input_fidelity = newConfig.input_fidelity;
      updatedTools.push(cfg);
    }

    handleChange("tools", updatedTools);
  };

  return {
    localStep,
    setLocalStep,
    handleChange,
    computerUseConfig,
    imageGenerationConfig,
    handleToolToggle,
    handleShellSettingChange,
    handleComputerUseConfigChange,
    handleImageGenerationConfigChange,
    isToolSelected,
    resolvedImageDefaults,
  };
}
