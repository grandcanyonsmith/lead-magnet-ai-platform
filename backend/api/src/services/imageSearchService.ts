import { env } from "@utils/env";
import { logger } from "@utils/logger";

export type ImageSearchResult = {
  url: string;
  source_url?: string;
  title?: string;
};

const DEFAULT_ENDPOINT =
  "https://api.bing.microsoft.com/v7.0/images/search";
const MAX_RESULTS = 8;

class ImageSearchService {
  async searchImages(query: string, count = 4): Promise<ImageSearchResult[]> {
    const apiKey = env.bingImageSearchKey?.trim();
    if (!apiKey || !query.trim()) {
      return [];
    }

    const endpoint = (env.bingImageSearchEndpoint || DEFAULT_ENDPOINT).trim();
    if (!endpoint) {
      return [];
    }

    const safeCount = Math.min(Math.max(count, 1), MAX_RESULTS);
    const params = new URLSearchParams({
      q: query,
      count: String(safeCount),
      safeSearch: "Moderate",
      imageType: "Photo",
    });
    const url = `${endpoint}?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey,
        },
      });

      if (!response.ok) {
        logger.warn("[Image Search] Request failed", {
          status: response.status,
          statusText: response.statusText,
        });
        return [];
      }

      const data = (await response.json()) as { value?: any[] };
      const items: any[] = Array.isArray(data?.value) ? data.value : [];
      return items
        .map((item) => ({
          url: item?.thumbnailUrl || item?.contentUrl,
          source_url: item?.hostPageUrl || item?.contentUrl,
          title: item?.name,
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
}

export const imageSearchService = new ImageSearchService();
