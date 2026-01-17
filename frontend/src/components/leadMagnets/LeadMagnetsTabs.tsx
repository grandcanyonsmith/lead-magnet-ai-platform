"use client";

import { usePathname } from "next/navigation";
import { SubHeaderTabs } from "@/components/ui/SubHeaderTabs";

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
  const activeId =
    tabs.find((tab) =>
      tab.activePrefixes.some(
        (prefix) => pathname === prefix || pathname?.startsWith(prefix + "/"),
      ),
    )?.key || tabs[0].key;

  return (
    <SubHeaderTabs
      tabs={tabs.map((tab) => ({
        id: tab.key,
        label: tab.label,
        href: tab.href,
      }))}
      activeId={activeId}
      portalTargetId="dashboard-subheader"
      className={className}
      enableOverflowMenu
      mobileMaxVisible={2}
      compactMaxVisible={1}
      compactBreakpointPx={420}
    />
  );
}
