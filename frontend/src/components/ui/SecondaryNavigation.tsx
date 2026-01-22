"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
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
  const navContent = (
    <div
      className={cn(baseContainerClass, className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        const badgeText = getBadgeText(item.badge);
        const tabClassName = cn(
          baseTabClass,
          uppercase && "uppercase tracking-wide",
          isActive
            ? "bg-foreground/10 text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        );
        const badgeClassName = cn(
          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
          item.badgeClassName ?? "bg-muted text-muted-foreground",
        );

        if (item.href) {
          return (
            <Link
              key={item.id}
              href={item.href}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              className={tabClassName}
              onClick={() => onSelect?.(item.id)}
            >
              <span>{item.label}</span>
              {badgeText && <span className={badgeClassName}>{badgeText}</span>}
            </Link>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={tabClassName}
            onClick={() => onSelect?.(item.id)}
          >
            <span>{item.label}</span>
            {badgeText && <span className={badgeClassName}>{badgeText}</span>}
          </button>
        );
      })}
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
