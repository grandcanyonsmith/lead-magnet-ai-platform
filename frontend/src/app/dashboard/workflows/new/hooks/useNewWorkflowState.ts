import { useState, useRef, useMemo, useCallback, useEffect } from "react";
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
import { api } from "@/lib/api";
import {
  AIModel,
  ICPProfile,
  WorkflowIdeationMessage,
} from "@/types";
import { DEFAULT_AI_MODEL } from "@/constants/models";
import {
  ChatMessage,
  createChatId,
  createInitialChatMessages,
  createIcpId,
  IdeationDraft,
  IdeationDraftKey,
  DEFAULT_IDEATION_DRAFT,
  IDEATION_STEPS,
} from "../constants";

export type WizardStep = "choice" | "prompt" | "chat" | "form" | "creating";

export function useNewWorkflowState() {
  const router = useRouter();
  
  // UI State
  const [step, setStep] = useState<WizardStep>("choice");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // Generation State
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [generatedTemplateId, setGeneratedTemplateId] = useState<string | null>(null);
  
  // Chat & Ideation State
  const [chatInput, setChatInput] = useState("");
  const [isChatSetupComplete, setIsChatSetupComplete] = useState(false);
  const [chatSetupStep, setChatSetupStep] = useState(0);
  const [ideationDraft, setIdeationDraft] = useState<IdeationDraft>(DEFAULT_IDEATION_DRAFT);
  const [chatSetupError, setChatSetupError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => createInitialChatMessages());
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string | null>(null);
  
  // Mockups State
  const [mockupImages, setMockupImages] = useState<string[]>([]);
  const [isGeneratingMockups, setIsGeneratingMockups] = useState(false);
  const [mockupError, setMockupError] = useState<string | null>(null);
  
  // ICP State
  const [selectedIcpProfileId, setSelectedIcpProfileId] = useState<string>("");
  const [icpProfileName, setIcpProfileName] = useState("");
  const [icpProfileError, setIcpProfileError] = useState<string | null>(null);
  const [isIcpResearching, setIsIcpResearching] = useState(false);
  const [icpResearchError, setIcpResearchError] = useState<string | null>(null);

  // Refs
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Hooks
  const aiGeneration = useAIGeneration();
  const ideation = useWorkflowIdeation();
  const workflowForm = useWorkflowForm();
  const { settings, refetch: refetchSettings } = useSettings();
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

  const totalWizardSteps = IDEATION_STEPS.length;
  const isWizardReview = chatSetupStep >= totalWizardSteps;
  const currentWizardStep = IDEATION_STEPS[chatSetupStep];
  const wizardProgress = totalWizardSteps === 0 ? 0 : Math.min(chatSetupStep + 1, totalWizardSteps) / totalWizardSteps;
  
  const hasWizardCore = Boolean(ideationDraft.icp.trim() && ideationDraft.pain.trim() && ideationDraft.outcome.trim());
  
  const chatErrors = [chatSetupError, ideation.error].filter(Boolean) as string[];
  
  const icpProfiles = useMemo(() => 
    Array.isArray(settings?.icp_profiles) ? settings.icp_profiles : [], 
    [settings?.icp_profiles]
  );
  
  const selectedIcpProfile = useMemo(() => 
    icpProfiles.find((profile) => profile.id === selectedIcpProfileId),
    [icpProfiles, selectedIcpProfileId]
  );
  
  const selectedIcpResearchStatus = selectedIcpProfile?.research_status || 
    (selectedIcpProfile?.research_report ? "completed" : undefined);

  const wizardStepValue = !isWizardReview && currentWizardStep ? ideationDraft[currentWizardStep.key] : "";
  
  const showWizardHint = Boolean(!isWizardReview && currentWizardStep?.hint && wizardStepValue.toLowerCase().includes("not sure"));

  const contextItems = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];
    if (ideationDraft.icp.trim()) items.push({ label: "ICP", value: ideationDraft.icp });
    if (ideationDraft.pain.trim()) items.push({ label: "Pain", value: ideationDraft.pain });
    if (ideationDraft.outcome.trim()) items.push({ label: "Outcome", value: ideationDraft.outcome });
    if (ideationDraft.offer.trim()) items.push({ label: "Offer", value: ideationDraft.offer });
    if (ideationDraft.constraints.trim()) items.push({ label: "Constraints", value: ideationDraft.constraints });
    if (ideationDraft.examples.trim()) items.push({ label: "Examples", value: ideationDraft.examples });
    return items;
  }, [ideationDraft]);

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

  const focusChatInput = () => {
    requestAnimationFrame(() => {
      chatInputRef.current?.focus();
    });
  };

  const applyChatSuggestion = (value: string) => {
    setChatInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return value;
      if (trimmed.endsWith(value)) return trimmed;
      return `${trimmed} ${value}`;
    });
    focusChatInput();
  };

  const applyStarterPrompt = (value: string) => {
    setChatInput(value);
    focusChatInput();
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

  const handleSkipWizard = () => {
    setChatSetupError(null);
    setIsChatSetupComplete(true);
    const context = contextItems.map((item) => `${item.label}: ${item.value}`).join("\n");
    if (context.trim()) {
      const contextMsg: ChatMessage = {
        id: createChatId(),
        role: "user",
        content: `Here is my context:\n${context}`,
      };
      setChatMessages((prev) => {
        if (prev.some((m) => m.content.includes("Here is my context"))) return prev;
        return [...prev, contextMsg];
      });
    }
  };

  const handleGenerateFromWizard = async () => {
    if (!hasWizardCore) {
      setChatSetupError("Please complete the ICP, Pain, and Outcome steps first");
      return;
    }
    setIsChatSetupComplete(true);

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

    setChatMessages((prev) => [...prev, userMessage, assistantMessage]);

    const requestMessages: WorkflowIdeationMessage[] = [...chatMessages, userMessage];

    const result = await ideation.ideate(requestMessages, resolvedModel, {
      mode: "ideation",
    });

    if (!result) {
      setChatMessages((prev) => prev.filter((message) => message.id !== assistantMessage.id));
      return;
    }

    if (result.assistant_message || (Array.isArray(result.deliverables) && result.deliverables.length > 0)) {
      const assistantContent = result.assistant_message || "Here are a few options to consider.";
      setChatMessages((prev) => {
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
    if (!chatInput.trim()) return;

    const selectedDeliverable = chatMessages
      .flatMap((m) => m.deliverables || [])
      .find((d) => d.id === selectedDeliverableId);

    const isFollowup = Boolean(selectedDeliverable);
    const trimmedInput = chatInput.trim();
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

    setChatMessages((prev) => [...prev, userMessage, assistantMessage]);
    setChatInput("");
    if (!isFollowup) {
      setSelectedDeliverableId(null);
    }

    const result = await ideation.ideate([...chatMessages, userMessage], resolvedModel, {
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
      setChatMessages((prev) => prev.filter((message) => message.id !== assistantMessage.id));
      return;
    }

    if (result.assistant_message || (!isFollowup && Array.isArray(result.deliverables) && result.deliverables.length > 0)) {
      const assistantContent = result.assistant_message || "Here are a few options to consider.";
      setChatMessages((prev) => {
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
    const selectedDeliverable = chatMessages
      .flatMap((m) => m.deliverables || [])
      .find((d) => d.id === selectedDeliverableId);

    if (!selectedDeliverable || isGeneratingMockups) return;

    setIsGeneratingMockups(true);
    setMockupError(null);
    setMockupImages([]);

    try {
      const response = await api.generateDeliverableMockups({
        deliverable: {
          title: selectedDeliverable.title,
          description: selectedDeliverable.description,
          deliverable_type: selectedDeliverable.deliverable_type,
          build_description: selectedDeliverable.build_description,
        },
        count: 4,
      });

      const urls = (response.images || []).map((image) => image.url).filter(Boolean);
      if (urls.length === 0) {
        setMockupError("No mockups returned. Try again in a moment.");
        return;
      }
      setMockupImages(urls);
    } catch (err: any) {
      setMockupError(err.message || "Failed to generate mockups");
    } finally {
      setIsGeneratingMockups(false);
    }
  };

  const handleCreateWorkflow = async () => {
    const selectedDeliverable = chatMessages
      .flatMap((m) => m.deliverables || [])
      .find((d) => d.id === selectedDeliverableId);

    if (!selectedDeliverable) return;

    workflowForm.updateFormData({
      workflow_name: selectedDeliverable.title,
      workflow_description: selectedDeliverable.description,
    });

    setStep("form");
  };

  const handleEditWizard = () => {
    setIsChatSetupComplete(false);
    setChatSetupStep(IDEATION_STEPS.length);
  };

  const handleResetChat = () => {
    setChatMessages(createInitialChatMessages());
    setIdeationDraft(DEFAULT_IDEATION_DRAFT);
    setChatSetupStep(0);
    setIsChatSetupComplete(false);
    setSelectedDeliverableId(null);
    setMockupImages([]);
  };

  const handleSaveIcpProfile = async () => {
    if (!hasWizardCore) {
      setIcpProfileError("Please complete ICP, Pain, and Outcome first");
      return;
    }
    if (!icpProfileName.trim()) {
      setIcpProfileError("Please give this profile a name");
      return;
    }

    setIcpProfileError(null);
    try {
      const newProfile: ICPProfile = {
        id: createIcpId(),
        name: icpProfileName.trim(),
        icp: ideationDraft.icp,
        pain: ideationDraft.pain,
        outcome: ideationDraft.outcome,
        offer: ideationDraft.offer,
        constraints: ideationDraft.constraints,
        examples: ideationDraft.examples,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updatedProfiles = [...icpProfiles, newProfile];
      await updateSettings({ icp_profiles: updatedProfiles });
      setIcpProfileName("");
      setSelectedIcpProfileId(newProfile.id);
      await refetchSettings();
    } catch (err: any) {
      setIcpProfileError(err.message || "Failed to save ICP profile");
    }
  };

  const runIcpResearch = async (profileId: string, force = false) => {
    const profile = icpProfiles.find((p) => p.id === profileId);
    if (!profile) return;

    if (!force && (profile.research_status === "completed" || profile.research_status === "pending")) {
      return;
    }

    setIsIcpResearching(true);
    setIcpResearchError(null);

    try {
      const updatedProfiles = icpProfiles.map((p) =>
        p.id === profileId ? { ...p, research_status: "pending" as const, research_error: undefined } : p
      );
      await updateSettings({ icp_profiles: updatedProfiles });

      const result = await api.settings.generateIcpResearch({ profile_id: profileId, force });

      const completedProfiles = icpProfiles.map((p) => (p.id === profileId ? result.profile : p));
      await updateSettings({ icp_profiles: completedProfiles });
      await refetchSettings();
    } catch (err: any) {
      setIcpResearchError(err.message || "Research failed");
      const failedProfiles = icpProfiles.map((p) =>
        p.id === profileId
          ? { ...p, research_status: "failed" as const, research_error: err.message || "Research failed" }
          : p
      );
      await updateSettings({ icp_profiles: failedProfiles });
    } finally {
      setIsIcpResearching(false);
    }
  };

  const applyIcpProfile = (profile: ICPProfile) => {
    setIdeationDraft((prev) => ({
      ...prev,
      icp: profile.icp || "",
      pain: profile.pain || "",
      outcome: profile.outcome || "",
      offer: profile.offer || "",
      constraints: profile.constraints || "",
      examples: profile.examples || "",
    }));
    setChatSetupError(null);
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
    chatInput, setChatInput,
    isChatSetupComplete, setIsChatSetupComplete,
    chatSetupStep, setChatSetupStep,
    ideationDraft, setIdeationDraft,
    chatSetupError, setChatSetupError,
    chatMessages, setChatMessages,
    selectedDeliverableId, setSelectedDeliverableId,
    mockupImages, setMockupImages,
    isGeneratingMockups, setIsGeneratingMockups,
    mockupError, setMockupError,
    selectedIcpProfileId, setSelectedIcpProfileId,
    icpProfileName, setIcpProfileName,
    icpProfileError, setIcpProfileError,
    isIcpResearching, setIsIcpResearching,
    icpResearchError, setIcpResearchError,
    
    // Refs
    chatScrollRef,
    chatInputRef,
    
    // Hooks & Data
    aiGeneration,
    ideation,
    workflowForm,
    workflowSteps,
    validation,
    submission,
    generationStatus,
    resolvedModel,
    icpProfiles,
    selectedIcpProfile,
    
    // Computed
    totalWizardSteps,
    isWizardReview,
    currentWizardStep,
    wizardProgress,
    hasWizardCore,
    chatErrors,
    selectedIcpResearchStatus,
    wizardStepValue,
    showWizardHint,
    contextItems,
    isUpdatingSettings,
    
    // Actions
    updateDraftField,
    appendDraftValue,
    setDraftPreset,
    focusChatInput,
    applyChatSuggestion,
    applyStarterPrompt,
    handleWizardNext,
    handleWizardBack,
    handleSkipWizard,
    handleGenerateFromWizard,
    handleSendChatMessage,
    handleGenerateMockups,
    handleCreateWorkflow,
    handleEditWizard,
    handleResetChat,
    handleSaveIcpProfile,
    runIcpResearch,
    applyIcpProfile,
    handleSubmit,
  };
}
