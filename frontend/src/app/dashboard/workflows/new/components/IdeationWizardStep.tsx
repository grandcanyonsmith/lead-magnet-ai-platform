import { IdeationStepConfig } from "../constants";

interface IdeationWizardStepProps {
  stepConfig: IdeationStepConfig;
  value: string;
  onChange: (value: string) => void;
  onAppend: (value: string) => void;
  onPreset: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  showHint: boolean;
}

export function IdeationWizardStep({
  stepConfig,
  value,
  onChange,
  onAppend,
  onPreset,
  onNext,
  onBack,
  isFirstStep,
  isLastStep,
  showHint,
}: IdeationWizardStepProps) {
  return (
    <div className="space-y-4">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={stepConfig.placeholder}
        rows={4}
        className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-foreground placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent resize-none"
      />

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Quick picks
        </div>
        <div className="flex flex-wrap gap-2">
          {stepConfig.chips.map((chip) => {
            const isSelected = value.toLowerCase().includes(chip.toLowerCase());
            return (
              <button
                key={chip}
                type="button"
                onClick={() => onAppend(chip)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-emerald-300 dark:hover:border-emerald-700"
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Cursor-style options
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {stepConfig.cards.map((card) => {
            const isSelected = value.toLowerCase().includes(card.value.toLowerCase());
            return (
              <button
                key={card.title}
                type="button"
                onClick={() => onPreset(card.value)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm"
                    : "border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 bg-white dark:bg-gray-900"
                }`}
              >
                <div className="text-sm font-semibold text-gray-900 dark:text-foreground">
                  {card.title}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {card.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showHint && stepConfig.hint && (
        <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">
          {stepConfig.hint}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onBack}
          disabled={isFirstStep}
          className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >
          {isLastStep ? "Review" : "Next"}
        </button>
      </div>
    </div>
  );
}
