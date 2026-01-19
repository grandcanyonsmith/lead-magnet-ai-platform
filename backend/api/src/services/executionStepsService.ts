import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getOpenAIClient } from "./openaiService";
import { env } from "../utils/env";
import { stripMarkdownCodeFences } from "../utils/openaiHelpers";
import {
  getPromptOverridesForTenant,
  resolvePromptOverride,
  type PromptOverrides,
} from "./promptOverrides";

const ARTIFACTS_BUCKET = env.artifactsBucket;
const CLOUDFRONT_DOMAIN = env.cloudfrontDomain;
const AWS_REGION = env.awsRegion;
const s3Client = new S3Client({ region: env.awsRegion });

if (!ARTIFACTS_BUCKET) {
  logger.warn(
    "[Execution Steps Service] ARTIFACTS_BUCKET is not configured - execution steps operations may fail",
  );
}

/**
 * Service for managing execution steps stored in S3.
 * Handles fetching, saving, and editing execution steps.
 */
export class ExecutionStepsService {
  private normalizeImageUrl(url: string): string {
    if (!url || !CLOUDFRONT_DOMAIN) return url;
    try {
      const parsed = new URL(url);
      if (parsed.hostname === CLOUDFRONT_DOMAIN) {
        return url;
      }

      const path = parsed.pathname.replace(/^\/+/, "");
      if (!path) return url;

      const looksLikeArtifact =
        path.startsWith("cust_") && path.includes("/jobs/");
      const isDirectS3 =
        ARTIFACTS_BUCKET &&
        parsed.hostname ===
          `${ARTIFACTS_BUCKET}.s3.${AWS_REGION}.amazonaws.com`;
      const isCloudFront = parsed.hostname.endsWith(".cloudfront.net");

      if (isDirectS3 || (isCloudFront && looksLikeArtifact)) {
        return `https://${CLOUDFRONT_DOMAIN}/${path}`;
      }
    } catch {
      return url;
    }
    return url;
  }

  private normalizeExecutionStepsImageUrls(executionSteps: any[]): any[] {
    if (!Array.isArray(executionSteps)) return executionSteps;

    return executionSteps.map((step) => {
      if (!step || typeof step !== "object") {
        return step;
      }

      let updatedStep = step;

      if (Array.isArray(step.image_urls)) {
        const normalizedUrls = step.image_urls.map((url: any) =>
          this.normalizeImageUrl(String(url)),
        );
        const changed = normalizedUrls.some(
          (url: string, idx: number) => url !== step.image_urls[idx],
        );
        if (changed) {
          updatedStep = { ...updatedStep, image_urls: normalizedUrls };
        }
      }

      if (
        updatedStep.response_details &&
        Array.isArray(updatedStep.response_details.image_urls)
      ) {
        const normalizedResponseUrls =
          updatedStep.response_details.image_urls.map((url: any) =>
            this.normalizeImageUrl(String(url)),
          );
        const changed = normalizedResponseUrls.some(
          (url: string, idx: number) =>
            url !== updatedStep.response_details.image_urls[idx],
        );
        if (changed) {
          updatedStep = {
            ...updatedStep,
            response_details: {
              ...updatedStep.response_details,
              image_urls: normalizedResponseUrls,
            },
          };
        }
      }

      return updatedStep;
    });
  }
  /**
   * Fetch execution steps from S3.
   */
  async fetchFromS3(s3Key: string): Promise<any[]> {
    try {
      if (!ARTIFACTS_BUCKET) {
        throw new ApiError(
          "ARTIFACTS_BUCKET environment variable is not configured",
          500,
        );
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

      if (!bodyContents || bodyContents.trim() === "") {
        throw new ApiError(`S3 object content is empty for key: ${s3Key}`, 500);
      }

      let parsedData;
      try {
        parsedData = JSON.parse(bodyContents);
      } catch (parseError: any) {
        logger.error(
          "[Execution Steps Service] Failed to parse execution steps JSON",
          {
            s3Key,
            parseError: parseError.message,
            contentLength: bodyContents.length,
          },
        );
        throw new ApiError(
          `Failed to parse execution steps JSON from S3: ${parseError.message}`,
          500,
        );
      }

      // Validate that parsed data is an array
      if (!Array.isArray(parsedData)) {
        logger.error(
          "[Execution Steps Service] Execution steps from S3 is not an array",
          {
            s3Key,
            dataType: typeof parsedData,
            isArray: Array.isArray(parsedData),
          },
        );
        throw new ApiError(
          `Execution steps from S3 is not an array. Expected array, got ${typeof parsedData}`,
          500,
        );
      }

      // Empty array is valid, but log it for debugging
      if (parsedData.length === 0) {
        logger.warn(
          "[Execution Steps Service] Execution steps array is empty",
          { s3Key },
        );
      }

      return this.normalizeExecutionStepsImageUrls(parsedData);
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error(
        "[Execution Steps Service] Error fetching execution steps from S3",
        {
          s3Key,
          error: error.message,
          errorStack: error.stack,
        },
      );
      throw new ApiError(
        `Failed to fetch execution steps from S3: ${error.message}`,
        500,
      );
    }
  }

  /**
   * Save execution steps to S3.
   */
  async saveToS3(s3Key: string, executionSteps: any[]): Promise<void> {
    try {
      if (!ARTIFACTS_BUCKET) {
        throw new ApiError(
          "ARTIFACTS_BUCKET environment variable is not configured",
          500,
        );
      }

      // Validate executionSteps is an array
      if (!Array.isArray(executionSteps)) {
        logger.error(
          "[Execution Steps Service] Cannot save: execution steps is not an array",
          {
            s3Key,
            executionStepsType: typeof executionSteps,
            isArray: Array.isArray(executionSteps),
          },
        );
        throw new ApiError("Cannot save execution steps: expected array", 500);
      }

      let jsonBody: string;
      try {
        jsonBody = JSON.stringify(executionSteps, null, 2);
      } catch (stringifyError: any) {
        logger.error(
          "[Execution Steps Service] Failed to stringify execution steps for S3",
          {
            s3Key,
            stepsCount: executionSteps.length,
            error: stringifyError.message,
          },
        );
        throw new ApiError(
          `Failed to serialize execution steps: ${stringifyError.message}`,
          500,
        );
      }

      const command = new PutObjectCommand({
        Bucket: ARTIFACTS_BUCKET,
        Key: s3Key,
        Body: jsonBody,
        ContentType: "application/json",
      });

      await s3Client.send(command);
      logger.info("[Execution Steps Service] Saved execution steps to S3", {
        s3Key,
        stepsCount: executionSteps.length,
        bodySize: jsonBody.length,
      });
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error(
        "[Execution Steps Service] Error saving execution steps to S3",
        {
          s3Key,
          error: error.message,
          errorStack: error.stack,
        },
      );
      throw new ApiError(
        `Failed to save execution steps to S3: ${error.message}`,
        500,
      );
    }
  }

  /**
   * Edit a step's output using AI.
   */
  async editStep(
    s3Key: string,
    stepOrder: number,
    userPrompt: string,
    save: boolean,
    tenantId?: string,
    promptOverrides?: PromptOverrides,
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
      logger.error(
        "[Execution Steps Service] Failed to fetch execution steps",
        {
          s3Key,
          error: error.message,
        },
      );
      throw error;
    }

    // Find the step to edit
    const stepIndex = executionSteps.findIndex(
      (step: any) => step.step_order === stepOrder,
    );
    if (stepIndex === -1) {
      logger.warn("[Execution Steps Service] Step not found", {
        s3Key,
        stepOrder,
        availableSteps: executionSteps.map((s: any) => s.step_order),
      });
      throw new ApiError(
        `Step with order ${stepOrder} not found in execution steps`,
        404,
      );
    }

    const step = executionSteps[stepIndex];

    // Validate step structure
    if (!step || typeof step !== "object") {
      logger.error("[Execution Steps Service] Invalid step structure", {
        s3Key,
        stepOrder,
        stepType: typeof step,
      });
      throw new ApiError(
        `Step with order ${stepOrder} has invalid structure`,
        500,
      );
    }

    // Check if step has output to edit
    if (
      step.output === null ||
      step.output === undefined ||
      step.output === ""
    ) {
      throw new ApiError(
        `Step with order ${stepOrder} has no output to edit`,
        400,
      );
    }

    // Convert step output to string for processing
    let originalOutput: string;
    try {
      if (typeof step.output === "string") {
        originalOutput = step.output;
      } else {
        originalOutput = JSON.stringify(step.output, null, 2);
      }
    } catch (stringifyError: any) {
      logger.error(
        "[Execution Steps Service] Failed to stringify step output",
        {
          s3Key,
          stepOrder,
          outputType: typeof step.output,
          error: stringifyError.message,
        },
      );
      throw new ApiError(
        `Step output is too large or contains circular references: ${stringifyError.message}`,
        500,
      );
    }

    logger.info("[Execution Steps Service] Starting AI edit", {
      s3Key,
      stepOrder,
      stepName: step.step_name,
      promptLength: userPrompt.length,
    });

    try {
      // Get OpenAI client
      const openai = await getOpenAIClient();

      // Build context for AI
      const systemPrompt = `You are an Expert Content Editor and Data Analyst.
      
The user will provide:
1. The original step output (text, markdown, or JSON)
2. A prompt describing how they want to edit it

Your task:
- Edit the output to satisfy the user's request while maintaining the highest quality standards.
- **Preserve Format**: If original is JSON, return valid JSON. If Markdown, return Markdown.
- **Improve Quality**: If the text is vague, make it clearer. If the data is messy, clean it up.
- **No Meta-Talk**: Return ONLY the edited content. No "Here is the edited text" preambles.`;

      const userMessage = `Original Step Output:
${originalOutput}

Step Name: ${step.step_name || "Unknown"}
Step Order: ${stepOrder}

User Request: ${userPrompt}

Please generate the edited output based on the user's request. Return only the edited output, maintaining the same format as the original.`;

      const overrides =
        promptOverrides ?? (tenantId ? await getPromptOverridesForTenant(tenantId) : undefined);
      const resolved = resolvePromptOverride({
        key: "execution_step_edit",
        defaults: {
          instructions: systemPrompt,
          prompt: userMessage,
        },
        overrides,
        variables: {
          step_name: step.step_name || "Unknown",
          step_order: String(stepOrder),
          user_prompt: userPrompt,
          original_output: originalOutput,
        },
      });

      // Call OpenAI (Responses API)
      const completion = await (openai as any).responses.create({
        model: "gpt-5.2",
        instructions: resolved.instructions,
        input: resolved.prompt,
        reasoning: { effort: "high" },
        service_tier: "priority",
      });

      const editedOutput = stripMarkdownCodeFences(
        String((completion as any)?.output_text || ""),
      ).trim();
      if (!editedOutput) {
        throw new Error("No response from OpenAI");
      }

      // Parse edited output if original was JSON
      let parsedEditedOutput: any = editedOutput;
      try {
        if (typeof step.output !== "string") {
          parsedEditedOutput = JSON.parse(editedOutput);
        }
      } catch {
        // If parsing fails, use as string
        parsedEditedOutput = editedOutput;
      }

      // Generate changes summary
      const changesSummary = `Edited step output based on user prompt: "${userPrompt.substring(0, 100)}${userPrompt.length > 100 ? "..." : ""}"`;

      logger.info("[Execution Steps Service] AI edit completed", {
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

        logger.info("[Execution Steps Service] Changes saved", {
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
      logger.error("[Execution Steps Service] Error during AI edit", {
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
