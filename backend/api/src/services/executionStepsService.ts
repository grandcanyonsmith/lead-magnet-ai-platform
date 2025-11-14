import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getOpenAIClient } from './openaiService';
import { env } from '../utils/env';

const ARTIFACTS_BUCKET = env.artifactsBucket;
const s3Client = new S3Client({ region: env.awsRegion });

if (!ARTIFACTS_BUCKET) {
  logger.warn('[Execution Steps Service] ARTIFACTS_BUCKET is not configured - execution steps operations may fail');
}

/**
 * Service for managing execution steps stored in S3.
 * Handles fetching, saving, and editing execution steps.
 */
export class ExecutionStepsService {
  /**
   * Fetch execution steps from S3.
   */
  async fetchFromS3(s3Key: string): Promise<any[]> {
    try {
      if (!ARTIFACTS_BUCKET) {
        throw new ApiError('ARTIFACTS_BUCKET environment variable is not configured', 500);
      }

      const command = new GetObjectCommand({
        Bucket: ARTIFACTS_BUCKET,
        Key: s3Key,
      });
      
      const response = await s3Client.send(command);
      
      if (!response.Body) {
        throw new ApiError(`S3 object body is empty for key: ${s3Key}`, 500);
      }
      
      const bodyContents = await response.Body.transformToString();
      
      if (!bodyContents || bodyContents.trim() === '') {
        throw new ApiError(`S3 object content is empty for key: ${s3Key}`, 500);
      }
      
      let parsedData;
      try {
        parsedData = JSON.parse(bodyContents);
      } catch (parseError: any) {
        logger.error('[Execution Steps Service] Failed to parse execution steps JSON', {
          s3Key,
          parseError: parseError.message,
          contentLength: bodyContents.length,
        });
        throw new ApiError(`Failed to parse execution steps JSON from S3: ${parseError.message}`, 500);
      }
      
      // Validate that parsed data is an array
      if (!Array.isArray(parsedData)) {
        logger.error('[Execution Steps Service] Execution steps from S3 is not an array', {
          s3Key,
          dataType: typeof parsedData,
          isArray: Array.isArray(parsedData),
        });
        throw new ApiError(`Execution steps from S3 is not an array. Expected array, got ${typeof parsedData}`, 500);
      }
      
      // Empty array is valid, but log it for debugging
      if (parsedData.length === 0) {
        logger.warn('[Execution Steps Service] Execution steps array is empty', { s3Key });
      }
      
      return parsedData;
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      logger.error('[Execution Steps Service] Error fetching execution steps from S3', {
        s3Key,
        error: error.message,
        errorStack: error.stack,
      });
      throw new ApiError(`Failed to fetch execution steps from S3: ${error.message}`, 500);
    }
  }

  /**
   * Save execution steps to S3.
   */
  async saveToS3(s3Key: string, executionSteps: any[]): Promise<void> {
    try {
      if (!ARTIFACTS_BUCKET) {
        throw new ApiError('ARTIFACTS_BUCKET environment variable is not configured', 500);
      }

      // Validate executionSteps is an array
      if (!Array.isArray(executionSteps)) {
        logger.error('[Execution Steps Service] Cannot save: execution steps is not an array', {
          s3Key,
          executionStepsType: typeof executionSteps,
          isArray: Array.isArray(executionSteps),
        });
        throw new ApiError('Cannot save execution steps: expected array', 500);
      }

      let jsonBody: string;
      try {
        jsonBody = JSON.stringify(executionSteps, null, 2);
      } catch (stringifyError: any) {
        logger.error('[Execution Steps Service] Failed to stringify execution steps for S3', {
          s3Key,
          stepsCount: executionSteps.length,
          error: stringifyError.message,
        });
        throw new ApiError(`Failed to serialize execution steps: ${stringifyError.message}`, 500);
      }

      const command = new PutObjectCommand({
        Bucket: ARTIFACTS_BUCKET,
        Key: s3Key,
        Body: jsonBody,
        ContentType: 'application/json',
      });
      
      await s3Client.send(command);
      logger.info('[Execution Steps Service] Saved execution steps to S3', { 
        s3Key, 
        stepsCount: executionSteps.length,
        bodySize: jsonBody.length,
      });
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      logger.error('[Execution Steps Service] Error saving execution steps to S3', {
        s3Key,
        error: error.message,
        errorStack: error.stack,
      });
      throw new ApiError(`Failed to save execution steps to S3: ${error.message}`, 500);
    }
  }

  /**
   * Edit a step's output using AI.
   */
  async editStep(
    s3Key: string,
    stepOrder: number,
    userPrompt: string,
    save: boolean
  ): Promise<{
    original_output: any;
    edited_output: any;
    changes_summary: string;
    saved: boolean;
  }> {
    // Fetch execution steps from S3
    let executionSteps: any[];
    try {
      executionSteps = await this.fetchFromS3(s3Key);
    } catch (error: any) {
      logger.error('[Execution Steps Service] Failed to fetch execution steps', {
        s3Key,
        error: error.message,
      });
      throw error;
    }

    // Find the step to edit
    const stepIndex = executionSteps.findIndex((step: any) => step.step_order === stepOrder);
    if (stepIndex === -1) {
      logger.warn('[Execution Steps Service] Step not found', {
        s3Key,
        stepOrder,
        availableSteps: executionSteps.map((s: any) => s.step_order),
      });
      throw new ApiError(`Step with order ${stepOrder} not found in execution steps`, 404);
    }

    const step = executionSteps[stepIndex];

    // Validate step structure
    if (!step || typeof step !== 'object') {
      logger.error('[Execution Steps Service] Invalid step structure', {
        s3Key,
        stepOrder,
        stepType: typeof step,
      });
      throw new ApiError(`Step with order ${stepOrder} has invalid structure`, 500);
    }

    // Check if step has output to edit
    if (step.output === null || step.output === undefined || step.output === '') {
      throw new ApiError(`Step with order ${stepOrder} has no output to edit`, 400);
    }

    // Convert step output to string for processing
    let originalOutput: string;
    try {
      if (typeof step.output === 'string') {
        originalOutput = step.output;
      } else {
        originalOutput = JSON.stringify(step.output, null, 2);
      }
    } catch (stringifyError: any) {
      logger.error('[Execution Steps Service] Failed to stringify step output', {
        s3Key,
        stepOrder,
        outputType: typeof step.output,
        error: stringifyError.message,
      });
      throw new ApiError(`Step output is too large or contains circular references: ${stringifyError.message}`, 500);
    }

    logger.info('[Execution Steps Service] Starting AI edit', {
      s3Key,
      stepOrder,
      stepName: step.step_name,
      promptLength: userPrompt.length,
    });

    try {
      // Get OpenAI client
      const openai = await getOpenAIClient();

      // Build context for AI
      const systemPrompt = `You are an AI assistant that helps edit execution step outputs for a lead magnet generation platform.

The user will provide:
1. The original step output (text or JSON)
2. A prompt describing how they want to edit it

Your job is to generate an edited version of the output that follows the user's instructions while maintaining the same format and structure.

Guidelines:
- Preserve the format of the original output (if it's JSON, return JSON; if it's markdown, return markdown)
- Make only the changes requested by the user
- Keep the overall structure and style consistent
- If the output contains structured data, maintain the same schema unless explicitly asked to change it
- Return only the edited output, not explanations or metadata`;

      const userMessage = `Original Step Output:
${originalOutput}

Step Name: ${step.step_name || 'Unknown'}
Step Order: ${stepOrder}

User Request: ${userPrompt}

Please generate the edited output based on the user's request. Return only the edited output, maintaining the same format as the original.`;

      // Call OpenAI
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      const editedOutput = completion.choices[0]?.message?.content;
      if (!editedOutput) {
        throw new Error('No response from OpenAI');
      }

      // Parse edited output if original was JSON
      let parsedEditedOutput: any = editedOutput;
      try {
        if (typeof step.output !== 'string') {
          parsedEditedOutput = JSON.parse(editedOutput);
        }
      } catch {
        // If parsing fails, use as string
        parsedEditedOutput = editedOutput;
      }

      // Generate changes summary
      const changesSummary = `Edited step output based on user prompt: "${userPrompt.substring(0, 100)}${userPrompt.length > 100 ? '...' : ''}"`;

      logger.info('[Execution Steps Service] AI edit completed', {
        s3Key,
        stepOrder,
        originalLength: originalOutput.length,
        editedLength: editedOutput.length,
      });

      // If save is true, update the execution step
      if (save) {
        // Update the step output
        executionSteps[stepIndex] = {
          ...step,
          output: parsedEditedOutput,
          updated_at: new Date().toISOString(),
        };

        // Save back to S3
        await this.saveToS3(s3Key, executionSteps);

        logger.info('[Execution Steps Service] Changes saved', {
          s3Key,
          stepOrder,
        });
      }

      return {
        original_output: step.output,
        edited_output: parsedEditedOutput,
        changes_summary: changesSummary,
        saved: save,
      };
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[Execution Steps Service] Error during AI edit', {
        s3Key,
        stepOrder,
        error: error.message,
        errorStack: error.stack,
      });
      throw new ApiError(`Failed to edit step: ${error.message}`, 500);
    }
  }
}

export const executionStepsService = new ExecutionStepsService();

