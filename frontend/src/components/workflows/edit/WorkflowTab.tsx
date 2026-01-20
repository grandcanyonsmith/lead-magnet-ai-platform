import { useState } from "react";
import dynamic from "next/dynamic";
import { useWorkflowAI } from "@/hooks/useWorkflowAI";
import { WorkflowStep, WorkflowFormData } from "@/types/workflow";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Separator } from "@/components/ui/Separator";
import { Sparkles, Zap, ChevronDown, ChevronUp, LayoutTemplate } from "lucide-react";
const WorkflowFlowchart = dynamic(
  () => import("@/app/dashboard/workflows/components/WorkflowFlowchart"),
  {
    loading: () => (
      <div className="h-[600px] w-full rounded-3xl border border-slate-200 dark:border-border bg-slate-50/70 dark:bg-card/60 flex items-center justify-center text-sm text-muted-foreground">
        Loading flowchart...
      </div>
    ),
  },
);
import FlowchartSidePanel from "@/app/dashboard/workflows/components/FlowchartSidePanel";
import WorkflowTriggerSidePanel from "@/app/dashboard/workflows/components/WorkflowTriggerSidePanel";
import { WorkflowDiffPreview } from "./WorkflowDiffPreview";

interface WorkflowTabProps {
  workflowId: string;
  formData: WorkflowFormData;
  steps: WorkflowStep[];
  submitting: boolean;
  selectedStepIndex: number | null;
  isSidePanelOpen: boolean;
  onFormDataChange: (field: string, value: any) => void;
  onStepsChange: (newSteps: WorkflowStep[]) => void;
  onAddStep: () => void;
  onStepClick: (index: number) => void;
  onStepsReorder: (newSteps: WorkflowStep[]) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onDeleteStep?: (index: number) => void;
  onMoveStepUp?: (index: number) => void;
  onMoveStepDown?: (index: number) => void;
  settings?: any;
}

export function WorkflowTab({
  workflowId,
  formData,
  steps,
  submitting,
  selectedStepIndex,
  isSidePanelOpen,
  onFormDataChange,
  onStepsChange,
  onAddStep,
  onStepClick,
  onStepsReorder,
  onSubmit,
  onCancel,
  onDeleteStep,
  onMoveStepUp,
  onMoveStepDown,
  settings,
}: WorkflowTabProps) {
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const {
    generateWorkflowEdit,
    clearProposal,
    isGenerating,
    error: aiError,
    proposal,
  } = useWorkflowAI(workflowId);

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error(
        "Please enter a description of how you want to change the workflow",
      );
      return;
    }

    try {
      await generateWorkflowEdit(aiPrompt);
      toast.success("AI proposal generated successfully!");
    } catch (err) {
      toast.error("Failed to generate AI proposal");
    }
  };

  const handleAcceptProposal = async () => {
    if (!proposal) return;

    setIsApplying(true);
    try {
      // Validate proposal steps before applying
      if (!proposal.steps || !Array.isArray(proposal.steps)) {
        throw new Error("Invalid proposal: steps must be an array");
      }

      // Validate each step has required fields
      for (let i = 0; i < proposal.steps.length; i++) {
        const step = proposal.steps[i];
        if (!step.step_name || !step.instructions) {
          throw new Error(
            `Invalid step ${i + 1}: missing required fields (step_name or instructions)`,
          );
        }
        // Model is required but backend will default to 'gpt-5.2' if missing
        // We don't need to validate it here as the backend handles defaults
      }

      // Apply workflow metadata changes
      if (proposal.workflow_name) {
        onFormDataChange("workflow_name", proposal.workflow_name);
      }
      if (proposal.workflow_description !== undefined) {
        onFormDataChange("workflow_description", proposal.workflow_description);
      }

      // Apply validated step changes
      onStepsChange(proposal.steps);

      toast.success("AI changes applied! Don't forget to save.");
      clearProposal();
      setAiPrompt("");
      setShowAIAssist(false);
    } catch (err: any) {
      console.error("[WorkflowTab] Failed to apply AI proposal", err);
      toast.error(err.message || "Failed to apply changes");
      // Don't clear proposal on error so user can try again or reject
    } finally {
      setIsApplying(false);
    }
  };

  const handleRejectProposal = () => {
    clearProposal();
    toast("Proposal rejected", { icon: "❌" });
  };

  const handleStepChange = (index: number, updatedStep: WorkflowStep) => {
    const newSteps = [...steps];
    newSteps[index] = updatedStep;
    onStepsChange(newSteps);
  };

  const handleDeleteStep = (index: number) => {
    if (onDeleteStep) {
      onDeleteStep(index);
    } else {
      const newSteps = steps.filter((_, i) => i !== index);
      onStepsChange(newSteps);
    }
  };

  const handleMoveStepUp = (index: number) => {
    if (index === 0) return;
    if (onMoveStepUp) {
      onMoveStepUp(index);
    } else {
      const newSteps = [...steps];
      [newSteps[index - 1], newSteps[index]] = [
        newSteps[index],
        newSteps[index - 1],
      ];
      onStepsChange(newSteps);
    }
  };

  const handleMoveStepDown = (index: number) => {
    if (index === steps.length - 1) return;
    if (onMoveStepDown) {
      onMoveStepDown(index);
    } else {
      const newSteps = [...steps];
      [newSteps[index], newSteps[index + 1]] = [
        newSteps[index + 1],
        newSteps[index],
      ];
      onStepsChange(newSteps);
    }
  };

  const handleCloseSidePanel = () => {
    onStepClick(-1); // Pass -1 to close the panel
  };

  const isTriggerSelected = selectedStepIndex === -2;

  const selectedStep =
    selectedStepIndex !== null && selectedStepIndex >= 0
      ? steps[selectedStepIndex]
      : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>General Information</CardTitle>
            <CardDescription>
              Basic details about your lead magnet workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workflow_name">
                Lead Magnet Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="workflow_name"
                value={formData.workflow_name}
                onChange={(e) => onFormDataChange("workflow_name", e.target.value)}
                placeholder="e.g., Course Idea Validator"
                maxLength={200}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workflow_description">Description</Label>
              <Textarea
                id="workflow_description"
                value={formData.workflow_description}
                onChange={(e) =>
                  onFormDataChange("workflow_description", e.target.value)
                }
                placeholder="Describe what this lead magnet does..."
                rows={3}
                maxLength={1000}
                className="resize-none"
              />
            </div>
          </CardContent>
        </Card>

        <Card className={`border-2 transition-colors ${showAIAssist ? 'border-purple-500/50 dark:border-purple-400/50 bg-purple-50/10 dark:bg-purple-900/10' : 'border-dashed'}`}>
          <CardHeader className="pb-3">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${showAIAssist ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-muted text-muted-foreground'}`}>
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">AI Copilot</CardTitle>
                    <CardDescription>Auto-configure your workflow</CardDescription>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowAIAssist(!showAIAssist)}
                  className={showAIAssist ? "text-purple-600 dark:text-purple-400" : ""}
                >
                  {showAIAssist ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
             </div>
          </CardHeader>
          
          {showAIAssist && (
            <CardContent>
              {!proposal ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase text-muted-foreground">What would you like to change?</Label>
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g., Add a research step at the beginning..."
                      className="min-h-[120px] resize-none"
                      disabled={isGenerating}
                    />
                  </div>

                  {aiError && (
                    <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 p-3 rounded-md border border-red-200 dark:border-red-900">
                      {aiError}
                    </div>
                  )}

                  <Button
                    onClick={handleGenerateAI}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {isGenerating ? (
                      <>
                        <Zap className="mr-2 h-4 w-4 animate-spin" />
                        Thinking...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Proposal
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <WorkflowDiffPreview
                  currentWorkflow={{
                    workflow_name: formData.workflow_name,
                    workflow_description: formData.workflow_description,
                    steps: steps,
                  }}
                  proposal={proposal}
                  onAccept={handleAcceptProposal}
                  onReject={handleRejectProposal}
                  isApplying={isApplying}
                />
              )}
            </CardContent>
          )}
          {!showAIAssist && (
             <CardContent className="pt-0 pb-6 text-sm text-muted-foreground">
               Click to expand the AI assistant to help you restructure or improve your workflow automatically.
             </CardContent>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden border-2 border-primary/10">
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Workflow Steps</CardTitle>
              <CardDescription>
                Design the logic flow of your lead magnet.
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-background">
              {steps.length} {steps.length === 1 ? 'Step' : 'Steps'}
            </Badge>
          </div>
        </CardHeader>
        <div className="p-0">
          <WorkflowFlowchart
            steps={steps}
            activeStepIndex={selectedStepIndex}
            onStepClick={onStepClick}
            onTriggerClick={() => onStepClick(-2)}
            onAddStep={onAddStep}
            onStepsReorder={(newSteps) => {
              const reorderedSteps = newSteps.map((step, index) => ({
                ...step,
                step_order: index,
              }));
              onStepsReorder(reorderedSteps);
            }}
          />
        </div>
      </Card>

      {formData.template_id && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center gap-3">
          <LayoutTemplate className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Template Active:</strong> This workflow is connected to a template. Visit the <strong>Design</strong> tab to edit it.
          </p>
        </div>
      )}

      {/* Step Editor Side Panel */}
      {selectedStepIndex !== null && selectedStepIndex >= 0 && (
        <FlowchartSidePanel
          step={selectedStep}
          index={selectedStepIndex}
          totalSteps={steps.length}
          allSteps={steps}
          isOpen={isSidePanelOpen}
          onClose={handleCloseSidePanel}
          onChange={handleStepChange}
          onDelete={handleDeleteStep}
          onMoveUp={handleMoveStepUp}
          onMoveDown={handleMoveStepDown}
          workflowId={workflowId}
        />
      )}

      {/* Trigger Side Panel */}
      {isTriggerSelected && (
        <WorkflowTriggerSidePanel
          trigger={formData.trigger || { type: "form" }}
          isOpen={isSidePanelOpen}
          onClose={handleCloseSidePanel}
          onChange={(trigger) => onFormDataChange("trigger", trigger)}
          workflowId={workflowId}
          settings={settings}
        />
      )}
    </div>
  );
}
