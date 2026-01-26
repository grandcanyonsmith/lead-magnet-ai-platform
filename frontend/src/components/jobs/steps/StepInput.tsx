import React, { useRef, useEffect } from "react";
import { FiEdit } from "react-icons/fi";
import { MergedStep } from "@/types/job";
import { formatStepInput } from "@/utils/jobFormatting";
import { StepContent } from "../StepContent";
import { CopyButton } from "@/components/ui/buttons/CopyButton";
import { SectionHeader } from "@/components/ui/sections/SectionHeader";

interface StepInputProps {
  step: MergedStep;
  canEdit?: boolean;
  onEditStep?: (stepIndex: number) => void;
  onCopy: (text: string) => void;
  contentHeightClass: string;
}

export function StepInput({
  step,
  canEdit,
  onEditStep,
  onCopy,
  contentHeightClass,
}: StepInputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll detection logic (reused)
  useEffect(() => {
    const el = scrollRef.current;
    const handleScroll = () => {
      if (el) {
        el.classList.add("scrolling");
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          if (el) el.classList.remove("scrolling");
        }, 300);
      }
    };

    if (el) el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (el) el.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const formattedInput = formatStepInput(step);
  const isAiStep =
    step.step_type === "ai_generation" ||
    step.step_type === "workflow_step" ||
    step.step_type === "html_generation" ||
    formattedInput.structure === "ai_input";
  const isWebhookStep = step.step_type === "webhook";
  const isHandoffStep = step.step_type === "workflow_handoff";

  const label = isWebhookStep
    ? "Request"
    : isHandoffStep
      ? "Handoff Input"
      : isAiStep
        ? "Prompt"
        : "Input";

  const title = isAiStep
    ? "Prompt = instructions + context (form submission + dependencies)"
    : undefined;

  const handleCopy = () => {
    let text: string;
    if (formattedInput.type === "json") {
      text = JSON.stringify(formattedInput.content, null, 2);
    } else if (typeof formattedInput.content === "string") {
      text = formattedInput.content;
    } else if (
      typeof formattedInput.content === "object" &&
      formattedInput.content !== null &&
      "input" in formattedInput.content
    ) {
      const contentObj = formattedInput.content as { input?: unknown };
      text = contentObj.input
        ? String(contentObj.input)
        : JSON.stringify(formattedInput.content, null, 2);
    } else {
      text = JSON.stringify(formattedInput.content, null, 2);
    }
    onCopy(text);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-card shadow-sm">
      <SectionHeader
        title={label}
        titleTitle={title}
        actions={
          <>
            {canEdit &&
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
                  className="flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Edit workflow step"
                >
                  <FiEdit className="w-3 h-3" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
              )}
            <CopyButton 
              text="" // We handle copy manually via onCopy prop for complex logic
              onCopy={handleCopy} 
              variant="both" 
            />
          </>
        }
      />
      <div
        ref={scrollRef}
        className={`p-3 md:p-2.5 bg-white dark:bg-card ${contentHeightClass} overflow-y-auto scrollbar-hide-until-hover`}
      >
        <StepContent formatted={formattedInput} />
      </div>
    </div>
  );
}
