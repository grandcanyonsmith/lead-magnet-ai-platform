export interface AccumulatedContext {
  [key: string]: any;
}

export interface StepResult {
  stepIndex: number;
  output: any;
  status: "success" | "error" | "pending";
  error?: string;
  duration?: number;
}

export type SidebarTab = "input" | "step-config" | "context" | "logs";
