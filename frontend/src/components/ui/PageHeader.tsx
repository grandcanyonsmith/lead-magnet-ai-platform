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
  const headerRowClassName = cn(
    "flex",
    actionsInlineOnMobile
      ? "flex-row items-start justify-between gap-3"
      : "flex-col gap-4 md:flex-row md:items-start md:justify-between",
  );
  const headingContainerClassName = cn(
    "space-y-1 max-w-2xl",
    actionsInlineOnMobile && "min-w-0 flex-1",
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {heading}
          </h1>
          {description && (
            <p className="text-muted-foreground text-sm sm:text-base">
              {description}
            </p>
          )}
        </div>
        {children && (
          <div className="flex items-center gap-3 shrink-0">
            {children}
          </div>
        )}
      </div>
      {bottomContent}
    </div>
  );
}

