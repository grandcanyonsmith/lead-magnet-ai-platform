import { RouteResponse } from '@routes/routes';
import { cssGenerationService } from '@services/cssGenerationService';
import { formManagementService } from '@domains/forms/services/formManagementService';

class FormsController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    return {
      statusCode: 200,
      body: await formManagementService.listForms(tenantId, limit),
    };
  }

  async get(tenantId: string, formId: string): Promise<RouteResponse> {
    return {
      statusCode: 200,
      body: await formManagementService.getForm(tenantId, formId),
    };
  }

  async getPublicForm(slug: string): Promise<RouteResponse> {
    return {
      statusCode: 200,
      body: await formManagementService.getPublicForm(slug),
    };
  }

  async submitForm(slug: string, body: any, sourceIp: string): Promise<RouteResponse> {
    return {
      statusCode: 202,
      body: await formManagementService.submitPublicForm(slug, body, sourceIp),
    };
  }

  async create(tenantId: string, body: any): Promise<RouteResponse> {
    return {
      statusCode: 201,
      body: await formManagementService.createForm(tenantId, body),
    };
  }

  async update(tenantId: string, formId: string, body: any): Promise<RouteResponse> {
    return {
      statusCode: 200,
      body: await formManagementService.updateForm(tenantId, formId, body),
    };
  }

  async delete(tenantId: string, formId: string): Promise<RouteResponse> {
    await formManagementService.deleteForm(tenantId, formId);
    return {
      statusCode: 204,
      body: {},
    };
  }

  async generateCSS(tenantId: string, body: any): Promise<RouteResponse> {
    const css = await cssGenerationService.generateCSS({
      form_fields_schema: body.form_fields_schema,
      css_prompt: body.css_prompt,
      model: body.model,
      tenantId,
    });

    return {
      statusCode: 200,
      body: {
        css,
      },
    };
  }

  async refineCSS(tenantId: string, body: any): Promise<RouteResponse> {
    const css = await cssGenerationService.refineCSS({
      current_css: body.current_css,
      css_prompt: body.css_prompt,
      model: body.model,
      tenantId,
    });

    return {
      statusCode: 200,
      body: {
        css,
      },
    };
  }
}

export const formsController = new FormsController();

