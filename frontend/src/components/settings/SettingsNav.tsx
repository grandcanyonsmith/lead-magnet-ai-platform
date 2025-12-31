"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Cog6ToothIcon,
  PhotoIcon,
  PaperAirplaneIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

const NAV_ITEMS = [
  {
    id: "general",
    label: "General",
    href: "/dashboard/settings/general",
    icon: Cog6ToothIcon,
  },
  {
    id: "branding",
    label: "Branding",
    href: "/dashboard/settings/branding",
    icon: PhotoIcon,
  },
  {
    id: "delivery",
    label: "Email Settings",
    href: "/dashboard/settings/delivery",
    icon: PaperAirplaneIcon,
  },
  {
    id: "billing",
    label: "Billing & Usage",
    href: "/dashboard/settings/billing",
    icon: CurrencyDollarIcon,
  },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings navigation"
      className="border-b border-gray-200 dark:border-border mb-8"
    >
      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname?.startsWith(item.href) || false;
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={clsx(
                "group relative flex items-center gap-2 py-4 px-4 text-sm font-bold transition-all focus:outline-none whitespace-nowrap",
                isActive
                  ? "text-primary-600 dark:text-primary"
                  : "text-gray-400 dark:text-muted-foreground hover:text-gray-600 dark:hover:text-foreground",
              )}
            >
              <Icon
                className={clsx(
                  "h-5 w-5 transition-colors",
                  isActive
                    ? "text-primary-600 dark:text-primary"
                    : "text-gray-400 dark:text-muted-foreground group-hover:text-gray-500 dark:group-hover:text-foreground",
                )}
              />
              {item.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


