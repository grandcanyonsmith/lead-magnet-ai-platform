"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/settings/FormField";
import { PROMPT_OVERRIDE_DEFINITIONS } from "@/constants/promptOverrides";
import { usePromptDefaults } from "@/hooks/api/useSettings";
import type { PromptDefault, PromptOverride, PromptOverrides } from "@/types/settings";

type PromptOverridesSettingsProps = {
  promptOverridesJson: string;
  onPromptOverridesChange: (value: string) => void;
  errors?: Record<string, string>;
  fallbackOverrides?: PromptOverrides;
};

type ParsedOverrides = {
  data?: PromptOverrides;
  error?: string;
};

type OverrideDraft = {
  enabled: boolean;
  instructions: string;
  prompt: string;
};

const parsePromptOverrides = (value: string): ParsedOverrides => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { data: {} };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "Prompt overrides must be a JSON object." };
    }
    return { data: parsed as PromptOverrides };
  } catch {
    return { error: "Prompt overrides must be valid JSON." };
  }
};

const getOverrideStatus = ({
  override,
  hasText,
}: {
  override?: PromptOverride;
  hasText: boolean;
}) => {
  const hasEnabledFlag = typeof override?.enabled === "boolean";
  const hasOverride = hasText || hasEnabledFlag;
  if (!hasOverride) {
    return {
      label: "Default",
      variant: "secondary" as const,
      description: "Using the default prompt.",
    };
  }
  if (override?.enabled === false) {
    return {
      label: "Disabled",
      variant: "warning" as const,
      description: "Override is disabled; defaults are used.",
    };
  }
  return {
    label: "Override",
    variant: "success" as const,
    description: "Override is active.",
  };
};

const getEmptyFieldLabel = (isDisabled: boolean, label: string) => {
  if (isDisabled) {
    return `Override disabled. Default ${label} is used.`;
  }
  return `Using default ${label}.`;
};

const orderOverrides = (overrides: PromptOverrides): PromptOverrides => {
  const ordered: PromptOverrides = {};
  const knownKeys = new Set<string>(
    PROMPT_OVERRIDE_DEFINITIONS.map((item) => item.key),
  );
  PROMPT_OVERRIDE_DEFINITIONS.forEach((item) => {
    if (overrides[item.key]) {
      ordered[item.key] = overrides[item.key];
    }
  });
  Object.keys(overrides)
    .filter((key) => !knownKeys.has(key))
    .sort()
    .forEach((key) => {
      ordered[key] = overrides[key];
    });
  return ordered;
};

const buildOverridePayload = (draft: OverrideDraft): PromptOverride | null => {
  const next: PromptOverride = {};
  const instructions = draft.instructions.trim();
  const prompt = draft.prompt.trim();
  if (instructions) {
    next.instructions = draft.instructions;
  }
  if (prompt) {
    next.prompt = draft.prompt;
  }
  if (!draft.enabled) {
    next.enabled = false;
  }
  return Object.keys(next).length > 0 ? next : null;
};

const renderDefaultBlock = (
  value: string | undefined,
  loading: boolean,
  emptyLabel: string,
) => {
  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading defaults...</p>;
  }
  if (!value || !value.trim()) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <pre className="rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-background p-3 text-xs text-foreground whitespace-pre-wrap break-words max-h-64 overflow-auto">
      {value}
    </pre>
  );
};

export function PromptOverridesSettings({
  promptOverridesJson,
  onPromptOverridesChange,
  errors,
  fallbackOverrides,
}: PromptOverridesSettingsProps) {
  const parsed = useMemo(
    () => parsePromptOverrides(promptOverridesJson),
    [promptOverridesJson],
  );
  const {
    promptDefaults,
    loading: defaultsLoading,
    error: defaultsError,
    refetch: refetchDefaults,
  } = usePromptDefaults();

  const previewOverrides = parsed.data ?? fallbackOverrides ?? {};
  const inputError = errors?.prompt_overrides ?? parsed.error;
  const showFallbackWarning = !!parsed.error && !!fallbackOverrides;

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<OverrideDraft | null>(null);

  const startEdit = (key: string) => {
    const override = previewOverrides[key];
    setEditingKey(key);
    setDraft({
      enabled: override?.enabled !== false,
      instructions: override?.instructions ?? "",
      prompt: override?.prompt ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraft(null);
  };

  const applyDefaults = (defaults?: PromptDefault | null) => {
    if (!draft) return;
    setDraft({
      ...draft,
      instructions: defaults?.instructions ?? "",
      prompt: defaults?.prompt ?? "",
    });
  };

  const saveOverride = (key: string) => {
    if (!draft) return;
    const nextOverrides: PromptOverrides = { ...previewOverrides };
    const payload = buildOverridePayload(draft);
    if (payload) {
      nextOverrides[key] = payload;
    } else {
      delete nextOverrides[key];
    }
    onPromptOverridesChange(JSON.stringify(orderOverrides(nextOverrides), null, 2));
    cancelEdit();
  };

  const deleteOverride = (key: string) => {
    const nextOverrides: PromptOverrides = { ...previewOverrides };
    delete nextOverrides[key];
    onPromptOverridesChange(JSON.stringify(orderOverrides(nextOverrides), null, 2));
    cancelEdit();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-secondary/30">
          <CardTitle className="text-lg">Prompt Overrides</CardTitle>
          <CardDescription>
            Review default prompts, create overrides, and manage enable/disable states
            for each prompt key.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          <div className="rounded-lg border border-gray-100 dark:border-border bg-white dark:bg-background px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Prompt overrides replace default system instructions and prompt templates
              on a per-tenant basis. Keys are documented in{" "}
              <span className="font-medium">docs/prompt-overrides.md</span>.
            </p>
          </div>
          {defaultsError && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-xs text-amber-700 dark:text-amber-200">
                Unable to load default prompt templates. Check the API response.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchDefaults()}
              >
                Retry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-secondary/30">
          <CardTitle className="text-lg">Prompt Keys</CardTitle>
          <CardDescription>
            Each prompt shows the default template and any override currently saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {parsed.error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-900/20 px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-200">
                {parsed.error}
              </p>
              {showFallbackWarning && (
                <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                  Previewing the last saved overrides until the JSON is fixed.
                </p>
              )}
            </div>
          )}

          <div className="space-y-4">
            {PROMPT_OVERRIDE_DEFINITIONS.map((item) => {
              const override = previewOverrides[item.key];
              const instructions = override?.instructions?.trim();
              const prompt = override?.prompt?.trim();
              const hasText = Boolean(instructions || prompt);
              const status = getOverrideStatus({ override, hasText });
              const isDisabled = override?.enabled === false;
              const defaultsForKey = promptDefaults?.[item.key];
              const defaultInstructions = defaultsForKey?.instructions;
              const defaultPrompt = defaultsForKey?.prompt;
              const isEditing = editingKey === item.key;

              return (
                <div
                  key={item.key}
                  className="rounded-xl border border-border bg-muted/20 p-4 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {item.key}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {!isEditing ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(item.key)}
                        >
                          Edit
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={cancelEdit}
                        >
                          Close
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {status.description}
                    {typeof override?.enabled === "boolean" && (
                      <span className="ml-2">
                        Enabled: {override.enabled ? "true" : "false"}
                      </span>
                    )}
                  </p>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Default Instructions
                      </p>
                      {renderDefaultBlock(
                        defaultInstructions,
                        defaultsLoading,
                        "No default instructions available.",
                      )}

                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Default Prompt
                      </p>
                      {renderDefaultBlock(
                        defaultPrompt,
                        defaultsLoading,
                        "No default prompt available.",
                      )}
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Override Instructions
                      </p>
                      {instructions ? (
                        <pre className="rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-background p-3 text-xs text-foreground whitespace-pre-wrap break-words max-h-64 overflow-auto">
                          {instructions}
                        </pre>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {getEmptyFieldLabel(isDisabled, "instructions")}
                        </p>
                      )}

                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Override Prompt
                      </p>
                      {prompt ? (
                        <pre className="rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-background p-3 text-xs text-foreground whitespace-pre-wrap break-words max-h-64 overflow-auto">
                          {prompt}
                        </pre>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {getEmptyFieldLabel(isDisabled, "prompt")}
                        </p>
                      )}
                    </div>
                  </div>

                  {isEditing && draft && (
                    <div className="rounded-lg border border-gray-200 dark:border-border bg-white/70 dark:bg-background/40 p-4 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <input
                            id={`toggle-${item.key}`}
                            type="checkbox"
                            checked={draft.enabled}
                            onChange={(event) =>
                              setDraft((prev) =>
                                prev
                                  ? { ...prev, enabled: event.target.checked }
                                  : prev,
                              )
                            }
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <label htmlFor={`toggle-${item.key}`}>Override enabled</label>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => applyDefaults(defaultsForKey)}
                          disabled={!defaultsForKey?.instructions && !defaultsForKey?.prompt}
                        >
                          Copy defaults
                        </Button>
                      </div>

                      <FormField
                        label="Override Instructions"
                        name={`override_instructions_${item.key}`}
                        type="textarea"
                        value={draft.instructions}
                        onChange={(value) =>
                          setDraft((prev) => (prev ? { ...prev, instructions: value } : prev))
                        }
                        placeholder="Add custom system instructions..."
                        className="min-h-[160px]"
                      />

                      <FormField
                        label="Override Prompt"
                        name={`override_prompt_${item.key}`}
                        type="textarea"
                        value={draft.prompt}
                        onChange={(value) =>
                          setDraft((prev) => (prev ? { ...prev, prompt: value } : prev))
                        }
                        placeholder="Add a custom prompt template..."
                        className="min-h-[180px]"
                      />

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {override && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteOverride(item.key)}
                          >
                            Delete override
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => saveOverride(item.key)}
                        >
                          Save override
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-secondary/30">
          <CardTitle className="text-lg">Edit Overrides JSON</CardTitle>
          <CardDescription>
            Update the JSON payload directly if you want bulk edits.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <FormField
            label="Prompt Overrides (JSON)"
            name="prompt_overrides"
            type="textarea"
            value={promptOverridesJson}
            onChange={onPromptOverridesChange}
            error={inputError}
            helpText="Use keys from docs/prompt-overrides.md. Supports {{variables}} placeholders."
            placeholder='{"workflow_generation": {"instructions": "...", "prompt": "..."}}'
            className="min-h-[200px]"
          />
        </CardContent>
      </Card>
    </div>
  );
}
