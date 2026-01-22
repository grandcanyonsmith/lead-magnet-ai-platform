import { ElementType, ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type SectionLabelProps<T extends ElementType = "p"> = {
  as?: T;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

export function SectionLabel<T extends ElementType = "p">({
  as,
  className,
  ...props
}: SectionLabelProps<T>) {
  const Component = as || "p";

  return (
    <Component
      className={cn(
        "text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
