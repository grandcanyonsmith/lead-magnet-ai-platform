/**
 * AI model constants
 */

import { AIModel } from "@/types/workflow";

export const AI_MODELS: Array<{ value: AIModel; label: string }> = [
  { value: "gpt-5.2", label: "GPT-5.2" },
  { value: "computer-use-preview", label: "Computer Use Preview" },
] as const;

export const DEFAULT_AI_MODEL: AIModel = "gpt-5.2";
export const DEFAULT_REWRITE_MODEL: AIModel = "gpt-5.2";
export const DEFAULT_TEMPLATE_MODEL = "gpt-5.2";
