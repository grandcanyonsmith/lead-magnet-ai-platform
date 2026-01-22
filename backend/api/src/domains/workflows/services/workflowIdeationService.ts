import OpenAI from "openai";
import { ulid } from "ulid";
import { ApiError } from "@utils/errors";
import { logger } from "@utils/logger";
import { stripMarkdownCodeFences } from "@utils/openaiHelpers";
import { getOpenAIClient } from "@services/openaiService";
import { s3Service } from "@services/s3Service";

export type WorkflowIdeationMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export interface WorkflowIdeationRequest {
  messages: WorkflowIdeationMessage[];
  model?: string;
}

export interface WorkflowIdeationDeliverable {
  id: string;
  title: string;
  description: string;
  deliverable_type: string;
  build_description: string;
  image_prompt: string;
  image_url?: string | null;
  image_s3_key?: string | null;
}

export interface WorkflowIdeationResponse {
  assistant_message: string;
  deliverables: WorkflowIdeationDeliverable[];
}

const DEFAULT_MODEL = "gpt-5.2";
const DEFAULT_IMAGE_MODEL = "gpt-image-1.5";
const MAX_DELIVERABLES = 5;

const IDEATION_SYSTEM_PROMPT = `You are a Lead Magnet Strategist helping a user decide what to build.
Your job is to propose a small set of high-value deliverables based on the conversation so far.

Guidelines:
- Provide 3 to 5 distinct deliverable options.
- Each option should be feasible, specific, and high-conversion.
- Provide image prompts for cover-style visuals (no text in image).
- Provide a build_description that can be used directly to generate a workflow.
- Be concise and actionable.`;

class WorkflowIdeationService {
  async ideateWorkflow(
    tenantId: string,
    payload: WorkflowIdeationRequest,
  ): Promise<WorkflowIdeationResponse> {
    if (!payload || !Array.isArray(payload.messages)) {
      throw new ApiError("messages array is required", 400);
    }

    const messages = payload.messages
      .filter((message) => message?.content?.trim())
      .slice(-20);

    if (messages.length === 0) {
      throw new ApiError("At least one message is required", 400);
    }

    const model =
      typeof payload.model === "string" && payload.model.trim()
        ? payload.model.trim()
        : DEFAULT_MODEL;

    const conversation = this.buildConversationTranscript(messages);
    const prompt = `${conversation}

Return ONLY valid JSON using this schema:
{
  "assistant_message": "A short, friendly response to the user.",
  "deliverables": [
    {
      "title": "Short deliverable title",
      "description": "1-2 sentence summary",
      "deliverable_type": "report|checklist|template|guide|calculator|framework|dashboard",
      "build_description": "A detailed description that can be used directly to generate the workflow, including audience, scope, sections, and outputs.",
      "image_prompt": "A concise visual prompt for a cover image. No text in the image."
    }
  ]
}`;

    const openai = await getOpenAIClient();
    logger.info("[Workflow Ideation] Starting ideation", {
      tenantId,
      model,
      messageCount: messages.length,
    });

    const completionParams: any = {
      model,
      instructions: IDEATION_SYSTEM_PROMPT,
      input: prompt,
      reasoning: { effort: "high" },
      service_tier: "priority",
    };
    const completion = await openai.responses.create(completionParams);

    const outputText = String((completion as any)?.output_text || "");
    const parsed = this.parseIdeationResult(outputText);
    const normalized = this.normalizeDeliverables(parsed.deliverables);

    const deliverables = await Promise.all(
      normalized.map((deliverable, index) =>
        this.attachImage(openai, tenantId, deliverable, index),
      ),
    );

    return {
      assistant_message:
        parsed.assistant_message || "Here are a few strong options to consider.",
      deliverables,
    };
  }

  private buildConversationTranscript(messages: WorkflowIdeationMessage[]): string {
    const lines = messages.map((message) => {
      const role =
        message.role === "assistant"
          ? "Assistant"
          : message.role === "system"
            ? "System"
            : "User";
      return `${role}: ${message.content.trim()}`;
    });
    return `Conversation so far:\n${lines.join("\n")}`;
  }

  private parseIdeationResult(outputText: string): {
    assistant_message?: string;
    deliverables: any[];
  } {
    const cleaned = stripMarkdownCodeFences(outputText).trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error("[Workflow Ideation] Invalid JSON from model", {
        outputSnippet: cleaned.slice(0, 500),
      });
      throw new ApiError("AI response was not valid JSON", 500);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || !Array.isArray(parsed.deliverables)) {
      throw new ApiError("AI response missing deliverables", 500);
    }

    return parsed;
  }

  private normalizeDeliverables(rawDeliverables: any[]): WorkflowIdeationDeliverable[] {
    return rawDeliverables.slice(0, MAX_DELIVERABLES).map((item, index) => {
      const title =
        typeof item?.title === "string" && item.title.trim()
          ? item.title.trim()
          : `Deliverable ${index + 1}`;
      const description =
        typeof item?.description === "string" && item.description.trim()
          ? item.description.trim()
          : "A high-value lead magnet tailored to your audience.";
      const deliverableType =
        typeof item?.deliverable_type === "string" && item.deliverable_type.trim()
          ? item.deliverable_type.trim()
          : "report";
      const buildDescription =
        typeof item?.build_description === "string" &&
        item.build_description.trim()
          ? item.build_description.trim()
          : `${title}: ${description}. Create a structured, actionable deliverable with clear sections, insights, and next steps.`;
      const imagePrompt =
        typeof item?.image_prompt === "string" && item.image_prompt.trim()
          ? item.image_prompt.trim()
          : `Cover image for "${title}". Clean, modern, professional style. No text.`;

      return {
        id: `ideation_${ulid()}`,
        title,
        description,
        deliverable_type: deliverableType,
        build_description: buildDescription,
        image_prompt: imagePrompt,
      };
    });
  }

  private async attachImage(
    openai: OpenAI,
    tenantId: string,
    deliverable: WorkflowIdeationDeliverable,
    index: number,
  ): Promise<WorkflowIdeationDeliverable> {
    try {
      const buffer = await this.generateImageBuffer(
        openai,
        deliverable.image_prompt,
      );
      const filename = `${deliverable.id}_${index + 1}.png`;
      const s3Key = await s3Service.uploadFile(
        tenantId,
        buffer,
        filename,
        "ideation-images",
        "image/png",
      );
      const imageUrl = await s3Service.getFileUrl(s3Key);
      return {
        ...deliverable,
        image_url: imageUrl,
        image_s3_key: s3Key,
      };
    } catch (error: any) {
      logger.error("[Workflow Ideation] Image generation failed", {
        error: error?.message || String(error),
        deliverable: deliverable.title,
      });
      return {
        ...deliverable,
        image_url: null,
        image_s3_key: null,
      };
    }
  }

  private async generateImageBuffer(
    openai: OpenAI,
    prompt: string,
  ): Promise<Buffer> {
    const params: any = {
      model: DEFAULT_IMAGE_MODEL,
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "high",
    };

    let response;
    try {
      response = await openai.images.generate(params);
    } catch (error: any) {
      const message = String(error?.message || "");
      if (message.includes("Unknown parameter: 'response_format'")) {
        delete params.response_format;
        response = await openai.images.generate(params);
      } else {
        throw error;
      }
    }

    const dataItem: any = Array.isArray(response?.data)
      ? response.data[0]
      : null;

    if (dataItem?.b64_json) {
      return Buffer.from(dataItem.b64_json, "base64");
    }

    if (dataItem?.url) {
      const fetchResponse = await fetch(dataItem.url);
      if (!fetchResponse.ok) {
        throw new Error(
          `Failed to download image: ${fetchResponse.status} ${fetchResponse.statusText}`,
        );
      }
      const arrayBuffer = await fetchResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    throw new Error("Images API returned no image data");
  }
}

export const workflowIdeationService = new WorkflowIdeationService();
