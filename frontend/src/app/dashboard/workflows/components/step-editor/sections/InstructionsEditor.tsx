import React, { useState } from "react";
import { WorkflowStep } from "@/types/workflow";
import { FiMaximize2, FiFileText, FiX } from "react-icons/fi";

interface InstructionsEditorProps {
  step: WorkflowStep;
  index: number;
  onChange: (field: keyof WorkflowStep, value: any) => void;
  isFocusMode: boolean;
}

export default function InstructionsEditor({
  step,
  index,
  onChange,
  isFocusMode,
}: InstructionsEditorProps) {
  const [isInstructionsExpanded, setIsInstructionsExpanded] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-border/50 bg-muted/10 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-sm font-semibold text-foreground">Instructions</h5>
          <button
            type="button"
            onClick={() => setIsInstructionsExpanded(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border/60 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Expand instructions"
          >
            <FiMaximize2 className="h-3.5 w-3.5" />
            Expand
          </button>
        </div>
        <textarea
          id={`instructions-${index}`}
          value={step.instructions}
          onChange={(e) => onChange("instructions", e.target.value)}
          className={`w-full resize-y rounded-lg border border-input bg-background px-5 py-4 font-mono text-[13px] leading-7 text-foreground shadow-sm transition-all hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 ${
            isFocusMode ? "min-h-[55vh]" : "min-h-[320px]"
          }`}
          placeholder="Enter detailed instructions for what this step should do..."
          rows={12}
          required
          aria-label="Step instructions"
          aria-required="true"
        />
        <p className="text-xs text-muted-foreground">
          Use clear steps and include any formatting or data requirements.
        </p>
      </div>

      {/* Expanded Instructions Modal */}
      {isInstructionsExpanded && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-5xl h-[90vh] flex flex-col bg-card border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 ring-1 ring-border/50">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FiFileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Instructions Editor
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Step {index + 1}: {step.step_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInstructionsExpanded(false)}
                className="p-2 hover:bg-muted hover:text-foreground text-muted-foreground rounded-lg transition-colors"
                title="Close editor"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 p-0 overflow-hidden relative group">
              <textarea
                value={step.instructions}
                onChange={(e) => onChange("instructions", e.target.value)}
                className="w-full h-full resize-none bg-card p-6 font-mono text-sm leading-relaxed focus:outline-none text-foreground"
                placeholder="Enter detailed instructions..."
                autoFocus
                spellCheck={false}
              />
            </div>
            <div className="p-4 bg-muted/20 border-t border-border flex justify-between items-center rounded-b-xl">
              <span className="text-xs text-muted-foreground">
                {step.instructions?.length || 0} characters
              </span>
              <button
                onClick={() => setIsInstructionsExpanded(false)}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium text-sm shadow-sm transition-all hover:shadow-md active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
