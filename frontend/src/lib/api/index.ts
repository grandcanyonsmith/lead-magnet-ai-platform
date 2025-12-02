/**
 * Main API client that combines all domain-specific clients
 * This provides a unified interface matching the original ApiClient
 */

import { TokenProvider } from './base.client'
import { LocalStorageTokenProvider } from './token-provider'
import { BaseApiClient } from './base.client'
import { WorkflowsClient } from './workflows.client'
import { FormsClient } from './forms.client'
import { TemplatesClient } from './templates.client'
import { JobsClient } from './jobs.client'
import { ArtifactsClient } from './artifacts.client'
import { SubmissionsClient } from './submissions.client'
import { NotificationsClient } from './notifications.client'
import { SettingsClient } from './settings.client'
import { AnalyticsClient } from './analytics.client'
import { UsageClient } from './usage.client'
import { WebhookLogsClient } from './webhookLogs.client'
import { ApiClient, ArtifactListParams, ArtifactListResponse, Artifact, FormUpdateRequest, TemplateUpdateRequest, WorkflowUpdateRequest } from '@/types'
import { AxiosRequestConfig } from 'axios'

class ApiClientImpl extends BaseApiClient implements ApiClient {
  public workflows: WorkflowsClient
  public forms: FormsClient
  public templates: TemplatesClient
  public jobs: JobsClient
  public artifacts: ArtifactsClient
  public submissions: SubmissionsClient
  public notifications: NotificationsClient
  public settings: SettingsClient
  public analytics: AnalyticsClient
  public usage: UsageClient
  public webhookLogs: WebhookLogsClient

  constructor(tokenProvider?: TokenProvider) {
    super(tokenProvider || new LocalStorageTokenProvider())
    
    this.workflows = new WorkflowsClient(this.tokenProvider)
    this.forms = new FormsClient(this.tokenProvider)
    this.templates = new TemplatesClient(this.tokenProvider)
    this.jobs = new JobsClient(this.tokenProvider)
    this.artifacts = new ArtifactsClient(this.tokenProvider)
    this.submissions = new SubmissionsClient(this.tokenProvider)
    this.notifications = new NotificationsClient(this.tokenProvider)
    this.settings = new SettingsClient(this.tokenProvider)
    this.analytics = new AnalyticsClient(this.tokenProvider)
    this.usage = new UsageClient(this.tokenProvider)
    this.webhookLogs = new WebhookLogsClient(this.tokenProvider)
  }

  // Generic HTTP methods for direct endpoint access
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return super.get<T>(url, config)
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return super.post<T>(url, data, config)
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return super.put<T>(url, data, config)
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return super.delete<T>(url, config)
  }

  // Workflows - delegate to workflows client
  async getWorkflows(params?: Record<string, unknown>) {
    return this.workflows.getWorkflows(params)
  }

  async getWorkflow(id: string) {
    return this.workflows.getWorkflow(id)
  }

  async createWorkflow(data: Parameters<WorkflowsClient['createWorkflow']>[0]) {
    return this.workflows.createWorkflow(data)
  }

  async updateWorkflow(id: string, data: WorkflowUpdateRequest) {
    return this.workflows.updateWorkflow(id, data)
  }

  async deleteWorkflow(id: string) {
    return this.workflows.deleteWorkflow(id)
  }

  // Forms - delegate to forms client
  async getForms(params?: Record<string, unknown>) {
    return this.forms.getForms(params)
  }

  async getForm(id: string) {
    return this.forms.getForm(id)
  }

  async createForm(data: Parameters<FormsClient['createForm']>[0]) {
    return this.forms.createForm(data)
  }

  async updateForm(id: string, data: FormUpdateRequest) {
    return this.forms.updateForm(id, data)
  }

  async deleteForm(id: string) {
    return this.forms.deleteForm(id)
  }

  // Templates - delegate to templates client
  async getTemplates(params?: Record<string, unknown>) {
    return this.templates.getTemplates(params)
  }

  async getTemplate(id: string) {
    return this.templates.getTemplate(id)
  }

  async createTemplate(data: Parameters<TemplatesClient['createTemplate']>[0]) {
    return this.templates.createTemplate(data)
  }

  async updateTemplate(id: string, data: TemplateUpdateRequest) {
    return this.templates.updateTemplate(id, data)
  }

  async deleteTemplate(id: string) {
    return this.templates.deleteTemplate(id)
  }

  // Jobs - delegate to jobs client
  async getJobs(params?: Parameters<JobsClient['getJobs']>[0]) {
    return this.jobs.getJobs(params)
  }

  async getJob(id: string) {
    return this.jobs.getJob(id)
  }

  async resubmitJob(jobId: string) {
    return this.jobs.resubmitJob(jobId)
  }

  async rerunStep(jobId: string, stepIndex: number, continueAfter: boolean = false) {
    return this.jobs.rerunStep(jobId, stepIndex, continueAfter)
  }

  async quickEditStep(jobId: string, stepOrder: number, userPrompt: string, save?: boolean) {
    return this.jobs.quickEditStep(jobId, stepOrder, userPrompt, save)
  }

  async getExecutionSteps(jobId: string) {
    return this.jobs.getExecutionSteps(jobId)
  }

  async getJobDocument(jobId: string): Promise<string> {
    return this.jobs.getJobDocument(jobId)
  }

  async getJobDocumentBlobUrl(jobId: string): Promise<string> {
    return this.jobs.getJobDocumentBlobUrl(jobId)
  }

  // Artifacts - delegate to artifacts client
  async getArtifacts(params?: ArtifactListParams): Promise<ArtifactListResponse> {
    return this.artifacts.getArtifacts(params)
  }

  async getArtifact(id: string): Promise<Artifact> {
    return this.artifacts.getArtifact(id)
  }

  async getArtifactContent(id: string): Promise<string> {
    return this.artifacts.getArtifactContent(id)
  }

  // Submissions - delegate to submissions client
  async getSubmissions(params?: { form_id?: string; limit?: number }) {
    return this.submissions.getSubmissions(params)
  }

  async getSubmission(id: string) {
    return this.submissions.getSubmission(id)
  }

  // AI Generation - delegate to workflows client
  async generateWorkflowWithAI(request: Parameters<WorkflowsClient['generateWorkflowWithAI']>[0]) {
    return this.workflows.generateWorkflowWithAI(request)
  }

  async getWorkflowGenerationStatus(jobId: string) {
    return this.workflows.getWorkflowGenerationStatus(jobId)
  }

  async refineWorkflowInstructions(workflowId: string, request: Parameters<WorkflowsClient['refineWorkflowInstructions']>[1]) {
    return this.workflows.refineWorkflowInstructions(workflowId, request)
  }

  async refineInstructions(request: Parameters<WorkflowsClient['refineInstructions']>[0]) {
    return this.workflows.refineInstructions(request)
  }

  async generateStepWithAI(workflowId: string, request: Parameters<WorkflowsClient['generateStepWithAI']>[1]) {
    return this.workflows.generateStepWithAI(workflowId, request)
  }

  async editWorkflowWithAI(workflowId: string, request: Parameters<WorkflowsClient['editWorkflowWithAI']>[1]) {
    return this.workflows.editWorkflowWithAI(workflowId, request)
  }

  // Template AI - delegate to templates client
  async generateTemplateWithAI(request: Parameters<TemplatesClient['generateTemplateWithAI']>[0]) {
    return this.templates.generateTemplateWithAI(request)
  }

  async refineTemplateWithAI(request: Parameters<TemplatesClient['refineTemplateWithAI']>[0]) {
    return this.templates.refineTemplateWithAI(request)
  }

  // Form AI - delegate to forms client
  async generateFormCSS(request: Parameters<FormsClient['generateFormCSS']>[0]) {
    return this.forms.generateFormCSS(request)
  }

  async refineFormCSS(request: Parameters<FormsClient['refineFormCSS']>[0]) {
    return this.forms.refineFormCSS(request)
  }

  // Notifications - delegate to notifications client
  async getNotifications(unreadOnly?: boolean) {
    return this.notifications.getNotifications(unreadOnly)
  }

  async markNotificationRead(notificationId: string) {
    return this.notifications.markNotificationRead(notificationId)
  }

  async markAllNotificationsRead() {
    return this.notifications.markAllNotificationsRead()
  }

  // Settings - delegate to settings client
  async getSettings() {
    return this.settings.getSettings()
  }

  async updateSettings(data: Parameters<SettingsClient['updateSettings']>[0]) {
    return this.settings.updateSettings(data)
  }

  // Analytics - delegate to analytics client
  async getAnalytics(params?: Record<string, unknown>) {
    return this.analytics.getAnalytics(params)
  }

  // Usage - delegate to usage client
  async getUsage(startDate?: string, endDate?: string) {
    return this.usage.getUsage(startDate, endDate)
  }

  // Onboarding - delegate to settings client
  async updateOnboardingSurvey(surveyResponses: Record<string, unknown>) {
    return this.settings.updateOnboardingSurvey(surveyResponses)
  }

  async updateOnboardingChecklist(checklist: Record<string, boolean>) {
    return this.settings.updateOnboardingChecklist(checklist)
  }
}

// Export singleton instance for backward compatibility
export const api = new ApiClientImpl()

// Export class for testing
export { ApiClientImpl }

