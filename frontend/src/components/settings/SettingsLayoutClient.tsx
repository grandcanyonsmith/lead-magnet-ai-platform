"use client";

import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { SettingsEditorProvider, useSettingsEditor } from "./SettingsEditorContext";
import { SettingsNav } from "./SettingsNav";

function deriveInitialSection(pathname: string | null): "general" | "branding" | "delivery" | "billing" {
  if (!pathname) return "general";
  if (pathname.includes("/dashboard/settings/billing")) return "billing";
  if (pathname.includes("/dashboard/settings/branding")) return "branding";
  if (pathname.includes("/dashboard/settings/delivery")) return "delivery";
  return "general";
}

function SettingsLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hasUnsavedChanges } = useSettingsEditor();
  const isBilling = pathname?.includes("/dashboard/settings/billing") || false;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-foreground tracking-tight">
              Settings
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-muted-foreground">
              Configure your organization, brand identity, delivery preferences,
              and billing.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isBilling && hasUnsavedChanges && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-800 animate-in fade-in duration-300">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 dark:bg-orange-400 mr-1.5 animate-pulse" />
                Unsaved changes
              </span>
            )}
          </div>
        </div>
      </div>

      <SettingsNav />

      <div
        className={clsx(
          "space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function SettingsLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const initialSection = useMemo(
    () => deriveInitialSection(pathname),
    [pathname],
  );

  return (
    <SettingsEditorProvider initialSection={initialSection}>
      <SettingsLayoutInner>{children}</SettingsLayoutInner>
    </SettingsEditorProvider>
  );
}


