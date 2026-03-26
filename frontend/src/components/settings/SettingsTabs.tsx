/**
 * Tab navigation component for settings sections
 */

"use client";

import { ReactNode } from "react";
import {
  Cog6ToothIcon,
  PhotoIcon,
  PaperAirplaneIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

export type SettingsTab = "general" | "branding" | "delivery" | "billing";

interface SettingsTabsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  children: ReactNode;
}

export function SettingsTabs({
  activeTab,
  onTabChange,
  children,
}: SettingsTabsProps) {
  const tabs = [
    { id: "general", label: "General", icon: Cog6ToothIcon },
    { id: "branding", label: "Branding", icon: PhotoIcon },
    { id: "delivery", label: "Delivery", icon: PaperAirplaneIcon },
    { id: "billing", label: "Billing & Usage", icon: CurrencyDollarIcon },
  ];

  return (
    <div>
      <div
        role="tablist"
        className="flex space-x-1 border-b border-gray-200 mb-8 overflow-x-auto scrollbar-hide"
        aria-label="Settings sections"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls="settings-tabpanel"
              tabIndex={selected ? 0 : -1}
              className={clsx(
                "group relative flex items-center gap-2 py-4 px-4 text-sm font-bold transition-all focus:outline-none whitespace-nowrap",
                selected
                  ? "text-primary-600"
                  : "text-gray-400 hover:text-gray-600",
              )}
              onClick={() => onTabChange(tab.id as SettingsTab)}
            >
              <tab.icon
                className={clsx(
                  "h-5 w-5 transition-colors",
                  selected
                    ? "text-primary-600"
                    : "text-gray-400 group-hover:text-gray-500",
                )}
              />
              {tab.label}
              {selected && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id="settings-tabpanel"
        aria-labelledby={`settings-tab-${activeTab}`}
        className="focus:outline-none"
      >
        {children}
      </div>
    </div>
  );
}
