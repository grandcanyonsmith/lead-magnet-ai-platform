import { logger } from "../utils/logger";
import {
  callResponsesWithTimeout,
  stripMarkdownCodeFences,
} from "../utils/openaiHelpers";
import { retryWithBackoff } from "../utils/errorHandling";
import { getOpenAIClient } from "./openaiService";

type PatchHtmlArgs = {
  html: string;
  prompt: string;
  selector?: string | null;
  selectedOuterHtml?: string | null;
  pageUrl?: string | null;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high" | null;
};

export type PatchHtmlResult = {
  summary: string;
  patchedHtml: string;
};

type ParsedSimpleSelector = {
  tag: string;
  id: string | null;
  classes: string[];
};

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function looksLikeHtmlFragment(html: string): boolean {
  const trimmed = (html || "").trim();
  return (
    trimmed.startsWith("<") && trimmed.endsWith(">") && trimmed.length > 10
  );
}

function parseSimpleSelector(
  selector: string | null,
): ParsedSimpleSelector | null {
  const raw = (selector || "").trim();
  if (!raw) return null;

  // Our frontend selection script builds selectors like:
  //   tagName + (#id?) + (.class1.class2...)
  // Class tokens may include characters like ":" (Tailwind), so we parse by delimiters
  // rather than using a restrictive regex.
  let i = 0;
  while (i < raw.length && raw[i] !== "#" && raw[i] !== ".") i++;
  const tag = raw.slice(0, i).trim().toLowerCase();
  if (!tag) return null;

  let id: string | null = null;
  const classes: string[] = [];

  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "#") {
      i++;
      const start = i;
      while (i < raw.length && raw[i] !== "." && raw[i] !== "#") i++;
      const value = raw.slice(start, i).trim();
      if (value) id = value;
      continue;
    }
    if (ch === ".") {
      i++;
      const start = i;
      while (i < raw.length && raw[i] !== "." && raw[i] !== "#") i++;
      const value = raw.slice(start, i).trim();
      if (value) classes.push(value);
      continue;
    }
    i++;
  }

  return { tag, id, classes };
}

function stripHtmlToText(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findElementRangeBySelector(
  html: string,
  selector: ParsedSimpleSelector,
  selectedOuterHtml?: string | null,
): { start: number; end: number; outerHtml: string } | null {
  const tag = selector.tag.toLowerCase();
  const re = new RegExp(`<${tag}\\b[^>]*>`, "gi");

  const candidates: Array<{ start: number; end: number; outerHtml: string }> =
    [];

  const requiredClasses = selector.classes.filter(Boolean);
  const requireId =
    selector.id && selector.id.trim().length > 0 ? selector.id.trim() : null;

  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const start = match.index;
    const openTag = match[0];

    // Quick attribute checks (id/classes) on the opening tag.
    if (requireId) {
      const idMatch = openTag.match(/\bid\s*=\s*["']([^"']+)["']/i);
      const idValue = idMatch?.[1] ? String(idMatch[1]) : "";
      if (idValue !== requireId) {
        continue;
      }
    }

    if (requiredClasses.length > 0) {
      const classMatch = openTag.match(/\bclass\s*=\s*["']([^"']*)["']/i);
      const classValue = classMatch?.[1] ? String(classMatch[1]) : "";
      const classTokens = classValue.split(/\s+/).filter(Boolean);
      const hasAll = requiredClasses.every((c) => classTokens.includes(c));
      if (!hasAll) {
        continue;
      }
    }

    const openEnd = start + openTag.length;
    const isSelfClosing = openTag.endsWith("/>") || VOID_ELEMENTS.has(tag);
    if (isSelfClosing) {
      candidates.push({
        start,
        end: openEnd,
        outerHtml: html.slice(start, openEnd),
      });
      continue;
    }

    // Find the matching close tag by tracking nested tags of the same name.
    const tagRe = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
    tagRe.lastIndex = openEnd;

    let depth = 1;
    let innerMatch: RegExpExecArray | null;
    while ((innerMatch = tagRe.exec(html))) {
      const token = innerMatch[0];
      const isClose = token.startsWith("</");
      const isTokenSelfClosing = !isClose && token.endsWith("/>");

      if (isClose) {
        depth -= 1;
        if (depth === 0) {
          const end = innerMatch.index + token.length;
          candidates.push({ start, end, outerHtml: html.slice(start, end) });
          break;
        }
        continue;
      }

      if (!isTokenSelfClosing) {
        depth += 1;
      }
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Best-effort disambiguation using selectedOuterHtml (if present).
  const selectedText = selectedOuterHtml
    ? stripHtmlToText(selectedOuterHtml).slice(0, 80)
    : "";
  const selectedLen = selectedOuterHtml ? selectedOuterHtml.length : 0;

  let best = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const cand of candidates) {
    let score = 0;
    if (selectedLen > 0) {
      score -= Math.abs(cand.outerHtml.length - selectedLen);
    }
    if (selectedText) {
      const candText = stripHtmlToText(cand.outerHtml);
      if (candText.includes(selectedText)) score += 10000;
      else if (candText.includes(selectedText.slice(0, 40))) score += 5000;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  return best;
}

function extractInjectedBlocks(html: string): {
  cleanedHtml: string;
  injectedBlocks: string[];
} {
  const blocks: string[] = [];
  let cleaned = html;

  const patterns: Array<{ name: string; re: RegExp }> = [
    {
      name: "editor",
      re: /<!--\s*Lead Magnet Editor Overlay\s*-->[\s\S]*?<\/script>\s*/i,
    },
    {
      name: "tracking",
      re: /<!--\s*Lead Magnet Tracking Script\s*-->[\s\S]*?<\/script>\s*/i,
    },
  ];

  for (const { name, re } of patterns) {
    const match = cleaned.match(re);
    if (match && match[0]) {
      blocks.push(match[0]);
      cleaned = cleaned.replace(re, "");
      logger.debug("[HtmlPatchService] Stripped injected block", {
        block: name,
        length: match[0].length,
      });
    }
  }

  return { cleanedHtml: cleaned, injectedBlocks: blocks };
}

function injectBlocksBeforeBodyClose(html: string, blocks: string[]): string {
  if (!blocks.length) return html;
  const insertion = `\n${blocks.join("\n")}\n`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${insertion}</body>`);
  }
  return html + insertion;
}

export async function patchHtmlWithOpenAI(
  args: PatchHtmlArgs,
): Promise<PatchHtmlResult> {
  const prompt = (args.prompt || "").trim();
  if (!prompt) {
    throw new Error("Prompt is required");
  }

  const { cleanedHtml, injectedBlocks } = extractInjectedBlocks(
    args.html || "",
  );

  const selector = (args.selector || "").trim() || null;
  const selectedOuterHtml = (args.selectedOuterHtml || "").trim() || null;
  const pageUrl = (args.pageUrl || "").trim() || null;

  const openai = await getOpenAIClient();

  // Use provided model or default to gpt-5.1-codex
  const model = args.model || "gpt-5.1-codex";
  const reasoningEffort = args.reasoningEffort || null;
  const supportsReasoningEffort =
    model.startsWith("gpt-5") || model.startsWith("o"); // e.g. o-series models

  const getStatus = (err: any): number | undefined => {
    if (!err) return undefined;
    const status =
      typeof err.status === "number"
        ? err.status
        : typeof err.statusCode === "number"
          ? err.statusCode
          : typeof err.response?.status === "number"
            ? err.response.status
            : undefined;
    return typeof status === "number" ? status : undefined;
  };

  const isRetryable = (err: any): boolean => {
    const status = getStatus(err);
    if (status === 429 || status === 503) return true;
    if (typeof status === "number" && status >= 500) return true;
    const msg = String(err?.message || "").toLowerCase();
    return (
      msg.includes("timeout") ||
      msg.includes("overloaded") ||
      msg.includes("service unavailable")
    );
  };

  // ------------------------------------------------------------
  // Snippet mode: If a specific element was selected, ask the model
  // to return ONLY the updated outerHTML for that element, then
  // apply it to the document. This keeps responses fast and avoids
  // full-document rewrites/timeouts.
  // ------------------------------------------------------------
  if (selectedOuterHtml) {
    const snippetInstructions = `You are a Senior Frontend Engineer.
    
You will receive:
- A CSS selector (optional) and the selected element's outerHTML.
- A user request describing changes.

Your task:
- Surgically update the HTML fragment to meet the user's request.
- Return ONLY the updated outerHTML for the selected element.
- Do NOT return the full HTML document.
- Preserve attributes and structure unless asked to change them.
- Do NOT include any markdown code fences in your response. Just the raw HTML fragment.`;

    const snippetInputParts: string[] = [];
    if (pageUrl) snippetInputParts.push(`Page URL:\n${pageUrl}\n`);
    if (selector) snippetInputParts.push(`Selected selector:\n${selector}\n`);
    snippetInputParts.push(`Selected outerHTML:\n${selectedOuterHtml}\n`);
    snippetInputParts.push(`User request:\n${prompt}\n`);

    logger.info(
      "[HtmlPatchService] Calling OpenAI to patch HTML (Selected Element Mode)",
      {
        model,
        promptLength: prompt.length,
        selectedOuterHtmlLength: selectedOuterHtml.length,
        hasSelector: Boolean(selector),
      },
    );

    try {
      const snippetResponse = await retryWithBackoff(
        () =>
          callResponsesWithTimeout(
            () =>
              (openai as any).responses.create({
                model,
                instructions: snippetInstructions,
                input: snippetInputParts.join("\n"),
                ...(supportsReasoningEffort && reasoningEffort
                  ? { reasoning: { effort: reasoningEffort } }
                  : {}),
                // NOTE: Avoid forcing priority tier here; it can be unavailable in some environments.
              }),
            "HTML Patch OpenAI call (selected element)",
          ),
        {
          maxAttempts: 2,
          initialDelayMs: 750,
          retryableErrors: isRetryable,
          onRetry: (attempt, error) => {
            logger.warn(
              "[HtmlPatchService] Retrying selected-element OpenAI call",
              {
                attempt,
                status: getStatus(error),
                error: error instanceof Error ? error.message : String(error),
              },
            );
          },
        },
      );

      const snippetOutputText = String(
        (snippetResponse as any)?.output_text || "",
      );
      const updatedOuterHtmlRaw =
        stripMarkdownCodeFences(snippetOutputText).trim();

      // Basic sanity checks: must look like an element fragment and not a full document.
      const isFullDoc =
        /<html[\s>]/i.test(updatedOuterHtmlRaw) ||
        /<!doctype/i.test(updatedOuterHtmlRaw);
      if (looksLikeHtmlFragment(updatedOuterHtmlRaw) && !isFullDoc) {
        if (cleanedHtml.includes(selectedOuterHtml)) {
          const patchedHtml = cleanedHtml.replace(
            selectedOuterHtml,
            updatedOuterHtmlRaw,
          );
          const patchedWithBlocks = injectBlocksBeforeBodyClose(
            patchedHtml,
            injectedBlocks,
          );
          return {
            summary: "Updated selected element based on your request.",
            patchedHtml: patchedWithBlocks,
          };
        }

        const parsed = parseSimpleSelector(selector);
        if (parsed) {
          const range = findElementRangeBySelector(
            cleanedHtml,
            parsed,
            selectedOuterHtml,
          );
          if (range) {
            const patchedHtml =
              cleanedHtml.slice(0, range.start) +
              updatedOuterHtmlRaw +
              cleanedHtml.slice(range.end);
            const patchedWithBlocks = injectBlocksBeforeBodyClose(
              patchedHtml,
              injectedBlocks,
            );
            return {
              summary: "Updated selected element based on your request.",
              patchedHtml: patchedWithBlocks,
            };
          }
        }

        logger.warn(
          "[HtmlPatchService] Selected outerHTML not found (and selector match failed); falling back to full-document mode",
          {
            selector,
            selectedOuterHtmlLength: selectedOuterHtml.length,
            cleanedHtmlLength: cleanedHtml.length,
          },
        );
      } else {
        logger.warn(
          "[HtmlPatchService] Selected element mode returned non-fragment; falling back to full-document mode",
          {
            outputLength: updatedOuterHtmlRaw.length,
            isFullDoc,
          },
        );
      }
    } catch (error: any) {
      logger.warn(
        "[HtmlPatchService] Selected element mode failed; falling back to full-document mode",
        {
          error: error?.message || String(error),
        },
      );
    }
  }

  const instructions = `You are a Senior Frontend Engineer.

You will receive:
- A complete HTML document (WITHOUT any editing overlays).
- Optionally, a CSS selector and the selected element's outerHTML.
- A user request describing changes.

Your task:
- Apply the user's requested changes to the HTML with high precision.
- Return the COMPLETE, VALID, modified HTML document.
- Do NOT return a diff. Return the full HTML.
- Preserve all existing scripts, styles, and structure unless explicitly asked to change them.
- Do NOT include any markdown code fences in your response. Just the raw HTML.

Input HTML is provided below.`;

  const inputParts: string[] = [];
  if (pageUrl) inputParts.push(`Page URL:\n${pageUrl}\n`);
  if (selector) inputParts.push(`Selected selector:\n${selector}\n`);
  if (selectedOuterHtml)
    inputParts.push(
      `Selected outerHTML (may be truncated):\n${selectedOuterHtml}\n`,
    );
  inputParts.push(`User request:\n${prompt}\n`);
  inputParts.push(`index.html:\n${cleanedHtml}`);

  logger.info(
    "[HtmlPatchService] Calling OpenAI to patch HTML (Full Document Mode)",
    {
      model,
      promptLength: prompt.length,
      htmlLength: cleanedHtml.length,
      hasSelector: Boolean(selector),
      hasSelectedOuterHtml: Boolean(selectedOuterHtml),
    },
  );

  // NOTE: We intentionally do NOT enforce an app-level timeout here. Upstream infrastructure
  // (API Gateway/Lambda/ALB/etc.) may still enforce request timeouts depending on deployment.
  const response = await retryWithBackoff(
    () =>
      callResponsesWithTimeout(
        () =>
          (openai as any).responses.create({
            model,
            instructions,
            input: inputParts.join("\n"),
            ...(supportsReasoningEffort && reasoningEffort
              ? { reasoning: { effort: reasoningEffort } }
              : {}),
            // NOTE: Avoid forcing priority tier here; it can be unavailable in some environments.
          }),
        "HTML Patch OpenAI call (full document)",
      ),
    {
      maxAttempts: 2,
      initialDelayMs: 750,
      retryableErrors: isRetryable,
      onRetry: (attempt, error) => {
        logger.warn("[HtmlPatchService] Retrying full-document OpenAI call", {
          attempt,
          status: getStatus(error),
          error: error instanceof Error ? error.message : String(error),
        });
      },
    },
  );

  const outputText = String((response as any)?.output_text || "");

  if (!outputText || outputText.length < 10) {
    throw new Error("AI returned empty or invalid HTML.");
  }

  // Strip markdown fences if present
  const patchedHtmlRaw = stripMarkdownCodeFences(outputText);

  // Re-inject the blocks we stripped out earlier
  const patchedWithBlocks = injectBlocksBeforeBodyClose(
    patchedHtmlRaw,
    injectedBlocks,
  );

  return {
    summary: "Updated HTML based on your request.",
    patchedHtml: patchedWithBlocks,
  };
}
