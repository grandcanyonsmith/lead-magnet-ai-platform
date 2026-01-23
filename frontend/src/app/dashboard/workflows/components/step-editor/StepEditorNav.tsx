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
  layout?: "horizontal" | "vertical";
}

export default function StepEditorNav<T extends string>({
  sections,
  activeSection,
  onChange,
  isCompact = false,
  layout = "horizontal",
}: StepEditorNavProps<T>) {
  const selectedIndex = Math.max(
    0,
    sections.findIndex((section) => section.id === activeSection),
  );
  const isVertical = layout === "vertical";

  return (
    <Tab.Group
      selectedIndex={selectedIndex}
      onChange={(index) => {
        const section = sections[index];
        if (section) onChange(section.id);
      }}
    >
      <div className={isVertical ? "space-y-2" : "space-y-3"}>
        {isVertical && (
          <div className="flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span>Sections</span>
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px]">
              {sections.length}
            </span>
          </div>
        )}
        <Tab.List
          className={
            isVertical
              ? "relative flex w-full flex-col gap-2 rounded-xl border border-border/60 bg-background/80 p-2 shadow-sm lg:sticky lg:top-6"
              : "relative flex w-full items-stretch gap-3 overflow-x-auto rounded-xl border border-border/60 bg-muted/15 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-muted/35"
          }
          aria-label="Step editor sections"
          aria-orientation={isVertical ? "vertical" : "horizontal"}
        >
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Tab
                key={section.id}
                as="button"
                className={({ selected }) =>
                  isVertical
                    ? `group relative flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        selected
                          ? "border-primary/40 bg-primary/5 text-foreground shadow-sm"
                          : "border-transparent bg-muted/30 text-foreground/75 hover:bg-background hover:text-foreground"
                      }`
                    : `group relative inline-flex min-w-[200px] flex-1 items-center gap-3 rounded-lg border px-4 py-3.5 text-left text-base font-semibold tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        selected
                          ? "border-primary/60 bg-background text-foreground shadow-md ring-1 ring-primary/15"
                          : "border-border/60 bg-muted/25 text-foreground/75 hover:border-border/80 hover:text-foreground"
                      }`
                }
              >
                {({ selected }) => (
                  <>
                    {Icon && (
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm transition-colors ${
                          selected
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-transparent bg-muted/50 text-muted-foreground"
                        }`}
                        aria-hidden="true"
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                    )}
                    <span className="flex-1 min-w-0 space-y-0.5">
                      <span className="block text-[15px] font-semibold leading-tight text-foreground">
                        {section.label}
                      </span>
                      {!isCompact && section.description && (
                        <span className="block text-sm text-muted-foreground leading-snug line-clamp-2">
                          {section.description}
                        </span>
                      )}
                    </span>
                    {selected && (
                      <span
                        className={
                          isVertical
                            ? "pointer-events-none absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary/80"
                            : "pointer-events-none absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary/80"
                        }
                        aria-hidden="true"
                      />
                    )}
                  </>
                )}
              </Tab>
            );
          })}
        </Tab.List>
      </div>
    </Tab.Group>
  );
}
