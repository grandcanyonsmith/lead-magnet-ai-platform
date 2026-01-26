import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAIGeneration } from "@/hooks/useAIGeneration";
import { useWorkflowForm } from "@/hooks/useWorkflowForm";
import { useWorkflowSteps } from "@/hooks/useWorkflowSteps";
import { useWorkflowValidation } from "@/hooks/useWorkflowValidation";
import { useWorkflowSubmission } from "@/hooks/useWorkflowSubmission";
import { useWorkflowGenerationStatus } from "@/hooks/useWorkflowGenerationStatus";
import { useSettings, useUpdateSettings } from "@/hooks/api/useSettings";
import { useWorkflowIdeation } from "@/hooks/useWorkflowIdeation";
import { useAIModels } from "@/hooks/api/useWorkflows";
import { AIModel, ICPProfile, WorkflowIdeationMessage } from "@/types";
import { DEFAULT_AI_MODEL } from "@/constants/models";
import { ChatMessage, createChatId, createIcpId, IDEATION_STEPS } from "../constants";

import { useWizardState } from "./useWizardState";
import { useChatState } from "./useChatState";
import { useIcpState } from "./useIcpState";
import { useMockupState } from "./useMockupState";

export type WizardStep = "choice" | "prompt" | "chat" | "form" | "creating";

export function useNewWorkflowState() {
  const router = useRouter();
  
  // Sub-hooks
  const wizard = useWizardState();
  const chat = useChatState();
  const icp = useIcpState();
  const mockups = useMockupState();

  // UI State
  const [step, setStep] = useState<WizardStep>("choice");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // Generation State
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [generatedTemplateId, setGeneratedTemplateId] = useState<string | null>(null);

  // Hooks
  const aiGeneration = useAIGeneration();
  const ideation = useWorkflowIdeation();
  const workflowForm = useWorkflowForm();
  const { settings } = useSettings();
  const { updateSettings, loading: isUpdatingSettings } = useUpdateSettings();
  const { models: aiModels } = useAIModels();
  
  const workflowSteps = useWorkflowSteps({
    defaultToolChoice: settings?.default_tool_choice,
    defaultServiceTier: settings?.default_service_tier,
    defaultTextVerbosity: settings?.default_text_verbosity || undefined,
  });

  const validation = useWorkflowValidation(
    workflowForm.formData,
    workflowSteps.steps,
    workflowForm.templateData,
  );

  const submission = useWorkflowSubmission();
  const generationStatus = useWorkflowGenerationStatus(generationJobId);

  // Computed Values
  const resolvedModel = useMemo<AIModel>(() => {
    const preferred = settings?.default_ai_model;
    if (preferred && aiModels.some((model) => model.id === preferred)) {
      return preferred as AIModel;
    }
    if (aiModels.some((model) => model.id === DEFAULT_AI_MODEL)) {
      return DEFAULT_AI_MODEL;
    }
    return (aiModels[0]?.id || DEFAULT_AI_MODEL) as AIModel;
  }, [aiModels, settings?.default_ai_model]);

  const chatErrors = [wizard.chatSetupError, ideation.error].filter(Boolean) as string[];
  
  const contextItems = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];
    if (wizard.ideationDraft.icp.trim()) items.push({ label: "ICP", value: wizard.ideationDraft.icp });
    if (wizard.ideationDraft.pain.trim()) items.push({ label: "Pain", value: wizard.ideationDraft.pain });
    if (wizard.ideationDraft.outcome.trim()) items.push({ label: "Outcome", value: wizard.ideationDraft.outcome });
    if (wizard.ideationDraft.offer.trim()) items.push({ label: "Offer", value: wizard.ideationDraft.offer });
    if (wizard.ideationDraft.constraints.trim()) items.push({ label: "Constraints", value: wizard.ideationDraft.constraints });
    if (wizard.ideationDraft.examples.trim()) items.push({ label: "Examples", value: wizard.ideationDraft.examples });
    return items;
  }, [wizard.ideationDraft]);

  // Effects
  useEffect(() => {
    if (generationStatus.status === "completed" && generationStatus.workflowId) {
      setStep("form");
    } else if (generationStatus.status === "failed") {
      setError(generationStatus.error || "Workflow generation failed");
      setStep("prompt");
      setGenerationJobId(null);
    }
  }, [generationStatus.status, generationStatus.workflowId, generationStatus.error]);

  // Actions
  const handleSkipWizard = () => {
    wizard.setChatSetupError(null);
    wizard.setIsChatSetupComplete(true);
    const context = contextItems.map((item) => `${item.label}: ${item.value}`).join("\n");
    if (context.trim()) {
      const contextMsg: ChatMessage = {
        id: createChatId(),
        role: "user",
        content: `Here is my context:\n${context}`,
      };
      chat.setChatMessages((prev) => {
        if (prev.some((m) => m.content.includes("Here is my context"))) return prev;
        return [...prev, contextMsg];
      });
    }
  };

  const handleGenerateFromWizard = async () => {
    if (!wizard.hasWizardCore) {
      wizard.setChatSetupError("Please complete the ICP, Pain, and Outcome steps first");
      return;
    }
    wizard.setIsChatSetupComplete(true);

    const context = contextItems.map((item) => `${item.label}: ${item.value}`).join("\n");
    const prompt = `Based on this context:\n${context}\n\nSuggest 3 distinct lead magnet ideas that would work well.`;

    const userMessage: ChatMessage = {
      id: createChatId(),
      role: "user",
      content: prompt,
    };
    const assistantMessage: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      content: "",
    };

    chat.setChatMessages((prev) => [...prev, userMessage, assistantMessage]);

    const requestMessages: WorkflowIdeationMessage[] = [...chat.chatMessages, userMessage];

    const result = await ideation.ideate(requestMessages, resolvedModel, {
      mode: "ideation",
    });

    if (!result) {
      chat.setChatMessages((prev) => prev.filter((message) => message.id !== assistantMessage.id));
      return;
    }

    if (result.assistant_message || (Array.isArray(result.deliverables) && result.deliverables.length > 0)) {
      const assistantContent = result.assistant_message || "Here are a few options to consider.";
      chat.setChatMessages((prev) => {
        return prev.map((message) => {
          if (message.id !== assistantMessage.id) return message;
          const deliverables = Array.isArray(result.deliverables) ? result.deliverables : undefined;
          return {
            ...message,
            content: assistantContent,
            deliverables: deliverables?.length ? deliverables : undefined,
          };
        });
      });
    }
  };

  const handleSendChatMessage = async () => {
    if (!chat.chatInput.trim()) return;

    const selectedDeliverable = chat.chatMessages
      .flatMap((m) => m.deliverables || [])
      .find((d) => d.id === chat.selectedDeliverableId);

    const isFollowup = Boolean(selectedDeliverable);
    const trimmedInput = chat.chatInput.trim();
    const userMessage: ChatMessage = {
      id: createChatId(),
      role: "user",
      content: trimmedInput,
    };
    const assistantMessage: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      content: "",
    };

    chat.setChatMessages((prev) => [...prev, userMessage, assistantMessage]);
    chat.setChatInput("");
    if (!isFollowup) {
      chat.setSelectedDeliverableId(null);
    }

    const result = await ideation.ideate([...chat.chatMessages, userMessage], resolvedModel, {
      mode: isFollowup ? "followup" : "ideation",
      selectedDeliverable: selectedDeliverable
        ? {
            title: selectedDeliverable.title,
            description: selectedDeliverable.description,
            deliverable_type: selectedDeliverable.deliverable_type,
            build_description: selectedDeliverable.build_description,
          }
        : undefined,
    });

    if (!result) {
      chat.setChatMessages((prev) => prev.filter((message) => message.id !== assistantMessage.id));
      return;
    }

    if (result.assistant_message || (!isFollowup && Array.isArray(result.deliverables) && result.deliverables.length > 0)) {
      const assistantContent = result.assistant_message || "Here are a few options to consider.";
      chat.setChatMessages((prev) => {
        return prev.map((message) => {
          if (message.id !== assistantMessage.id) return message;
          const deliverables = !isFollowup && Array.isArray(result.deliverables) ? result.deliverables : undefined;
          return {
            ...message,
            content: assistantContent,
            deliverables: deliverables?.length ? deliverables : undefined,
          };
        });
      });
    }
  };

  const handleGenerateMockups = async () => {
    const selectedDeliverable = chat.chatMessages
      .flatMap((m) => m.deliverables || [])
      .find((d) => d.id === chat.selectedDeliverableId);

    if (!selectedDeliverable) return;
    
    await mockups.generateMockups(selectedDeliverable);
  };

  const handleCreateWorkflow = async () => {
    const selectedDeliverable = chat.chatMessages
      .flatMap((m) => m.deliverables || [])
      .find((d) => d.id === chat.selectedDeliverableId);

    if (!selectedDeliverable) return;

    workflowForm.updateFormData({
      workflow_name: selectedDeliverable.title,
      workflow_description: selectedDeliverable.description,
    });

    setStep("form");
  };

  const handleResetChat = () => {
    chat.resetChat();
    wizard.resetWizard();
    mockups.resetMockups();
  };

  const handleSaveIcpProfile = async () => {
    if (!wizard.hasWizardCore) {
      icp.setIcpProfileError("Please complete ICP, Pain, and Outcome first");
      return;
    }
    if (!icp.icpProfileName.trim()) {
      icp.setIcpProfileError("Please give this profile a name");
      return;
    }

    icp.setIcpProfileError(null);
    try {
      const newProfile: ICPProfile = {
        id: createIcpId(),
        name: icp.icpProfileName.trim(),
        icp: wizard.ideationDraft.icp,
        pain: wizard.ideationDraft.pain,
        outcome: wizard.ideationDraft.outcome,
        offer: wizard.ideationDraft.offer,
        constraints: wizard.ideationDraft.constraints,
        examples: wizard.ideationDraft.examples,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updatedProfiles = [...icp.icpProfiles, newProfile];
      await updateSettings({ icp_profiles: updatedProfiles });
      icp.setIcpProfileName("");
      icp.setSelectedIcpProfileId(newProfile.id);
      await icp.refetchSettings();
    } catch (err: any) {
      icp.setIcpProfileError(err.message || "Failed to save ICP profile");
    }
  };

  const applyIcpProfile = (profile: ICPProfile) => {
    wizard.setIdeationDraft((prev) => ({
      ...prev,
      icp: profile.icp || "",
      pain: profile.pain || "",
      outcome: profile.outcome || "",
      offer: profile.offer || "",
      constraints: profile.constraints || "",
      examples: profile.examples || "",
    }));
    wizard.setChatSetupError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    setError(null);
    const workflow = await submission.submitWorkflow(
      workflowForm.formData,
      workflowSteps.steps,
      workflowForm.templateData,
      workflowForm.formFieldsData,
      generatedTemplateId,
      setGeneratedTemplateId,
      false,
    );

    if (workflow) {
      router.push("/dashboard/workflows");
    }
  };

  return {
    // State
    step, setStep,
    prompt, setPrompt,
    error, setError,
    generationJobId, setGenerationJobId,
    generatedTemplateId, setGeneratedTemplateId,
    
    // Sub-hooks exposed directly
    ...wizard,
    ...chat,
    ...icp,
    ...mockups,
    
    // Computed Overrides/Additions
    chatErrors,
    contextItems,
    isUpdatingSettings,
    
    // Actions
    handleSkipWizard,
    handleGenerateFromWizard,
    handleSendChatMessage,
    handleGenerateMockups,
    handleCreateWorkflow,
    handleResetChat,
    handleSaveIcpProfile,
    applyIcpProfile,
    handleSubmit,
    
    // Hooks & Data
    aiGeneration,
    ideation,
    workflowForm,
    workflowSteps,
    validation,
    submission,
    generationStatus,
    resolvedModel,
  };
}
