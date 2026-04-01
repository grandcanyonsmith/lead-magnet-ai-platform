import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  heading: ReactNode;
  description?: string;
  children?: ReactNode;
  className?: string;
  bottomContent?: ReactNode;
  actionsInlineOnMobile?: boolean;
}

export function PageHeader({
  heading,
  description,
  children,
  className,
  bottomContent,
  actionsInlineOnMobile,
}: PageHeaderProps) {
  const isPlainHeading =
    typeof heading === "string" || typeof heading === "number";
  const headerRowClassName = cn(
    "flex",
    actionsInlineOnMobile
      ? "flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      : "flex-col gap-4 md:flex-row md:items-start md:justify-between",
  );
  const headingContainerClassName = cn(
    "space-y-1 max-w-2xl",
    actionsInlineOnMobile && "min-w-0 flex-1 max-w-none",
  );
  const actionsContainerClassName = cn(
    "flex flex-wrap gap-3 shrink-0",
    actionsInlineOnMobile
      ? "w-full items-center justify-start sm:w-auto sm:justify-end"
      : "w-full flex-col items-stretch sm:w-auto sm:flex-row sm:items-center sm:justify-end",
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-4 pb-6 mb-8 border-b border-border/40",
        className,
      )}
    >
      <div className={headerRowClassName}>
        <div className={headingContainerClassName}>
          {isPlainHeading ? (
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {heading}
            </h1>
          ) : (
            <div className="min-w-0">{heading}</div>
          )}
          {description && (
            <p className="text-muted-foreground text-sm sm:text-base">
              {description}
            </p>
          )}
        </div>
        {children && <div className={actionsContainerClassName}>{children}</div>}
      </div>
      {bottomContent}
    </div>
  );
}

