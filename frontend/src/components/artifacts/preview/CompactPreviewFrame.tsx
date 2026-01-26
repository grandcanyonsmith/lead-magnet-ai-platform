import type { ReactNode } from "react";

export const CompactPreviewFrame = ({ children }: { children: ReactNode }) => (
  <div
    className="relative w-full h-full bg-gray-50 dark:bg-gray-900 p-2"
    style={{ contain: "layout style paint", minHeight: 0 }}
  >
    <div
      className="h-full w-full overflow-hidden rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm"
      style={{ minHeight: 0 }}
    >
      {children}
    </div>
  </div>
);
