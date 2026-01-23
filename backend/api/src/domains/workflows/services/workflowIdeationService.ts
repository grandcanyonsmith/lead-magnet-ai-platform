import OpenAI from "openai";
import { createHash } from "crypto";
import { ulid } from "ulid";
import { ApiError } from "@utils/errors";
import { logger } from "@utils/logger";
import { stripMarkdownCodeFences } from "@utils/openaiHelpers";
import { getOpenAIClient } from "@services/openaiService";
import { s3Service } from "@services/s3Service";
import { imageSearchService } from "@services/imageSearchService";

export type WorkflowIdeationMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export interface WorkflowIdeationRequest {
  messages: WorkflowIdeationMessage[];
  model?: string;
  mode?: "ideation" | "followup";
  selected_deliverable?: WorkflowIdeationSelectedDeliverable;
  image_strategy?: "preview" | "generated";
}

export interface WorkflowIdeationSelectedDeliverable {
  title: string;
  description?: string;
  deliverable_type?: string;
  build_description?: string;
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
  example_images?: WorkflowIdeationExampleImage[];
}

export interface WorkflowIdeationExampleImage {
  url: string;
  source_url?: string;
  title?: string;
}

export interface WorkflowIdeationResponse {
  assistant_message: string;
  deliverables: WorkflowIdeationDeliverable[];
}

export interface WorkflowIdeationMockupRequest {
  deliverable: WorkflowIdeationSelectedDeliverable;
  count?: number;
}

export interface WorkflowIdeationMockupResponse {
  images: Array<{ url: string; s3_key: string }>;
}

type IdeationImageStrategy = "preview" | "generated";

const DEFAULT_MODEL = "gpt-5.2";
const DEFAULT_IMAGE_MODEL = "gpt-image-1.5";
const MAX_DELIVERABLES = 5;
const DEFAULT_MOCKUP_COUNT = 4;
const DEFAULT_IMAGE_STRATEGY: IdeationImageStrategy = "preview";
const DEFAULT_EXAMPLE_IMAGE_COUNT = 4;
const PREVIEW_IMAGE_WIDTH = 1024;
const PREVIEW_IMAGE_HEIGHT = 768;

const IDEATION_SYSTEM_PROMPT = `You are a Lead Magnet Strategist helping a user decide what to build.
Your job is to propose a small set of high-value deliverables and help the user go deeper on their goal.

Guidelines:
- Provide 3 to 5 distinct deliverable options.
- Each option should be feasible, specific, and high-conversion.
- Provide image prompts for cover-style visuals (no text in image).
- Provide a build_description that can be used directly to generate a workflow.
- assistant_message must be a single line, 1-3 sentences. Make it slightly more in-depth: acknowledge the goal, summarize the options at a high level, and ask 1-2 targeted questions to refine the direction.

Output format:
1) A single line starting with "MESSAGE:" followed by the assistant_message text.
2) A JSON object that matches the required schema.
Do NOT wrap the JSON in markdown code fences.`;

const FOLLOWUP_SYSTEM_PROMPT = `You are a Lead Magnet Strategist.
The user has already selected a deliverable. Answer their questions, clarify scope, and help refine the deliverable in depth.
Do NOT propose new deliverables unless the user explicitly asks for more options.
If no new options are requested, return an empty deliverables array.
- assistant_message must be a single line, 1-3 sentences. Provide deeper guidance and ask 1-2 targeted questions if needed.

Output format:
1) A single line starting with "MESSAGE:" followed by the assistant_message text.
2) A JSON object that matches the required schema.
Do NOT wrap the JSON in markdown code fences.`;

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
    const mode = payload.mode === "followup" ? "followup" : "ideation";
    const imageStrategy = this.resolveImageStrategy(payload.image_strategy);

    const conversation = this.buildConversationTranscript(messages);
    const deliverableContext =
      mode === "followup" && payload.selected_deliverable
        ? `\n\nSelected deliverable:\nTitle: ${payload.selected_deliverable.title}\nType: ${payload.selected_deliverable.deliverable_type || "n/a"}\nDescription: ${payload.selected_deliverable.description || "n/a"}\nBuild description: ${payload.selected_deliverable.build_description || "n/a"}`
        : "";
    const prompt = `${conversation}${deliverableContext}

Remember: output a "MESSAGE:" line before the JSON.
Return raw JSON only (no code fences).
Return JSON using this schema:
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
      imageStrategy,
    });

    const completionParams: any = {
      model,
      instructions: mode === "followup" ? FOLLOWUP_SYSTEM_PROMPT : IDEATION_SYSTEM_PROMPT,
      input: prompt,
      reasoning: { effort: "high" },
      service_tier: "priority",
    };
    const completion = await openai.responses.create(completionParams);

    const outputText = String((completion as any)?.output_text || "");
    const parsed = this.parseIdeationResult(outputText);
    const normalized = this.normalizeDeliverables(
      Array.isArray(parsed.deliverables) ? parsed.deliverables : [],
    );
    const deliverables =
      normalized.length > 0
        ? await Promise.all(
            normalized.map((deliverable, index) =>
              this.attachIdeationImage(
                openai,
                tenantId,
                deliverable,
                index,
                imageStrategy,
              ),
            ),
          )
        : normalized;

    return {
      assistant_message:
        parsed.assistant_message ||
        (mode === "followup"
          ? "Got it. What would you like to refine or explore about this deliverable?"
          : "Here are a few strong options to consider."),
      deliverables,
    };
  }

  async ideateWorkflowStream(
    tenantId: string,
    payload: WorkflowIdeationRequest,
    handlers?: { onDelta?: (text: string) => void },
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
    const mode = payload.mode === "followup" ? "followup" : "ideation";
    const imageStrategy = this.resolveImageStrategy(payload.image_strategy);

    const conversation = this.buildConversationTranscript(messages);
    const deliverableContext =
      mode === "followup" && payload.selected_deliverable
        ? `\n\nSelected deliverable:\nTitle: ${payload.selected_deliverable.title}\nType: ${payload.selected_deliverable.deliverable_type || "n/a"}\nDescription: ${payload.selected_deliverable.description || "n/a"}\nBuild description: ${payload.selected_deliverable.build_description || "n/a"}`
        : "";
    const prompt = `${conversation}${deliverableContext}

Remember: output a "MESSAGE:" line before the JSON.
Return raw JSON only (no code fences).
Return JSON using this schema:
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
    logger.info("[Workflow Ideation] Starting streamed ideation", {
      tenantId,
      model,
      messageCount: messages.length,
      imageStrategy,
    });

    const stream = await (openai as any).responses.create({
      model,
      instructions: mode === "followup" ? FOLLOWUP_SYSTEM_PROMPT : IDEATION_SYSTEM_PROMPT,
      input: prompt,
      reasoning: { effort: "high" },
      service_tier: "priority",
      stream: true,
    });

    let outputText = "";
    for await (const event of stream as any) {
      const eventType = String((event as any)?.type || "");
      if (!eventType.includes("output_text")) {
        continue;
      }
      const delta =
        typeof (event as any)?.delta === "string"
          ? (event as any).delta
          : typeof (event as any)?.text === "string"
            ? (event as any).text
            : undefined;
      if (!delta) {
        continue;
      }
      outputText += delta;
      handlers?.onDelta?.(delta);
    }

    let parsed;
    try {
      parsed = this.parseIdeationResult(outputText);
    } catch (error: any) {
      logger.error("[Workflow Ideation] Failed to parse ideation result", {
        error: String(error),
        errorMessage: error?.message,
        outputTextLength: outputText.length,
        outputTextPreview: outputText.slice(0, 1000),
        outputTextEnd: outputText.slice(-500),
      });
      // Try to extract JSON more aggressively as fallback
      const jsonMatch = outputText.match(/\{[\s\S]*"deliverables"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const fallbackParsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(fallbackParsed.deliverables)) {
            parsed = fallbackParsed;
            logger.info("[Workflow Ideation] Recovered using fallback parsing");
          } else {
            throw error;
          }
        } catch {
          throw error;
        }
      } else {
        throw error;
      }
    }
    
    const normalized = this.normalizeDeliverables(
      Array.isArray(parsed.deliverables) ? parsed.deliverables : [],
    );
    const deliverables =
      normalized.length > 0
        ? await Promise.all(
            normalized.map((deliverable, index) =>
              this.attachIdeationImage(
                openai,
                tenantId,
                deliverable,
                index,
                imageStrategy,
              ),
            ),
          )
        : normalized;

    return {
      assistant_message:
        parsed.assistant_message ||
        (mode === "followup"
          ? "Got it. What would you like to refine or explore about this deliverable?"
          : "Here are a few strong options to consider."),
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
    // First strip markdown code fences (handles ```json ... ```)
    let cleaned = stripMarkdownCodeFences(outputText).trim();
    
    // Also handle cases where JSON might be wrapped in ```json at the start
    // and ``` at the end separately
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    
    // Extract MESSAGE: prefix if present (single-line per prompt)
    let messagePrefix = "";
    const messageMatch = cleaned.match(/^\s*MESSAGE:\s*([^\n]*)/i);
    if (messageMatch) {
      messagePrefix = messageMatch[1].trim();
    }

    // Prefer JSON inside explicit ```json fences if present anywhere in the output.
    const fencedJsonMatch = cleaned.match(/```json\s*([\s\S]*?)```/i);
    let jsonText = fencedJsonMatch ? fencedJsonMatch[1].trim() : cleaned;
    if (!fencedJsonMatch && messageMatch) {
      const afterMessage = cleaned.slice(messageMatch[0].length).trim();
      if (afterMessage.includes("{")) {
        jsonText = afterMessage;
      }
    }

    // If any generic code fence remains, strip it defensively.
    if (jsonText.includes("```")) {
      jsonText = jsonText.replace(/^```[a-z0-9_-]*\s*/i, "").replace(/\s*```$/i, "").trim();
    }
    
    // Try to find JSON object - look for the first { that starts a complete object
    const firstBrace = jsonText.indexOf("{");
    if (firstBrace === -1) {
      logger.error("[Workflow Ideation] No JSON object found", {
        outputSnippet: cleaned.slice(0, 500),
      });
      throw new ApiError("AI response was not valid JSON", 500);
    }
    
    // Find the first complete JSON object and stop there
    const parsed = this.parseFirstJsonObject(jsonText);
    if (!parsed) {
      logger.error("[Workflow Ideation] Invalid JSON from model", {
        outputSnippet: cleaned.slice(0, 500),
        jsonTextPreview: jsonText.slice(0, 500),
        jsonTextLength: jsonText.length,
      });
      throw new ApiError("AI response was not valid JSON", 500);
    }

    // Use MESSAGE: prefix as assistant_message if not in JSON
    if (messagePrefix && !parsed.assistant_message) {
      parsed.assistant_message = messagePrefix;
    }

    // Ensure we return a clean object with only expected fields
    return {
      assistant_message: parsed.assistant_message || messagePrefix || undefined,
      deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables : [],
    };
  }

  private parseFirstJsonObject(text: string): any | null {
    // First try: extract using brace matching
    const candidates = this.extractJsonCandidates(text);
    for (const candidate of candidates) {
      try {
        // Trim the candidate to ensure no trailing whitespace
        const trimmed = candidate.trim();
        if (!trimmed) continue;
        
        const parsed = JSON.parse(trimmed);
        // Validate it has the expected structure for ideation response
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed) &&
          (typeof parsed.assistant_message === "string" ||
            Array.isArray(parsed.deliverables))
        ) {
          return parsed;
        }
      } catch (e: any) {
        // Log the error with more context
        logger.debug("[Workflow Ideation] Failed to parse JSON candidate", {
          error: String(e),
          errorMessage: e?.message,
          candidateLength: candidate.length,
          candidatePreview: candidate.slice(0, 200),
          candidateEnd: candidate.slice(-100),
        });
        // Try next candidate
      }
    }
    
    // Fallback: try regex to find JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed) &&
          (typeof parsed.assistant_message === "string" ||
            Array.isArray(parsed.deliverables))
        ) {
          return parsed;
        }
      } catch (e: any) {
        logger.debug("[Workflow Ideation] Regex fallback also failed", {
          error: String(e),
          matchLength: jsonMatch[0].length,
        });
      }
    }
    
    return null;
  }

  private extractJsonCandidates(text: string): string[] {
    const candidates: string[] = [];
    let startIndex = -1;
    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
          continue;
        }
        if (char === "\\") {
          isEscaped = true;
          continue;
        }
        if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (char === "{") {
        if (depth === 0) {
          startIndex = i;
        }
        depth += 1;
        continue;
      }

      if (char === "}") {
        if (depth === 0) {
          continue;
        }
        depth -= 1;
        if (depth === 0 && startIndex !== -1) {
          // Extract only up to the closing brace, no trailing text
          const candidate = text.slice(startIndex, i + 1);
          // Verify the candidate ends with } 
          if (candidate.endsWith("}")) {
            // Check if there's non-whitespace after the closing brace
            const afterBrace = text.slice(i + 1).trim();
            if (afterBrace.length > 0) {
              logger.debug("[Workflow Ideation] Found text after JSON", {
                afterBracePreview: afterBrace.slice(0, 50),
              });
            }
            candidates.push(candidate);
            logger.debug("[Workflow Ideation] Extracted JSON candidate", {
              candidateLength: candidate.length,
              candidateEndsWithBrace: candidate.endsWith("}"),
              textAfterCandidate: text.slice(i + 1, i + 20),
            });
            // Stop after finding the first complete JSON object
            // This prevents issues with trailing text
            break;
          }
        }
      }
    }

    return candidates;
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

  private resolveImageStrategy(value?: string): IdeationImageStrategy {
    return value === "generated" ? "generated" : DEFAULT_IMAGE_STRATEGY;
  }

  private async attachIdeationImage(
    openai: OpenAI,
    tenantId: string,
    deliverable: WorkflowIdeationDeliverable,
    index: number,
    imageStrategy: IdeationImageStrategy,
  ): Promise<WorkflowIdeationDeliverable> {
    const withImage =
      imageStrategy === "generated"
        ? await this.attachImage(openai, tenantId, deliverable, index)
        : await this.attachPreviewImage(deliverable, index);
    return this.attachExampleImages(withImage);
  }

  private async attachPreviewImage(
    deliverable: WorkflowIdeationDeliverable,
    index: number,
  ): Promise<WorkflowIdeationDeliverable> {
    const imageUrl = this.buildPreviewImageUrl(deliverable, index);
    return {
      ...deliverable,
      image_url: imageUrl,
      image_s3_key: null,
    };
  }

  private buildPreviewImageUrl(
    deliverable: WorkflowIdeationDeliverable,
    index: number,
  ): string {
    const query = this.buildPreviewImageQuery(deliverable);
    const seed = this.buildPreviewImageSeed(query, index);
    return `https://picsum.photos/seed/${seed}/${PREVIEW_IMAGE_WIDTH}/${PREVIEW_IMAGE_HEIGHT}`;
  }

  private buildPreviewImageQuery(
    deliverable: WorkflowIdeationDeliverable,
  ): string {
    const parts = [
      deliverable.title,
      deliverable.deliverable_type,
      "cover",
      "minimal",
      "modern",
    ];
    return parts.filter((part) => typeof part === "string" && part.trim()).join(" ");
  }

  private buildExampleSearchQuery(
    deliverable: WorkflowIdeationDeliverable,
  ): string {
    const type = deliverable.deliverable_type || "lead magnet";
    const base = deliverable.title || deliverable.build_description || type;
    const typeHint =
      type === "calculator"
        ? "calculator spreadsheet template"
        : type === "framework"
          ? "framework worksheet"
          : type === "checklist"
            ? "checklist template"
            : type === "dashboard"
              ? "dashboard template"
              : type === "guide"
                ? "guide pdf"
                : type === "template"
                  ? "template"
                  : type === "report"
                    ? "report template"
                    : type;
    return [base, typeHint, "lead magnet", "example"].join(" ");
  }

  private async attachExampleImages(
    deliverable: WorkflowIdeationDeliverable,
  ): Promise<WorkflowIdeationDeliverable> {
    const query = this.buildExampleSearchQuery(deliverable);
    if (!query.trim()) {
      return deliverable;
    }
    try {
      const images = await imageSearchService.searchImages(
        query,
        DEFAULT_EXAMPLE_IMAGE_COUNT,
      );
      if (!images.length) {
        return deliverable;
      }
      return {
        ...deliverable,
        example_images: images.map((image) => ({
          url: image.url,
          source_url: image.source_url,
          title: image.title,
        })),
      };
    } catch (error: any) {
      logger.warn("[Workflow Ideation] Example image search failed", {
        error: error?.message || String(error),
        deliverable: deliverable.title,
      });
      return deliverable;
    }
  }

  private buildPreviewImageSeed(query: string, index: number): string {
    return createHash("sha1")
      .update(`${query}|${index + 1}`)
      .digest("hex")
      .slice(0, 16);
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
      let didRetry = false;
      if (message.includes("Unknown parameter: 'response_format'")) {
        delete params.response_format;
        didRetry = true;
      }
      if (message.includes("Unknown parameter: 'input_fidelity'")) {
        delete params.input_fidelity;
        didRetry = true;
      }
      if (didRetry) {
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

  async generateDeliverableMockups(
    tenantId: string,
    payload: WorkflowIdeationMockupRequest,
  ): Promise<WorkflowIdeationMockupResponse> {
    if (!payload?.deliverable?.title?.trim()) {
      throw new ApiError("deliverable.title is required", 400);
    }

    const countRaw =
      typeof payload.count === "number" && Number.isFinite(payload.count)
        ? Math.floor(payload.count)
        : DEFAULT_MOCKUP_COUNT;
    const count = Math.min(Math.max(countRaw, 1), 6);

    const deliverable = payload.deliverable;
    const prompt = `Create a clean, modern mockup preview of the deliverable "${deliverable.title}". 
Show realistic interior pages/assets (layouts, charts, checklists, diagrams) without any readable text.
Style: premium, professional, minimal, neutral background, high contrast, studio lighting. 
Deliverable type: ${deliverable.deliverable_type || "n/a"}.
Context: ${deliverable.description || deliverable.build_description || "High-value lead magnet content."}`;

    const openai = await getOpenAIClient();
    const buffers = await this.generateImageBuffers(openai, prompt, count, {
      quality: "high",
      input_fidelity: "high",
    });

    const uploads = await Promise.all(
      buffers.map(async (buffer, index) => {
        const filename = `${deliverable.title.replace(/[^a-zA-Z0-9._-]/g, "_")}_mockup_${index + 1}.png`;
        const s3Key = await s3Service.uploadFile(
          tenantId,
          buffer,
          filename,
          "ideation-mockups",
          "image/png",
        );
        const url = await s3Service.getFileUrl(s3Key);
        return { url, s3_key: s3Key };
      }),
    );

    return { images: uploads };
  }

  private async generateImageBuffers(
    openai: OpenAI,
    prompt: string,
    count: number,
    options?: { quality?: "low" | "medium" | "high"; input_fidelity?: "low" | "high" },
  ): Promise<Buffer[]> {
    const params: any = {
      model: DEFAULT_IMAGE_MODEL,
      prompt,
      n: count,
      size: "1024x1024",
      quality: options?.quality || "high",
      input_fidelity: options?.input_fidelity || "high",
    };

    let response;
    try {
      response = await openai.images.generate(params);
    } catch (error: any) {
      const message = String(error?.message || "");
      let didRetry = false;
      if (message.includes("Unknown parameter: 'response_format'")) {
        delete params.response_format;
        didRetry = true;
      }
      if (message.includes("Unknown parameter: 'input_fidelity'")) {
        delete params.input_fidelity;
        didRetry = true;
      }
      if (didRetry) {
        response = await openai.images.generate(params);
      } else {
        throw error;
      }
    }

    const dataItems: any[] = Array.isArray(response?.data) ? response.data : [];
    if (dataItems.length === 0) {
      throw new Error("Images API returned no image data");
    }

    const buffers = await Promise.all(
      dataItems.map(async (dataItem) => {
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
      }),
    );

    return buffers;
  }
}

export const workflowIdeationService = new WorkflowIdeationService();
