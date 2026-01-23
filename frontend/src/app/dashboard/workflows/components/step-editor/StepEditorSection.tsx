"use client";

import React from "react";

interface StepEditorSectionProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
  showHeader?: boolean;
}

export default function StepEditorSection({
  title,
  description,
  icon: Icon,
  actions,
  children,
  showHeader = true,
}: StepEditorSectionProps) {
  return (
    <section className="space-y-4">
      {showHeader && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2">
            {Icon && <Icon className="mt-0.5 h-5 w-5 text-primary" aria-hidden />}
            <div>
              <h4 className="text-base font-semibold text-foreground">{title}</h4>
              {description && (
                <p className="text-sm text-foreground/70">{description}</p>
              )}
            </div>
          </div>
          {actions}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
