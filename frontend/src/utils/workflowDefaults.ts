import { WorkflowStep } from "@/types/workflow";

export const DEFAULT_TOOL_CHOICE: WorkflowStep["tool_choice"] = "required";

export const resolveToolChoice = (
  value?: string,
): WorkflowStep["tool_choice"] => {
  return value === "auto" || value === "required" || value === "none"
    ? value
    : DEFAULT_TOOL_CHOICE;
};

export const resolveServiceTier = (
  value?: string,
): WorkflowStep["service_tier"] | undefined => {
  if (
    value === "default" ||
    value === "flex" ||
    value === "scale" ||
    value === "priority"
  ) {
    return value;
  }
  return undefined;
};

export const resolveTextVerbosity = (
  value?: string,
): WorkflowStep["text_verbosity"] | undefined => {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : undefined;
};

export const buildDefaultSteps = (
  defaultToolChoice: WorkflowStep["tool_choice"],
  defaultServiceTier?: WorkflowStep["service_tier"],
  defaultTextVerbosity?: WorkflowStep["text_verbosity"],
): WorkflowStep[] => [
  {
    step_name: "Deep Research",
    step_description: "Generate comprehensive research report",
    model: "gpt-5.2",
    instructions: "",
    step_order: 0,
    tools: ["web_search"],
    tool_choice: defaultToolChoice,
    service_tier: defaultServiceTier,
    text_verbosity: defaultTextVerbosity,
  },
  {
    step_name: "HTML Rewrite",
    step_description: "Rewrite content into styled HTML matching template",
    model: "gpt-5.2",
    instructions:
      "Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template's design and structure.",
    step_order: 1,
    tools: [],
    tool_choice: defaultToolChoice,
    service_tier: defaultServiceTier,
    text_verbosity: defaultTextVerbosity,
  },
];
