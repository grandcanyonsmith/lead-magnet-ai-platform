"use client";

import React from "react";
import { Tab } from "@headlessui/react";

type StepEditorNavItem<T extends string = string> = {
  id: T;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
};

interface StepEditorNavProps<T extends string = string> {
  sections: StepEditorNavItem<T>[];
  activeSection: T;
  onChange: (sectionId: T) => void;
  isCompact?: boolean;
}

export default function StepEditorNav<T extends string>({
  sections,
  activeSection,
  onChange,
  isCompact = false,
}: StepEditorNavProps<T>) {
  const selectedIndex = Math.max(
    0,
    sections.findIndex((section) => section.id === activeSection),
  );

  return (
    <Tab.Group
      selectedIndex={selectedIndex}
      onChange={(index) => {
        const section = sections[index];
        if (section) onChange(section.id);
      }}
    >
      <Tab.List
        className="rounded-xl border border-border/60 bg-muted/30 p-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]"
        aria-label="Step editor sections"
      >
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Tab
              key={section.id}
              as="button"
              className={({ selected }) =>
                `flex min-w-0 items-start gap-4 rounded-xl border px-4 py-4 text-left text-base transition-colors ${
                  selected
                    ? "border-primary/30 bg-background text-foreground shadow-sm"
                    : "border-border/50 bg-background/70 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                }`
              }
            >
              {({ selected }) => (
                <>
                  {Icon && (
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
                        selected
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-transparent bg-muted/50 text-muted-foreground"
                      }`}
                      aria-hidden="true"
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-base font-semibold text-foreground leading-snug">
                      {section.label}
                    </span>
                    {!isCompact && section.description && (
                      <span className="mt-1 block text-sm text-muted-foreground leading-snug line-clamp-2">
                        {section.description}
                      </span>
                    )}
                  </span>
                </>
              )}
            </Tab>
          );
        })}
      </Tab.List>
    </Tab.Group>
  );
}
