import { WorkflowIdeationDeliverable, WorkflowIdeationMessage } from "@/types";

export const PREVIEW_IMAGE_WIDTH = 1024;
export const PREVIEW_IMAGE_HEIGHT = 768;
export const buildPreviewFallbackUrl = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${PREVIEW_IMAGE_WIDTH}/${PREVIEW_IMAGE_HEIGHT}`;
export const CHAT_SCROLL_THRESHOLD = 120;

export type ChatMessage = WorkflowIdeationMessage & {
  id: string;
  deliverables?: WorkflowIdeationDeliverable[];
};

export const createChatId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createInitialChatMessages = (): ChatMessage[] => [
  {
    id: createChatId(),
    role: "assistant",
    content:
      "Tell me what you want to build. I'll suggest a few lead magnet ideas with quick visual references, and we can go deeper before you pick one.",
  },
];

export const createIcpId = () =>
  `icp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export type IdeationDraft = {
  icp: string;
  pain: string;
  outcome: string;
  offer: string;
  constraints: string;
  examples: string;
};

export type IdeationDraftKey = keyof IdeationDraft;

export type IdeationStepConfig = {
  key: IdeationDraftKey;
  title: string;
  description: string;
  placeholder: string;
  chips: string[];
  cards: Array<{ title: string; description: string; value: string }>;
  hint?: string;
};

export const DEFAULT_IDEATION_DRAFT: IdeationDraft = {
  icp: "",
  pain: "",
  outcome: "",
  offer: "",
  constraints: "",
  examples: "",
};

export const IDEATION_STEPS: IdeationStepConfig[] = [
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

export const CHAT_STARTER_PROMPTS = [
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
