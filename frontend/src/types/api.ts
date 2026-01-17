/**
 * API-related types and response structures
 */

import {
  Workflow,
  WorkflowListResponse,
  WorkflowCreateRequest,
  WorkflowUpdateRequest,
  WorkflowGenerationRequest,
  WorkflowGenerationResponse,
  WorkflowRefineInstructionsRequest,
  WorkflowRefineInstructionsResponse,
  WorkflowVersionListResponse,
  WorkflowVersionRecord,
  AIModelConfig,
  WorkflowAIEditResponse,
  WorkflowAIImprovement,
  WorkflowImprovementStatus,
} from "./workflow";
import {
  Form,
  FormListResponse,
  FormCreateRequest,
  FormUpdateRequest,
  FormGenerateCSSRequest,
  FormGenerateCSSResponse,
  FormRefineCSSRequest,
  FormRefineCSSResponse,
  FormSubmission,
} from "./form";
import {
  Template,
  TemplateListResponse,
  TemplateCreateRequest,
  TemplateUpdateRequest,
  TemplateGenerateRequest,
  TemplateGenerateResponse,
  TemplateRefineRequest,
  TemplateRefineResponse,
} from "./template";
import {
  Job,
  JobListResponse,
  JobListParams,
  JobResubmitResponse,
  JobStatusResponse,
} from "./job";
import { Artifact, ArtifactListResponse, ArtifactListParams } from "./artifact";
import { Notification, NotificationListResponse } from "./notification";
import { Settings, SettingsUpdateRequest } from "./settings";
import { AnalyticsResponse } from "./analytics";
import { UsageResponse } from "./usage";

/**
 * Base API response wrapper
 */
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

/**
 * API client interface
 */
export interface ApiClient {
  // Workflows
  getWorkflows(params?: Record<string, unknown>): Promise<WorkflowListResponse>;
  getWorkflow(id: string): Promise<Workflow>;
  createWorkflow(data: WorkflowCreateRequest): Promise<Workflow>;
  updateWorkflow(id: string, data: WorkflowUpdateRequest): Promise<Workflow>;
  deleteWorkflow(id: string): Promise<void>;
  getWorkflowVersions(
    id: string,
    params?: Record<string, unknown>,
  ): Promise<WorkflowVersionListResponse>;
  getWorkflowVersion(id: string, version: number): Promise<WorkflowVersionRecord>;
  restoreWorkflowVersion(id: string, version: number): Promise<Workflow>;
  getModels(): Promise<{ models: AIModelConfig[] }>;

  // Forms
  getForms(params?: Record<string, unknown>): Promise<FormListResponse>;
  getForm(id: string): Promise<Form>;
  createForm(data: FormCreateRequest): Promise<Form>;
  updateForm(id: string, data: FormUpdateRequest): Promise<Form>;
  deleteForm(id: string): Promise<void>;

  // Templates
  getTemplates(params?: Record<string, unknown>): Promise<TemplateListResponse>;
  getTemplate(id: string): Promise<Template>;
  createTemplate(data: TemplateCreateRequest): Promise<Template>;
  updateTemplate(id: string, data: TemplateUpdateRequest): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;

  // Jobs
  getJobs(params?: JobListParams): Promise<JobListResponse>;
  getJob(id: string): Promise<Job>;
  getJobStatus(id: string): Promise<JobStatusResponse>;
  resubmitJob(jobId: string): Promise<JobResubmitResponse>;

  // Artifacts
  getArtifacts(params?: ArtifactListParams): Promise<ArtifactListResponse>;
  getArtifact(id: string): Promise<Artifact>;

  // Submissions
  getSubmissions(params?: {
    form_id?: string;
    limit?: number;
  }): Promise<{ submissions: FormSubmission[]; count: number }>;
  getSubmission(id: string): Promise<FormSubmission>;

  // AI Generation
  generateWorkflowWithAI(
    request: WorkflowGenerationRequest,
  ): Promise<WorkflowGenerationResponse>;
  getWorkflowGenerationStatus(
    jobId: string,
  ): Promise<WorkflowGenerationResponse>;
  refineWorkflowInstructions(
    workflowId: string,
    request: WorkflowRefineInstructionsRequest,
  ): Promise<WorkflowRefineInstructionsResponse>;
  refineInstructions(
    request: WorkflowRefineInstructionsRequest,
  ): Promise<WorkflowRefineInstructionsResponse>;

  generateStepWithAI(
    workflowId: string,
    request: {
      userPrompt: string;
      action?: "update" | "add";
      currentStep?: any;
      currentStepIndex?: number;
    },
  ): Promise<{
    action: "update" | "add";
    step_index?: number;
    step: any;
  }>;

  editWorkflowWithAI(
    workflowId: string,
    request: {
      userPrompt: string;
      contextJobId?: string;
    },
  ): Promise<{
    job_id: string;
    status: "pending" | "processing" | "completed" | "failed";
    message?: string;
  }>;

  getWorkflowAIEditStatus(jobId: string): Promise<{
    job_id: string;
    status: "pending" | "processing" | "completed" | "failed";
    result: WorkflowAIEditResponse | null;
    error_message?: string | null;
    workflow_id?: string | null;
    improvement_status?: WorkflowImprovementStatus | null;
    reviewed_at?: string | null;
    created_at?: string;
    updated_at?: string;
  }>;

  getWorkflowAIImprovements(
    workflowId: string,
  ): Promise<{ improvements: WorkflowAIImprovement[] }>;

  reviewWorkflowAIImprovement(
    jobId: string,
    status: WorkflowImprovementStatus,
  ): Promise<{ improvement: WorkflowAIImprovement }>;

  testStep(request: { step: any; input?: any }): Promise<{
    job_id: string;
    status: string;
    message: string;
  }>;

  testWorkflow(request: { steps: any[]; input?: any }): Promise<{
    job_id: string;
    status: string;
    message: string;
  }>;

  // Template AI
  generateTemplateWithAI(
    request: TemplateGenerateRequest,
  ): Promise<TemplateGenerateResponse>;
  refineTemplateWithAI(
    request: TemplateRefineRequest,
  ): Promise<TemplateRefineResponse>;

  // Form AI
  generateFormCSS(
    request: FormGenerateCSSRequest,
  ): Promise<FormGenerateCSSResponse>;
  refineFormCSS(request: FormRefineCSSRequest): Promise<FormRefineCSSResponse>;

  // Notifications
  getNotifications(unreadOnly?: boolean): Promise<NotificationListResponse>;
  markNotificationRead(notificationId: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(data: SettingsUpdateRequest): Promise<Settings>;

  // Cloudflare
  connectCloudflare(apiToken: string): Promise<{ message: string; connected: boolean }>;
  getCloudflareStatus(): Promise<{ connected: boolean; connected_at: string | null }>;
  createCloudflareDNSRecords(data: {
    forms_subdomain?: string;
    assets_subdomain?: string;
    cloudfront_domain: string;
  }): Promise<{
    message: string;
    records_created: Array<{ name: string; type: string; content: string }>;
    errors?: Array<{ name: string; error: string }>;
  }>;
  disconnectCloudflare(): Promise<{ message: string; connected: boolean }>;

  // Analytics
  getAnalytics(params?: Record<string, unknown>): Promise<AnalyticsResponse>;

  // Usage
  getUsage(startDate?: string, endDate?: string): Promise<UsageResponse>;

  // Onboarding
  updateOnboardingSurvey(
    surveyResponses: Record<string, unknown>,
  ): Promise<Settings>;
  updateOnboardingChecklist(
    checklist: Record<string, boolean>,
  ): Promise<Settings>;
}
