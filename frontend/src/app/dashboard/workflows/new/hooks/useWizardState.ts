import { useState } from "react";
import { IdeationDraft, IdeationDraftKey, DEFAULT_IDEATION_DRAFT, IDEATION_STEPS } from "../constants";

export function useWizardState() {
  const [chatSetupStep, setChatSetupStep] = useState(0);
  const [isChatSetupComplete, setIsChatSetupComplete] = useState(false);
  const [ideationDraft, setIdeationDraft] = useState<IdeationDraft>(DEFAULT_IDEATION_DRAFT);
  const [chatSetupError, setChatSetupError] = useState<string | null>(null);

  const totalWizardSteps = IDEATION_STEPS.length;
  const isWizardReview = chatSetupStep >= totalWizardSteps;
  const currentWizardStep = IDEATION_STEPS[chatSetupStep];
  const wizardProgress = totalWizardSteps === 0 ? 0 : Math.min(chatSetupStep + 1, totalWizardSteps) / totalWizardSteps;
  
  const hasWizardCore = Boolean(ideationDraft.icp.trim() && ideationDraft.pain.trim() && ideationDraft.outcome.trim());
  
  const wizardStepValue = !isWizardReview && currentWizardStep ? ideationDraft[currentWizardStep.key] : "";
  const showWizardHint = Boolean(!isWizardReview && currentWizardStep?.hint && wizardStepValue.toLowerCase().includes("not sure"));

  const updateDraftField = (key: IdeationDraftKey, value: string) => {
    setIdeationDraft((prev) => ({ ...prev, [key]: value }));
    setChatSetupError(null);
  };

  const appendDraftValue = (key: IdeationDraftKey, value: string) => {
    setIdeationDraft((prev) => {
      const current = prev[key].trim();
      if (!current || value.toLowerCase() === "not sure") {
        return { ...prev, [key]: value };
      }
      if (current.toLowerCase().includes(value.toLowerCase())) {
        return prev;
      }
      return { ...prev, [key]: `${current}, ${value}` };
    });
    setChatSetupError(null);
  };

  const setDraftPreset = (key: IdeationDraftKey, value: string) => {
    setIdeationDraft((prev) => ({ ...prev, [key]: value }));
    setChatSetupError(null);
  };

  const handleWizardNext = () => {
    if (isWizardReview) return;
    const currentKey = currentWizardStep.key;
    const currentValue = ideationDraft[currentKey].trim();
    if (!currentValue) {
      if (["icp", "pain", "outcome"].includes(currentKey)) {
        setChatSetupError("Please provide an answer or select 'Not sure'");
        return;
      }
    }
    setChatSetupError(null);
    setChatSetupStep((prev) => prev + 1);
  };

  const handleWizardBack = () => {
    setChatSetupError(null);
    setChatSetupStep((prev) => Math.max(0, prev - 1));
  };

  const handleEditWizard = () => {
    setIsChatSetupComplete(false);
    setChatSetupStep(IDEATION_STEPS.length);
  };

  const resetWizard = () => {
    setIdeationDraft(DEFAULT_IDEATION_DRAFT);
    setChatSetupStep(0);
    setIsChatSetupComplete(false);
    setChatSetupError(null);
  };

  return {
    chatSetupStep, setChatSetupStep,
    isChatSetupComplete, setIsChatSetupComplete,
    ideationDraft, setIdeationDraft,
    chatSetupError, setChatSetupError,
    totalWizardSteps,
    isWizardReview,
    currentWizardStep,
    wizardProgress,
    hasWizardCore,
    wizardStepValue,
    showWizardHint,
    updateDraftField,
    appendDraftValue,
    setDraftPreset,
    handleWizardNext,
    handleWizardBack,
    handleEditWizard,
    resetWizard,
  };
}
