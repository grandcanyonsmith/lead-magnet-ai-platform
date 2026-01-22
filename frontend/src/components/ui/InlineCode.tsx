import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InlineCodeProps = HTMLAttributes<HTMLElement>;

export function InlineCode({ className, children, ...props }: InlineCodeProps) {
  return (
    <code
      className={cn(
        "rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700 dark:bg-secondary dark:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
}
