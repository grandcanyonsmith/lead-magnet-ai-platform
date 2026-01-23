import {
  FiGlobe,
  FiImage,
  FiMonitor,
  FiFileText,
  FiCode,
  FiTerminal,
  FiZap,
  FiCpu,
  FiBox,
  FiAlignLeft,
  FiLayout,
  FiSettings,
} from "react-icons/fi";

export const AVAILABLE_TOOLS = [
  {
    value: "web_search",
    label: "Search the Web",
    description: "Look up real-time information",
    icon: FiGlobe,
  },
  {
    value: "image_generation",
    label: "Create Images",
    description: "Generate images from text",
    icon: FiImage,
  },
  {
    value: "computer_use_preview",
    label: "Computer Use",
    description: "Interact with interfaces (Beta)",
    icon: FiMonitor,
  },
  {
    value: "file_search",
    label: "Search Files",
    description: "Search uploaded files",
    icon: FiFileText,
  },
  {
    value: "code_interpreter",
    label: "Run Code",
    description: "Execute Python code",
    icon: FiCode,
  },
  {
    value: "shell",
    label: "Shell Commands",
    description: "Run system commands",
    icon: FiTerminal,
  },
];

export const TOOL_CHOICE_OPTIONS = [
  {
    value: "auto",
    label: "Auto",
    description: "Model decides when to use tools",
  },
  {
    value: "required",
    label: "Required",
    description: "Model must use at least one tool",
  },
  { value: "none", label: "None", description: "Disable tools entirely" },
];

export const SERVICE_TIER_OPTIONS = [
  {
    value: "auto",
    label: "Auto",
    description: "Project Default",
    icon: FiZap,
  },
  {
    value: "priority",
    label: "Priority",
    description: "Fastest Response",
    icon: FiZap,
  },
  {
    value: "default",
    label: "Default",
    description: "Standard Speed",
    icon: FiCpu,
  },
  {
    value: "flex",
    label: "Flex",
    description: "Lower Cost",
    icon: FiBox,
  },
  {
    value: "scale",
    label: "Scale",
    description: "High Volume",
    icon: FiBox,
  },
];

export const OUTPUT_TYPE_OPTIONS = [
  {
    value: "text",
    label: "Text",
    description: "Standard text response",
    icon: FiAlignLeft,
  },
  {
    value: "json_schema",
    label: "Structured JSON",
    description: "Strict schema validation",
    icon: FiLayout,
  },
  {
    value: "json_object",
    label: "JSON Object",
    description: "Raw JSON output",
    icon: FiCode,
  },
];

export const STEP_EDITOR_SECTIONS = [
  {
    id: "basics",
    label: "Basics",
    description: "Name, model, and defaults",
    icon: FiSettings,
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Webhooks and handoff",
    icon: FiGlobe,
  },
] as const;

export const FIELD_LABEL =
  "flex items-center gap-1.5 text-sm font-medium text-foreground/90 mb-1.5";
export const FIELD_OPTIONAL = "text-xs font-normal text-muted-foreground";
export const FIELD_REQUIRED = "text-destructive";

export const CONTROL_BASE =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm transition-all hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50";
export const SELECT_CONTROL = `${CONTROL_BASE} pr-9`;
export const HELP_TEXT = "mt-2 text-xs leading-relaxed text-muted-foreground";
