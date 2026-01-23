import React, { useState } from "react";
import { WorkflowStep, ShellSettings } from "@/types/workflow";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { CollapsibleSection } from "@/components/workflows/edit/CollapsibleSection";
import ComputerUseConfig from "../ComputerUseConfig";
import ImageGenerationConfig from "../ImageGenerationConfig";
import {
  AVAILABLE_TOOLS,
  TOOL_CHOICE_OPTIONS,
  FIELD_LABEL,
  FIELD_OPTIONAL,
  SELECT_CONTROL,
  HELP_TEXT,
  CONTROL_BASE,
} from "../constants";
import {
  ComputerUseConfigState,
  ImageGenerationConfigState,
} from "../types";

interface ToolsConfigProps {
  step: WorkflowStep;
  index: number;
  onChange: (field: keyof WorkflowStep, value: any) => void;
  isToolSelected: (toolValue: string) => boolean;
  handleToolToggle: (toolValue: string) => void;
  computerUseConfig: ComputerUseConfigState;
  handleComputerUseConfigChange: (
    field: keyof ComputerUseConfigState,
    value: number | string
  ) => void;
  imageGenerationConfig: ImageGenerationConfigState;
  handleImageGenerationConfigChange: (
    field: keyof ImageGenerationConfigState,
    value: any
  ) => void;
  handleShellSettingChange: (field: keyof ShellSettings, value: string) => void;
}

export default function ToolsConfig({
  step,
  index,
  onChange,
  isToolSelected,
  handleToolToggle,
  computerUseConfig,
  handleComputerUseConfigChange,
  imageGenerationConfig,
  handleImageGenerationConfigChange,
  handleShellSettingChange,
}: ToolsConfigProps) {
  const [isShellSettingsCollapsed, setIsShellSettingsCollapsed] = useState(true);

  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold text-foreground">Tools</h5>
        <span className="text-xs text-muted-foreground">
          {Array.isArray(step.tools) && step.tools.length > 0
            ? `${step.tools.length} enabled`
            : "None"}
        </span>
      </div>
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

      <div className="space-y-2">
        <div className="text-sm font-semibold text-foreground">Tool usage</div>
        <div className="space-y-1.5">
          <label className={FIELD_LABEL} htmlFor={`tool-choice-${index}`}>
            <span>Tool Choice</span>
            <span className={FIELD_OPTIONAL}>(Optional)</span>
          </label>
          <Select
            id={`tool-choice-${index}`}
            value={step.tool_choice || "required"}
            onChange={(nextValue) =>
              onChange("tool_choice", nextValue as "auto" | "required" | "none")
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
            Determines whether the model must use tools, can choose to use them,
            or should not use them.
          </p>
        </div>
      </div>

      {isToolSelected("shell") && (
        <CollapsibleSection
          title="Shell runtime"
          isCollapsed={isShellSettingsCollapsed}
          onToggle={() => setIsShellSettingsCollapsed(!isShellSettingsCollapsed)}
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
                value={step.shell_settings?.max_iterations ?? ""}
                onChange={(e) =>
                  handleShellSettingChange("max_iterations", e.target.value)
                }
                className={CONTROL_BASE}
                placeholder="Default"
              />
              <p className={HELP_TEXT}>
                Upper bound for shell tool loop cycles (leave blank for server
                default).
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
                value={step.shell_settings?.command_timeout_ms ? Math.floor(step.shell_settings.command_timeout_ms / 1000) : ""}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value, 10) * 1000 : "";
                  handleShellSettingChange("command_timeout_ms", val.toString())
                }}
                className={CONTROL_BASE}
                placeholder="Default"
              />
              <p className={HELP_TEXT}>Max time per command (seconds).</p>
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
                value={step.shell_settings?.command_max_output_length ?? ""}
                onChange={(e) =>
                  handleShellSettingChange(
                    "command_max_output_length",
                    e.target.value
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
  );
}
