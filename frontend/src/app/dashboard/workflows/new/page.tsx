"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiZap,
  FiLayout,
  FiMessageSquare,
} from "react-icons/fi";
import { WorkflowBasicFields } from "@/components/workflows/WorkflowBasicFields";
import { TemplateEditor } from "@/components/workflows/TemplateEditor";
import { FormFieldsEditor } from "@/components/workflows/FormFieldsEditor";
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
  PREVIEW_IMAGE_WIDTH,
  PREVIEW_IMAGE_HEIGHT,
  CHAT_SCROLL_THRESHOLD,
  ChatMessage,
  createChatId,
  createInitialChatMessages,
  createIcpId,
  IdeationDraft,
  IdeationDraftKey,
  DEFAULT_IDEATION_DRAFT,
  IDEATION_STEPS,
} from "./constants";
import { IdeationWizardStep } from "./components/IdeationWizardStep";
import { IdeationReview } from "./components/IdeationReview";
import { ChatInterface } from "./components/ChatInterface";

export default function NewWorkflowPage() {
  const router = useRouter();
  const [step, setStep] = useState<
    "choice" | "prompt" | "chat" | "form" | "creating"
  >("choice");
  const [prompt, setPrompt] = useState("");
  const [generatedTemplateId, setGeneratedTemplateId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [isChatSetupComplete, setIsChatSetupComplete] = useState(false);
  const [chatSetupStep, setChatSetupStep] = useState(0);
  const [ideationDraft, setIdeationDraft] = useState<IdeationDraft>(
    DEFAULT_IDEATION_DRAFT,
  );
  const [chatSetupError, setChatSetupError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    createInitialChatMessages(),
  );
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<
    string | null
  >(null);
  const [mockupImages, setMockupImages] = useState<string[]>([]);
  const [isGeneratingMockups, setIsGeneratingMockups] = useState(false);
  const [mockupError, setMockupError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectedIcpProfileId, setSelectedIcpProfileId] = useState<string>("");
  const [icpProfileName, setIcpProfileName] = useState("");
  const [icpProfileError, setIcpProfileError] = useState<string | null>(null);
  const [isIcpResearching, setIsIcpResearching] = useState(false);
  const [icpResearchError, setIcpResearchError] = useState<string | null>(null);

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
  const wizardProgress =
    totalWizardSteps === 0
      ? 0
      : Math.min(chatSetupStep + 1, totalWizardSteps) / totalWizardSteps;
  const hasWizardCore =
    ideationDraft.icp.trim() &&
    ideationDraft.pain.trim() &&
    ideationDraft.outcome.trim();
  const chatErrors = [chatSetupError, ideation.error].filter(
    Boolean,
  ) as string[];
  const hasUserMessages = chatMessages.some(
    (message) => message.role === "user",
  );
  const icpProfiles = useMemo(
    () =>
      Array.isArray(settings?.icp_profiles) ? settings.icp_profiles : [],
    [settings?.icp_profiles],
  );
  const selectedIcpProfile = useMemo(
    () => icpProfiles.find((profile) => profile.id === selectedIcpProfileId),
    [icpProfiles, selectedIcpProfileId],
  );
  const selectedIcpResearchStatus =
    selectedIcpProfile?.research_status ||
    (selectedIcpProfile?.research_report ? "completed" : undefined);
  const wizardStepValue =
    !isWizardReview && currentWizardStep
      ? ideationDraft[currentWizardStep.key]
      : "";
  const showWizardHint =
    !isWizardReview &&
    currentWizardStep?.hint &&
    wizardStepValue.toLowerCase().includes("not sure");

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

  const summarizeList = useCallback((items?: string[], limit = 6) => {
    if (!items || items.length === 0) return "";
    if (items.length <= limit) return items.join(", ");
    return `${items.slice(0, limit).join(", ")}...`;
  }, []);

  const contextItems = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];
    if (ideationDraft.icp.trim())
      items.push({ label: "ICP", value: ideationDraft.icp });
    if (ideationDraft.pain.trim())
      items.push({ label: "Pain", value: ideationDraft.pain });
    if (ideationDraft.outcome.trim())
      items.push({ label: "Outcome", value: ideationDraft.outcome });
    if (ideationDraft.offer.trim())
      items.push({ label: "Offer", value: ideationDraft.offer });
    if (ideationDraft.constraints.trim())
      items.push({ label: "Constraints", value: ideationDraft.constraints });
    if (ideationDraft.examples.trim())
      items.push({ label: "Examples", value: ideationDraft.examples });
    return items;
  }, [ideationDraft]);

  const handleWizardNext = () => {
    if (isWizardReview) return;
    const currentKey = currentWizardStep.key;
    const currentValue = ideationDraft[currentKey].trim();
    if (!currentValue) {
      // Allow skipping optional fields if needed, but for now enforce input or "Not sure"
      // If user typed nothing, we can block or just let them pass.
      // Let's block empty inputs for core fields (icp, pain, outcome)
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
    // If we have some draft data, inject it as context message
    const context = contextItems
      .map((item) => `${item.label}: ${item.value}`)
      .join("\n");
    if (context.trim()) {
      const contextMsg: ChatMessage = {
        id: createChatId(),
        role: "user",
        content: `Here is my context:\n${context}`,
      };
      // Only add if not already added
      setChatMessages((prev) => {
        if (prev.some((m) => m.content.includes("Here is my context")))
          return prev;
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

    const context = contextItems
      .map((item) => `${item.label}: ${item.value}`)
      .join("\n");
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

    const requestMessages: WorkflowIdeationMessage[] = [
      ...chatMessages,
      userMessage,
    ];

    const result = await ideation.ideate(requestMessages, resolvedModel, {
      mode: "ideation",
    });

    if (!result) {
      setChatMessages((prev) => {
        return prev.filter((message) => message.id !== assistantMessage.id);
      });
      return;
    }

    if (
      result.assistant_message ||
      (Array.isArray(result.deliverables) && result.deliverables.length > 0)
    ) {
      const assistantContent =
        result.assistant_message || "Here are a few options to consider.";
      setChatMessages((prev) => {
        return prev.map((message) => {
          if (message.id !== assistantMessage.id) {
            return message;
          }
          const deliverables = Array.isArray(result.deliverables)
            ? result.deliverables
            : undefined;
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
    if (!chatInput.trim()) {
      return;
    }

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
    const requestMessages: WorkflowIdeationMessage[] = [
      ...chatMessages,
      userMessage,
    ];

    setChatMessages((prev) => [...prev, userMessage, assistantMessage]);
    setChatInput("");
    if (!isFollowup) {
      setSelectedDeliverableId(null);
    }

    const result = await ideation.ideate(requestMessages, resolvedModel, {
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
      setChatMessages((prev) => {
        return prev.filter((message) => message.id !== assistantMessage.id);
      });
      return;
    }

    if (
      result.assistant_message ||
      (!isFollowup &&
        Array.isArray(result.deliverables) &&
        result.deliverables.length > 0)
    ) {
      const assistantContent =
        result.assistant_message || "Here are a few options to consider.";
      setChatMessages((prev) => {
        return prev.map((message) => {
          if (message.id !== assistantMessage.id) {
            return message;
          }
          const deliverables =
            !isFollowup && Array.isArray(result.deliverables)
              ? result.deliverables
              : undefined;
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

    if (!selectedDeliverable || isGeneratingMockups) {
      return;
    }

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

      const urls = (response.images || [])
        .map((image) => image.url)
        .filter(Boolean);
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

  // Handle generation status changes
  useEffect(() => {
    if (
      generationStatus.status === "completed" &&
      generationStatus.workflowId
    ) {
      // Navigation is handled by useWorkflowGenerationStatus hook
      // Just clear the creating state
      setStep("form");
    } else if (generationStatus.status === "failed") {
      setError(generationStatus.error || "Workflow generation failed");
      setStep("prompt");
      setGenerationJobId(null);
    }
  }, [
    generationStatus.status,
    generationStatus.workflowId,
    generationStatus.error,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
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

  const handleCreateWorkflow = async () => {
    const selectedDeliverable = chatMessages
      .flatMap((m) => m.deliverables || [])
      .find((d) => d.id === selectedDeliverableId);

    if (!selectedDeliverable) return;

    // Prefill form with deliverable data
    workflowForm.updateFormData({
      workflow_name: selectedDeliverable.title,
      workflow_description: selectedDeliverable.description,
    });

    // TODO: Map deliverable type to template/steps if possible
    // For now just go to form step
    setStep("form");
  };

  const handleEditWizard = () => {
    setIsChatSetupComplete(false);
    setChatSetupStep(IDEATION_STEPS.length); // Go to review step
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
      await updateSettings({
        icp_profiles: updatedProfiles,
      });
      setIcpProfileName("");
      setSelectedIcpProfileId(newProfile.id);
      // Refetch settings to ensure we have latest state
      await refetchSettings();
    } catch (err: any) {
      setIcpProfileError(err.message || "Failed to save ICP profile");
    }
  };

  const runIcpResearch = async (profileId: string, force = false) => {
    const profile = icpProfiles.find((p) => p.id === profileId);
    if (!profile) return;

    if (
      !force &&
      (profile.research_status === "completed" ||
        profile.research_status === "pending")
    ) {
      return;
    }

    setIsIcpResearching(true);
    setIcpResearchError(null);

    try {
      // Optimistic update
      const updatedProfiles = icpProfiles.map((p) =>
        p.id === profileId
          ? { ...p, research_status: "pending" as const, research_error: undefined }
          : p,
      );
      await updateSettings({ icp_profiles: updatedProfiles });

      // Call API
      const result = await api.settings.generateIcpResearch({
        profile_id: profileId,
        force,
      });

      // Update with result
      const completedProfiles = icpProfiles.map((p) =>
        p.id === profileId ? result.profile : p,
      );
      await updateSettings({ icp_profiles: completedProfiles });
      await refetchSettings();
    } catch (err: any) {
      console.error("ICP Research failed:", err);
      setIcpResearchError(err.message || "Research failed");
      // Revert/update status to failed
      const failedProfiles = icpProfiles.map((p) =>
        p.id === profileId
          ? {
              ...p,
              research_status: "failed" as const,
              research_error: err.message || "Research failed",
            }
          : p,
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

  // Choice Step
  if (step === "choice") {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground mb-4">
            How would you like to start?
          </h1>
          <p className="text-gray-600 dark:text-muted-foreground text-lg">
            Choose how you want to create your new lead magnet workflow
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Generate with AI Card */}
          <button
            onClick={() => setStep("prompt")}
            className="group relative flex flex-col items-center p-8 bg-white dark:bg-card rounded-xl shadow-sm border-2 border-transparent hover:border-purple-500 dark:hover:border-purple-400 transition-all duration-200 hover:shadow-md text-left"
          >
            <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
              <FiZap className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-3">
              Generate with AI
            </h3>
            <p className="text-gray-600 dark:text-muted-foreground text-center mb-6">
              Describe what you want to build, and AI will generate the entire
              workflow, including research steps and email templates.
            </p>
            <span className="text-purple-600 dark:text-purple-400 font-medium group-hover:underline">
              Start with AI &rarr;
            </span>
          </button>

          {/* Chat with AI Card */}
          <button
            onClick={() => setStep("chat")}
            className="group relative flex flex-col items-center p-8 bg-white dark:bg-card rounded-xl shadow-sm border-2 border-transparent hover:border-emerald-500 dark:hover:border-emerald-400 transition-all duration-200 hover:shadow-md text-left"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
              <FiMessageSquare className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-3">
              Chat with AI
            </h3>
            <p className="text-gray-600 dark:text-muted-foreground text-center mb-6">
              Have a conversation, get visual deliverable options, and choose
              what to build.
            </p>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium group-hover:underline">
              Start chat &rarr;
            </span>
          </button>

          {/* Start from Scratch Card */}
          <button
            onClick={() => setStep("form")}
            className="group relative flex flex-col items-center p-8 bg-white dark:bg-card rounded-xl shadow-sm border-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 hover:shadow-md text-left"
          >
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
              <FiLayout className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-3">
              Start from Scratch
            </h3>
            <p className="text-gray-600 dark:text-muted-foreground text-center mb-6">
              Build your workflow manually step-by-step. Perfect for when you
              already know exactly what you need.
            </p>
            <span className="text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
              Build Manually &rarr;
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Creating Step
  if (step === "creating") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
            Creating Your Lead Magnet
          </h1>
          <p className="text-gray-600 dark:text-muted-foreground">
            AI is generating your lead magnet configuration...
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-card rounded-lg shadow p-6 border border-gray-200 dark:border-border">
          <div className="bg-gradient-to-r from-purple-50 dark:from-purple-900/20 to-blue-50 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 dark:border-purple-400"></div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-2">
                  {aiGeneration.generationStatus ||
                    "Creating your lead magnet..."}
                </h3>
                <p className="text-sm text-gray-600 dark:text-muted-foreground">
                  This may take a minute. We&apos;ll automatically take you to
                  the edit page when it&apos;s ready.
                </p>
                {generationJobId && (
                  <p className="text-xs text-gray-500 dark:text-muted-foreground/70 mt-2 font-mono">
                    Job ID: {generationJobId}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chat Step
  if (step === "chat") {
    return (
      <div>
        <div className="mb-8">
          <button
            onClick={() => setStep("choice")}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-muted-foreground dark:hover:text-foreground mb-4 flex items-center gap-1 transition-colors group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">
              ←
            </span>
            Back to options
          </button>
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
              <FiMessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground mb-2">
                Chat to Ideate
              </h1>
              <p className="text-gray-600 dark:text-muted-foreground text-base leading-relaxed">
                Describe your lead magnet idea. We&apos;ll suggest options with
                quick visual previews, help you refine the concept, and then
                build it for you.
              </p>
            </div>
          </div>
        </div>

        {chatErrors.length > 0 && (
          <div className="mb-6 space-y-2">
            {chatErrors.map((message, index) => (
              <div
                key={`${message}-${index}`}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm"
              >
                {message}
              </div>
            ))}
          </div>
        )}

        <div className="bg-white dark:bg-card rounded-lg shadow-lg border border-gray-200 dark:border-border overflow-hidden">
          <div className="space-y-6 p-6">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  ICP Library
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                  {icpProfiles.length} saved
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <select
                  value={selectedIcpProfileId}
                  onChange={(event) => {
                    setSelectedIcpProfileId(event.target.value);
                    setIcpProfileError(null);
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                >
                  <option value="">Select a saved ICP profile</option>
                  {icpProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    selectedIcpProfile && applyIcpProfile(selectedIcpProfile)
                  }
                  disabled={!selectedIcpProfile}
                  className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Use ICP
                </button>
              </div>
              {selectedIcpProfile && (
                <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                  <div>
                    {selectedIcpProfile.icp
                      ? `ICP: ${selectedIcpProfile.icp}`
                      : "ICP profile loaded."}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                      Research
                    </span>
                    {selectedIcpResearchStatus ? (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          selectedIcpResearchStatus === "completed"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : selectedIcpResearchStatus === "failed"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                        }`}
                      >
                        {selectedIcpResearchStatus === "completed"
                          ? "Ready"
                          : selectedIcpResearchStatus === "failed"
                            ? "Failed"
                            : "In progress"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        Not started
                      </span>
                    )}
                    {selectedIcpProfile.research_completed_at && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        Updated{" "}
                        {new Date(
                          selectedIcpProfile.research_completed_at,
                        ).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {selectedIcpProfile.research_report && (
                    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-950/40 p-3 space-y-2">
                      {selectedIcpProfile.research_report.summary && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                            Summary
                          </div>
                          <div className="text-xs text-gray-700 dark:text-gray-200">
                            {selectedIcpProfile.research_report.summary}
                          </div>
                        </div>
                      )}
                      <div className="grid sm:grid-cols-2 gap-2">
                        {selectedIcpProfile.research_report.pains &&
                          selectedIcpProfile.research_report.pains.length >
                            0 && (
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                                Pains
                              </div>
                              <ul className="list-disc list-inside text-xs text-gray-700 dark:text-gray-200 space-y-1">
                                {selectedIcpProfile.research_report.pains
                                  .slice(0, 4)
                                  .map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                              </ul>
                            </div>
                          )}
                        {selectedIcpProfile.research_report.desires &&
                          selectedIcpProfile.research_report.desires.length >
                            0 && (
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                                Desires
                              </div>
                              <ul className="list-disc list-inside text-xs text-gray-700 dark:text-gray-200 space-y-1">
                                {selectedIcpProfile.research_report.desires
                                  .slice(0, 4)
                                  .map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                              </ul>
                            </div>
                          )}
                        {selectedIcpProfile.research_report.wants &&
                          selectedIcpProfile.research_report.wants.length >
                            0 && (
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                                Wants
                              </div>
                              <ul className="list-disc list-inside text-xs text-gray-700 dark:text-gray-200 space-y-1">
                                {selectedIcpProfile.research_report.wants
                                  .slice(0, 4)
                                  .map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                              </ul>
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                  {selectedIcpProfile.research_error && (
                    <div className="text-xs text-red-600 dark:text-red-400">
                      {selectedIcpProfile.research_error}
                    </div>
                  )}
                  {icpResearchError && (
                    <div className="text-xs text-red-600 dark:text-red-400">
                      {icpResearchError}
                    </div>
                  )}
                  {selectedIcpProfile && (
                    <button
                      type="button"
                      onClick={() =>
                        runIcpResearch(selectedIcpProfile.id, true)
                      }
                      disabled={
                        isIcpResearching ||
                        selectedIcpResearchStatus === "pending"
                      }
                      className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {selectedIcpResearchStatus === "pending" ||
                      isIcpResearching
                        ? "Running deep research..."
                        : "Run deep research"}
                    </button>
                  )}
                </div>
              )}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Save current ICP
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    value={icpProfileName}
                    onChange={(event) => setIcpProfileName(event.target.value)}
                    placeholder="e.g., Creator Ops Consultants"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveIcpProfile}
                    disabled={
                      !hasWizardCore || isUpdatingSettings || isIcpResearching
                    }
                    className="px-4 py-2 text-sm rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdatingSettings
                      ? "Saving..."
                      : isIcpResearching
                        ? "Researching..."
                        : "Save ICP"}
                  </button>
                </div>
                {!hasWizardCore && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Complete ICP, pain, and outcome before saving.
                  </div>
                )}
                {icpProfileError && (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {icpProfileError}
                  </div>
                )}
              </div>
            </div>
            {!isChatSetupComplete ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      {isWizardReview
                        ? "Review"
                        : `Step ${Math.min(chatSetupStep + 1, totalWizardSteps)} of ${totalWizardSteps}`}
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">
                      {isWizardReview
                        ? "Review your inputs"
                        : currentWizardStep?.title}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground">
                      {isWizardReview
                        ? "Make sure the context is accurate. You can edit any field before generating options."
                        : currentWizardStep?.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSkipWizard}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-foreground hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
                  >
                    Skip to chat
                  </button>
                </div>

                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.round(wizardProgress * 100)}%` }}
                  />
                </div>

                {!isWizardReview ? (
                  <IdeationWizardStep
                    stepConfig={currentWizardStep}
                    value={wizardStepValue}
                    onChange={(val) =>
                      updateDraftField(currentWizardStep.key, val)
                    }
                    onAppend={(val) =>
                      appendDraftValue(currentWizardStep.key, val)
                    }
                    onPreset={(val) =>
                      setDraftPreset(currentWizardStep.key, val)
                    }
                    onNext={handleWizardNext}
                    onBack={handleWizardBack}
                    isFirstStep={chatSetupStep === 0}
                    isLastStep={chatSetupStep + 1 >= totalWizardSteps}
                    showHint={showWizardHint || false}
                  />
                ) : (
                  <IdeationReview
                    draft={ideationDraft}
                    onEditStep={(index) => {
                      setChatSetupStep(index);
                      setChatSetupError(null);
                    }}
                    onBack={handleWizardBack}
                    onSkip={handleSkipWizard}
                    onGenerate={handleGenerateFromWizard}
                    isGenerating={ideation.isIdeating}
                  />
                )}
              </div>
            ) : (
              <ChatInterface
                chatMessages={chatMessages}
                chatInput={chatInput}
                setChatInput={setChatInput}
                handleSendChatMessage={handleSendChatMessage}
                isIdeating={ideation.isIdeating}
                selectedDeliverableId={selectedDeliverableId}
                setSelectedDeliverableId={setSelectedDeliverableId}
                mockupImages={mockupImages}
                isGeneratingMockups={isGeneratingMockups}
                mockupError={mockupError}
                handleGenerateMockups={handleGenerateMockups}
                handleCreateWorkflow={handleCreateWorkflow}
                chatScrollRef={chatScrollRef}
                chatInputRef={chatInputRef}
                applyStarterPrompt={applyStarterPrompt}
                contextItems={contextItems}
                handleEditWizard={handleEditWizard}
                handleResetChat={handleResetChat}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Prompt Step (Generate with AI)
  if (step === "prompt") {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => setStep("choice")}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-muted-foreground dark:hover:text-foreground mb-4 flex items-center gap-1 transition-colors group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">
              ←
            </span>
            Back to options
          </button>
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
              <FiZap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground mb-2">
                Describe Your Lead Magnet
              </h1>
              <p className="text-gray-600 dark:text-muted-foreground text-base leading-relaxed">
                Tell us what you want to build. We&apos;ll generate the structure,
                content, and configuration for you.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-card rounded-lg shadow-lg border border-gray-200 dark:border-border overflow-hidden">
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <label
                htmlFor="prompt"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                What do you want to create?
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., I want a 5-day email course on how to launch a podcast, targeting busy professionals..."
                rows={6}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-0 text-gray-900 dark:text-foreground bg-white dark:bg-gray-900 placeholder-gray-400 dark:placeholder-gray-500 transition-colors resize-none text-base"
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-muted-foreground">
                Be specific about your audience and the goal of the lead magnet.
              </p>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={async () => {
                  if (!prompt.trim()) {
                    setError("Please describe what you want to build");
                    return;
                  }
                  setError(null);
                  setStep("creating");

                  try {
                    const result = await aiGeneration.generateWorkflow(
                      prompt,
                      resolvedModel,
                    );
                    if (result?.jobId) {
                      setGenerationJobId(result.jobId);
                    } else if (result?.workflow) {
                      // Direct result (legacy or fast path)
                      workflowForm.updateFormData({
                        workflow_name: result.workflow.workflow_name || "",
                        workflow_description: result.workflow.workflow_description || "",
                      });
                      workflowSteps.setSteps(result.workflow.steps);
                      if (result.workflow.templateData) {
                        workflowForm.updateTemplateData(
                          result.workflow.templateData,
                          undefined,
                        );
                      }
                      setStep("form");
                    }
                  } catch (err: any) {
                    setError(err.message || "Failed to generate workflow");
                    setStep("prompt");
                  }
                }}
                disabled={!prompt.trim() || aiGeneration.isGenerating}
                className="px-8 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                {aiGeneration.isGenerating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FiZap className="w-5 h-5" />
                    Generate Workflow
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Form Step (Manual or Edit after AI)
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => setStep("choice")}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-muted-foreground dark:hover:text-foreground mb-4 flex items-center gap-1 transition-colors group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">
            ←
          </span>
          Start Over
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground">
              {workflowForm.formData.workflow_name || "New Workflow"}
            </h1>
            <p className="text-gray-600 dark:text-muted-foreground mt-1">
              Configure your lead magnet workflow details
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submission.isSubmitting || !validation.valid}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {submission.isSubmitting ? "Creating..." : "Create Workflow"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-8">
        <section className="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-border bg-gray-50/50 dark:bg-gray-900/50">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">
              Basic Information
            </h2>
            <p className="text-sm text-gray-500 dark:text-muted-foreground">
              General settings for your workflow
            </p>
          </div>
          <div className="p-6">
            <WorkflowBasicFields
              formData={workflowForm.formData}
              onChange={workflowForm.updateFormData}
            />
          </div>
        </section>

        <section className="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-border bg-gray-50/50 dark:bg-gray-900/50">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">
              Input Form
            </h2>
            <p className="text-sm text-gray-500 dark:text-muted-foreground">
              Define the fields users need to fill out
            </p>
          </div>
          <div className="p-6">
            <FormFieldsEditor
              formFieldsData={workflowForm.formFieldsData}
              onChange={workflowForm.updateFormFieldsData}
              onFieldChange={workflowForm.updateFormField}
              onAddField={workflowForm.addFormField}
              onRemoveField={workflowForm.removeFormField}
            />
          </div>
        </section>

        <section className="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-border bg-gray-50/50 dark:bg-gray-900/50">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">
              Content Template
            </h2>
            <p className="text-sm text-gray-500 dark:text-muted-foreground">
              Design the content generated by this workflow
            </p>
          </div>
          <div className="p-6">
            <TemplateEditor
              templateData={workflowForm.templateData}
              onChange={workflowForm.updateTemplateData}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
