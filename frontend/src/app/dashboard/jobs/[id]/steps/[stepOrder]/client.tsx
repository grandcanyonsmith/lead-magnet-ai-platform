"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { StepNavCard } from "@/components/jobs/detail/StepNavCard";
import FlowchartSidePanel from "@/app/dashboard/workflows/components/FlowchartSidePanel";

import { useStepDetailData } from "./hooks/useStepDetailData";
import { StepHeader } from "./components/StepHeader";
import { StepOutput } from "./components/StepOutput";
import { StepInput } from "./components/StepInput";
import { StepImages } from "./components/StepImages";
import { StepStats } from "./components/StepStats";

export default function StepDetailClient() {
  const {
    stepOrder,
    isStepOrderValid,
    job,
    workflow,
    loading,
    error,
    refreshJob,
    refreshing,
    editingStepIndex,
    isSidePanelOpen,
    setIsSidePanelOpen,
    latestStepUpdateRef,
    sortedSteps,
    step,
    formattedInputPayload,
    formattedInstructions,
    outputContent,
    outputPreview,
    inputPreview,
    instructionsPreview,
    stepStatus,
    loadingArtifacts,
    stepImageUrls,
    stepImageArtifacts,
    hasImages,
    isLiveStep,
    liveOutputText,
    hasLiveOutput,
    outputIsEmpty,
    showLiveOutputPanel,
    liveStatus,
    liveUpdatedAtLabel,
    jobHref,
    prevHref,
    nextHref,
    stepLabel,
    heading,
    description,
    formattedCost,
    durationLabel,
    startedAtLabel,
    completedAtLabel,
    usageRows,
    toolChoice,
    toolLabels,
    stepTypeLabel,
    totalSteps,
    stepPosition,
    progressPercent,
    statsPreview,
    prevStepStatus,
    nextStepStatus,
    timelineHref,
    canEditStep,
    isEditingDisabled,
    handleEditStep,
    handleCancelEdit,
    handleCopy,
    prevStep,
    nextStep,
  } = useStepDetailData();

  if (loading) {
    return <LoadingState fullPage message="Loading step details..." />;
  }

  if (error && !job) {
    return (
      <ErrorState
        title="Unable to load job"
        message={error}
        onRetry={refreshJob}
        retryLabel={refreshing ? "Refreshing..." : "Reload job"}
        className="dark:bg-red-900/20 dark:border-red-800"
      />
    );
  }

  if (!isStepOrderValid) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Invalid step"
          message="This step number is not valid. Please return to the job."
        />
        <Link
          href={jobHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to job
        </Link>
      </div>
    );
  }

  if (!job || !step) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Step not found"
          message="This step does not exist for the selected job."
          onRetry={refreshJob}
          retryLabel="Reload job"
          className="dark:bg-red-900/20 dark:border-red-800"
        />
        <Link
          href={jobHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to job
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepHeader
        jobHref={jobHref}
        jobId={job.job_id}
        stepLabel={stepLabel}
        heading={heading}
        description={description}
        stepStatus={stepStatus}
        isLiveStep={isLiveStep}
        stepTypeLabel={stepTypeLabel}
        step={step}
        toolLabels={toolLabels}
        canEditStep={canEditStep}
        handleEditStep={handleEditStep}
        isEditingDisabled={isEditingDisabled}
        prevHref={prevHref}
        nextHref={nextHref}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <StepNavCard
          label="Previous step"
          direction="previous"
          href={prevHref}
          step={prevStep}
          status={prevStepStatus}
        />
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold uppercase tracking-wide">Progress</span>
            {stepPosition !== null && totalSteps > 0 && (
              <span>
                {stepPosition} of {totalSteps}
              </span>
            )}
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-2 rounded-full bg-primary-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <span>
              {startedAtLabel ? `Started ${startedAtLabel}` : "Not started"}
            </span>
            <span className="text-right">
              {durationLabel ? `Duration ${durationLabel}` : "Duration —"}
            </span>
            <span>
              {completedAtLabel
                ? `Completed ${completedAtLabel}`
                : job?.status === "processing"
                  ? "In progress"
                  : "Not completed"}
            </span>
            <span className="text-right">
              {formattedCost ? `Cost ${formattedCost}` : "Cost —"}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
            <span>{progressPercent}% complete</span>
            <Link
              href={timelineHref}
              className="font-semibold text-primary-600 hover:text-primary-700"
            >
              View full timeline
            </Link>
          </div>
        </div>
        <StepNavCard
          label="Next step"
          direction="next"
          href={nextHref}
          step={nextStep}
          status={nextStepStatus}
        />
      </div>

      <div className="space-y-4">
        <StepOutput
          outputPreview={outputPreview}
          handleCopyOutput={() => handleCopy(outputPreview || "", "Output copied")}
          showLiveOutputPanel={Boolean(showLiveOutputPanel)}
          liveStatus={liveStatus}
          job={job}
          liveUpdatedAtLabel={liveUpdatedAtLabel}
          hasLiveOutput={hasLiveOutput}
          liveOutputText={liveOutputText}
          outputIsEmpty={outputIsEmpty}
          outputContent={outputContent}
          stepImageUrls={stepImageUrls}
        />

        <StepInput
          formattedInstructions={formattedInstructions}
          instructionsPreview={instructionsPreview}
          handleCopy={handleCopy}
          formattedInputPayload={formattedInputPayload}
          inputPreview={inputPreview}
        />

        <StepImages
          hasImages={hasImages}
          stepImageUrls={stepImageUrls}
          stepImageArtifacts={stepImageArtifacts}
          loadingArtifacts={loadingArtifacts}
        />

        <StepStats
          statsPreview={statsPreview}
          step={step as any}
          stepTypeLabel={stepTypeLabel}
          toolChoice={toolChoice}
          toolLabels={toolLabels}
          durationLabel={durationLabel}
          startedAtLabel={startedAtLabel}
          completedAtLabel={completedAtLabel}
          formattedCost={formattedCost}
          usageRows={usageRows}
          jobStatus={job?.status}
        />

        {step.error && (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-200">
            <h3 className="text-sm font-semibold">Error details</h3>
            <p className="mt-2 whitespace-pre-wrap">{step.error}</p>
          </div>
        )}
      </div>

      {editingStepIndex !== null && workflow?.steps?.[editingStepIndex] && (
        <FlowchartSidePanel
          step={workflow.steps[editingStepIndex] as any}
          index={editingStepIndex}
          totalSteps={workflow.steps.length}
          allSteps={workflow.steps}
          isOpen={isSidePanelOpen}
          onClose={handleCancelEdit}
          onChange={(index, updatedStep) => {
            latestStepUpdateRef.current = updatedStep;
          }}
          onDelete={() =>
            toast.error("Cannot delete steps from execution viewer.")
          }
          onMoveUp={() =>
            toast.error("Cannot reorder steps from execution viewer.")
          }
          onMoveDown={() =>
            toast.error("Cannot reorder steps from execution viewer.")
          }
          workflowId={workflow.workflow_id}
        />
      )}
    </div>
  );
}
