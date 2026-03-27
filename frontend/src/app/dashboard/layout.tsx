import type { ReactNode } from "react";
import { DashboardShellClient } from "@/components/dashboard/DashboardShellClient";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <DashboardShellClient>{children}</DashboardShellClient>;
}
