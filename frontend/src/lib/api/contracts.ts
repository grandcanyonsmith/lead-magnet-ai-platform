import type {
  Workflow,
  WorkflowStep,
  WorkflowListResponse,
  WorkflowCreateRequest,
  WorkflowUpdateRequest,
  WorkflowGenerationRequest,
  WorkflowGenerationResponse,
  WorkflowRefineInstructionsRequest,
  WorkflowRefineInstructionsResponse,
  Form,
  FormListResponse,
  FormCreateRequest,
  FormUpdateRequest,
  FormGenerateCSSRequest,
  FormGenerateCSSResponse,
  FormRefineCSSRequest,
  FormRefineCSSResponse,
  Job,
  JobListResponse,
  JobListParams,
  JobResubmitResponse,
  ExecutionStep,
  Template,
  TemplateListResponse,
  TemplateCreateRequest,
  TemplateUpdateRequest,
  TemplateGenerateRequest,
  TemplateGenerateResponse,
  TemplateRefineRequest,
  TemplateRefineResponse,
  NotificationListResponse,
  Settings,
  SettingsUpdateRequest,
  AnalyticsResponse,
  UsageResponse,
} from "@/types";

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

type ApiContractTypes<Query, Body, Response> = {
  query: Query;
  body: Body;
  response: Response;
};

const defineTypes = <Query, Body, Response>() =>
  ({
    query: undefined as unknown as Query,
    body: undefined as unknown as Body,
    response: undefined as unknown as Response,
  }) as ApiContractTypes<Query, Body, Response>;

export interface ApiEndpointContract<Query, Body, Response> {
  method: ApiMethod;
  path: string;
  description: string;
  docs: string;
  __types: ApiContractTypes<Query, Body, Response>;
}

type WorkflowListQuery = {
  status?: string;
  limit?: number;
  cursor?: string;
};

type WorkflowAIStepRequest = {
  userPrompt: string;
  action?: "update" | "add";
  currentStep?: WorkflowStep;
  currentStepIndex?: number;
};

type WorkflowAIStepResponse = {
  action: "update" | "add";
  step_index?: number;
  step: WorkflowStep;
};

type WorkflowAIEditRequest = {
  userPrompt: string;
};

type WorkflowAIEditResponse = {
  workflow_name?: string;
  workflow_description?: string;
  html_enabled?: boolean;
  steps: WorkflowStep[];
  changes_summary: string;
};

type JobRerunRequest = {
  step_index: number;
  continue_after?: boolean;
};

type JobRerunResponse = {
  message: string;
  job_id: string;
  step_index: number;
};

type JobQuickEditRequest = {
  step_order: number;
  user_prompt: string;
  save?: boolean;
};

type JobQuickEditResponse = {
  original_output: unknown;
  edited_output: unknown;
  changes_summary: string;
  saved: boolean;
};

type JobsDocumentResponse = string;

export const workflowContracts = {
  list: {
    method: "GET",
    path: "/admin/workflows",
    description: "List workflows for the authenticated tenant.",
    docs: "docs/contracts/README.md#workflows",
    __types: defineTypes<
      WorkflowListQuery | undefined,
      void,
      WorkflowListResponse
    >(),
  },
  detail: {
    method: "GET",
    path: "/admin/workflows/:id",
    description: "Retrieve a single workflow with form metadata.",
    docs: "docs/contracts/README.md#workflows",
    __types: defineTypes<void, void, Workflow>(),
  },
  create: {
    method: "POST",
    path: "/admin/workflows",
    description: "Create a workflow draft.",
    docs: "docs/contracts/README.md#workflows",
    __types: defineTypes<void, WorkflowCreateRequest, Workflow>(),
  },
  update: {
    method: "PUT",
    path: "/admin/workflows/:id",
    description: "Update workflow metadata or steps.",
    docs: "docs/contracts/README.md#workflows",
    __types: defineTypes<void, WorkflowUpdateRequest, Workflow>(),
  },
  remove: {
    method: "DELETE",
    path: "/admin/workflows/:id",
    description: "Soft delete a workflow.",
    docs: "docs/contracts/README.md#workflows",
    __types: defineTypes<void, void, void>(),
  },
  generateWithAI: {
    method: "POST",
    path: "/admin/workflows/generate-with-ai",
    description: "Kick off asynchronous workflow generation.",
    docs: "docs/contracts/README.md#workflows",
    __types: defineTypes<
      void,
      WorkflowGenerationRequest,
      WorkflowGenerationResponse
    >(),
  },
  generationStatus: {
    method: "GET",
    path: "/admin/workflows/generation-status/:jobId",
    description: "Poll workflow generation job status.",
    docs: "docs/contracts/README.md#workflows",
    __types: defineTypes<void, void, WorkflowGenerationResponse>(),
  },
  refineInstructions: {
    method: "POST",
    path: "/admin/workflows/refine-instructions",
    description: "Refine workflow instructions with AI.",
    docs: "docs/contracts/README.md#workflows",
    __types: defineTypes<
      void,
      WorkflowRefineInstructionsRequest,
      WorkflowRefineInstructionsResponse
    >(),
  },
  aiStep: {
    method: "POST",
    path: "/admin/workflows/:id/ai-step",
    description: "Generate or update a workflow step with AI.",
    docs: "docs/contracts/README.md#workflows",
    __types: defineTypes<void, WorkflowAIStepRequest, WorkflowAIStepResponse>(),
  },
  aiEdit: {
    method: "POST",
    path: "/admin/workflows/:id/ai-edit",
    description: "Edit an entire workflow using AI assistance.",
    docs: "docs/contracts/README.md#workflows",
    __types: defineTypes<void, WorkflowAIEditRequest, WorkflowAIEditResponse>(),
  },
} satisfies Record<string, ApiEndpointContract<any, any, any>>;

export const formContracts = {
  list: {
    method: "GET",
    path: "/admin/forms",
    description: "List forms for the tenant.",
    docs: "docs/contracts/README.md#forms",
    __types: defineTypes<
      Record<string, unknown> | undefined,
      void,
      FormListResponse
    >(),
  },
  detail: {
    method: "GET",
    path: "/admin/forms/:id",
    description: "Fetch a single form.",
    docs: "docs/contracts/README.md#forms",
    __types: defineTypes<void, void, Form>(),
  },
  create: {
    method: "POST",
    path: "/admin/forms",
    description: "Create a workflow-bound form.",
    docs: "docs/contracts/README.md#forms",
    __types: defineTypes<void, FormCreateRequest, Form>(),
  },
  update: {
    method: "PUT",
    path: "/admin/forms/:id",
    description: "Update form schema or metadata.",
    docs: "docs/contracts/README.md#forms",
    __types: defineTypes<void, FormUpdateRequest, Form>(),
  },
  remove: {
    method: "DELETE",
    path: "/admin/forms/:id",
    description: "Soft delete a form.",
    docs: "docs/contracts/README.md#forms",
    __types: defineTypes<void, void, void>(),
  },
  generateCss: {
    method: "POST",
    path: "/admin/forms/generate-css",
    description: "Generate CSS via AI.",
    docs: "docs/contracts/README.md#forms",
    __types: defineTypes<
      void,
      FormGenerateCSSRequest,
      FormGenerateCSSResponse
    >(),
  },
  refineCss: {
    method: "POST",
    path: "/admin/forms/refine-css",
    description: "Refine CSS via AI.",
    docs: "docs/contracts/README.md#forms",
    __types: defineTypes<void, FormRefineCSSRequest, FormRefineCSSResponse>(),
  },
} satisfies Record<string, ApiEndpointContract<any, any, any>>;

export const jobContracts = {
  list: {
    method: "GET",
    path: "/admin/jobs",
    description: "List jobs (supports status/workflow filters).",
    docs: "docs/contracts/README.md#jobs--execution",
    __types: defineTypes<JobListParams | undefined, void, JobListResponse>(),
  },
  detail: {
    method: "GET",
    path: "/admin/jobs/:id",
    description: "Fetch a single job.",
    docs: "docs/contracts/README.md#jobs--execution",
    __types: defineTypes<void, void, Job>(),
  },
  resubmit: {
    method: "POST",
    path: "/admin/jobs/:id/resubmit",
    description: "Resubmit a failed job.",
    docs: "docs/contracts/README.md#jobs--execution",
    __types: defineTypes<void, void, JobResubmitResponse>(),
  },
  rerunStep: {
    method: "POST",
    path: "/admin/jobs/:id/rerun-step",
    description: "Rerun a job step.",
    docs: "docs/contracts/README.md#jobs--execution",
    __types: defineTypes<void, JobRerunRequest, JobRerunResponse>(),
  },
  quickEditStep: {
    method: "POST",
    path: "/admin/jobs/:id/quick-edit-step",
    description: "Quick edit a job step output via AI.",
    docs: "docs/contracts/README.md#jobs--execution",
    __types: defineTypes<void, JobQuickEditRequest, JobQuickEditResponse>(),
  },
  executionSteps: {
    method: "GET",
    path: "/admin/jobs/:id/execution-steps",
    description: "Fetch execution step metadata.",
    docs: "docs/contracts/README.md#jobs--execution",
    __types: defineTypes<void, void, ExecutionStep[]>(),
  },
  document: {
    method: "GET",
    path: "/admin/jobs/:id/document",
    description: "Fetch rendered job document (HTML/Markdown).",
    docs: "docs/contracts/README.md#jobs--execution",
    __types: defineTypes<void, void, JobsDocumentResponse>(),
  },
} satisfies Record<string, ApiEndpointContract<any, any, any>>;

export const templateContracts = {
  list: {
    method: "GET",
    path: "/admin/templates",
    description: "List templates.",
    docs: "docs/contracts/README.md#templates--notifications-snapshot",
    __types: defineTypes<
      Record<string, unknown> | undefined,
      void,
      TemplateListResponse
    >(),
  },
  detail: {
    method: "GET",
    path: "/admin/templates/:id",
    description: "Fetch a template.",
    docs: "docs/contracts/README.md#templates--notifications-snapshot",
    __types: defineTypes<void, void, Template>(),
  },
  create: {
    method: "POST",
    path: "/admin/templates",
    description: "Create a template.",
    docs: "docs/contracts/README.md#templates--notifications-snapshot",
    __types: defineTypes<void, TemplateCreateRequest, Template>(),
  },
  update: {
    method: "PUT",
    path: "/admin/templates/:id",
    description: "Update a template.",
    docs: "docs/contracts/README.md#templates--notifications-snapshot",
    __types: defineTypes<void, TemplateUpdateRequest, Template>(),
  },
  generateWithAI: {
    method: "POST",
    path: "/admin/templates/generate-with-ai",
    description: "AI-generate template HTML.",
    docs: "docs/contracts/README.md#templates--notifications-snapshot",
    __types: defineTypes<
      void,
      TemplateGenerateRequest,
      TemplateGenerateResponse
    >(),
  },
  refineWithAI: {
    method: "POST",
    path: "/admin/templates/refine-with-ai",
    description: "Refine template HTML via AI.",
    docs: "docs/contracts/README.md#templates--notifications-snapshot",
    __types: defineTypes<void, TemplateRefineRequest, TemplateRefineResponse>(),
  },
} satisfies Record<string, ApiEndpointContract<any, any, any>>;

export const notificationContracts = {
  list: {
    method: "GET",
    path: "/admin/notifications",
    description: "List notifications (optional unread filter).",
    docs: "docs/contracts/README.md#templates--notifications-snapshot",
    __types: defineTypes<
      { unread_only?: boolean } | undefined,
      void,
      NotificationListResponse
    >(),
  },
  markRead: {
    method: "POST",
    path: "/admin/notifications/:id/mark-read",
    description: "Mark a notification as read.",
    docs: "docs/contracts/README.md#templates--notifications-snapshot",
    __types: defineTypes<void, void, void>(),
  },
  markAllRead: {
    method: "POST",
    path: "/admin/notifications/mark-all-read",
    description: "Mark every notification as read.",
    docs: "docs/contracts/README.md#templates--notifications-snapshot",
    __types: defineTypes<void, void, void>(),
  },
} satisfies Record<string, ApiEndpointContract<any, any, any>>;

export const settingsContracts = {
  detail: {
    method: "GET",
    path: "/admin/settings",
    description: "Fetch tenant settings & onboarding state.",
    docs: "docs/contracts/README.md#settings--analytics-snapshot",
    __types: defineTypes<void, void, Settings>(),
  },
  update: {
    method: "PUT",
    path: "/admin/settings",
    description: "Update general settings.",
    docs: "docs/contracts/README.md#settings--analytics-snapshot",
    __types: defineTypes<void, SettingsUpdateRequest, Settings>(),
  },
  onboardingSurvey: {
    method: "POST",
    path: "/admin/settings/onboarding-survey",
    description: "Submit onboarding survey responses.",
    docs: "docs/contracts/README.md#settings--analytics-snapshot",
    __types: defineTypes<void, Record<string, unknown>, Settings>(),
  },
  analytics: {
    method: "GET",
    path: "/admin/analytics",
    description: "Fetch analytics overview.",
    docs: "docs/contracts/README.md#settings--analytics-snapshot",
    __types: defineTypes<
      Record<string, unknown> | undefined,
      void,
      AnalyticsResponse
    >(),
  },
  usage: {
    method: "GET",
    path: "/admin/usage",
    description: "Fetch OpenAI usage summary.",
    docs: "docs/contracts/README.md#settings--analytics-snapshot",
    __types: defineTypes<
      { start_date?: string; end_date?: string } | undefined,
      void,
      UsageResponse
    >(),
  },
} satisfies Record<string, ApiEndpointContract<any, any, any>>;

export const apiContracts = {
  workflows: workflowContracts,
  forms: formContracts,
  jobs: jobContracts,
  templates: templateContracts,
  notifications: notificationContracts,
  settings: settingsContracts,
} as const;

export type ApiContracts = typeof apiContracts;
