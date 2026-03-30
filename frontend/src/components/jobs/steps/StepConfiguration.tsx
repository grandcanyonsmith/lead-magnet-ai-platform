"use client";

import React, { useState } from "react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { FiEdit } from "react-icons/fi";
import { MergedStep } from "@/types/job";
import { SectionHeader } from "@/components/ui/sections/SectionHeader";

interface StepConfigurationProps {
  step: MergedStep;
  canEdit?: boolean;
  onEditStep?: (stepIndex: number) => void;
}

export function StepConfiguration({
  step,
  canEdit,
  onEditStep,
}: StepConfigurationProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-card shadow-sm">
      <SectionHeader
        title="Configuration"
        className="bg-slate-50 dark:bg-slate-900/50 border-gray-300 dark:border-gray-700"
        actions={
          canEdit &&
          onEditStep &&
          (step.step_type === "workflow_step" ||
            step.step_type === "ai_generation" ||
            step.step_type === "webhook") &&
          step.step_order !== undefined &&
          step.step_order > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const workflowStepIndex = step.step_order - 1;
                onEditStep(workflowStepIndex);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              title="Edit workflow step"
            >
              <FiEdit className="w-4 h-4" />
              <span>Edit Step</span>
            </button>
          )
        }
      />
      <div className="p-4 md:p-3 bg-white dark:bg-card space-y-3 md:space-y-2">
        {step.instructions && (
          <div className="group/instructions">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                Step Instructions (directive)
              </span>
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-all dark:text-gray-500 ${
                  expanded
                    ? "opacity-100 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    : "opacity-0 group-hover/instructions:opacity-100 focus:opacity-100"
                }`}
                aria-label={expanded ? "Collapse instructions" : "Expand instructions"}
                aria-expanded={expanded}
              >
                <ChevronUpDownIcon className="h-4 w-4" />
              </button>
            </div>
            <div
              className={`mt-1 rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50 ${
                expanded
                  ? "max-h-[65vh] overflow-y-auto scrollbar-hide-until-hover"
                  : "max-h-40 overflow-hidden"
              }`}
            >
              <pre className="p-2.5 text-sm whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300">
                {step.instructions}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
