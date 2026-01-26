import type { ExecutionStepInput } from "@/types/job";

export function getStepInput(input: unknown): ExecutionStepInput | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }
  return input as ExecutionStepInput;
}
