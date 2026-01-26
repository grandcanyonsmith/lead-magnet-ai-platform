"use client";

import type { Dispatch, SetStateAction } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { FormField } from "@/components/settings/FormField";
import { Switch } from "@/components/ui/Switch";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import type { PromptDefault, PromptOverride } from "@/types/settings";
import type { TextVerbosity, AIModel, ReasoningEffort, ServiceTier } from "@/types/workflow";
import {
  getEmptyFieldLabel,
  getOverrideStatus,
  type OverrideDraft,
} from "@/utils/promptOverrides";

type PromptOverrideCardProps = {
  item: { key: string; label: string };
  override?: PromptOverride;
  defaultsForKey?: PromptDefault;
  defaultsLoading?: boolean;
  isEditing: boolean;
  draft: OverrideDraft | null;
  setDraft: Dispatch<SetStateAction<OverrideDraft | null>>;
  onStartEdit: (key: string) => void;
  onCancelEdit: () => void;
  onApplyDefaults: (defaults?: PromptDefault | null) => void;
  onSave: (key: string) => void;
  onDelete: (key: string) => void;
};

const AI_MODEL_OPTIONS = [
  { value: "", label: "Use default" },
  { value: "gpt-5.1", label: "GPT 5.1" },
  { value: "gpt-5.1-codex", label: "GPT 5.1 Codex" },
  { value: "gpt-5.2", label: "GPT 5.2" },
  { value: "gpt-5", label: "GPT 5" },
  { value: "gpt-4.1", label: "GPT 4.1" },
  { value: "gpt-4-turbo", label: "GPT 4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT 3.5 Turbo" },
  { value: "computer-use-preview", label: "Computer Use Preview" },
  { value: "o4-mini-deep-research", label: "o4 Mini Deep Research" },
];

const REASONING_EFFORT_OPTIONS = [
  { value: "", label: "Use default" },
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra High" },
];

const SERVICE_TIER_OPTIONS = [
  { value: "", label: "Use default" },
  { value: "auto", label: "Auto" },
  { value: "default", label: "Default" },
  { value: "flex", label: "Flex" },
  { value: "scale", label: "Scale" },
  { value: "priority", label: "Priority" },
];

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
    <MarkdownRenderer
      value={trimmed}
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none leading-relaxed break-words",
        "prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2",
        "prose-li:my-1 prose-ul:my-2 prose-ol:my-2",
        "prose-pre:my-3 prose-pre:overflow-x-auto prose-pre:bg-gray-50 dark:prose-pre:bg-gray-900/40",
        "text-[11px] leading-snug sm:text-xs",
      )}
      fallbackClassName={cn(
        "whitespace-pre-wrap break-words text-xs",
        "text-[11px] leading-snug sm:text-xs",
      )}
    />
  );

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm transition group-hover:shadow-md">
      <div className="h-48 w-full overflow-hidden sm:h-auto sm:aspect-[3/4]">
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

export function PromptOverrideCard({
  item,
  override,
  defaultsForKey,
  defaultsLoading,
  isEditing,
  draft,
  setDraft,
  onStartEdit,
  onCancelEdit,
  onApplyDefaults,
  onSave,
  onDelete,
}: PromptOverrideCardProps) {
  const instructions = override?.instructions?.trim();
  const prompt = override?.prompt?.trim();
  const hasText = Boolean(instructions || prompt);
  const status = getOverrideStatus({ override, hasText });
  const isDisabled = override?.enabled === false;
  const defaultInstructions = defaultsForKey?.instructions;
  const defaultPrompt = defaultsForKey?.prompt;
  
  // Only show override cards if they have actual content or if override is explicitly disabled
  // Hide them when they would just show "Using default..." messages
  const hasOverrideContent = hasText || isDisabled;
  
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
    // Only include override cards if there's actual override content
    // Hide them when they would just show "Using default..." messages
    ...(hasOverrideContent
      ? [
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
        ]
      : []),
  ];

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 sm:p-4 space-y-4">
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
              onClick={() => onStartEdit(item.key)}
              className="w-full sm:w-auto"
            >
              Edit
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancelEdit}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground break-words">
          {status.description}
          {typeof override?.enabled === "boolean" && (
            <span className="ml-2">
              Enabled: {override.enabled ? "true" : "false"}
            </span>
          )}
        </p>
        {(defaultsForKey?.model || defaultsForKey?.reasoning_effort || defaultsForKey?.service_tier) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">Defaults:</span>
            {defaultsForKey?.model && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 border border-border/50">
                <span className="text-muted-foreground">Model:</span>
                <span className="font-mono text-foreground">{defaultsForKey.model}</span>
              </span>
            )}
            {defaultsForKey?.reasoning_effort && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 border border-border/50">
                <span className="text-muted-foreground">Reasoning:</span>
                <span className="font-medium text-foreground capitalize">{defaultsForKey.reasoning_effort}</span>
              </span>
            )}
            {defaultsForKey?.service_tier && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 border border-border/50">
                <span className="text-muted-foreground">Service:</span>
                <span className="font-medium text-foreground capitalize">{defaultsForKey.service_tier}</span>
              </span>
            )}
          </div>
        )}
        {override?.output_verbosity && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">Override:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
              <span className="text-muted-foreground">Output Verbosity:</span>
              <span className="font-medium text-foreground capitalize">{override.output_verbosity}</span>
            </span>
          </div>
        )}
        {(override?.model || override?.reasoning_effort || override?.service_tier) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">Overrides:</span>
            {override?.model && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                <span className="text-muted-foreground">Model:</span>
                <span className="font-mono text-foreground">{override.model}</span>
              </span>
            )}
            {override?.reasoning_effort && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                <span className="text-muted-foreground">Reasoning:</span>
                <span className="font-medium text-foreground capitalize">{override.reasoning_effort}</span>
              </span>
            )}
            {override?.service_tier && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                <span className="text-muted-foreground">Service:</span>
                <span className="font-medium text-foreground capitalize">{override.service_tier}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {previewCards.map((card) => (
          <div key={card.id} className="group flex flex-col text-left">
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
              <Switch
                id={`toggle-${item.key}`}
                checked={draft.enabled}
                onChange={(checked) =>
                  setDraft((prev) =>
                    prev ? { ...prev, enabled: checked } : prev,
                  )
                }
              />
              <label htmlFor={`toggle-${item.key}`}>Override enabled</label>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onApplyDefaults(defaultsForKey)}
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

          <div className="space-y-2">
            <label
              htmlFor={`output_verbosity_${item.key}`}
              className="text-sm font-medium text-foreground"
            >
              Output Verbosity
            </label>
            <Select
              id={`output_verbosity_${item.key}`}
              name={`output_verbosity_${item.key}`}
              value={draft.output_verbosity || ""}
              onChange={(value) =>
                setDraft((prev) =>
                  prev ? { ...prev, output_verbosity: value || undefined } : prev,
                )
              }
              placeholder="Use default"
              options={[
                { value: "", label: "Use default" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Control the verbosity level of the output for this prompt override.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label
                htmlFor={`model_${item.key}`}
                className="text-sm font-medium text-foreground"
              >
                AI Model
              </label>
              <Select
                id={`model_${item.key}`}
                name={`model_${item.key}`}
                value={draft.model || ""}
                onChange={(value) =>
                  setDraft((prev) =>
                    prev ? { ...prev, model: value || undefined } : prev,
                  )
                }
                placeholder="Use default"
                options={AI_MODEL_OPTIONS}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor={`reasoning_effort_${item.key}`}
                className="text-sm font-medium text-foreground"
              >
                Reasoning Effort
              </label>
              <Select
                id={`reasoning_effort_${item.key}`}
                name={`reasoning_effort_${item.key}`}
                value={draft.reasoning_effort || ""}
                onChange={(value) =>
                  setDraft((prev) =>
                    prev ? { ...prev, reasoning_effort: value || undefined } : prev,
                  )
                }
                placeholder="Use default"
                options={REASONING_EFFORT_OPTIONS}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor={`service_tier_${item.key}`}
                className="text-sm font-medium text-foreground"
              >
                Service Tier
              </label>
              <Select
                id={`service_tier_${item.key}`}
                name={`service_tier_${item.key}`}
                value={draft.service_tier || ""}
                onChange={(value) =>
                  setDraft((prev) =>
                    prev ? { ...prev, service_tier: value || undefined } : prev,
                  )
                }
                placeholder="Use default"
                options={SERVICE_TIER_OPTIONS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {override && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onDelete(item.key)}
                className="w-full sm:w-auto"
              >
                Delete override
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancelEdit}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => onSave(item.key)}
              className="w-full sm:w-auto"
            >
              Save override
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
