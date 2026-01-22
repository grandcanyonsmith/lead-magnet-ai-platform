"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Tab } from "@headlessui/react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

export type SubHeaderTab = {
  id: string;
  label: string;
  href?: string;
  badge?: string | number | null;
};

interface SubHeaderTabsProps {
  tabs: readonly SubHeaderTab[];
  activeId: string;
  onSelect?: (id: string) => void;
  portalTargetId?: string | null;
  className?: string;
  enableOverflowMenu?: boolean;
  mobileMaxVisible?: number;
  compactMaxVisible?: number;
  compactBreakpointPx?: number;
  moreLabel?: string;
}

const tabClass =
  "relative flex items-center gap-2 pb-2 text-xs font-semibold text-muted-foreground transition-all duration-150 ease-out sm:text-sm " +
  "after:absolute after:inset-x-0 after:-bottom-[1px] after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200";

const getBadgeText = (badge?: string | number | null) => {
  if (badge === null || badge === undefined) return null;
  return String(badge);
};

export function SubHeaderTabs({
  tabs,
  activeId,
  onSelect,
  portalTargetId = "dashboard-subheader",
  className,
  enableOverflowMenu = false,
  mobileMaxVisible,
  compactMaxVisible,
  compactBreakpointPx = 420,
  moreLabel = "More",
}: SubHeaderTabsProps) {
  const [isCompact, setIsCompact] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  const effectiveMobileMax = mobileMaxVisible ?? tabs.length;
  const effectiveCompactMax = compactMaxVisible ?? effectiveMobileMax;
  const overflowEnabled = enableOverflowMenu && effectiveMobileMax < tabs.length;
  const visibleCount = isCompact ? effectiveCompactMax : effectiveMobileMax;

  const [visibleIds, setVisibleIds] = useState<string[]>(() =>
    tabs.slice(0, visibleCount).map((tab) => tab.id),
  );

  useEffect(() => {
    if (!overflowEnabled) return;
    const mediaQuery = window.matchMedia(`(max-width: ${compactBreakpointPx}px)`);
    const update = () => setIsCompact(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [compactBreakpointPx, overflowEnabled]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const update = () => setIsSmallScreen(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const normalizeVisibleIds = useCallback((current: string[]) => {
    const unique = current.filter((id, idx) => current.indexOf(id) === idx);
    const existing = unique.filter((id) => tabs.some((tab) => tab.id === id));
    const next = [...existing];
    if (next.length > visibleCount) {
      next.splice(visibleCount);
    }
    if (next.length < visibleCount) {
      const missing = tabs
        .map((tab) => tab.id)
        .filter((id) => !next.includes(id));
      next.push(...missing.slice(0, visibleCount - next.length));
    }
    return next;
  }, [tabs, visibleCount]);

  const swapIntoVisible = useCallback((current: string[], id: string) => {
    if (current.includes(id)) return current;
    if (current.length === 0) return [id];
    const swapIndex = Math.max(current.length - 2, 0);
    const next = [...current];
    next[swapIndex] = id;
    return next;
  }, []);

  useEffect(() => {
    if (!overflowEnabled) return;
    setVisibleIds((prev) => normalizeVisibleIds(prev));
  }, [overflowEnabled, normalizeVisibleIds]);

  useEffect(() => {
    if (!overflowEnabled) return;
    setVisibleIds((prev) => swapIntoVisible(normalizeVisibleIds(prev), activeId));
  }, [activeId, overflowEnabled, normalizeVisibleIds, swapIntoVisible]);

  const mobileVisibleIds = overflowEnabled
    ? visibleIds.slice(0, visibleCount)
    : tabs.map((tab) => tab.id);

  const mobileTabs = useMemo(
    () => tabs.filter((tab) => mobileVisibleIds.includes(tab.id)),
    [tabs, mobileVisibleIds],
  );
  const overflowTabs = useMemo(
    () => tabs.filter((tab) => !mobileVisibleIds.includes(tab.id)),
    [tabs, mobileVisibleIds],
  );

  const handleTabClick = (id: string) => {
    if (overflowEnabled) {
      setVisibleIds((prev) => swapIntoVisible(normalizeVisibleIds(prev), id));
    }
    onSelect?.(id);
  };

  const tabsForSelection =
    overflowEnabled && isSmallScreen ? mobileTabs : tabs;
  const selectedIndex = Math.max(
    0,
    tabsForSelection.findIndex((tab) => tab.id === activeId),
  );

  const handleTabChange = (index: number) => {
    const nextTab = tabsForSelection[index];
    if (!nextTab) return;
    handleTabClick(nextTab.id);
  };

  const renderTab = (tab: SubHeaderTab) => {
    const badgeText = getBadgeText(tab.badge);
    const tabClassName = ({ selected }: { selected: boolean }) =>
      cn(
        tabClass,
        selected
          ? "text-foreground after:scale-x-100"
          : "hover:text-foreground hover:-translate-y-0.5 hover:after:scale-x-100",
      );
    const renderContent = ({ selected }: { selected: boolean }) => (
      <>
        <span>{tab.label}</span>
        {badgeText && (
          <span
            className={cn(
              "whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:text-[11px]",
              selected && "bg-primary/10 text-primary-700 dark:text-primary-300",
            )}
          >
            {badgeText}
          </span>
        )}
      </>
    );

    if (tab.href) {
      return (
        <Tab key={tab.id} as={Link} href={tab.href} className={tabClassName}>
          {renderContent}
        </Tab>
      );
    }

    return (
      <Tab key={tab.id} as="button" className={tabClassName}>
        {renderContent}
      </Tab>
    );
  };

  const navContent = (
    <div className={cn("border-b border-border/60 bg-muted", className)}>
      <div className="px-4 sm:px-6 lg:px-12">
        <Tab.Group selectedIndex={selectedIndex} onChange={handleTabChange}>
          <Tab.List className="flex w-full items-center py-2" aria-label="Section navigation">
            {overflowEnabled ? (
              isSmallScreen ? (
                <div className="flex w-full items-center gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto scrollbar-hide">
                    {mobileTabs.map(renderTab)}
                  </div>
                  {overflowTabs.length > 0 && (
                    <>
                      <span className="h-5 w-px bg-border/60" aria-hidden="true" />
                      <div className="relative shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center gap-1 pb-2 text-xs font-semibold text-muted-foreground transition-all duration-150 ease-out hover:text-foreground hover:-translate-y-0.5">
                            <span>{moreLabel}</span>
                            <ChevronDown className="h-3 w-3" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            side="bottom"
                            className="w-44 z-[70]"
                          >
                            {overflowTabs.map((tab) => {
                              const badgeText = getBadgeText(tab.badge);
                              return (
                                <DropdownMenuItem key={tab.id} className="transition-colors">
                                  {tab.href ? (
                                    <Link
                                      href={tab.href}
                                      className="flex w-full items-center justify-between gap-2"
                                      onClick={() => handleTabClick(tab.id)}
                                    >
                                      <span>{tab.label}</span>
                                      {badgeText && (
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                          {badgeText}
                                        </span>
                                      )}
                                    </Link>
                                  ) : (
                                    <button
                                      type="button"
                                      className="flex w-full items-center justify-between gap-2 text-left"
                                      onClick={() => handleTabClick(tab.id)}
                                    >
                                      <span>{tab.label}</span>
                                      {badgeText && (
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                          {badgeText}
                                        </span>
                                      )}
                                    </button>
                                  )}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="w-full overflow-x-auto scrollbar-hide">
                  <div className="inline-flex items-center gap-6">
                    {tabs.map(renderTab)}
                  </div>
                </div>
              )
            ) : (
              <div className="inline-flex items-center gap-6 overflow-x-auto scrollbar-hide">
                {tabs.map(renderTab)}
              </div>
            )}
          </Tab.List>
        </Tab.Group>
      </div>
    </div>
  );

  if (portalTargetId) {
    const target =
      typeof document === "undefined"
        ? null
        : document.getElementById(portalTargetId);
    if (target) {
      return createPortal(navContent, target);
    }
  }

  return navContent;
}
