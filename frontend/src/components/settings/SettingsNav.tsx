"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    id: "general",
    label: "General",
    href: "/dashboard/settings/general",
  },
  {
    id: "branding",
    label: "Branding",
    href: "/dashboard/settings/branding",
  },
  {
    id: "delivery",
    label: "Email Settings",
    href: "/dashboard/settings/delivery",
  },
  {
    id: "billing",
    label: "Billing & Usage",
    href: "/dashboard/settings/billing",
  },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  const subHeaderTarget =
    typeof document === "undefined"
      ? null
      : document.getElementById("dashboard-subheader");
  const shouldPortal = Boolean(subHeaderTarget);
  const navContent = (
    <div className={cn("border-b border-border/60 bg-muted/20", shouldPortal ? "" : "mb-8")}>
      <div className="px-6 sm:px-8 lg:px-12">
        <nav
          aria-label="Settings navigation"
          className="flex gap-1 overflow-x-auto py-2 scrollbar-hide"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname?.startsWith(item.href) || false;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={clsx(
                  "group relative flex items-center pb-2 text-sm font-semibold transition-all duration-150 ease-out whitespace-nowrap",
                  "after:absolute after:inset-x-0 after:-bottom-[1px] after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200",
                  isActive
                    ? "text-foreground after:scale-x-100"
                    : "text-muted-foreground hover:text-foreground hover:-translate-y-0.5 hover:after:scale-x-100",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );

  if (shouldPortal && subHeaderTarget) {
    return createPortal(navContent, subHeaderTarget);
  }

  return navContent;
}


