"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LeadMagnetsTabsProps {
  className?: string;
}

const tabs = [
  {
    key: "builder",
    label: "My Magnets",
    href: "/dashboard/workflows",
    activePrefixes: ["/dashboard/workflows"],
  },
  {
    key: "generated",
    label: "Leads & Results",
    href: "/dashboard/jobs",
    activePrefixes: ["/dashboard/jobs"],
  },
] as const;

export function LeadMagnetsTabs({ className }: LeadMagnetsTabsProps) {
  const pathname = usePathname();
  const activeKey =
    tabs.find((tab) =>
      tab.activePrefixes.some(
        (prefix) => pathname === prefix || pathname?.startsWith(prefix + "/"),
      ),
    )?.key || tabs[0].key;

  return (
    <div
      role="tablist"
      aria-label="Lead magnets navigation"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
