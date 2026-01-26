import React from "react";
import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { CollapsibleSectionCard } from "@/components/ui/CollapsibleSectionCard";
import { StepContent } from "@/components/jobs/StepContent";
import { toCopyText } from "@/utils/stepDetailUtils";

interface StepInputProps {
  formattedInstructions: any;
  instructionsPreview: string | null;
  handleCopy: (value: string, successMessage: string) => void;
  formattedInputPayload: any;
  inputPreview: string | null;
}

export function StepInput({
  formattedInstructions,
  instructionsPreview,
  handleCopy,
  formattedInputPayload,
  inputPreview,
}: StepInputProps) {
  return (
    <>
      {formattedInstructions && (
        <CollapsibleSectionCard
          title="Instructions"
          description="Prompt instructions for this step."
          preview={instructionsPreview}
          actions={
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  toCopyText(formattedInstructions),
                  "Instructions copied",
                )
              }
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              <ClipboardDocumentIcon className="h-3.5 w-3.5" />
              Copy
            </button>
          }
        >
          <StepContent formatted={formattedInstructions} />
        </CollapsibleSectionCard>
      )}

      <CollapsibleSectionCard
        title="Input payload"
        description="Structured input data sent into the step."
        preview={inputPreview}
        actions={
          <button
            type="button"
            onClick={() =>
              handleCopy(
                toCopyText(formattedInputPayload),
                "Input payload copied",
              )
            }
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
          >
            <ClipboardDocumentIcon className="h-3.5 w-3.5" />
            Copy
          </button>
        }
      >
        <StepContent formatted={formattedInputPayload} />
      </CollapsibleSectionCard>
    </>
  );
}
