/**
 * Settings API client
 */

import { BaseApiClient, TokenProvider } from "./base.client";
import { PromptDefaults, Settings, SettingsUpdateRequest } from "@/types";

export class SettingsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider);
  }

  // ... rest of the file ...

  async getSettings(): Promise<Settings> {
    return this.get<Settings>("/admin/settings");
  }

  async updateSettings(data: SettingsUpdateRequest): Promise<Settings> {
    return this.put<Settings>("/admin/settings", data);
  }

  async getPromptDefaults(): Promise<PromptDefaults> {
    return this.get<PromptDefaults>("/admin/settings/prompt-defaults");
  }

  async updateOnboardingSurvey(
    surveyResponses: Record<string, unknown>,
  ): Promise<Settings> {
    return this.updateSettings({
      onboarding_survey_completed: true,
      onboarding_survey_responses: surveyResponses,
    });
  }

  async updateOnboardingChecklist(
    checklist: Record<string, boolean>,
  ): Promise<Settings> {
    return this.updateSettings({
      onboarding_checklist: checklist,
    });
  }

  async regenerateWebhookToken(): Promise<Settings> {
    return this.post<Settings>("/admin/settings/webhook/regenerate");
  }

  async getWebhookUrl(): Promise<{
    webhook_url: string;
    webhook_token: string;
  }> {
    return this.get<{ webhook_url: string; webhook_token: string }>(
      "/admin/settings/webhook",
    );
  }

  // Cloudflare integration methods
  async connectCloudflare(apiToken: string): Promise<{ message: string; connected: boolean }> {
    return this.post<{ message: string; connected: boolean }>(
      "/admin/settings/cloudflare/connect",
      { api_token: apiToken }
    );
  }

  async getCloudflareStatus(): Promise<{ connected: boolean; connected_at: string | null }> {
    return this.get<{ connected: boolean; connected_at: string | null }>(
      "/admin/settings/cloudflare/status"
    );
  }

  async createCloudflareDNSRecords(data: {
    forms_subdomain?: string;
    assets_subdomain?: string;
    cloudfront_domain: string;
  }): Promise<{
    message: string;
    records_created: Array<{ name: string; type: string; content: string }>;
    errors?: Array<{ name: string; error: string }>;
  }> {
    return this.post<
      {
        message: string;
        records_created: Array<{ name: string; type: string; content: string }>;
        errors?: Array<{ name: string; error: string }>;
      }
    >("/admin/settings/cloudflare/dns/create", data);
  }

  async disconnectCloudflare(): Promise<{ message: string; connected: boolean }> {
    return this.post<{ message: string; connected: boolean }>(
      "/admin/settings/cloudflare/disconnect"
    );
  }
}
