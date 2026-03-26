import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface TabNode {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number;
  content?: React.ReactNode;
  children?: TabNode[]; // For nested tabs
  disabled?: boolean;
}

interface RecursiveTabsProps {
  tabs: TabNode[];
  defaultActiveTab?: string;
  activeTab?: string; // Controlled mode
  onTabChange?: (tabId: string) => void; // Controlled mode
  className?: string;
  tabListClassName?: string;
  tabContentClassName?: string;
  orientation?: "horizontal" | "vertical";
}

export const RecursiveTabs: React.FC<RecursiveTabsProps> = ({
  tabs,
  defaultActiveTab,
  activeTab: controlledActiveTab,
  onTabChange,
  className,
  tabListClassName,
  tabContentClassName,
  orientation = "horizontal",
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<string>(
    defaultActiveTab || tabs[0]?.id
  );

  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabClick = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else {
      setInternalActiveTab(tabId);
    }
  };

  const activeTabNode = tabs.find((tab) => tab.id === activeTab);

  const tabButtonClasses = (tabId: string, isActive: boolean, disabled?: boolean) =>
    cn(
      "group relative isolate shrink-0 px-4 py-3 text-[13px] sm:text-sm font-semibold border-b-2 transition-all duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      orientation === "vertical" && "w-full justify-start border-b-0 border-l-2",
      isActive
        ? "border-foreground text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
      disabled && "opacity-50 cursor-not-allowed pointer-events-none"
    );

  return (
    <div className={cn("flex flex-col w-full", className)}>
      {/* Tab Header */}
      <div
        className={cn(
          "flex border-b border-border overflow-x-auto scrollbar-hide",
          orientation === "vertical" && "flex-col border-b-0 border-r w-48 overflow-x-visible",
          tabListClassName
        )}
        role="tablist"
      >
        {tabs.map(({ id, label, icon: Icon, badge, disabled }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              disabled={disabled}
              className={tabButtonClasses(id, isActive, disabled)}
              aria-selected={isActive}
              role="tab"
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              <span className="truncate">{label}</span>
              {badge !== undefined && badge > 0 ? (
                <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 text-[10px] font-semibold text-muted-foreground">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className={cn("relative flex-1", tabContentClassName)}>
        {activeTabNode && (
          <div className="flex flex-col h-full">
            {activeTabNode.children ? (
              <RecursiveTabs tabs={activeTabNode.children} />
            ) : (
              activeTabNode.content
            )}
          </div>
        )}
      </div>
    </div>
  );
};
