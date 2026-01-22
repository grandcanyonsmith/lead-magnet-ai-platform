import { ReactNode } from "react";
import { CardDescription, CardHeader, CardTitle } from "./Card";
import { cn } from "@/lib/utils";

interface CardHeaderIntroProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  iconWrapperClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  actionsClassName?: string;
}

export function CardHeaderIntro({
  title,
  description,
  icon,
  actions,
  className,
  contentClassName,
  iconWrapperClassName,
  titleClassName,
  descriptionClassName,
  actionsClassName,
}: CardHeaderIntroProps) {
  const headerContent = (
    <div className={cn("flex items-start gap-3", contentClassName)}>
      {icon && (
        <div className={cn("p-2 rounded-lg", iconWrapperClassName)}>{icon}</div>
      )}
      <div className="space-y-1">
        <CardTitle className={cn("text-lg", titleClassName)}>{title}</CardTitle>
        {description && (
          <CardDescription className={descriptionClassName}>
            {description}
          </CardDescription>
        )}
      </div>
    </div>
  );

  return (
    <CardHeader
      className={cn(
        "border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-secondary/30",
        className,
      )}
    >
      {actions ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {headerContent}
          <div className={cn("flex items-center gap-2", actionsClassName)}>
            {actions}
          </div>
        </div>
      ) : (
        headerContent
      )}
    </CardHeader>
  );
}
