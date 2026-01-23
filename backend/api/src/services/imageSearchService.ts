import { logger } from "@utils/logger";
import { getOpenAIClient } from "@services/openaiService";
import { stripMarkdownCodeFences } from "@utils/openaiHelpers";

export type ImageSearchResult = {
  url: string;
  source_url?: string;
  title?: string;
};

const OPENAI_SEARCH_MODEL = "gpt-5.2";
const MAX_RESULTS = 8;
const MAX_TEXT_LENGTH = 10000;

type ParsedImagePayload =
  | ImageSearchResult[]
  | { images?: ImageSearchResult[] };

class ImageSearchService {
  async searchImages(query: string, count = 4): Promise<ImageSearchResult[]> {
    if (!query.trim()) {
      return [];
    }
    const safeCount = Math.min(Math.max(count, 1), MAX_RESULTS);

    try {
      const openai = await getOpenAIClient();
      const prompt = `Find ${safeCount} real-world example images on the public web for: "${query}".
Return ONLY JSON (no markdown) in one of these formats:
1) [{"url":"...","source_url":"...","title":"..."}]
2) {"images":[{"url":"...","source_url":"...","title":"..."}]}

Rules:
- "url" must be a direct image URL or a thumbnail URL that can be loaded in a browser.
- "source_url" should be the page where the image appears (if known).
- Prefer recent, high-quality examples.
- If unsure, return an empty array.`;

      const response = await (openai as any).responses.create({
        model: OPENAI_SEARCH_MODEL,
        input: prompt,
        tools: [{ type: "web_search" }],
        tool_choice: "auto",
        reasoning: { effort: "low" },
      });

      const outputText = String((response as any)?.output_text || "")
        .slice(0, MAX_TEXT_LENGTH);
      const parsed = this.parseImagePayload(outputText);
      const images = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.images)
          ? parsed.images
          : [];

      return images
        .map((item) => ({
          url: item?.url,
          source_url: item?.source_url,
          title: item?.title,
        }))
        .filter((item) => typeof item.url === "string" && item.url.trim())
        .slice(0, safeCount);
    } catch (error: any) {
      logger.error("[Image Search] Request error", {
        error: error?.message || String(error),
      });
      return [];
    }
  }

  private parseImagePayload(text: string): ParsedImagePayload | null {
    if (!text) return null;
    let cleaned = stripMarkdownCodeFences(text).trim();
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

    try {
      const direct = JSON.parse(cleaned) as ParsedImagePayload;
      return direct;
    } catch {
      // continue
    }

    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as ParsedImagePayload;
      } catch {
        // continue
      }
    }

    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]) as ParsedImagePayload;
      } catch {
        // ignore
      }
    }

    return null;
  }
}

export const imageSearchService = new ImageSearchService();
