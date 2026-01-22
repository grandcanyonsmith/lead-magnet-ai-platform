import type { WorkflowAIEditResponse } from "@/types/workflow";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface WorkflowDiffPreviewProps {
  currentWorkflow: {
    workflow_name: string;
    workflow_description?: string;
    steps: any[];
  };
  proposal: WorkflowAIEditResponse;
  onAccept: () => void;
  onReject: () => void;
  isApplying?: boolean;
  showActions?: boolean;
  acceptLabel?: string;
  rejectLabel?: string;
  actionsDisabled?: boolean;
}

export function WorkflowDiffPreview({
  currentWorkflow,
  proposal,
  onAccept,
  onReject,
  isApplying = false,
  showActions = true,
  acceptLabel = "Apply Changes",
  rejectLabel = "Reject",
  actionsDisabled = false,
}: WorkflowDiffPreviewProps) {
  const formatDependsOn = (dependsOn: number[] | undefined, steps: any[]) => {
    if (!Array.isArray(dependsOn) || dependsOn.length === 0) return "none";
    return dependsOn
      .map((dep) => {
        const step = steps?.[dep];
        const name = step?.step_name ? `: ${step.step_name}` : "";
        return `Step ${dep + 1}${name}`;
      })
      .join(", ");
  };

  const isActionDisabled = isApplying || actionsDisabled;
  const hasNameChange =
    proposal.workflow_name &&
    proposal.workflow_name !== currentWorkflow.workflow_name;
  const hasDescriptionChange =
    proposal.workflow_description !== undefined &&
    proposal.workflow_description !== currentWorkflow.workflow_description;
  const stepsWithDiff = proposal.steps.map((proposedStep, index) => {
    const currentStep = currentWorkflow.steps[index];
    const isNew = !currentStep;
    const isModified =
      currentStep &&
      (currentStep.step_name !== proposedStep.step_name ||
        currentStep.step_description !== proposedStep.step_description ||
        currentStep.model !== proposedStep.model ||
        currentStep.instructions !== proposedStep.instructions ||
        JSON.stringify(currentStep.depends_on) !==
          JSON.stringify(proposedStep.depends_on));

    return {
      proposedStep,
      currentStep,
      index,
      isNew,
      isModified,
    };
  });
  const changedSteps = stepsWithDiff.filter(
    (step) => step.isNew || step.isModified,
  );
  const unchangedSteps = stepsWithDiff.filter(
    (step) => !step.isNew && !step.isModified,
  );

  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <Badge variant="secondary" className="text-[10px] uppercase">
            AI proposal
          </Badge>
          <h3 className="text-lg font-semibold text-foreground">
            Proposed workflow updates
          </h3>
          <p className="text-sm text-muted-foreground break-words">
            {proposal.changes_summary || "Review the suggested workflow edits."}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {(hasNameChange || hasDescriptionChange) && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3 min-w-0">
            <h4 className="text-sm font-semibold text-foreground">
              Workflow settings
            </h4>

            {hasNameChange && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Name
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="min-w-0 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground line-through break-words">
                    {currentWorkflow.workflow_name}
                  </div>
                  <div className="min-w-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-foreground break-words">
                    {proposal.workflow_name}
                  </div>
                </div>
              </div>
            )}

            {hasDescriptionChange && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Description
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="min-w-0 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground line-through break-words">
                    {currentWorkflow.workflow_description || "(empty)"}
                  </div>
                  <div className="min-w-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-foreground break-words">
                    {proposal.workflow_description || "(empty)"}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              Steps ({currentWorkflow.steps.length} → {proposal.steps.length})
            </h4>
            <Badge variant="outline" className="text-[10px] uppercase">
              Review changes
            </Badge>
          </div>

          <div className="space-y-2">
            {(changedSteps.length > 0 ? changedSteps : stepsWithDiff).map(
              (step) => {
                const statusBadge = step.isNew
                  ? { label: "New", variant: "success" as const }
                  : step.isModified
                    ? { label: "Modified", variant: "warning" as const }
                    : { label: "Unchanged", variant: "secondary" as const };
                const toneClass = step.isNew
                  ? "border-l-emerald-500/70 bg-emerald-500/5"
                  : step.isModified
                    ? "border-l-amber-500/70 bg-amber-500/5"
                    : "bg-background/60";

                return (
                  <div
                    key={step.index}
                    className={`rounded-lg border border-border border-l-4 p-3 ${toneClass}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Step {step.index + 1}
                        </span>
                        <Badge
                          variant={statusBadge.variant}
                          className="text-[10px] uppercase"
                        >
                          {statusBadge.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-2 space-y-2 min-w-0">
                      <div className="text-sm font-semibold text-foreground break-words">
                        {step.proposedStep.step_name}
                      </div>

                      {step.proposedStep.step_description && (
                        <div className="text-sm text-muted-foreground break-words">
                          {step.proposedStep.step_description}
                        </div>
                      )}

                      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="max-w-full break-words rounded border border-border bg-background/80 px-2 py-1">
                          {step.proposedStep.model}
                        </span>
                        {step.proposedStep.tools &&
                          step.proposedStep.tools.length > 0 && (
                            <span className="max-w-full break-words rounded border border-border bg-background/80 px-2 py-1">
                              {step.proposedStep.tools
                                .map((t: any) =>
                                  typeof t === "string" ? t : t.type,
                                )
                                .join(", ")}
                            </span>
                          )}
                        <span className="max-w-full break-words rounded border border-border bg-background/80 px-2 py-1">
                          Depends on:{" "}
                          {formatDependsOn(
                            step.proposedStep.depends_on,
                            proposal.steps,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </div>

          {unchangedSteps.length > 0 && changedSteps.length > 0 && (
            <details className="rounded-lg border border-dashed border-border bg-background/60 p-3">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                Unchanged steps ({unchangedSteps.length})
              </summary>
              <div className="mt-3 space-y-2">
                {unchangedSteps.map((step) => {
                  const toneClass = "bg-background/60";

                  return (
                    <div
                      key={step.index}
                      className={`rounded-lg border border-border border-l-4 p-3 ${toneClass}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Step {step.index + 1}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] uppercase"
                          >
                            Unchanged
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-2 space-y-2 min-w-0">
                        <div className="text-sm font-semibold text-foreground break-words">
                          {step.proposedStep.step_name}
                        </div>

                        {step.proposedStep.step_description && (
                          <div className="text-sm text-muted-foreground break-words">
                            {step.proposedStep.step_description}
                          </div>
                        )}

                        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="max-w-full break-words rounded border border-border bg-background/80 px-2 py-1">
                            {step.proposedStep.model}
                          </span>
                          {step.proposedStep.tools &&
                            step.proposedStep.tools.length > 0 && (
                              <span className="max-w-full break-words rounded border border-border bg-background/80 px-2 py-1">
                                {step.proposedStep.tools
                                  .map((t: any) =>
                                    typeof t === "string" ? t : t.type,
                                  )
                                  .join(", ")}
                              </span>
                            )}
                          <span className="max-w-full break-words rounded border border-border bg-background/80 px-2 py-1">
                            Depends on:{" "}
                            {formatDependsOn(
                              step.proposedStep.depends_on,
                              proposal.steps,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          {currentWorkflow.steps.length > proposal.steps.length && (
            <div className="rounded-lg border border-dashed border-border bg-background/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-foreground">
                  Removed steps (
                  {currentWorkflow.steps.length - proposal.steps.length})
                </div>
                <Badge variant="destructive" className="text-[10px] uppercase">
                  Removed
                </Badge>
              </div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {currentWorkflow.steps
                  .slice(proposal.steps.length)
                  .map((step, index) => (
                    <div key={index} className="line-through break-words">
                      • {step.step_name}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showActions && (
        <div className="flex flex-col gap-2 pt-2 border-t border-border sm:flex-row sm:items-center sm:justify-end">
          <Button
            onClick={onReject}
            disabled={isActionDisabled}
            variant="outline"
          >
            {rejectLabel}
          </Button>
          <Button
            onClick={onAccept}
            disabled={isActionDisabled}
            isLoading={isApplying}
          >
            {isApplying ? "Applying..." : acceptLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
