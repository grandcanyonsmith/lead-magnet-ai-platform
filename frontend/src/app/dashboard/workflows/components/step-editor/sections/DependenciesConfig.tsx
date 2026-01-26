import React, { useState } from "react";
import { WorkflowStep } from "@/types/workflow";
import { Checkbox } from "@/components/ui/Checkbox";
import { CollapsibleSection } from "@/components/workflows/edit/CollapsibleSection";

interface DependenciesConfigProps {
  step: WorkflowStep;
  index: number;
  allSteps: WorkflowStep[];
  onChange: (field: keyof WorkflowStep, value: any) => void;
}

export default function DependenciesConfig({
  step,
  index,
  allSteps,
  onChange,
}: DependenciesConfigProps) {
  const [isDependenciesCollapsed, setIsDependenciesCollapsed] = useState(true);

  const handleDependencyToggle = (otherIndex: number, checked: boolean) => {
    const currentDeps = step.depends_on || [];
    const newDeps = checked
      ? [...currentDeps.filter((dep: number) => dep !== otherIndex), otherIndex]
      : currentDeps.filter((dep: number) => dep !== otherIndex);
    onChange("depends_on", newDeps);
  };

  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-5 space-y-4">
      <h5 className="text-sm font-semibold text-foreground">Dependencies & Data</h5>
      
      <div className="rounded-xl border border-border/40 bg-background p-3 flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">Include Form Data</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Pass the workflow trigger form data to this step
          </div>
        </div>
        <Checkbox
          checked={step.include_form_data || false}
          onChange={(checked) => onChange("include_form_data", checked)}
          aria-label="Include form data"
        />
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        {(step.depends_on || []).length > 0
          ? `Depends on: ${(step.depends_on || [])
              .map((dep) => allSteps[dep]?.step_name || `Step ${dep + 1}`)
              .join(", ")}`
          : "No dependencies configured"}
      </div>

      <CollapsibleSection
        title="Manage dependencies"
        isCollapsed={isDependenciesCollapsed}
        onToggle={() => setIsDependenciesCollapsed(!isDependenciesCollapsed)}
      >
        <div className="space-y-3">
          {allSteps.length > 0 ? (
            allSteps.map((otherStep, otherIndex) => {
              if (otherIndex === index) return null;
              const isSelected = (step.depends_on || []).includes(otherIndex);
              return (
                <div
                  key={otherIndex}
                  className={`relative flex items-start gap-3 p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/10"
                      : "border-border/40 hover:border-primary/20 hover:bg-muted/30 bg-background"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium border shrink-0 ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {otherIndex + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium truncate ${
                          isSelected ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {otherStep.step_name}
                      </div>
                      {otherStep.step_description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {otherStep.step_description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Checkbox
                      checked={isSelected}
                      onChange={(checked) => handleDependencyToggle(otherIndex, checked)}
                      aria-label={`${isSelected ? "Remove" : "Add"} dependency on ${otherStep.step_name}`}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/60">
              <p className="text-sm">No other steps available to depend on</p>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
