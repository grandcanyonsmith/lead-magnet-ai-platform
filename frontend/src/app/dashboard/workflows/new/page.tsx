"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  FiSave,
  FiZap,
  FiPlus,
  FiLayout,
  FiMessageSquare,
  FiImage,
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
import { useSettings, useUpdateSettings } from "@/hooks/api/useSettings";
import { useWorkflowIdeation } from "@/hooks/useWorkflowIdeation";
import { api } from "@/lib/api";
import {
  AIModel,
  ICPProfile,
  WorkflowIdeationDeliverable,
  WorkflowIdeationMessage,
} from "@/types";
import { AI_MODELS, DEFAULT_AI_MODEL } from "@/constants/models";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

const isAIModel = (value?: string): value is AIModel =>
  !!value && AI_MODELS.some((model) => model.value === value);

const PREVIEW_IMAGE_WIDTH = 1024;
const PREVIEW_IMAGE_HEIGHT = 768;
const buildPreviewFallbackUrl = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${PREVIEW_IMAGE_WIDTH}/${PREVIEW_IMAGE_HEIGHT}`;
const CHAT_SCROLL_THRESHOLD = 120;

type ChatMessage = WorkflowIdeationMessage & {
  id: string;
  deliverables?: WorkflowIdeationDeliverable[];
};

const createChatId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createIcpId = () =>
  `icp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

type IdeationDraft = {
  icp: string;
  pain: string;
  outcome: string;
  offer: string;
  constraints: string;
  examples: string;
};

type IdeationDraftKey = keyof IdeationDraft;

type IdeationStepConfig = {
  key: IdeationDraftKey;
  title: string;
  description: string;
  placeholder: string;
  chips: string[];
  cards: Array<{ title: string; description: string; value: string }>;
  hint?: string;
};

const DEFAULT_IDEATION_DRAFT: IdeationDraft = {
  icp: "",
  pain: "",
  outcome: "",
  offer: "",
  constraints: "",
  examples: "",
};

const IDEATION_STEPS: IdeationStepConfig[] = [
  {
    key: "icp",
    title: "Ideal Customer Profile",
    description: "Who is this for? Be as specific as you can.",
    placeholder:
      "e.g., Solo B2B founders running $1-5M ARR SaaS who sell to HR teams",
    chips: [
      "Founders",
      "Agencies",
      "Coaches",
      "E-commerce",
      "Local services",
      "SaaS",
      "Not sure",
    ],
    cards: [
      {
        title: "Solo founders",
        description: "B2B SaaS founders under $2M ARR",
        value: "Solo B2B SaaS founders under $2M ARR",
      },
      {
        title: "Service businesses",
        description: "Agencies and consultants selling high-ticket services",
        value: "Agencies and consultants selling high-ticket services",
      },
      {
        title: "Creators",
        description: "Course creators or coaches selling programs",
        value: "Creators selling courses or coaching programs",
      },
      {
        title: "Local operators",
        description: "Local businesses with repeatable services",
        value: "Local service businesses looking for steady lead flow",
      },
    ],
    hint:
      "If unsure, pick a segment you know best and narrow by role, size, or industry.",
  },
  {
    key: "pain",
    title: "Primary Pain Point",
    description: "What is the most urgent problem they want solved?",
    placeholder:
      "e.g., They get leads but most are unqualified and waste their time",
    chips: [
      "Low-quality leads",
      "Low conversion",
      "No time",
      "Weak positioning",
      "Churn risk",
      "Inconsistent revenue",
      "Not sure",
    ],
    cards: [
      {
        title: "Lead quality",
        description: "Lots of interest, but few good fits",
        value: "They get interest, but most leads are unqualified",
      },
      {
        title: "Positioning gap",
        description: "Hard to explain why they are different",
        value: "They struggle to explain their differentiation clearly",
      },
      {
        title: "Conversion drop",
        description: "Traffic is ok, but signups are weak",
        value: "They have traffic but low conversion to leads or calls",
      },
      {
        title: "Time drain",
        description: "Manual tasks slow them down",
        value: "Too many manual tasks slow down growth",
      },
    ],
    hint:
      "Pick the pain that creates urgency and makes your solution feel like relief.",
  },
  {
    key: "outcome",
    title: "Desired Outcome",
    description: "What result do they want after using the lead magnet?",
    placeholder: "e.g., Clear next steps and a prioritized action plan",
    chips: [
      "More qualified leads",
      "Book calls",
      "Higher conversion",
      "Raise prices",
      "Save time",
      "Ship faster",
      "Not sure",
    ],
    cards: [
      {
        title: "Clear action plan",
        description: "Give them the next 3 steps to take",
        value: "A clear action plan with 3 priorities to implement",
      },
      {
        title: "Quick win",
        description: "Help them get a fast, visible result",
        value: "A quick win they can implement in 7 days",
      },
      {
        title: "Proof of ROI",
        description: "Quantify the upside of solving the problem",
        value: "A concrete ROI estimate for solving the problem",
      },
      {
        title: "Decision clarity",
        description: "Make a confident choice about next steps",
        value: "A clear decision framework for what to do next",
      },
    ],
    hint:
      "Aim for an outcome that points directly to your paid offer as the next step.",
  },
  {
    key: "offer",
    title: "Solution / Offer",
    description: "What type of solution do you sell or want to lead into?",
    placeholder: "e.g., Done-for-you service that optimizes their funnel",
    chips: [
      "Consulting",
      "Coaching",
      "Course",
      "SaaS",
      "Agency service",
      "Template pack",
      "Not sure",
    ],
    cards: [
      {
        title: "Done-for-you",
        description: "You implement it for them",
        value: "Done-for-you service where we implement the solution",
      },
      {
        title: "Done-with-you",
        description: "Hands-on guidance or coaching",
        value: "Done-with-you coaching or consulting engagement",
      },
      {
        title: "Product-led",
        description: "Software or template-based solution",
        value: "Product-led solution (software or templates)",
      },
      {
        title: "Education-led",
        description: "Course or program that teaches the system",
        value: "Course or program that teaches the full system",
      },
    ],
    hint:
      "If unsure, pick the offer you want more leads for and we will align the magnet to it.",
  },
  {
    key: "constraints",
    title: "Constraints",
    description: "Any limits or preferences for format or delivery?",
    placeholder: "e.g., Must be no-code, easy to complete in 10 minutes",
    chips: [
      "No-code only",
      "Short time to value",
      "Premium positioning",
      "Low budget",
      "B2B only",
      "B2C only",
      "Not sure",
    ],
    cards: [
      {
        title: "Quick completion",
        description: "Under 10 minutes to finish",
        value: "Should be completable in under 10 minutes",
      },
      {
        title: "Light lift",
        description: "Minimal inputs required",
        value: "Requires minimal inputs and no complex data",
      },
      {
        title: "High trust",
        description: "Feels premium and authoritative",
        value: "Needs to feel premium and high-trust",
      },
      {
        title: "No-code",
        description: "Deliverable should be no-code friendly",
        value: "Must be no-code friendly to produce",
      },
    ],
  },
  {
    key: "examples",
    title: "Examples / Inspiration",
    description: "Share links or references. Optional but helpful.",
    placeholder: "e.g., https://example.com/lead-magnet-i-like",
    chips: [
      "No examples",
      "I have links",
      "Competitor idea",
      "Past content",
      "Not sure",
    ],
    cards: [
      {
        title: "Checklist style",
        description: "Actionable checklist or scorecard",
        value: "I like checklist or scorecard style lead magnets",
      },
      {
        title: "Calculator",
        description: "Interactive ROI or savings calculator",
        value: "I like ROI or savings calculators",
      },
      {
        title: "Audit",
        description: "Self-assessment with scores",
        value: "I like audit-style self assessments",
      },
      {
        title: "Playbook",
        description: "Step-by-step playbook or guide",
        value: "I like step-by-step playbooks or guides",
      },
    ],
  },
];

const CHAT_STARTER_PROMPTS = [
  {
    title: "7-day action plan",
    description: "Daily steps + quick wins",
    value:
      "Create a 7-day action plan lead magnet for [audience] that helps them achieve [outcome].",
  },
  {
    title: "Scorecard + next steps",
    description: "Self-assessment with recommendations",
    value:
      "I want a scorecard that helps [audience] grade their [topic] and gives 3 next steps.",
  },
  {
    title: "Template pack",
    description: "Ready-to-use assets",
    value:
      "Suggest a template pack lead magnet for [audience] that saves time on [task].",
  },
  {
    title: "ROI calculator",
    description: "Estimate impact or savings",
    value:
      "Build an ROI calculator lead magnet for [audience] to estimate [benefit].",
  },
];

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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: createChatId(),
      role: "assistant",
      content:
        "Tell me what you want to build. I'll suggest a few lead magnet ideas with quick visual references, and we can go deeper before you pick one.",
    },
  ]);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<
    string | null
  >(null);
  const [mockupImages, setMockupImages] = useState<string[]>([]);
  const [isGeneratingMockups, setIsGeneratingMockups] = useState(false);
  const [mockupError, setMockupError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [selectedIcpProfileId, setSelectedIcpProfileId] = useState<string>("");
  const [icpProfileName, setIcpProfileName] = useState("");
  const [icpProfileError, setIcpProfileError] = useState<string | null>(null);

  // Hooks
  const aiGeneration = useAIGeneration();
  const ideation = useWorkflowIdeation();
  const workflowForm = useWorkflowForm();
  const { settings } = useSettings();
  const { updateSettings, loading: isUpdatingSettings } = useUpdateSettings();
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

  const applyChatSuggestion = (value: string) => {
    setChatInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return value;
      if (trimmed.endsWith(value)) return trimmed;
      return `${trimmed} ${value}`;
    });
  };

  const buildIcpContextMessage = (
    profile?: ICPProfile,
  ): WorkflowIdeationMessage | null => {
    if (!profile) return null;
    const lines = [
      `ICP Profile: ${profile.name}`,
      profile.icp ? `ICP: ${profile.icp}` : "",
      profile.pain ? `Pain: ${profile.pain}` : "",
      profile.outcome ? `Outcome: ${profile.outcome}` : "",
      profile.offer ? `Offer: ${profile.offer}` : "",
      profile.constraints ? `Constraints: ${profile.constraints}` : "",
      profile.examples ? `Examples: ${profile.examples}` : "",
    ].filter(Boolean);
    if (lines.length === 0) return null;
    return {
      role: "system",
      content: lines.join("\n"),
    };
  };

  const icpContextMessage = useMemo(
    () => buildIcpContextMessage(selectedIcpProfile),
    [selectedIcpProfile],
  );

  const buildRequestMessages = (messages: ChatMessage[]) => {
    const base = messages.map(({ role, content }) => ({ role, content }));
    return icpContextMessage ? [icpContextMessage, ...base] : base;
  };

  const applyIcpProfile = (profile: ICPProfile) => {
    setIdeationDraft({
      icp: profile.icp || "",
      pain: profile.pain || "",
      outcome: profile.outcome || "",
      offer: profile.offer || "",
      constraints: profile.constraints || "",
      examples: profile.examples || "",
    });
    setChatSetupError(null);
    setChatSetupStep(totalWizardSteps);
  };

  const handleSaveIcpProfile = async () => {
    if (!hasWizardCore) {
      setIcpProfileError(
        "Add ICP, pain, and outcome before saving a profile.",
      );
      return;
    }
    const name = icpProfileName.trim();
    if (!name) {
      setIcpProfileError("Please name this ICP profile.");
      return;
    }
    setIcpProfileError(null);

    const now = new Date().toISOString();
    const newProfile: ICPProfile = {
      id: createIcpId(),
      name,
      icp: ideationDraft.icp.trim(),
      pain: ideationDraft.pain.trim(),
      outcome: ideationDraft.outcome.trim(),
      offer: ideationDraft.offer.trim(),
      constraints: ideationDraft.constraints.trim(),
      examples: ideationDraft.examples.trim(),
      created_at: now,
      updated_at: now,
    };

    const nextProfiles = [...icpProfiles];
    const existingIndex = nextProfiles.findIndex(
      (profile) => profile.name.toLowerCase() === name.toLowerCase(),
    );
    if (existingIndex >= 0) {
      nextProfiles[existingIndex] = {
        ...nextProfiles[existingIndex],
        ...newProfile,
        id: nextProfiles[existingIndex].id,
        created_at: nextProfiles[existingIndex].created_at || now,
        updated_at: now,
      };
    } else {
      nextProfiles.push(newProfile);
    }

    const result = await updateSettings({ icp_profiles: nextProfiles });
    if (result) {
      setIcpProfileName("");
    }
  };

  const buildWizardSummary = () => {
    const lines: string[] = [];
    if (ideationDraft.icp.trim()) {
      lines.push(`ICP: ${ideationDraft.icp.trim()}`);
    }
    if (ideationDraft.pain.trim()) {
      lines.push(`Pain: ${ideationDraft.pain.trim()}`);
    }
    if (ideationDraft.outcome.trim()) {
      lines.push(`Outcome: ${ideationDraft.outcome.trim()}`);
    }
    if (ideationDraft.offer.trim()) {
      lines.push(`Offer: ${ideationDraft.offer.trim()}`);
    }
    if (ideationDraft.constraints.trim()) {
      lines.push(`Constraints: ${ideationDraft.constraints.trim()}`);
    }
    if (ideationDraft.examples.trim()) {
      lines.push(`Examples: ${ideationDraft.examples.trim()}`);
    }
    if (lines.length === 0) {
      return "";
    }
    return [
      "Let's ideate a lead magnet using this context:",
      ...lines,
    ].join("\n");
  };
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

  const allDeliverables = useMemo(
    () => chatMessages.flatMap((message) => message.deliverables || []),
    [chatMessages],
  );
  const selectedDeliverable = allDeliverables.find(
    (deliverable) => deliverable.id === selectedDeliverableId,
  );
  const latestUserMessage = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      const message = chatMessages[i];
      if (message.role === "user") {
        return message.content.trim();
      }
    }
    return "";
  }, [chatMessages]);
  const chatSuggestionCards = useMemo(() => {
    const suggestions: Array<{
      title: string;
      description: string;
      value: string;
    }> = [];
    const icpHint = ideationDraft.icp.trim();
    const painHint = ideationDraft.pain.trim();
    const outcomeHint = ideationDraft.outcome.trim();

    if (selectedDeliverable) {
      suggestions.push({
        title: "Refine this deliverable",
        description: "Add sections and outcomes",
        value: `Refine "${selectedDeliverable.title}" with clear sections and outputs.`,
      });
      suggestions.push({
        title: "Adjust the style",
        description: "Explore a different visual feel",
        value: `Suggest 3 style directions for "${selectedDeliverable.title}".`,
      });
      suggestions.push({
        title: "Make it shorter",
        description: "Trim to a quick-win version",
        value: `Shorten "${selectedDeliverable.title}" to a 1-page version.`,
      });
      suggestions.push({
        title: "Focus on one pain",
        description: "Anchor it to the core pain point",
        value: painHint
          ? `Focus this on: ${painHint}`
          : "Focus this on one urgent pain point.",
      });
    } else if (allDeliverables.length > 0) {
      suggestions.push({
        title: "Compare options",
        description: "Evaluate impact vs effort",
        value: "Compare the top 2 options for impact vs effort.",
      });
      suggestions.push({
        title: "Pick the best fit",
        description: "Recommend a single winner",
        value: "Recommend the best option and explain why.",
      });
      suggestions.push({
        title: "More options",
        description: "Generate additional ideas",
        value: "Give me 3 more deliverable options.",
      });
      suggestions.push({
        title: "Refine ICP",
        description: "Narrow the target audience",
        value: icpHint ? `Narrow the ICP to: ${icpHint}` : "Let's refine the ICP.",
      });
    } else {
      suggestions.push({
        title: "Refine ICP",
        description: "Narrow to a specific segment",
        value: icpHint ? `ICP: ${icpHint}` : "My ICP is: ",
      });
      suggestions.push({
        title: "Sharpen the pain",
        description: "Pick the most urgent pain",
        value: painHint ? `The most urgent pain is: ${painHint}` : "The most urgent pain is: ",
      });
      suggestions.push({
        title: "Define outcome",
        description: "Clarify the desired result",
        value: outcomeHint ? `Desired outcome: ${outcomeHint}` : "The desired outcome is: ",
      });
      suggestions.push({
        title: "Share examples",
        description: "Paste links or styles you like",
        value: "Examples I like: ",
      });
    }

    if (latestUserMessage && suggestions.length > 0) {
      suggestions[0] = {
        ...suggestions[0],
        description: `Based on: "${latestUserMessage.slice(0, 60)}"`,
      };
    }

    return suggestions.slice(0, 4);
  }, [allDeliverables.length, ideationDraft, latestUserMessage, selectedDeliverable]);
  const chatQuickReplies = useMemo(() => {
    const replies: string[] = [];
    const painHint = ideationDraft.pain.trim();

    if (selectedDeliverable) {
      replies.push("Make it more premium");
      replies.push("Shorten to one page");
      replies.push("Add concrete examples");
      replies.push("Show a draft outline");
      if (painHint) {
        replies.push(`Focus on: ${painHint}`);
      }
    } else if (allDeliverables.length > 0) {
      replies.push("Give me more options");
      replies.push("Compare the top 2");
      replies.push("Make it more premium");
      replies.push("Focus on one pain");
      replies.push("Shorten the deliverable");
    } else {
      replies.push("Give me more options");
      replies.push("Refine ICP");
      replies.push("Sharpen the pain");
      replies.push("Share examples");
      replies.push("Add concrete outcomes");
    }

    return replies.filter((item, index) => replies.indexOf(item) === index).slice(0, 6);
  }, [allDeliverables.length, ideationDraft.pain, selectedDeliverable]);
  const showStarterPrompts =
    isChatSetupComplete && !hasUserMessages && !ideation.isIdeating;
  const showSuggestionCards =
    isChatSetupComplete &&
    (hasUserMessages || allDeliverables.length > 0 || Boolean(selectedDeliverable));
  const showQuickReplies =
    isChatSetupComplete &&
    chatQuickReplies.length > 0 &&
    (hasUserMessages || allDeliverables.length > 0 || Boolean(selectedDeliverable));

  useEffect(() => {
    setMockupImages([]);
    setMockupError(null);
  }, [selectedDeliverableId]);
  useEffect(() => {
    if (!isChatSetupComplete) {
      return;
    }
    const container = chatScrollRef.current;
    if (!container) {
      return;
    }
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom > CHAT_SCROLL_THRESHOLD) {
      return;
    }
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [
    chatMessages,
    ideation.isIdeating,
    isChatSetupComplete,
    selectedDeliverableId,
    mockupImages.length,
  ]);

  const handleGenerateFromChat = async () => {
    if (!selectedDeliverable) {
      return;
    }
    setPrompt(selectedDeliverable.build_description);
    await startGeneration(selectedDeliverable.build_description);
  };

  const handleWizardBack = () => {
    setChatSetupStep((prev) => Math.max(prev - 1, 0));
    setChatSetupError(null);
  };

  const handleWizardNext = () => {
    setChatSetupStep((prev) => Math.min(prev + 1, totalWizardSteps));
    setChatSetupError(null);
  };

  const handleSkipWizard = () => {
    setIsChatSetupComplete(true);
    setChatSetupError(null);
  };

  const handleGenerateFromWizard = async () => {
    if (!hasWizardCore) {
      setChatSetupError(
        "Please fill in the ICP, pain point, and desired outcome before generating options.",
      );
      return;
    }

    const summary = buildWizardSummary();
    if (!summary) {
      setChatSetupError("Please add at least one detail before continuing.");
      return;
    }

    setIsChatSetupComplete(true);
    setSelectedDeliverableId(null);

    const userMessage: ChatMessage = {
      id: createChatId(),
      role: "user",
      content: summary,
    };
    const assistantMessage: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      content: "",
    };
    const requestMessages: WorkflowIdeationMessage[] = buildRequestMessages([
      ...chatMessages,
      userMessage,
    ]);

    setChatMessages((prev) => [...prev, userMessage, assistantMessage]);

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
    const requestMessages: WorkflowIdeationMessage[] = buildRequestMessages([
      ...chatMessages,
      userMessage,
    ]);

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
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
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
                Describe your lead magnet idea. We&apos;ll suggest options with quick visual previews, 
                help you refine the concept, and then build it for you.
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
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {selectedIcpProfile.icp
                    ? `ICP: ${selectedIcpProfile.icp}`
                    : "ICP profile loaded."}
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
                    disabled={!hasWizardCore || isUpdatingSettings}
                    className="px-4 py-2 text-sm rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdatingSettings ? "Saving..." : "Save ICP"}
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
                  <div className="space-y-4">
                    <textarea
                      value={wizardStepValue}
                      onChange={(e) =>
                        currentWizardStep &&
                        updateDraftField(currentWizardStep.key, e.target.value)
                      }
                      placeholder={currentWizardStep?.placeholder}
                      rows={4}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-foreground placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent resize-none"
                    />

                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Quick picks
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentWizardStep?.chips.map((chip) => {
                          const isSelected = wizardStepValue
                            .toLowerCase()
                            .includes(chip.toLowerCase());
                          return (
                            <button
                              key={chip}
                              type="button"
                              onClick={() =>
                                currentWizardStep &&
                                appendDraftValue(currentWizardStep.key, chip)
                              }
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                isSelected
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-emerald-300 dark:hover:border-emerald-700"
                              }`}
                            >
                              {chip}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Cursor-style options
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {currentWizardStep?.cards.map((card) => {
                          const isSelected = wizardStepValue
                            .toLowerCase()
                            .includes(card.value.toLowerCase());
                          return (
                            <button
                              key={card.title}
                              type="button"
                              onClick={() =>
                                currentWizardStep &&
                                setDraftPreset(currentWizardStep.key, card.value)
                              }
                              className={`text-left p-3 rounded-xl border transition-all ${
                                isSelected
                                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm"
                                  : "border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 bg-white dark:bg-gray-900"
                              }`}
                            >
                              <div className="text-sm font-semibold text-gray-900 dark:text-foreground">
                                {card.title}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {card.description}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {showWizardHint && (
                      <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">
                        {currentWizardStep?.hint}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={handleWizardBack}
                        disabled={chatSetupStep === 0}
                        className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleWizardNext}
                        className="px-5 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                      >
                        {chatSetupStep + 1 >= totalWizardSteps
                          ? "Review"
                          : "Next"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 space-y-3">
                      {IDEATION_STEPS.map((stepItem, index) => (
                        <div
                          key={stepItem.key}
                          className="flex items-start justify-between gap-3"
                        >
                          <div>
                            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                              {stepItem.title}
                            </div>
                            <div className="text-sm text-gray-900 dark:text-foreground mt-1">
                              {ideationDraft[stepItem.key].trim() ||
                                "Not provided"}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setChatSetupStep(index);
                              setChatSetupError(null);
                            }}
                            className="text-xs text-emerald-600 dark:text-emerald-300 hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleWizardBack}
                        className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                      >
                        Back
                      </button>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleSkipWizard}
                          className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500"
                        >
                          Keep chatting
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateFromWizard}
                          disabled={ideation.isIdeating}
                          className="px-5 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ideation.isIdeating
                            ? "Generating options..."
                            : "Generate options"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
            <div
              ref={chatScrollRef}
              className="rounded-lg border border-gray-200 dark:border-border bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-950 p-4 max-h-[500px] overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700"
            >
              {chatMessages.map((message, index) => {
                const isUserMessage = message.role === "user";
                return (
                  <div key={message.id} className="space-y-3">
                    <div
                      className={`flex ${
                        isUserMessage ? "justify-end" : "justify-start"
                      } animate-in fade-in slide-in-from-bottom-2 duration-300`}
                      style={{ animationDelay: `${index * 10}ms` }}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          isUserMessage
                            ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white whitespace-pre-wrap"
                            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-foreground border border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        {isUserMessage ? (
                          message.content
                        ) : (
                          <MarkdownRenderer
                            value={message.content}
                            className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0"
                            fallbackClassName="whitespace-pre-wrap text-sm text-gray-900 dark:text-foreground"
                          />
                        )}
                      </div>
                    </div>

                  {message.deliverables && message.deliverables.length > 0 && (
                    <div className="flex justify-start animate-in fade-in slide-in-from-bottom-3 duration-300">
                      <div className="w-full rounded-2xl border border-emerald-200/70 dark:border-emerald-900/60 bg-white dark:bg-gray-900 px-4 py-4 shadow-sm">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                          <h3 className="text-base font-bold text-gray-900 dark:text-foreground flex items-center gap-2">
                            <FiLayout className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            Suggested Deliverables
                          </h3>
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">
                            {message.deliverables.length}{" "}
                            {message.deliverables.length === 1 ? "option" : "options"}
                          </span>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4 pt-3">
                          {message.deliverables.map((deliverable, idx) => {
                            const isSelected =
                              deliverable.id === selectedDeliverableId;
                            const fallbackSeed = `${deliverable.id || deliverable.title}-${idx + 1}`;
                            const examplePreview = deliverable.example_images?.find(
                              (image) => image?.url,
                            )?.url;
                            const previewUrl =
                              examplePreview ||
                              deliverable.image_url ||
                              buildPreviewFallbackUrl(fallbackSeed);
                            return (
                              <button
                                key={deliverable.id}
                                type="button"
                                onClick={() =>
                                  setSelectedDeliverableId(deliverable.id)
                                }
                                aria-pressed={isSelected}
                                aria-label={`Select ${deliverable.title}`}
                                className={`group text-left rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-lg ${
                                  isSelected
                                    ? "border-emerald-500 ring-4 ring-emerald-200/50 dark:ring-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-md"
                                    : "border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 bg-white dark:bg-gray-800"
                                }`}
                                style={{ animationDelay: `${idx * 50}ms` }}
                              >
                                <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 mb-3 group-hover:scale-[1.02] transition-transform duration-200">
                                  <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                                    <FiImage className="w-8 h-8 opacity-50" />
                                  </div>
                                  <Image
                                    src={previewUrl}
                                    alt={deliverable.title}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                    onError={(event) => {
                                      const target = event.currentTarget as HTMLImageElement;
                                      if (target.dataset.fallback === "true") {
                                        target.style.display = "none";
                                        return;
                                      }
                                      target.dataset.fallback = "true";
                                      target.src =
                                        buildPreviewFallbackUrl(fallbackSeed);
                                    }}
                                  />
                                  {isSelected && (
                                    <div className="absolute top-2 right-2 bg-emerald-600 text-white rounded-full p-1.5 shadow-lg">
                                      <FiZap className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-foreground leading-tight">
                                      {deliverable.title}
                                    </h4>
                                  </div>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                    {deliverable.description}
                                  </p>
                                  {deliverable.build_description?.trim() && (
                                    <div className="rounded-lg bg-gray-50/80 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700 px-2 py-1.5 space-y-1">
                                      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                                        Build plan
                                      </div>
                                      <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
                                        {deliverable.build_description}
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 pt-1">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 uppercase tracking-wide font-medium">
                                      {deliverable.deliverable_type}
                                    </span>
                                  </div>
                                  {deliverable.example_images &&
                                    deliverable.example_images.length > 0 && (
                                      <div className="space-y-1">
                                        <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                                          Example styles
                                        </div>
                                        <div className="flex gap-2">
                                          {deliverable.example_images
                                            .filter((image) => image?.url)
                                            .slice(0, 3)
                                            .map((image, imageIndex) => {
                                              const href =
                                                image.source_url || image.url;
                                              return (
                                                <a
                                                  key={`${deliverable.id}-example-${imageIndex}`}
                                                  href={href}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="relative h-12 w-12 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700"
                                                  title={image.title || undefined}
                                                >
                                                  <Image
                                                    src={image.url}
                                                    alt={
                                                      image.title ||
                                                      `${deliverable.title} example ${imageIndex + 1}`
                                                    }
                                                    fill
                                                    className="object-cover"
                                                    unoptimized
                                                    onError={(event) => {
                                                      (event.currentTarget as HTMLImageElement).style.display =
                                                        "none";
                                                    }}
                                                  />
                                                </a>
                                              );
                                            })}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                );
              })}

              {showStarterPrompts && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Starter prompts
                    </div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Tap to fill the composer
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {CHAT_STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt.title}
                        type="button"
                        onClick={() => setChatInput(prompt.value)}
                        className="text-left rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-950 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
                      >
                        <div className="text-sm font-semibold text-gray-900 dark:text-foreground">
                          {prompt.title}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {prompt.description}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-2 line-clamp-2">
                          {prompt.value}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {ideation.isIdeating && (
                <div className="flex justify-start animate-in fade-in">
                  <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-foreground border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-200 dark:border-emerald-800 border-t-emerald-600 dark:border-t-emerald-400"></div>
                      </div>
                      <span className="text-gray-600 dark:text-gray-300">Thinking through options...</span>
                    </div>
                  </div>
                </div>
              )}

              {ideation.isIdeating && allDeliverables.length === 0 && (
                <div className="grid sm:grid-cols-2 gap-4 animate-pulse">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`deliverable-skeleton-${index}`}
                      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3"
                    >
                      <div className="h-24 rounded-lg bg-gray-200 dark:bg-gray-800" />
                      <div className="h-3 rounded bg-gray-200 dark:bg-gray-800 w-3/4" />
                      <div className="h-3 rounded bg-gray-200 dark:bg-gray-800 w-2/3" />
                    </div>
                  ))}
                </div>
              )}

              {!ideation.isIdeating &&
                hasUserMessages &&
                allDeliverables.length === 0 && (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
                    <div className="text-sm font-semibold text-gray-900 dark:text-foreground">
                      No deliverables yet
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Add a bit more detail or ask for more options and we will try again.
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        applyChatSuggestion("Give me 3 deliverable options.")
                      }
                      className="inline-flex items-center px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                )}

              {selectedDeliverable && (
                <div className="rounded-xl border-2 border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse"></div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                          Selected Deliverable
                        </div>
                      </div>
                      <div className="text-base font-bold text-gray-900 dark:text-foreground mb-1">
                        {selectedDeliverable.title}
                      </div>
                      <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                        {selectedDeliverable.description}
                      </div>
                      {selectedDeliverable.build_description?.trim() && (
                        <div className="mt-3 rounded-lg bg-white/70 dark:bg-gray-900/60 px-3 py-2 border border-emerald-100 dark:border-emerald-900/60 space-y-1">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            Build plan
                          </div>
                          <div className="text-xs text-emerald-700/90 dark:text-emerald-200/90 line-clamp-4">
                            {selectedDeliverable.build_description}
                          </div>
                        </div>
                      )}
                      <div className="mt-2 text-xs text-emerald-700/90 dark:text-emerald-200/90 bg-white/60 dark:bg-gray-800/60 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        💡 Optional: Generate custom mockups to preview the final deliverable (takes ~1 minute)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDeliverableId(null)}
                      className="text-xs px-3 py-1.5 rounded-lg text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/50 dark:hover:bg-emerald-900/50 transition-colors font-medium"
                    >
                      Change
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateMockups}
                    disabled={isGeneratingMockups}
                    className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                  >
                    {isGeneratingMockups ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Generating mockups...
                      </>
                    ) : mockupImages.length > 0 ? (
                      "🔄 Regenerate Mockups"
                    ) : (
                      "✨ Generate Mockups"
                    )}
                  </button>

                  {mockupError && (
                    <div className="text-xs text-red-600 dark:text-red-400">
                      {mockupError}
                    </div>
                  )}

                  {mockupImages.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-semibold">
                        Deliverable Mockups
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {mockupImages.map((url, index) => (
                          <div
                            key={`${url}-${index}`}
                            className="relative aspect-[4/3] rounded-md overflow-hidden bg-muted/30 border border-emerald-200/60 dark:border-emerald-900/60"
                          >
                            <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                              <FiImage className="w-6 h-6 opacity-50" />
                            </div>
                            <Image
                              src={url}
                              alt={`Deliverable mockup ${index + 1}`}
                              fill
                              className="object-cover"
                              unoptimized
                              onError={(event) => {
                                (event.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {showSuggestionCards && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Suggested prompts
                  </div>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    Tap to add to the composer
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {chatSuggestionCards.map((card) => (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => applyChatSuggestion(card.value)}
                      disabled={ideation.isIdeating}
                      className="text-left rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <div className="text-sm font-semibold text-gray-900 dark:text-foreground">
                        {card.title}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {card.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              {showQuickReplies && (
                <div className="flex flex-wrap gap-2">
                  {chatQuickReplies.map((reply) => (
                    <button
                      key={reply}
                      type="button"
                      onClick={() => applyChatSuggestion(reply)}
                      disabled={ideation.isIdeating}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !ideation.isIdeating &&
                      chatInput.trim()
                    ) {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-foreground placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed resize-none transition-all"
                  placeholder="Describe the lead magnet you want to build... (Enter to send, Shift+Enter for a new line)"
                  rows={3}
                  disabled={ideation.isIdeating}
                />
                <button
                  type="button"
                  onClick={handleSendChatMessage}
                  disabled={ideation.isIdeating || !chatInput.trim()}
                  className="absolute right-3 bottom-3 p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  title="Send message (Enter)"
                >
                  <FiMessageSquare className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSendChatMessage}
                  disabled={ideation.isIdeating || !chatInput.trim()}
                  className="flex items-center justify-center px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md font-medium"
                >
                  {ideation.isIdeating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    "Send Message"
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleGenerateFromChat}
                  disabled={
                    ideation.isIdeating ||
                    aiGeneration.isGenerating ||
                    !selectedDeliverable
                  }
                  className="flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-500 dark:to-blue-500 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 dark:hover:from-purple-600 dark:hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md font-medium"
                >
                  <FiZap className="w-4 h-4 mr-2" />
                  Build This
                </button>

                {selectedDeliverable && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                    <div className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse"></div>
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {selectedDeliverable.title}
                    </span>
                  </div>
                )}
              </div>
            </div>
              </>
            )}
          </div>
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
