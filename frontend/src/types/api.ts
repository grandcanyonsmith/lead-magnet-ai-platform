/**
 * API-related types and response structures
 */

import { Workflow, WorkflowListResponse, WorkflowCreateRequest, WorkflowUpdateRequest, WorkflowGenerationRequest, WorkflowGenerationResponse, WorkflowRefineInstructionsRequest, WorkflowRefineInstructionsResponse } from './workflow'
import { Form, FormListResponse, FormCreateRequest, FormUpdateRequest, FormGenerateCSSRequest, FormGenerateCSSResponse, FormRefineCSSRequest, FormRefineCSSResponse } from './form'
import { Template, TemplateListResponse, TemplateCreateRequest, TemplateUpdateRequest, TemplateGenerateRequest, TemplateGenerateResponse, TemplateRefineRequest, TemplateRefineResponse } from './template'
import { Job, JobListResponse, JobListParams, JobResubmitResponse } from './job'
import { Notification, NotificationListResponse } from './notification'
import { Settings, SettingsUpdateRequest } from './settings'
import { AnalyticsResponse } from './analytics'
import { UsageResponse } from './usage'

/**
 * Base API response wrapper
 */
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

/**
 * API client interface
 */
export interface ApiClient {
  // Workflows
  getWorkflows(params?: Record<string, unknown>): Promise<WorkflowListResponse>
  getWorkflow(id: string): Promise<Workflow>
  createWorkflow(data: WorkflowCreateRequest): Promise<Workflow>
  updateWorkflow(id: string, data: WorkflowUpdateRequest): Promise<Workflow>
  deleteWorkflow(id: string): Promise<void>
  
  // Forms
  getForms(params?: Record<string, unknown>): Promise<FormListResponse>
  getForm(id: string): Promise<Form>
  createForm(data: FormCreateRequest): Promise<Form>
  updateForm(id: string, data: FormUpdateRequest): Promise<Form>
  deleteForm(id: string): Promise<void>
  
  // Templates
  getTemplates(params?: Record<string, unknown>): Promise<TemplateListResponse>
  getTemplate(id: string): Promise<Template>
  createTemplate(data: TemplateCreateRequest): Promise<Template>
  updateTemplate(id: string, data: TemplateUpdateRequest): Promise<Template>
  deleteTemplate(id: string): Promise<void>
  
  // Jobs
  getJobs(params?: JobListParams): Promise<JobListResponse>
  getJob(id: string): Promise<Job>
  resubmitJob(jobId: string): Promise<JobResubmitResponse>
  
  // AI Generation
  generateWorkflowWithAI(request: WorkflowGenerationRequest): Promise<WorkflowGenerationResponse>
  getWorkflowGenerationStatus(jobId: string): Promise<WorkflowGenerationResponse>
  refineWorkflowInstructions(workflowId: string, request: WorkflowRefineInstructionsRequest): Promise<WorkflowRefineInstructionsResponse>
  refineInstructions(request: WorkflowRefineInstructionsRequest): Promise<WorkflowRefineInstructionsResponse>
  
  // Template AI
  generateTemplateWithAI(request: TemplateGenerateRequest): Promise<TemplateGenerateResponse>
  refineTemplateWithAI(request: TemplateRefineRequest): Promise<TemplateRefineResponse>
  
  // Form AI
  generateFormCSS(request: FormGenerateCSSRequest): Promise<FormGenerateCSSResponse>
  refineFormCSS(request: FormRefineCSSRequest): Promise<FormRefineCSSResponse>
  
  // Notifications
  getNotifications(unreadOnly?: boolean): Promise<NotificationListResponse>
  markNotificationRead(notificationId: string): Promise<void>
  markAllNotificationsRead(): Promise<void>
  
  // Settings
  getSettings(): Promise<Settings>
  updateSettings(data: SettingsUpdateRequest): Promise<Settings>
  
  // Analytics
  getAnalytics(params?: Record<string, unknown>): Promise<AnalyticsResponse>
  
  // Usage
  getUsage(startDate?: string, endDate?: string): Promise<UsageResponse>
  
  // Onboarding
  updateOnboardingSurvey(surveyResponses: Record<string, unknown>): Promise<Settings>
  updateOnboardingChecklist(checklist: Record<string, boolean>): Promise<Settings>
}

