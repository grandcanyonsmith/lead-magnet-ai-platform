import { ApiError } from '@utils/errors';
import { RouteResponse } from '@routes/routes';
import { cssGenerationService } from '@services/cssGenerationService';

/**
 * Controller for AI-powered form operations.
 * Handles CSS generation and refinement.
 */
export class FormAIController {
  /**
   * Generate CSS for a form using AI.
   */
  async generateCSS(tenantId: string, body: any): Promise<RouteResponse> {
    const { form_fields_schema, css_prompt } = body;

    if (!form_fields_schema || !form_fields_schema.fields || form_fields_schema.fields.length === 0) {
      throw new ApiError('Form fields schema is required', 400);
    }

    if (!css_prompt || !css_prompt.trim()) {
      throw new ApiError('CSS prompt is required', 400);
    }

    const css = await cssGenerationService.generateCSS({
      form_fields_schema,
      css_prompt,
      tenantId,
    });

    return {
      statusCode: 200,
      body: {
        css,
      },
    };
  }

  /**
   * Refine CSS for a form using AI.
   */
  async refineCSS(tenantId: string, body: any): Promise<RouteResponse> {
    const { current_css, css_prompt } = body;

    if (!current_css || !current_css.trim()) {
      throw new ApiError('Current CSS is required', 400);
    }

    if (!css_prompt || !css_prompt.trim()) {
      throw new ApiError('CSS prompt is required', 400);
    }

    const css = await cssGenerationService.refineCSS({
      current_css,
      css_prompt,
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

export const formAIController = new FormAIController();

