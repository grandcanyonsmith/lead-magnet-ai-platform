"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  HomeIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  useBreadcrumbs,
  type BreadcrumbItem,
  type BreadcrumbMenuItem,
} from "@/contexts/BreadcrumbsContext";

interface BreadcrumbsProps {
  className?: string;
  listClassName?: string;
}

const MOBILE_BREAKPOINT_PX = 640;
const MOBILE_WORD_LIMIT = 3;
const DESKTOP_WORD_LIMIT = 5;
const SEARCH_THRESHOLD = 7;

const truncateWords = (value: string, maxWords: number) => {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return value;
  return `${words.slice(0, maxWords).join(" ")}...`;
};

const formatFallbackLabel = (segment: string) => {
  let label = segment.replace(/-/g, " ");
  if (segment.length > 20 && /\d/.test(segment)) {
    return "Details";
  }
  return label.replace(/\b\w/g, (c) => c.toUpperCase());
};

const useCompactBreadcrumbs = () => {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT_PX}px)`,
    );
    const update = () => setIsCompact(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isCompact;
};

type BreadcrumbDropdownProps = {
  item: BreadcrumbItem;
  displayLabel: string;
  isCurrent: boolean;
  isCompact: boolean;
};

function BreadcrumbDropdown({
  item,
  displayLabel,
  isCurrent,
  isCompact,
}: BreadcrumbDropdownProps) {
  const [query, setQuery] = useState("");
  const menuItems = item.menuItems ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const showSearch = menuItems.length >= SEARCH_THRESHOLD;
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return menuItems;
    return menuItems.filter((menuItem) => {
      const labelMatch = menuItem.label
        .toLowerCase()
        .includes(normalizedQuery);
      const descriptionMatch =
        typeof menuItem.description === "string" &&
        menuItem.description.toLowerCase().includes(normalizedQuery);
      return labelMatch || descriptionMatch;
    });
  }, [menuItems, normalizedQuery]);

  const emptyLabel =
    item.menuEmptyLabel || (normalizedQuery ? "No matches found." : "No items.");
  const maxWidthClass = isCompact
    ? "max-w-[7rem]"
    : "max-w-[12rem] lg:max-w-[16rem]";
  const menuWidthClass = isCompact ? "w-64" : "w-72 lg:w-80";

  return (
    <div className="relative inline-flex">
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className={cn(
            "ml-2 inline-flex items-center text-xs sm:text-sm font-medium transition-colors",
            isCurrent
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-current={isCurrent ? "page" : undefined}
        >
          <span
            className={cn("inline-flex min-w-0 items-center gap-1", maxWidthClass)}
          >
            <span className="truncate" title={item.label}>
              {displayLabel}
            </span>
            <ChevronDownIcon
              className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground"
              aria-hidden="true"
            />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="bottom"
          className={cn(menuWidthClass, "z-[70]")}
        >
          {item.menuLabel && (
            <DropdownMenuLabel className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {item.menuLabel}
            </DropdownMenuLabel>
          )}
          {showSearch && (
            <div className="px-2 pb-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={item.menuSearchPlaceholder || "Search..."}
                  className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}
          <div className="max-h-72 overflow-y-auto scrollbar-hide">
            {filteredItems.length > 0 ? (
              filteredItems.map((menuItem: BreadcrumbMenuItem) => (
                <DropdownMenuItem
                  key={menuItem.id}
                  className="cursor-pointer"
                >
                  <Link
                    href={menuItem.href}
                    className="flex w-full items-start gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {menuItem.label}
                      </span>
                      {menuItem.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {menuItem.description}
                        </span>
                      )}
                    </div>
                    {menuItem.isActive && (
                      <CheckIcon
                        className="mt-0.5 h-4 w-4 text-primary-500"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                {emptyLabel}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function Breadcrumbs({ className, listClassName }: BreadcrumbsProps = {}) {
  const pathname = usePathname();
  const { items: contextItems } = useBreadcrumbs();
  const isCompact = useCompactBreadcrumbs();

  const fallbackItems = useMemo<BreadcrumbItem[]>(() => {
    if (!pathname || pathname === "/dashboard") return [];
    const segments = pathname.split("/").filter(Boolean);
    const dashboardIndex = segments.indexOf("dashboard");
    const displaySegments =
      dashboardIndex >= 0 ? segments.slice(dashboardIndex + 1) : segments;
    if (displaySegments.length === 0) return [];

    return displaySegments.map((segment, index) => {
      const href = `/dashboard/${displaySegments
        .slice(0, index + 1)
        .join("/")}`;
      return {
        id: href,
        label: formatFallbackLabel(segment),
        href,
      };
    });
  }, [pathname]);

  const resolvedItems =
    contextItems && contextItems.length > 0 ? contextItems : fallbackItems;

  if (!pathname || pathname === "/dashboard" || resolvedItems.length === 0) {
    return null;
  }

  const wordLimit = isCompact ? MOBILE_WORD_LIMIT : DESKTOP_WORD_LIMIT;

  return (
    <nav
      className={cn(
        "flex min-w-0 items-center overflow-visible",
        className,
      )}
      aria-label="Breadcrumb"
    >
      <ol className={cn("flex min-w-0 items-center gap-1 sm:gap-2", listClassName)}>
        <li>
          <div>
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <HomeIcon
                className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="sr-only">Dashboard</span>
            </Link>
          </div>
        </li>
        {resolvedItems.map((item, index) => {
          const isLast = index === resolvedItems.length - 1;
          const hasMenu = Boolean(item.menuItems || item.menuEmptyLabel);
          const displayLabel = truncateWords(item.label, wordLimit);

          return (
            <li key={item.id} className="min-w-0">
              <div className="flex min-w-0 items-center">
                <ChevronRightIcon
                  className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-muted-foreground/50"
                  aria-hidden="true"
                />
                {hasMenu ? (
                  <BreadcrumbDropdown
                    item={item}
                    displayLabel={displayLabel}
                    isCurrent={isLast}
                    isCompact={isCompact}
                  />
                ) : item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className="ml-2 text-xs sm:text-sm font-medium transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <span
                      className="inline-block max-w-[10rem] truncate sm:max-w-[16rem]"
                      title={item.label}
                    >
                      {displayLabel}
                    </span>
                  </Link>
                ) : (
                  <span
                    className="ml-2 text-xs sm:text-sm font-medium text-foreground"
                    aria-current="page"
                    title={item.label}
                  >
                    <span className="inline-block max-w-[10rem] truncate sm:max-w-[16rem]">
                      {displayLabel}
                    </span>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

