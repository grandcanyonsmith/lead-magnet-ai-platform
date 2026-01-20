"use client";

import React, { useEffect, useMemo } from "react";
import clsx from "clsx";
import {
  CloudArrowUpIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { BrandingSettings } from "@/components/settings/BrandingSettings";
import { DeliverySettings } from "@/components/settings/DeliverySettings";
import { BillingUsage } from "@/components/settings/BillingUsage";
import { PromptOverridesSettings } from "@/components/settings/PromptOverridesSettings";
import { useSettingsEditor } from "@/components/settings/SettingsEditorContext";

type SettingsSection =
  | "general"
  | "branding"
  | "delivery"
  | "billing"
  | "prompt-overrides";

export function SettingsSectionPage({ section }: { section: SettingsSection }) {
  const {
    setSection,
    currentSettings,
    loading,
    error,
    refetch,
    errors,
    setField,
    promptOverridesJson,
    setPromptOverridesJson,
    saving,
    save,
    hasUnsavedChanges,
    applyServerSettingsUpdate,
  } = useSettingsEditor();

  useEffect(() => {
    setSection(section);
  }, [section, setSection]);

  const canSave = useMemo(() => {
    // Matches the old UX: billing doesn't expose Save Settings.
    if (section === "billing") return false;
    return hasUnsavedChanges;
  }, [hasUnsavedChanges, section]);

  if (section === "billing") {
    return <BillingUsage />;
  }

  if (loading) {
    return <LoadingState message="Loading settings..." fullPage />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  if (!currentSettings) {
    return <ErrorState message="Failed to load settings" onRetry={refetch} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {section === "general" && (
        <GeneralSettings
          settings={currentSettings}
          onChange={setField}
          errors={errors}
        />
      )}

      {section === "branding" && (
        <BrandingSettings
          settings={currentSettings}
          onChange={setField}
          errors={errors}
        />
      )}

      {section === "delivery" && (
        <DeliverySettings
          settings={currentSettings}
          onChange={setField}
          onSettingsUpdate={applyServerSettingsUpdate}
          errors={errors}
        />
      )}

      {section === "prompt-overrides" && (
        <PromptOverridesSettings
          promptOverridesJson={promptOverridesJson}
          onPromptOverridesChange={setPromptOverridesJson}
          errors={errors}
          fallbackOverrides={currentSettings.prompt_overrides}
        />
      )}

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          type="submit"
          disabled={saving || !canSave}
          className={clsx(
            "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500",
            saving || !canSave
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-primary-600 text-white hover:bg-primary-700",
          )}
        >
          {saving ? (
            <>
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              Saving changes...
            </>
          ) : (
            <>
              <CloudArrowUpIcon className="h-4 w-4" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </form>
  );
}


