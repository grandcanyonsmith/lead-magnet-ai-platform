import React from "react";
import { WorkflowStep, AIModel, ServiceTier } from "@/types/workflow";
import { DEFAULT_AI_MODEL } from "@/constants/models";
import { useAIModelOptions } from "@/hooks/useAIModelOptions";
import { Select } from "@/components/ui/Select";
import {
  FIELD_LABEL,
  FIELD_REQUIRED,
  FIELD_OPTIONAL,
  SELECT_CONTROL,
  HELP_TEXT,
  SERVICE_TIER_OPTIONS,
} from "../constants";

interface ModelConfigProps {
  step: WorkflowStep;
  index: number;
  onChange: (field: keyof WorkflowStep, value: any) => void;
}

export default function ModelConfig({ step, index, onChange }: ModelConfigProps) {
  const {
    options: modelOptions,
    loading: modelsLoading,
    error: modelsError,
  } = useAIModelOptions({
    currentModel: step.model,
    fallbackModel: DEFAULT_AI_MODEL,
  });

  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-5 space-y-4">
      <h5 className="text-sm font-semibold text-foreground">Model</h5>
      <div className="space-y-1.5">
        <label className={FIELD_LABEL} htmlFor={`ai-model-${index}`}>
          <span>AI Model</span>
          <span className={FIELD_REQUIRED}>*</span>
        </label>
        <Select
          id={`ai-model-${index}`}
          value={step.model}
          onChange={(nextValue) => onChange("model", nextValue as AIModel)}
          className={SELECT_CONTROL}
          placeholder={modelsLoading ? "Loading models..." : "Select model"}
          disabled={modelsLoading || !!modelsError}
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

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <label className={FIELD_LABEL} htmlFor={`reasoning-effort-${index}`}>
            <span>Reasoning Depth</span>
            <span className={FIELD_OPTIONAL}>(Optional)</span>
          </label>
          <Select
            id={`reasoning-effort-${index}`}
            value={step.reasoning_effort || ""}
            onChange={(nextValue) =>
              onChange("reasoning_effort", nextValue || undefined)
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

        <div className="space-y-1.5">
          <label className={FIELD_LABEL} htmlFor={`service-tier-${index}`}>
            <span>Service Tier</span>
            <span className={FIELD_OPTIONAL}>(Optional)</span>
          </label>
          <Select
            id={`service-tier-${index}`}
            value={step.service_tier || "auto"}
            onChange={(nextValue) =>
              onChange("service_tier", nextValue as ServiceTier)
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
  );
}
