"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { CardHeaderIntro } from "@/components/ui/CardHeaderIntro";
import { Button } from "@/components/ui/Button";
import { PromptOverrideCard } from "@/components/settings/PromptOverrideCard";
import { PromptOverridesJsonEditor } from "@/components/settings/PromptOverridesJsonEditor";
import { PROMPT_OVERRIDE_DEFINITIONS } from "@/constants/promptOverrides";
import { usePromptDefaults } from "@/hooks/api/useSettings";
import type { PromptDefault, PromptOverrides } from "@/types/settings";
import {
  buildOverridePayload,
  orderOverrides,
  parsePromptOverrides,
  type OverrideDraft,
} from "@/utils/promptOverrides";

type PromptOverridesSettingsProps = {
  promptOverridesJson: string;
  onPromptOverridesChange: (value: string) => void;
  errors?: Record<string, string>;
  fallbackOverrides?: PromptOverrides;
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
        <CardHeaderIntro
          className="p-4 sm:p-6"
          title="Prompt Overrides"
          description="Review default prompts, create overrides, and manage enable/disable states for each prompt key."
        />
        <CardContent className="p-4 sm:p-6 space-y-3">
          <div className="rounded-lg border border-gray-100 dark:border-border bg-white dark:bg-background px-3 sm:px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Prompt overrides replace default system instructions and prompt templates
              on a per-tenant basis. Keys are documented in{" "}
              <span className="font-medium">docs/prompt-overrides.md</span>.
            </p>
          </div>
          {defaultsError && (
            <AlertBanner
              variant="warning"
              description="Unable to load default prompt templates. Check the API response."
              descriptionClassName="text-xs"
              actions={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refetchDefaults()}
                  className="w-full sm:w-auto"
                >
                  Retry
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeaderIntro
          className="p-4 sm:p-6"
          title="Prompt Keys"
          description="Each prompt shows the default template and any override currently saved."
        />
        <CardContent className="p-4 sm:p-6 space-y-4">
          {parsed.error && (
            <AlertBanner variant="error">
              <p className="text-sm text-red-700 dark:text-red-200 break-words">
                {parsed.error}
              </p>
              {showFallbackWarning && (
                <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                  Previewing the last saved overrides until the JSON is fixed.
                </p>
              )}
            </AlertBanner>
          )}

          <div className="space-y-4">
            {PROMPT_OVERRIDE_DEFINITIONS.map((item) => {
              const defaultsForKey = promptDefaults?.[item.key];
              const isEditing = editingKey === item.key;
              return (
                <PromptOverrideCard
                  key={item.key}
                  item={item}
                  override={previewOverrides[item.key]}
                  defaultsForKey={defaultsForKey}
                  defaultsLoading={defaultsLoading}
                  isEditing={isEditing}
                  draft={draft}
                  setDraft={setDraft}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onApplyDefaults={applyDefaults}
                  onSave={saveOverride}
                  onDelete={deleteOverride}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
      <PromptOverridesJsonEditor
        value={promptOverridesJson}
        onChange={onPromptOverridesChange}
        error={inputError}
      />
    </div>
  );
}
