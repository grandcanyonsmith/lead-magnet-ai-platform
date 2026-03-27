import type { ReactNode } from "react";

export default function DashboardTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200">
      {children}
    </div>
  );
}
