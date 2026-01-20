"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/settings/FormField";
import { PROMPT_OVERRIDE_DEFINITIONS } from "@/constants/promptOverrides";
import { usePromptDefaults } from "@/hooks/api/useSettings";
import { cn } from "@/lib/utils";
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

const MarkdownRenderer = dynamic(() => import("react-markdown"), {
  ssr: false,
});

function PromptMarkdown({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [remarkGfm, setRemarkGfm] = useState<any>(null);

  useEffect(() => {
    let active = true;
    import("remark-gfm")
      .then((mod) => {
        if (active) setRemarkGfm(() => mod.default ?? mod);
      })
      .catch(() => {
        if (active) setRemarkGfm(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!remarkGfm) {
    return (
      <pre className={cn("whitespace-pre-wrap break-words text-xs", className)}>
        {value}
      </pre>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none leading-relaxed break-words",
        "prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2",
        "prose-li:my-1 prose-ul:my-2 prose-ol:my-2",
        "prose-pre:my-3 prose-pre:overflow-x-auto prose-pre:bg-gray-50 dark:prose-pre:bg-gray-900/40",
        className,
      )}
    >
      <MarkdownRenderer remarkPlugins={[remarkGfm]}>{value}</MarkdownRenderer>
    </div>
  );
}

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

const PromptPreviewCard = ({
  title,
  content,
  emptyLabel,
  loading,
}: {
  title: string;
  content?: string;
  emptyLabel: string;
  loading?: boolean;
}) => {
  const trimmed = content?.trim();
  const body = loading ? (
    <p className="text-[11px] text-muted-foreground">Loading defaults...</p>
  ) : !trimmed ? (
    <p className="text-[11px] text-muted-foreground">{emptyLabel}</p>
  ) : (
    <PromptMarkdown value={trimmed} className="text-[11px] leading-snug sm:text-xs" />
  );

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm transition group-hover:shadow-md">
      <div className="aspect-[3/4] w-full overflow-hidden">
        <div className="relative h-full w-full bg-gray-50 dark:bg-gray-900 p-2">
          <div className="h-full w-full overflow-hidden rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
            <div className="h-full overflow-auto p-3 sm:p-4">{body}</div>
          </div>
        </div>
      </div>
      <div className="border-t border-border/60 bg-background/80 px-3 py-2">
        <p className="text-xs font-medium text-foreground line-clamp-1">
          {title}
        </p>
      </div>
    </div>
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
        <CardHeader className="border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-secondary/30 p-4 sm:p-6">
          <CardTitle className="text-lg">Prompt Overrides</CardTitle>
          <CardDescription>
            Review default prompts, create overrides, and manage enable/disable states
            for each prompt key.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-3">
          <div className="rounded-lg border border-gray-100 dark:border-border bg-white dark:bg-background px-3 sm:px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Prompt overrides replace default system instructions and prompt templates
              on a per-tenant basis. Keys are documented in{" "}
              <span className="font-medium">docs/prompt-overrides.md</span>.
            </p>
          </div>
          {defaultsError && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-900/20 px-3 sm:px-4 py-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-amber-700 dark:text-amber-200 break-words">
                Unable to load default prompt templates. Check the API response.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchDefaults()}
                className="w-full sm:w-auto"
              >
                Retry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-secondary/30 p-4 sm:p-6">
          <CardTitle className="text-lg">Prompt Keys</CardTitle>
          <CardDescription>
            Each prompt shows the default template and any override currently saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {parsed.error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-900/20 px-3 sm:px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-200 break-words">
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
              const previewCards = [
                {
                  id: `${item.key}-default-instructions`,
                  title: "Default Instructions",
                  content: defaultInstructions,
                  emptyLabel: "No default instructions available.",
                  loading: defaultsLoading,
                },
                {
                  id: `${item.key}-default-prompt`,
                  title: "Default Prompt",
                  content: defaultPrompt,
                  emptyLabel: "No default prompt available.",
                  loading: defaultsLoading,
                },
                {
                  id: `${item.key}-override-instructions`,
                  title: "Override Instructions",
                  content: instructions,
                  emptyLabel: getEmptyFieldLabel(isDisabled, "instructions"),
                },
                {
                  id: `${item.key}-override-prompt`,
                  title: "Override Prompt",
                  content: prompt,
                  emptyLabel: getEmptyFieldLabel(isDisabled, "prompt"),
                },
              ];

              return (
                <div
                  key={item.key}
                  className="rounded-xl border border-border bg-muted/20 p-3 sm:p-4 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground break-words">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono break-words">
                        {item.key}
                      </p>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {!isEditing ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(item.key)}
                          className="w-full sm:w-auto"
                        >
                          Edit
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={cancelEdit}
                          className="w-full sm:w-auto"
                        >
                          Close
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground break-words">
                    {status.description}
                    {typeof override?.enabled === "boolean" && (
                      <span className="ml-2">
                        Enabled: {override.enabled ? "true" : "false"}
                      </span>
                    )}
                  </p>

                  <div className="grid grid-flow-col auto-cols-[16rem] sm:auto-cols-[minmax(0,1fr)] grid-rows-2 gap-3 sm:gap-4 overflow-x-auto pb-2 pl-1 pr-1 sm:overflow-visible sm:pb-0 sm:pl-0 sm:pr-0 snap-x snap-mandatory sm:snap-none scrollbar-hide">
                    {previewCards.map((card) => (
                      <div
                        key={card.id}
                        className="group flex w-64 flex-shrink-0 snap-start flex-col text-left sm:w-auto sm:flex-shrink"
                      >
                        <PromptPreviewCard
                          title={card.title}
                          content={card.content}
                          emptyLabel={card.emptyLabel}
                          loading={card.loading}
                        />
                      </div>
                    ))}
                  </div>

                  {isEditing && draft && (
                    <div className="rounded-lg border border-gray-200 dark:border-border bg-white/70 dark:bg-background/40 p-3 sm:p-4 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                          className="w-full sm:w-auto"
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
                        className="min-h-[140px] sm:min-h-[160px]"
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
                        className="min-h-[160px] sm:min-h-[180px]"
                      />

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        {override && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteOverride(item.key)}
                            className="w-full sm:w-auto"
                          >
                            Delete override
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={cancelEdit}
                          className="w-full sm:w-auto"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => saveOverride(item.key)}
                          className="w-full sm:w-auto"
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
        <CardHeader className="border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-secondary/30 p-4 sm:p-6">
          <CardTitle className="text-lg">Edit Overrides JSON</CardTitle>
          <CardDescription>
            Update the JSON payload directly if you want bulk edits.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <FormField
            label="Prompt Overrides (JSON)"
            name="prompt_overrides"
            type="textarea"
            value={promptOverridesJson}
            onChange={onPromptOverridesChange}
            error={inputError}
            helpText="Use keys from docs/prompt-overrides.md. Supports {{variables}} placeholders."
            placeholder='{"workflow_generation": {"instructions": "...", "prompt": "..."}}'
            className="min-h-[160px] sm:min-h-[200px]"
          />
        </CardContent>
      </Card>
    </div>
  );
}
