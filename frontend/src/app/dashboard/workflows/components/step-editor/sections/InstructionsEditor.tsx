import React, { useState } from "react";
import { WorkflowStep } from "@/types/workflow";
import { FiMaximize2, FiFileText, FiX, FiEdit, FiEye, FiLayout } from "react-icons/fi";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

type ViewMode = "edit" | "preview" | "split";

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
  const [expandedViewMode, setExpandedViewMode] = useState<ViewMode>("split");
  const [collapsedShowPreview, setCollapsedShowPreview] = useState(false);

  const renderEditor = (isExpanded: boolean) => {
    const currentViewMode = isExpanded ? expandedViewMode : (collapsedShowPreview ? "preview" : "edit");
    
    return (
      <div className={`flex flex-col ${isExpanded ? "h-full" : ""}`}>
        {/* View Mode Toggle - Only show in expanded mode */}
        {isExpanded && (
          <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/10">
            <button
              type="button"
              onClick={() => setExpandedViewMode("edit")}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                expandedViewMode === "edit"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <FiEdit className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setExpandedViewMode("preview")}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                expandedViewMode === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <FiEye className="w-3.5 h-3.5" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => setExpandedViewMode("split")}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                expandedViewMode === "split"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <FiLayout className="w-3.5 h-3.5" />
              Split
            </button>
          </div>
        )}

        {/* Editor/Preview Content */}
        <div
          className={`flex-1 overflow-hidden ${
            currentViewMode === "split" && isExpanded
              ? "grid grid-cols-2 gap-0"
              : "flex"
          }`}
        >
          {/* Editor */}
          {(currentViewMode === "edit" || currentViewMode === "split") && (
            <div
              className={`flex flex-col ${
                currentViewMode === "split" && isExpanded
                  ? "border-r border-border overflow-y-auto"
                  : "w-full"
              }`}
            >
              <textarea
                id={`instructions-${index}`}
                value={step.instructions}
                onChange={(e) => onChange("instructions", e.target.value)}
                className={`w-full resize-y rounded-lg border border-input bg-background px-5 py-4 font-mono text-[13px] leading-7 text-foreground shadow-sm transition-all hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 ${
                  isExpanded
                    ? "h-full resize-none rounded-none border-0 px-6 py-6"
                    : isFocusMode
                    ? "min-h-[55vh]"
                    : "min-h-[320px]"
                }`}
                placeholder="Enter detailed instructions for what this step should do... (Markdown supported)"
                rows={isExpanded ? undefined : 12}
                required
                aria-label="Step instructions"
                aria-required="true"
                spellCheck={false}
              />
            </div>
          )}

          {/* Preview */}
          {(currentViewMode === "preview" || currentViewMode === "split") && (
            <div
              className={`flex flex-col overflow-y-auto ${
                currentViewMode === "split" && isExpanded
                  ? "w-full"
                  : "w-full"
              } ${
                isExpanded
                  ? "h-full p-6"
                  : currentViewMode === "preview"
                  ? "min-h-[320px] p-4 rounded-lg border border-border bg-background"
                  : "hidden"
              }`}
            >
              {step.instructions ? (
                <MarkdownRenderer
                  value={step.instructions}
                  className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:text-foreground prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border"
                />
              ) : (
                <div className="text-muted-foreground text-sm italic">
                  No content to preview. Start typing to see the markdown preview.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="rounded-xl border border-border/50 bg-muted/10 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-sm font-semibold text-foreground">Instructions</h5>
          <div className="flex items-center gap-2">
            {!collapsedShowPreview && (
              <button
                type="button"
                onClick={() => setCollapsedShowPreview(true)}
                className="inline-flex items-center gap-2 rounded-md border border-border/60 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Show preview"
              >
                <FiEye className="h-3.5 w-3.5" />
                Preview
              </button>
            )}
            {collapsedShowPreview && (
              <button
                type="button"
                onClick={() => setCollapsedShowPreview(false)}
                className="inline-flex items-center gap-2 rounded-md border border-border/60 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Show editor"
              >
                <FiEdit className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
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
        </div>
        {renderEditor(false)}
        <p className="text-xs text-muted-foreground">
          Use clear steps and include any formatting or data requirements. Markdown is supported.
        </p>
      </div>

      {/* Expanded Instructions Modal */}
      {isInstructionsExpanded && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-7xl h-[90vh] flex flex-col bg-card border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 ring-1 ring-border/50">
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
            <div className="flex-1 overflow-hidden">
              {renderEditor(true)}
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
