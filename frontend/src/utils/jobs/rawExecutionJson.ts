import type { ExecutionStep } from "@/types/job";

type ExecutionStepSummary = Pick<
  ExecutionStep,
  "step_order" | "step_type" | "step_name" | "output"
> & {
  instructions?: string;
  tools?: ExecutionStep["tools"];
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

const readTools = (value: unknown): ExecutionStep["tools"] | undefined =>
  Array.isArray(value) ? (value as ExecutionStep["tools"]) : undefined;

const extractInstructions = (step: UnknownRecord): string | undefined => {
  const direct = readString(step.instructions);
  if (direct) {
    return direct;
  }
  const input = isRecord(step.input) ? step.input : null;
  return input ? readString(input.instructions) : undefined;
};

const extractTools = (step: UnknownRecord): ExecutionStep["tools"] | undefined => {
  const direct = readTools(step.tools);
  if (direct) {
    return direct;
  }
  const input = isRecord(step.input) ? step.input : null;
  return input ? readTools(input.tools) : undefined;
};

const looksLikeExecutionStep = (value: unknown): value is UnknownRecord => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    "step_order" in value ||
    "step_type" in value ||
    "step_name" in value ||
    "output" in value
  );
};

const summarizeStep = (step: UnknownRecord): ExecutionStepSummary => ({
  step_order: step.step_order as ExecutionStep["step_order"],
  step_type: step.step_type as ExecutionStep["step_type"],
  step_name: step.step_name as ExecutionStep["step_name"],
  instructions: extractInstructions(step),
  tools: extractTools(step),
  output: step.output as ExecutionStep["output"],
});

const summarizeExecutionSteps = (steps: unknown): unknown => {
  if (!Array.isArray(steps)) {
    return steps;
  }
  return steps.map((step) =>
    looksLikeExecutionStep(step) ? summarizeStep(step) : step,
  );
};

export const buildExecutionJsonSummary = (data: unknown): unknown => {
  if (Array.isArray(data)) {
    if (!data.some((item) => looksLikeExecutionStep(item))) {
      return data;
    }
    return summarizeExecutionSteps(data);
  }
  if (!isRecord(data) || !("execution_steps" in data)) {
    return data;
  }
  return {
    ...data,
    execution_steps: summarizeExecutionSteps(data.execution_steps),
  };
};
