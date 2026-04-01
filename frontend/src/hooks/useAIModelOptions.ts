import { useMemo } from "react";
import { AI_MODELS } from "@/constants/models";
import { useAIModels } from "@/hooks/api/useWorkflows";

export type AIModelOption = {
  value: string;
  label: string;
};

type UseAIModelOptionsArgs = {
  currentModel?: string | null;
  fallbackModel?: string | null;
};

const normalizeValue = (value?: string | null): string => {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed;
};

const MODEL_LABELS = new Map<string, string>(
  AI_MODELS.map((model) => [model.value, model.label]),
);
const SUPPORTED_MODEL_ORDER: string[] = AI_MODELS.map((model) => model.value);

const resolveLabel = (value: string): string =>
  MODEL_LABELS.get(value) ?? value;

export function useAIModelOptions(
  { currentModel, fallbackModel }: UseAIModelOptionsArgs = {},
) {
  const { models, loading, error } = useAIModels();

  const options = useMemo<AIModelOption[]>(() => {
    const modelsById = new Map(
      models
        .map((model) => [model.id, model] as const)
        .filter(([id]) => Boolean(id)),
    );

    const seen = new Set<string>();
    const baseOptions: AIModelOption[] = [];

    for (const id of SUPPORTED_MODEL_ORDER) {
      const model = modelsById.get(id);
      if (!model) continue;
      seen.add(id);
      baseOptions.push({
        value: id,
        label: model.name || resolveLabel(id),
      });
    }

    for (const [id, model] of modelsById) {
      if (seen.has(id)) continue;
      baseOptions.push({
        value: id,
        label: model.name || id,
      });
    }

    const current = normalizeValue(currentModel);
    const fallback = normalizeValue(fallbackModel);

    const withCurrent =
      current && !baseOptions.some((option) => option.value === current)
        ? [{ value: current, label: resolveLabel(current) }, ...baseOptions]
        : baseOptions;

    if (withCurrent.length > 0) {
      return withCurrent;
    }

    if (fallback) {
      return [{ value: fallback, label: resolveLabel(fallback) }];
    }

    return [];
  }, [models, currentModel, fallbackModel]);

  return {
    options,
    loading,
    error,
    models,
  };
}
