"use client";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";

interface CollapsibleSectionProps {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  isCollapsed,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <Disclosure defaultOpen={!isCollapsed}>
      {({ open }) => (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <DisclosureButton
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-between bg-muted/40 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {open ? (
              <FiChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <FiChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </DisclosureButton>
          <DisclosurePanel className="p-4">{children}</DisclosurePanel>
        </div>
      )}
    </Disclosure>
  );
}
