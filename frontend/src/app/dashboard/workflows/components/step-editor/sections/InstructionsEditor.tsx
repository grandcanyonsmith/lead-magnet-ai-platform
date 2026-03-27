import React, { useState } from "react";
import { WorkflowStep } from "@/types/workflow";
import { FiMaximize2, FiFileText, FiX, FiEdit, FiEye, FiLayout } from "react-icons/fi";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";

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
            <Button
              type="button"
              size="sm"
              variant={expandedViewMode === "edit" ? "default" : "outline"}
              onClick={() => setExpandedViewMode("edit")}
              className="h-8 gap-2 px-3 text-xs font-medium"
            >
              <FiEdit className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant={expandedViewMode === "preview" ? "default" : "outline"}
              onClick={() => setExpandedViewMode("preview")}
              className="h-8 gap-2 px-3 text-xs font-medium"
            >
              <FiEye className="w-3.5 h-3.5" />
              Preview
            </Button>
            <Button
              type="button"
              size="sm"
              variant={expandedViewMode === "split" ? "default" : "outline"}
              onClick={() => setExpandedViewMode("split")}
              className="h-8 gap-2 px-3 text-xs font-medium"
            >
              <FiLayout className="w-3.5 h-3.5" />
              Split
            </Button>
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCollapsedShowPreview(true)}
                className="h-7 gap-2 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                title="Show preview"
              >
                <FiEye className="h-3.5 w-3.5" />
                Preview
              </Button>
            )}
            {collapsedShowPreview && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCollapsedShowPreview(false)}
                className="h-7 gap-2 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                title="Show editor"
              >
                <FiEdit className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsInstructionsExpanded(true)}
              className="h-7 gap-2 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              title="Expand instructions"
            >
              <FiMaximize2 className="h-3.5 w-3.5" />
              Expand
            </Button>
          </div>
        </div>
        {renderEditor(false)}
        <p className="text-xs text-muted-foreground">
          Use clear steps and include any formatting or data requirements. Markdown is supported.
        </p>
      </div>

      <Dialog open={isInstructionsExpanded} onOpenChange={setIsInstructionsExpanded}>
        <DialogContent
          showCloseButton={false}
          className="!flex h-[90vh] max-w-7xl flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 shadow-2xl ring-1 ring-border/50"
        >
          <DialogHeader className="border-b border-border bg-muted/20 p-4 text-left">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <FiFileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-foreground">
                    Instructions Editor
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Step {index + 1}: {step.step_name}
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsInstructionsExpanded(false)}
                className="text-muted-foreground hover:text-foreground"
                title="Close editor"
              >
                <FiX className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {renderEditor(true)}
          </div>
          <div className="flex items-center justify-between border-t border-border bg-muted/20 p-4">
            <span className="text-xs text-muted-foreground">
              {step.instructions?.length || 0} characters
            </span>
            <Button onClick={() => setIsInstructionsExpanded(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
