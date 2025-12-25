/**
 * Submissions API client
 */

import { BaseApiClient, TokenProvider } from "./base.client";
import { FormSubmission } from "@/types";

export class SubmissionsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider);
  }

  async getSubmissions(params?: {
    form_id?: string;
    limit?: number;
  }): Promise<{ submissions: FormSubmission[]; count: number }> {
    return this.get<{ submissions: FormSubmission[]; count: number }>(
      "/admin/submissions",
      { params },
    );
  }

  async getSubmission(id: string): Promise<FormSubmission> {
    const data = await this.get<any>(`/admin/submissions/${id}`);
    // Map submission_data to form_data for frontend compatibility
    return {
      ...data,
      form_data: data.submission_data || data.form_data || {},
    } as FormSubmission;
  }
}
