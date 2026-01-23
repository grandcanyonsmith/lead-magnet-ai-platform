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

  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-5 space-y-4">
      <h5 className="text-sm font-semibold text-foreground">Dependencies</h5>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allSteps.length > 0 ? (
            allSteps.map((otherStep, otherIndex) => {
              if (otherIndex === index) return null;
              const isSelected = (step.depends_on || []).includes(otherIndex);
              return (
                <label
                  key={otherIndex}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/10"
                      : "border-border/40 hover:border-primary/20 hover:bg-muted/30 bg-background"
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium border ${
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
                  </div>
                  <Checkbox
                    checked={isSelected}
                    onChange={(checked) => {
                      const currentDeps = step.depends_on || [];
                      const newDeps = checked
                        ? [...currentDeps, otherIndex]
                        : currentDeps.filter((dep: number) => dep !== otherIndex);
                      onChange("depends_on", newDeps);
                    }}
                    className="sr-only"
                  />
                  {isSelected && (
                    <div className="absolute top-0 right-0 -mt-1 -mr-1 w-3 h-3 bg-primary rounded-full ring-2 ring-background" />
                  )}
                </label>
              );
            })
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/60">
              <p className="text-sm">No other steps available to depend on</p>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
