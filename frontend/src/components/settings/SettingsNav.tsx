"use client";

import { usePathname } from "next/navigation";
import { SubHeaderTabs } from "@/components/ui/SubHeaderTabs";

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
  const activeId =
    NAV_ITEMS.find((item) => pathname?.startsWith(item.href))?.id ||
    NAV_ITEMS[0].id;

  return (
    <SubHeaderTabs
      tabs={NAV_ITEMS}
      activeId={activeId}
      portalTargetId="dashboard-subheader"
      enableOverflowMenu
      mobileMaxVisible={3}
      compactMaxVisible={2}
      compactBreakpointPx={420}
    />
  );
}


