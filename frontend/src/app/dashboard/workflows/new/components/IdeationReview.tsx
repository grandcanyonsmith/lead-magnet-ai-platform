import { IdeationDraft, IDEATION_STEPS } from "../constants";

interface IdeationReviewProps {
  draft: IdeationDraft;
  onEditStep: (index: number) => void;
  onBack: () => void;
  onSkip: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function IdeationReview({
  draft,
  onEditStep,
  onBack,
  onSkip,
  onGenerate,
  isGenerating,
}: IdeationReviewProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 space-y-3">
        {IDEATION_STEPS.map((stepItem, index) => (
          <div
            key={stepItem.key}
            className="flex items-start justify-between gap-3"
          >
            <div>
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                {stepItem.title}
              </div>
              <div className="text-sm text-gray-900 dark:text-foreground mt-1">
                {draft[stepItem.key].trim() || "Not provided"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onEditStep(index)}
              className="text-xs text-emerald-600 dark:text-emerald-300 hover:underline"
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
        >
          Back
        </button>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500"
          >
            Keep chatting
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating}
            className="px-5 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? "Generating options..." : "Generate options"}
          </button>
        </div>
      </div>
    </div>
  );
}
