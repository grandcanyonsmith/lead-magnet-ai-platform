/**
 * Settings API client
 */

import { BaseApiClient, TokenProvider } from './base.client'
import {
  Settings,
  SettingsUpdateRequest,
} from '@/types'

export class SettingsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider)
  }

  async getSettings(): Promise<Settings> {
    return this.get<Settings>('/admin/settings')
  }

  async updateSettings(data: SettingsUpdateRequest): Promise<Settings> {
    return this.put<Settings>('/admin/settings', data)
  }

  async updateOnboardingSurvey(surveyResponses: Record<string, unknown>): Promise<Settings> {
    return this.updateSettings({
      onboarding_survey_completed: true,
      onboarding_survey_responses: surveyResponses,
    })
  }

  async updateOnboardingChecklist(checklist: Record<string, boolean>): Promise<Settings> {
    return this.updateSettings({
      onboarding_checklist: checklist,
    })
  }

  async regenerateWebhookToken(): Promise<Settings> {
    return this.post<Settings>('/admin/settings/webhook/regenerate')
  }

  async getWebhookUrl(): Promise<{ webhook_url: string; webhook_token: string }> {
    return this.get<{ webhook_url: string; webhook_token: string }>('/admin/settings/webhook')
  }
}

