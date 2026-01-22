import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type PanelHeaderProps = HTMLAttributes<HTMLDivElement>;

export function PanelHeader({ className, children, ...props }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
