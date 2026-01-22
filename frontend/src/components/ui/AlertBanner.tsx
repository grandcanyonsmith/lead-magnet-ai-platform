import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type AlertVariant = "info" | "success" | "warning" | "error";

const variantStyles: Record<
  AlertVariant,
  {
    container: string;
    icon: string;
    title: string;
    description: string;
  }
> = {
  info: {
    container:
      "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20",
    icon: "text-blue-600 dark:text-blue-400",
    title: "text-blue-900 dark:text-blue-100",
    description: "text-blue-800 dark:text-blue-200",
  },
  success: {
    container:
      "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20",
    icon: "text-green-600 dark:text-green-400",
    title: "text-green-900 dark:text-green-100",
    description: "text-green-800 dark:text-green-200",
  },
  warning: {
    container:
      "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20",
    icon: "text-amber-600 dark:text-amber-400",
    title: "text-amber-900 dark:text-amber-100",
    description: "text-amber-800 dark:text-amber-200",
  },
  error: {
    container:
      "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20",
    icon: "text-red-600 dark:text-red-400",
    title: "text-red-900 dark:text-red-100",
    description: "text-red-800 dark:text-red-200",
  },
};

interface AlertBannerProps
  extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  contentClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export function AlertBanner({
  variant = "info",
  icon,
  title,
  description,
  actions,
  className,
  contentClassName,
  titleClassName,
  descriptionClassName,
  children,
  ...props
}: AlertBannerProps) {
  const styles = variantStyles[variant];
  const containerClassName = cn(
    "rounded-lg border p-4",
    styles.container,
    className,
  );

  if (children) {
    return (
      <div className={containerClassName} {...props}>
        {children}
      </div>
    );
  }

  const content = (
    <div className={cn("flex items-start gap-3", contentClassName)}>
      {icon && <div className={cn("mt-0.5", styles.icon)}>{icon}</div>}
      <div className="space-y-1">
        {title && (
          <p className={cn("text-sm font-medium", styles.title, titleClassName)}>
            {title}
          </p>
        )}
        {description && (
          <p className={cn("text-sm", styles.description, descriptionClassName)}>
            {description}
          </p>
        )}
      </div>
    </div>
  );

  if (actions) {
    return (
      <div
        className={cn(
          containerClassName,
          "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        )}
        {...props}
      >
        {content}
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    );
  }

  return (
    <div className={containerClassName} {...props}>
      {content}
    </div>
  );
}
