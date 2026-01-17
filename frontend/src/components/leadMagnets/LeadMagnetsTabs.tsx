"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import clsx from "clsx";
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
  const subHeaderTarget =
    typeof document === "undefined"
      ? null
      : document.getElementById("dashboard-subheader");
  const shouldPortal = Boolean(subHeaderTarget);

  const navContent = (
    <div
      className={cn(
        "border-b border-border/60 bg-muted/20",
        shouldPortal ? "" : "mb-6",
        className,
      )}
    >
      <div className="px-6 sm:px-8 lg:px-12">
        <nav
          role="tablist"
          aria-label="Lead magnets views"
          className="flex w-full items-center gap-6 overflow-x-auto py-2 scrollbar-hide"
        >
          <div className="inline-flex items-center gap-6">
            {tabs.map((tab) => {
              const isActive = tab.activePrefixes.some(
                (prefix) => pathname === prefix || pathname?.startsWith(prefix + "/"),
              );

              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  role="tab"
                  aria-selected={isActive}
                  className={clsx(
                    "relative flex items-center gap-2 pb-2 text-sm font-semibold text-muted-foreground transition-all duration-150 ease-out",
                    "after:absolute after:inset-x-0 after:-bottom-[1px] after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200",
                    isActive
                      ? "text-foreground after:scale-x-100"
                      : "hover:text-foreground hover:after:scale-x-100 hover:-translate-y-0.5",
                  )}
                >
                  <span className="whitespace-nowrap">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );

  if (shouldPortal && subHeaderTarget) {
    return createPortal(navContent, subHeaderTarget);
  }

  return navContent;
}
