import React from "react";

interface WizardCreatingStepProps {
  error: string | null;
  aiGeneration: any;
  generationJobId: string | null;
}

export const WizardCreatingStep: React.FC<WizardCreatingStepProps> = ({
  error,
  aiGeneration,
  generationJobId,
}) => {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
          Creating Your Lead Magnet
        </h1>
        <p className="text-gray-600 dark:text-muted-foreground">
          AI is generating your lead magnet configuration...
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-card rounded-lg shadow p-6 border border-gray-200 dark:border-border">
        <div className="bg-gradient-to-r from-purple-50 dark:from-purple-900/20 to-blue-50 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-8 text-center">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 dark:border-purple-400"></div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-2">
                {aiGeneration.generationStatus ||
                  "Creating your lead magnet..."}
              </h3>
              <p className="text-sm text-gray-600 dark:text-muted-foreground">
                This may take a minute. We&apos;ll automatically take you to
                the edit page when it&apos;s ready.
              </p>
              {generationJobId && (
                <p className="text-xs text-gray-500 dark:text-muted-foreground/70 mt-2 font-mono">
                  Job ID: {generationJobId}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
