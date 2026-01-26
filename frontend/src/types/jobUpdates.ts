import type { WorkflowStep } from "@/types";
import type { ImageGenerationSettings } from "@/types/workflow";

export type QuickUpdateStepInput = {
  model?: WorkflowStep["model"] | null;
  service_tier?: WorkflowStep["service_tier"] | null;
  reasoning_effort?: WorkflowStep["reasoning_effort"] | null;
  image_generation?: ImageGenerationSettings;
  tools?: WorkflowStep["tools"] | null;
};
