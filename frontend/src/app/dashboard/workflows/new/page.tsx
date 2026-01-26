"use client";

import { useNewWorkflowState } from "./hooks/useNewWorkflowState";
import { WizardChoiceStep } from "./components/steps/WizardChoiceStep";
import { WizardCreatingStep } from "./components/steps/WizardCreatingStep";
import { WizardChatStep } from "./components/steps/WizardChatStep";
import { WizardPromptStep } from "./components/steps/WizardPromptStep";
import { WizardFormStep } from "./components/steps/WizardFormStep";

export default function NewWorkflowPage() {
  const state = useNewWorkflowState();

  if (state.step === "choice") {
    return <WizardChoiceStep setStep={state.setStep} />;
  }

  if (state.step === "creating") {
    return (
      <WizardCreatingStep
        error={state.error}
        aiGeneration={state.aiGeneration}
        generationJobId={state.generationJobId}
      />
    );
  }

  if (state.step === "chat") {
    return (
      <WizardChatStep
        setStep={state.setStep}
        chatErrors={state.chatErrors}
        icpProfiles={state.icpProfiles}
        selectedIcpProfileId={state.selectedIcpProfileId}
        setSelectedIcpProfileId={state.setSelectedIcpProfileId}
        setIcpProfileError={state.setIcpProfileError}
        selectedIcpProfile={state.selectedIcpProfile}
        applyIcpProfile={state.applyIcpProfile}
        selectedIcpResearchStatus={state.selectedIcpResearchStatus}
        icpResearchError={state.icpResearchError}
        runIcpResearch={state.runIcpResearch}
        isIcpResearching={state.isIcpResearching}
        icpProfileName={state.icpProfileName}
        setIcpProfileName={state.setIcpProfileName}
        handleSaveIcpProfile={state.handleSaveIcpProfile}
        hasWizardCore={state.hasWizardCore}
        isUpdatingSettings={state.isUpdatingSettings}
        icpProfileError={state.icpProfileError}
        isChatSetupComplete={state.isChatSetupComplete}
        isWizardReview={state.isWizardReview}
        chatSetupStep={state.chatSetupStep}
        totalWizardSteps={state.totalWizardSteps}
        currentWizardStep={state.currentWizardStep}
        handleSkipWizard={state.handleSkipWizard}
        wizardProgress={state.wizardProgress}
        wizardStepValue={state.wizardStepValue}
        updateDraftField={state.updateDraftField}
        appendDraftValue={state.appendDraftValue}
        setDraftPreset={state.setDraftPreset}
        handleWizardNext={state.handleWizardNext}
        handleWizardBack={state.handleWizardBack}
        showWizardHint={state.showWizardHint}
        ideationDraft={state.ideationDraft}
        setChatSetupStep={state.setChatSetupStep}
        setChatSetupError={state.setChatSetupError}
        handleGenerateFromWizard={state.handleGenerateFromWizard}
        ideation={state.ideation}
        chatMessages={state.chatMessages}
        chatInput={state.chatInput}
        setChatInput={state.setChatInput}
        handleSendChatMessage={state.handleSendChatMessage}
        selectedDeliverableId={state.selectedDeliverableId}
        setSelectedDeliverableId={state.setSelectedDeliverableId}
        mockupImages={state.mockupImages}
        isGeneratingMockups={state.isGeneratingMockups}
        mockupError={state.mockupError}
        handleGenerateMockups={state.handleGenerateMockups}
        handleCreateWorkflow={state.handleCreateWorkflow}
        chatScrollRef={state.chatScrollRef}
        chatInputRef={state.chatInputRef}
        applyStarterPrompt={state.applyStarterPrompt}
        contextItems={state.contextItems}
        handleEditWizard={state.handleEditWizard}
        handleResetChat={state.handleResetChat}
      />
    );
  }

  if (state.step === "prompt") {
    return (
      <WizardPromptStep
        setStep={state.setStep}
        prompt={state.prompt}
        setPrompt={state.setPrompt}
        error={state.error}
        setError={state.setError}
        aiGeneration={state.aiGeneration}
        resolvedModel={state.resolvedModel}
        setGenerationJobId={state.setGenerationJobId}
        workflowForm={state.workflowForm}
        workflowSteps={state.workflowSteps}
      />
    );
  }

  return (
    <WizardFormStep
      setStep={state.setStep}
      workflowForm={state.workflowForm}
      handleSubmit={state.handleSubmit}
      submission={state.submission}
      validation={state.validation}
      error={state.error}
    />
  );
}
