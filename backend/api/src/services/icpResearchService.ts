import { ApiError } from "@utils/errors";
import { logger } from "@utils/logger";
import { stripMarkdownCodeFences } from "@utils/openaiHelpers";
import { getOpenAIClient } from "@services/openaiService";

export interface IcpResearchReport {
  summary?: string;
  pains?: string[];
  desires?: string[];
  wants?: string[];
  goals?: string[];
  objections?: string[];
  triggers?: string[];
  buying_criteria?: string[];
  channels?: string[];
  language?: string[];
  opportunities?: string[];
  risks?: string[];
  sources?: Array<{ title?: string; url: string }>;
}

export interface IcpResearchProfileInput {
  name: string;
  icp?: string;
  pain?: string;
  outcome?: string;
  offer?: string;
  constraints?: string;
  examples?: string;
}

const DEFAULT_MODEL = "o4-mini-deep-research";

const ICP_RESEARCH_SYSTEM_PROMPT = `You are a market research analyst specializing in customer insight.
Your task is to produce a concise, actionable ICP research report for a lead magnet strategist.

Requirements:
- Prioritize practical, high-signal insights that help craft messaging and offers.
- Summarize pains, desires, and wants clearly.
- Provide 5-10 items per list when possible.
- If information is uncertain, state reasonable assumptions.
- If using web search, include sources with URLs.

Output format:
Return a single JSON object matching the schema. Do not wrap in markdown or code fences.

Schema:
{
  "summary": "2-4 sentence summary",
  "pains": ["..."],
  "desires": ["..."],
  "wants": ["..."],
  "goals": ["..."],
  "objections": ["..."],
  "triggers": ["..."],
  "buying_criteria": ["..."],
  "channels": ["..."],
  "language": ["..."],
  "opportunities": ["..."],
  "risks": ["..."],
  "sources": [{ "title": "optional", "url": "https://..." }]
}`;

class IcpResearchService {
  private parseReport(outputText: string): IcpResearchReport {
    const cleaned = stripMarkdownCodeFences(String(outputText || "")).trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new ApiError("Failed to parse ICP research response", 500);
    }
    const jsonText = cleaned.slice(jsonStart, jsonEnd + 1);
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw new ApiError("ICP research response was not valid JSON", 500, undefined, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const toList = (value: any): string[] | undefined => {
      if (Array.isArray(value)) {
        const normalized = value
          .map((item) => String(item || "").trim())
          .filter(Boolean);
        return normalized.length ? normalized : undefined;
      }
      if (typeof value === "string" && value.trim()) {
        return [value.trim()];
      }
      return undefined;
    };

    const sources =
      Array.isArray(parsed?.sources) && parsed.sources.length > 0
        ? parsed.sources
            .map((source: any) => {
              if (!source || !source.url) return null;
              return {
                title: source.title ? String(source.title) : undefined,
                url: String(source.url),
              };
            })
            .filter(Boolean)
        : undefined;

    return {
      summary: typeof parsed?.summary === "string" ? parsed.summary.trim() : undefined,
      pains: toList(parsed?.pains),
      desires: toList(parsed?.desires),
      wants: toList(parsed?.wants),
      goals: toList(parsed?.goals),
      objections: toList(parsed?.objections),
      triggers: toList(parsed?.triggers),
      buying_criteria: toList(parsed?.buying_criteria),
      channels: toList(parsed?.channels),
      language: toList(parsed?.language),
      opportunities: toList(parsed?.opportunities),
      risks: toList(parsed?.risks),
      sources,
    };
  }

  private buildPrompt(profile: IcpResearchProfileInput): string {
    const lines = [
      `ICP Name: ${profile.name}`,
      profile.icp ? `ICP: ${profile.icp}` : "",
      profile.pain ? `Pain: ${profile.pain}` : "",
      profile.outcome ? `Outcome: ${profile.outcome}` : "",
      profile.offer ? `Offer: ${profile.offer}` : "",
      profile.constraints ? `Constraints: ${profile.constraints}` : "",
      profile.examples ? `Examples: ${profile.examples}` : "",
    ].filter(Boolean);

    return `Create a deep research ICP report using the following context:\n${lines.join("\n")}`;
  }

  async generateReport(
    tenantId: string,
    profile: IcpResearchProfileInput,
    model?: string,
  ): Promise<IcpResearchReport> {
    if (!profile || !profile.name) {
      throw new ApiError("ICP profile is required to run research", 400);
    }

    const resolvedModel =
      typeof model === "string" && model.trim() ? model.trim() : DEFAULT_MODEL;
    const openai = await getOpenAIClient();
    const prompt = this.buildPrompt(profile);

    logger.info("[ICP Research] Starting deep research", {
      tenantId,
      model: resolvedModel,
      profileName: profile.name,
    });

    const completionParams: any = {
      model: resolvedModel,
      instructions: ICP_RESEARCH_SYSTEM_PROMPT,
      input: prompt,
      reasoning: { effort: "high" },
      service_tier: "priority",
      tools: [{ type: "web_search" }],
    };

    const completion = await openai.responses.create(completionParams);
    const outputText = String((completion as any)?.output_text || "");

    return this.parseReport(outputText);
  }
}

export const icpResearchService = new IcpResearchService();
