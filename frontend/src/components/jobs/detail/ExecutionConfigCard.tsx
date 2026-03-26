import { useMemo } from "react";
import {
  FiCpu,
  FiZap,
  FiGlobe,
  FiDatabase,
} from "react-icons/fi";
import type { MergedStep } from "@/types/job";
import { getStepInput } from "@/utils/stepInput";

interface ConfigItem {
  icon: React.ReactNode;
  label: string;
  iconBg: string;
}

interface ExecutionConfigCardProps {
  steps: MergedStep[];
  className?: string;
}

function extractConfig(steps: MergedStep[]): ConfigItem[] {
  const items: ConfigItem[] = [];
  const aiSteps = steps.filter(
    (s) => s.step_type === "ai_generation" || s.step_type === "workflow_step",
  );
  if (aiSteps.length === 0) return items;

  const firstAI = aiSteps[0];
  const model =
    firstAI.model || firstAI.usage_info?.model;
  if (model) {
    items.push({
      icon: <FiCpu className="h-4 w-4" />,
      label: model,
      iconBg: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
    });
  }

  const input = getStepInput(firstAI.input);
  const reasoning = (input as Record<string, unknown>)?.reasoning_effort;
  if (reasoning) {
    const label =
      typeof reasoning === "string"
        ? reasoning.charAt(0).toUpperCase() + reasoning.slice(1)
        : String(reasoning);
    items.push({
      icon: <FiZap className="h-4 w-4" />,
      label: `Reasoning: ${label}`,
      iconBg: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
    });
  }

  const allTools = aiSteps.flatMap((s) => {
    const stepInput = getStepInput(s.input);
    return stepInput?.tools ?? s.tools ?? [];
  });
  const toolNames = new Set<string>();
  for (const tool of allTools) {
    if (typeof tool === "string") {
      toolNames.add(tool);
    } else if (tool && typeof tool === "object" && "type" in tool) {
      toolNames.add(String((tool as unknown as Record<string, unknown>).type));
    }
  }

  const friendlyToolNames: Record<string, string> = {
    web_search: "Web Search",
    web_search_preview: "Web Search",
    file_search: "File Search",
    code_interpreter: "Code Interpreter",
    computer_use_preview: "Computer Use",
    image_generation: "Image Generation",
  };

  for (const name of toolNames) {
    items.push({
      icon: <FiGlobe className="h-4 w-4" />,
      label: friendlyToolNames[name] ?? name.replace(/_/g, " "),
      iconBg: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400",
    });
  }

  const hasDeps = aiSteps.some(
    (s) => s.depends_on && s.depends_on.length > 0,
  );
  if (hasDeps) {
    items.push({
      icon: <FiDatabase className="h-4 w-4" />,
      label: "Memory: Active",
      iconBg: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    });
  }

  return items;
}

export function ExecutionConfigCard({
  steps,
  className = "",
}: ExecutionConfigCardProps) {
  const configItems = useMemo(() => extractConfig(steps), [steps]);

  if (configItems.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-border bg-card shadow-sm ${className}`}
    >
      <div className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Execution Config
        </h3>
        <ul className="space-y-3">
          {configItems.map((item, idx) => (
            <li key={idx} className="flex items-center gap-3">
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${item.iconBg}`}
              >
                {item.icon}
              </span>
              <span className="text-sm text-foreground">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
