"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FiSave,
  FiZap,
  FiPlus,
  FiLayout,
  FiMessageSquare,
} from "react-icons/fi";
import WorkflowStepEditor from "../components/WorkflowStepEditor";
import { WorkflowBasicFields } from "@/components/workflows/WorkflowBasicFields";
import { TemplateEditor } from "@/components/workflows/TemplateEditor";
import { FormFieldsEditor } from "@/components/workflows/FormFieldsEditor";
import { useAIGeneration } from "@/hooks/useAIGeneration";
import { useWorkflowForm } from "@/hooks/useWorkflowForm";
import { useWorkflowSteps } from "@/hooks/useWorkflowSteps";
import { useWorkflowValidation } from "@/hooks/useWorkflowValidation";
import { useWorkflowSubmission } from "@/hooks/useWorkflowSubmission";
import { useWorkflowGenerationStatus } from "@/hooks/useWorkflowGenerationStatus";
import { useSettings } from "@/hooks/api/useSettings";
import { useWorkflowIdeation } from "@/hooks/useWorkflowIdeation";
import {
  AIModel,
  WorkflowIdeationDeliverable,
  WorkflowIdeationMessage,
} from "@/types";
import { AI_MODELS, DEFAULT_AI_MODEL } from "@/constants/models";

const isAIModel = (value?: string): value is AIModel =>
  !!value && AI_MODELS.some((model) => model.value === value);

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
  const [chatMessages, setChatMessages] = useState<WorkflowIdeationMessage[]>([
    {
      role: "assistant",
      content:
        "Tell me what you want to build. I will suggest a few lead magnet ideas with visuals.",
    },
  ]);
  const [chatDeliverables, setChatDeliverables] = useState<
    WorkflowIdeationDeliverable[]
  >([]);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<
    string | null
  >(null);

  // Hooks
  const aiGeneration = useAIGeneration();
  const ideation = useWorkflowIdeation();
  const workflowForm = useWorkflowForm();
  const { settings } = useSettings();
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
  const resolvedModel = isAIModel(settings?.default_ai_model)
    ? settings.default_ai_model
    : DEFAULT_AI_MODEL;
  // Handle AI generation result
  useEffect(() => {
    if (aiGeneration.result) {
      const result = aiGeneration.result;

      // Populate form data
      workflowForm.populateFromAIGeneration(result);

      // Populate steps
      if (
        result.workflow?.steps &&
        Array.isArray(result.workflow.steps) &&
        result.workflow.steps.length > 0
      ) {
        workflowSteps.setStepsFromAIGeneration(result.workflow.steps);
      } else if (result.workflow?.research_instructions) {
        workflowSteps.updateFirstStepInstructions(
          result.workflow.research_instructions,
        );
      }

      // Move to form step
      setStep("form");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiGeneration.result]);

  // Set error from hooks
  useEffect(() => {
    if (aiGeneration.error) {
      setError(aiGeneration.error);
    }
    if (submission.error) {
      setError(submission.error);
    }
  }, [aiGeneration.error, submission.error]);

  const startGeneration = async (description: string) => {
    if (!description.trim()) {
      setError("Please describe what you want to build a lead magnet for");
      return;
    }

    setError(null);
    setStep("creating");
    const result = await aiGeneration.generateWorkflow(
      description.trim(),
      resolvedModel,
    );

    if (result && result.job_id) {
      // Store job_id for status tracking
      setGenerationJobId(result.job_id);
    } else if (result) {
      // Fallback: synchronous result (legacy behavior)
      // Auto-save will be handled by useEffect
      aiGeneration.generationStatus &&
        setTimeout(() => {
          // Status will be cleared by hook
        }, 5000);
    }
  };

  const handleGenerateWithAI = async () => {
    await startGeneration(prompt);
  };

  const selectedDeliverable = chatDeliverables.find(
    (deliverable) => deliverable.id === selectedDeliverableId,
  );

  const handleGenerateFromChat = async () => {
    if (!selectedDeliverable) {
      return;
    }
    setPrompt(selectedDeliverable.build_description);
    await startGeneration(selectedDeliverable.build_description);
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) {
      return;
    }

    const nextMessages: WorkflowIdeationMessage[] = [
      ...chatMessages,
      { role: "user", content: chatInput.trim() },
    ];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatDeliverables([]);
    setSelectedDeliverableId(null);

    const result = await ideation.ideate(
      nextMessages,
      resolvedModel,
    );

    if (result) {
      setChatMessages([
        ...nextMessages,
        { role: "assistant", content: result.assistant_message },
      ]);
      setChatDeliverables(result.deliverables || []);
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
        <div className="mb-6">
          <button
            onClick={() => setStep("choice")}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-muted-foreground dark:hover:text-foreground mb-2 flex items-center"
          >
            ← Back to options
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
            Chat to Ideate
          </h1>
          <p className="text-gray-600 dark:text-muted-foreground">
            Tell us what you want to build. We will suggest deliverables with
            visuals and let you pick one to build.
          </p>
        </div>

        {ideation.error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
            {ideation.error}
          </div>
        )}

        <div className="bg-white dark:bg-card rounded-lg shadow p-6 border border-gray-200 dark:border-border">
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 dark:border-border bg-muted/10 p-4 max-h-[360px] overflow-y-auto space-y-4">
              {chatMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                      message.role === "user"
                        ? "bg-primary-600 dark:bg-primary text-white"
                        : "bg-white dark:bg-secondary text-gray-900 dark:text-foreground border border-gray-200 dark:border-border"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {ideation.isIdeating && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg px-4 py-3 text-sm bg-white dark:bg-secondary text-gray-900 dark:text-foreground border border-gray-200 dark:border-border">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 dark:border-purple-400"></div>
                      <span>Thinking through options...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 disabled:bg-gray-100 dark:disabled:bg-secondary disabled:cursor-not-allowed"
                placeholder="Describe the lead magnet you want to build..."
                rows={4}
                disabled={ideation.isIdeating}
              />

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSendChatMessage}
                  disabled={ideation.isIdeating || !chatInput.trim()}
                  className="flex items-center justify-center px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {ideation.isIdeating ? "Sending..." : "Send"}
                </button>

                <button
                  type="button"
                  onClick={handleGenerateFromChat}
                  disabled={
                    ideation.isIdeating ||
                    aiGeneration.isGenerating ||
                    !selectedDeliverable
                  }
                  className="flex items-center justify-center px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-500 dark:to-blue-500 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 dark:hover:from-purple-600 dark:hover:to-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiZap className="w-4 h-4 mr-2" />
                  Agree &amp; Build
                </button>

                {selectedDeliverable && (
                  <span className="text-sm text-gray-600 dark:text-muted-foreground">
                    Selected: {selectedDeliverable.title}
                  </span>
                )}
              </div>
            </div>
          </div>

          {chatDeliverables.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">
                  Suggested Deliverables
                </h3>
                <span className="text-xs text-gray-500 dark:text-muted-foreground">
                  {chatDeliverables.length} options
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {chatDeliverables.map((deliverable) => {
                  const isSelected =
                    deliverable.id === selectedDeliverableId;
                  return (
                    <button
                      key={deliverable.id}
                      type="button"
                      onClick={() => setSelectedDeliverableId(deliverable.id)}
                      className={`text-left rounded-lg border p-3 transition-all ${
                        isSelected
                          ? "border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900/40"
                          : "border-gray-200 dark:border-border hover:border-emerald-300"
                      }`}
                    >
                      <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-muted/30 border border-gray-200 dark:border-border">
                        {deliverable.image_url ? (
                          <Image
                            src={deliverable.image_url}
                            alt={deliverable.title}
                            fill
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-gray-500 dark:text-muted-foreground">
                            Image unavailable
                          </div>
                        )}
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-foreground">
                            {deliverable.title}
                          </h4>
                          {isSelected && (
                            <span className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-semibold">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-muted-foreground">
                          {deliverable.description}
                        </p>
                        <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-muted-foreground">
                          {deliverable.deliverable_type}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Prompt Step
  if (step === "prompt") {
    return (
      <div>
        <div className="mb-6">
          <button
            onClick={() => setStep("choice")}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-muted-foreground dark:hover:text-foreground mb-2 flex items-center"
          >
            ← Back to options
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
            Create Lead Magnet
          </h1>
          <p className="text-gray-600 dark:text-muted-foreground">
            Describe what you want to build, and AI will generate everything for
            you
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-card rounded-lg shadow p-6 border border-gray-200 dark:border-border">
          <div className="bg-gradient-to-r from-purple-50 dark:from-purple-900/20 to-blue-50 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-2 flex items-center">
              <FiZap
                className={`w-5 h-5 mr-2 text-purple-600 dark:text-purple-400 ${aiGeneration.isGenerating ? "animate-pulse" : ""}`}
              />
              What do you want to build?
            </h3>
            <p className="text-sm text-gray-600 dark:text-muted-foreground mb-4">
              Describe your lead magnet idea. AI will generate the name,
              description, research instructions, and template HTML for you.
            </p>

            <div className="space-y-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 disabled:bg-gray-100 dark:disabled:bg-secondary disabled:cursor-not-allowed"
                placeholder="e.g., A course idea validator that analyzes market demand, competition, target audience, and provides actionable recommendations for course creators..."
                rows={6}
                disabled={aiGeneration.isGenerating}
              />

              {aiGeneration.generationStatus && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400 mr-3"></div>
                  <span className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                    {aiGeneration.generationStatus}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={aiGeneration.isGenerating || !prompt.trim()}
                className="flex items-center justify-center px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-500 dark:to-blue-500 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 dark:hover:from-purple-600 dark:hover:to-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                {aiGeneration.isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <FiZap className="w-5 h-5 mr-2" />
                    <span>Generate Lead Magnet</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Form Step - Show all generated fields
  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => setStep("choice")}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-muted-foreground dark:hover:text-foreground mb-2 flex items-center"
        >
          ← Back to options
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
          Create Lead Magnet
        </h1>
        <p className="text-gray-600 dark:text-muted-foreground">
          Review and edit the {workflowForm.formData.workflow_name ? "generated" : "new"} configuration
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {aiGeneration.generationStatus && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg">
          {aiGeneration.generationStatus}
        </div>
      )}

      {/* Info Box */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
          How it works
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
          This tool will generate a personalized report for your leads.
        </p>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
          <li>
            <strong>Research + Design:</strong> AI gathers data and creates a
            beautiful report.
          </li>
          <li>
            <strong>Research Only:</strong> AI generates a text-based report.
          </li>
          <li>
            <strong>Design Only:</strong> AI formats your inputs into a design.
          </li>
        </ul>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-card rounded-lg shadow p-6 space-y-6 border border-gray-200 dark:border-border"
        data-tour="workflow-form"
      >
        {/* Workflow Basic Fields */}
        <WorkflowBasicFields
          formData={workflowForm.formData}
          onChange={workflowForm.updateFormData}
        />

        {/* Workflow Steps */}
        <div
          className="space-y-4 pt-6 border-t border-gray-200 dark:border-border"
          data-tour="workflow-steps"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground">
              AI Instructions
            </h2>
            <button
              type="button"
              onClick={workflowSteps.addStep}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 dark:bg-primary text-white dark:text-primary-foreground rounded-lg hover:bg-primary-700 dark:hover:bg-primary/90 transition-colors touch-target"
            >
              <FiPlus className="w-4 h-4" />
              Add Instruction
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-muted-foreground mb-4">
            Tell the AI what to do. Each instruction builds on the previous one.
          </p>

          <div className="space-y-4">
            {workflowSteps.steps.map((step, index) => (
              <WorkflowStepEditor
                key={index}
                step={step}
                index={index}
                totalSteps={workflowSteps.steps.length}
                allSteps={workflowSteps.steps}
                onChange={workflowSteps.updateStep}
                onDelete={workflowSteps.deleteStep}
                onMoveUp={workflowSteps.moveStepUp}
                onMoveDown={workflowSteps.moveStepDown}
              />
            ))}
          </div>
        </div>

        {/* Template Editor */}
        {(workflowForm.formData.template_id ||
          workflowForm.templateData.html_content.trim() ||
          true) && ( // Always show template editor in manual mode
          <TemplateEditor
            templateData={workflowForm.templateData}
            onChange={workflowForm.updateTemplateData}
          />
        )}

        {/* Form Fields Editor */}
        <FormFieldsEditor
          formFieldsData={workflowForm.formFieldsData}
          onChange={workflowForm.updateFormFieldsData}
          onFieldChange={workflowForm.updateFormField}
          onAddField={workflowForm.addFormField}
          onRemoveField={workflowForm.removeFormField}
        />

        <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-border">
          <button
            type="submit"
            disabled={submission.isSubmitting}
            className="flex items-center px-6 py-2 bg-primary-600 dark:bg-primary text-white dark:text-primary-foreground rounded-lg hover:bg-primary-700 dark:hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-tour="create-workflow-button"
          >
            <FiSave className="w-5 h-5 mr-2" />
            {submission.isSubmitting ? "Creating..." : "Create Lead Magnet"}
          </button>
        </div>
      </form>
    </div>
  );
}
