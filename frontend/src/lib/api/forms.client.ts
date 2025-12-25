/**
 * Forms API client
 */

import { BaseApiClient, TokenProvider } from "./base.client";
import {
  Form,
  FormListResponse,
  FormCreateRequest,
  FormUpdateRequest,
  FormGenerateCSSRequest,
  FormGenerateCSSResponse,
  FormRefineCSSRequest,
  FormRefineCSSResponse,
} from "@/types";

export class FormsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider);
  }

  async getForms(params?: Record<string, unknown>): Promise<FormListResponse> {
    return this.get<FormListResponse>("/admin/forms", { params });
  }

  async getForm(id: string): Promise<Form> {
    return this.get<Form>(`/admin/forms/${id}`);
  }

  async createForm(data: FormCreateRequest): Promise<Form> {
    return this.post<Form>("/admin/forms", data);
  }

  async updateForm(id: string, data: FormUpdateRequest): Promise<Form> {
    return this.put<Form>(`/admin/forms/${id}`, data);
  }

  async deleteForm(id: string): Promise<void> {
    return this.delete<void>(`/admin/forms/${id}`);
  }

  async generateFormCSS(
    request: FormGenerateCSSRequest,
  ): Promise<FormGenerateCSSResponse> {
    return this.post<FormGenerateCSSResponse>("/admin/forms/generate-css", {
      form_fields_schema: request.form_fields_schema,
      css_prompt: request.css_prompt,
      model: request.model || "gpt-4o",
    });
  }

  async refineFormCSS(
    request: FormRefineCSSRequest,
  ): Promise<FormRefineCSSResponse> {
    return this.post<FormRefineCSSResponse>("/admin/forms/refine-css", {
      current_css: request.current_css,
      css_prompt: request.css_prompt,
      model: request.model || "gpt-4o",
    });
  }
}
