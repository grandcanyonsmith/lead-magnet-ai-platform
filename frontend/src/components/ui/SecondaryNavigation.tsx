"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { Tab } from "@headlessui/react";
import { cn } from "@/lib/utils";

export type SecondaryNavigationItem = {
  id: string;
  label: string;
  badge?: string | number | null;
  badgeClassName?: string;
  href?: string;
};

interface SecondaryNavigationProps {
  items: readonly SecondaryNavigationItem[];
  activeId: string;
  onSelect?: (id: string) => void;
  portalTargetId?: string | null;
  className?: string;
  ariaLabel?: string;
  uppercase?: boolean;
}

const baseContainerClass =
  "inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-background/80 px-1.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur overflow-x-auto scrollbar-hide";
const baseTabClass =
  "inline-flex items-center gap-2 rounded-full px-3 py-1 transition";

const getBadgeText = (badge?: string | number | null) => {
  if (badge === null || badge === undefined) return null;
  return String(badge);
};

export function SecondaryNavigation({
  items,
  activeId,
  onSelect,
  portalTargetId,
  className,
  ariaLabel = "Secondary navigation",
  uppercase = true,
}: SecondaryNavigationProps) {
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );
  const handleChange = (index: number) => {
    const item = items[index];
    if (!item) return;
    onSelect?.(item.id);
  };

  const navContent = (
    <Tab.Group selectedIndex={selectedIndex} onChange={handleChange}>
      <Tab.List className={cn(baseContainerClass, className)} aria-label={ariaLabel}>
        {items.map((item) => {
          const badgeText = getBadgeText(item.badge);
          const badgeClassName = cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            item.badgeClassName ?? "bg-muted text-muted-foreground",
          );

          const tabClassName = ({ selected }: { selected: boolean }) =>
            cn(
              baseTabClass,
              uppercase && "uppercase tracking-wide",
              selected
                ? "bg-foreground/10 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            );

          if (item.href) {
            return (
              <Tab
                key={item.id}
                as={Link}
                href={item.href}
                className={tabClassName}
              >
                <span>{item.label}</span>
                {badgeText && <span className={badgeClassName}>{badgeText}</span>}
              </Tab>
            );
          }

          return (
            <Tab key={item.id} as="button" className={tabClassName}>
              <span>{item.label}</span>
              {badgeText && <span className={badgeClassName}>{badgeText}</span>}
            </Tab>
          );
        })}
      </Tab.List>
    </Tab.Group>
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
