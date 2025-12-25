import type { ReactNode } from "react";
import { SettingsLayoutClient } from "@/components/settings/SettingsLayoutClient";

export default function DashboardSettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <SettingsLayoutClient>{children}</SettingsLayoutClient>;
}


