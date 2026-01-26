"use client";

import React from "react";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

interface CollapsibleSectionCardProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  preview?: string | null;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function CollapsibleSectionCard({
  title,
  description,
  defaultOpen = false,
  preview,
  actions,
  children,
}: CollapsibleSectionCardProps) {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card shadow-sm overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              {description && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <DisclosureButton
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                aria-label={open ? "Collapse section" : "Expand section"}
              >
                {open ? (
                  <ChevronUpIcon className="h-4 w-4" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4" />
                )}
              </DisclosureButton>
            </div>
          </div>
          {!open && preview && (
            <div className="px-4 pb-4 sm:px-5 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap line-clamp-3">
              {preview}
            </div>
          )}
          <DisclosurePanel className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 sm:px-5 sm:py-5">
            {children}
          </DisclosurePanel>
        </div>
      )}
    </Disclosure>
  );
}
