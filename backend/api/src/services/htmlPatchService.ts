import { logger } from '../utils/logger';
import { callResponsesWithTimeout, stripMarkdownCodeFences } from '../utils/openaiHelpers';
import { retryWithBackoff } from '../utils/errorHandling';
import { getOpenAIClient } from './openaiService';

type PatchHtmlArgs = {
  html: string;
  prompt: string;
  selector?: string | null;
  selectedOuterHtml?: string | null;
  pageUrl?: string | null;
  model?: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | null;
};

export type PatchHtmlResult = {
  summary: string;
  patchedHtml: string;
};

function looksLikeHtmlFragment(html: string): boolean {
  const trimmed = (html || '').trim();
  return trimmed.startsWith('<') && trimmed.endsWith('>') && trimmed.length > 10;
}

function extractInjectedBlocks(html: string): { cleanedHtml: string; injectedBlocks: string[] } {
  const blocks: string[] = [];
  let cleaned = html;

  const patterns: Array<{ name: string; re: RegExp }> = [
    {
      name: 'editor',
      re: /<!--\s*Lead Magnet Editor Overlay\s*-->[\s\S]*?<\/script>\s*/i,
    },
    {
      name: 'tracking',
      re: /<!--\s*Lead Magnet Tracking Script\s*-->[\s\S]*?<\/script>\s*/i,
    },
  ];

  for (const { name, re } of patterns) {
    const match = cleaned.match(re);
    if (match && match[0]) {
      blocks.push(match[0]);
      cleaned = cleaned.replace(re, '');
      logger.debug('[HtmlPatchService] Stripped injected block', {
        block: name,
        length: match[0].length,
      });
    }
  }

  return { cleanedHtml: cleaned, injectedBlocks: blocks };
}

function injectBlocksBeforeBodyClose(html: string, blocks: string[]): string {
  if (!blocks.length) return html;
  const insertion = `\n${blocks.join('\n')}\n`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${insertion}</body>`);
  }
  return html + insertion;
}

export async function patchHtmlWithOpenAI(args: PatchHtmlArgs): Promise<PatchHtmlResult> {
  const prompt = (args.prompt || '').trim();
  if (!prompt) {
    throw new Error('Prompt is required');
  }

  const { cleanedHtml, injectedBlocks } = extractInjectedBlocks(args.html || '');

  const selector = (args.selector || '').trim() || null;
  const selectedOuterHtml = (args.selectedOuterHtml || '').trim() || null;
  const pageUrl = (args.pageUrl || '').trim() || null;

  const openai = await getOpenAIClient();

  // Use provided model or default to gpt-5.1-codex
  const model = args.model || 'gpt-5.1-codex';
  const reasoningEffort = args.reasoningEffort || null;
  const supportsReasoningEffort =
    model.startsWith('gpt-5') ||
    model.startsWith('o'); // e.g. o-series models

  const getStatus = (err: any): number | undefined => {
    if (!err) return undefined;
    const status =
      typeof err.status === 'number'
        ? err.status
        : typeof err.statusCode === 'number'
          ? err.statusCode
          : typeof err.response?.status === 'number'
            ? err.response.status
            : undefined;
    return typeof status === 'number' ? status : undefined;
  };

  const isRetryable = (err: any): boolean => {
    const status = getStatus(err);
    if (status === 429 || status === 503) return true;
    if (typeof status === 'number' && status >= 500) return true;
    const msg = String(err?.message || '').toLowerCase();
    return msg.includes('timeout') || msg.includes('overloaded') || msg.includes('service unavailable');
  };

  // ------------------------------------------------------------
  // Snippet mode: If a specific element was selected, ask the model
  // to return ONLY the updated outerHTML for that element, then
  // apply it to the document. This keeps responses fast and avoids
  // full-document rewrites/timeouts.
  // ------------------------------------------------------------
  if (selectedOuterHtml) {
    const snippetInstructions = `You are an expert HTML editor.

You will receive:
- A CSS selector (optional) and the selected element's outerHTML.
- A user request describing changes.

Your task:
- Return ONLY the updated outerHTML for the selected element.
- Do NOT return the full HTML document.
- Preserve attributes and structure unless asked to change them.
- Do NOT include any markdown code fences in your response. Just the raw HTML fragment.`;

    const snippetInputParts: string[] = [];
    if (pageUrl) snippetInputParts.push(`Page URL:\n${pageUrl}\n`);
    if (selector) snippetInputParts.push(`Selected selector:\n${selector}\n`);
    snippetInputParts.push(`Selected outerHTML:\n${selectedOuterHtml}\n`);
    snippetInputParts.push(`User request:\n${prompt}\n`);

    logger.info('[HtmlPatchService] Calling OpenAI to patch HTML (Selected Element Mode)', {
      model,
      promptLength: prompt.length,
      selectedOuterHtmlLength: selectedOuterHtml.length,
      hasSelector: Boolean(selector),
    });

    try {
      const snippetResponse = await retryWithBackoff(
        () =>
          callResponsesWithTimeout(
            () =>
              (openai as any).responses.create({
                model,
                instructions: snippetInstructions,
                input: snippetInputParts.join('\n'),
                ...(supportsReasoningEffort && reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
                // NOTE: Avoid forcing priority tier here; it can be unavailable in some environments.
              }),
            'HTML Patch OpenAI call (selected element)',
            25000
          ),
        {
          maxAttempts: 2,
          initialDelayMs: 750,
          retryableErrors: isRetryable,
          onRetry: (attempt, error) => {
            logger.warn('[HtmlPatchService] Retrying selected-element OpenAI call', {
              attempt,
              status: getStatus(error),
              error: error instanceof Error ? error.message : String(error),
            });
          },
        }
      );

      const snippetOutputText = String((snippetResponse as any)?.output_text || '');
      const updatedOuterHtmlRaw = stripMarkdownCodeFences(snippetOutputText).trim();

      // Basic sanity checks: must look like an element fragment and not a full document.
      const isFullDoc = /<html[\s>]/i.test(updatedOuterHtmlRaw) || /<!doctype/i.test(updatedOuterHtmlRaw);
      if (looksLikeHtmlFragment(updatedOuterHtmlRaw) && !isFullDoc) {
        if (cleanedHtml.includes(selectedOuterHtml)) {
          const patchedHtml = cleanedHtml.replace(selectedOuterHtml, updatedOuterHtmlRaw);
          const patchedWithBlocks = injectBlocksBeforeBodyClose(patchedHtml, injectedBlocks);
          return {
            summary: 'Updated selected element based on your request.',
            patchedHtml: patchedWithBlocks,
          };
        }

        logger.warn('[HtmlPatchService] Selected outerHTML not found in document; falling back to full-document mode', {
          selectedOuterHtmlLength: selectedOuterHtml.length,
          cleanedHtmlLength: cleanedHtml.length,
        });
      } else {
        logger.warn('[HtmlPatchService] Selected element mode returned non-fragment; falling back to full-document mode', {
          outputLength: updatedOuterHtmlRaw.length,
          isFullDoc,
        });
      }
    } catch (error: any) {
      logger.warn('[HtmlPatchService] Selected element mode failed; falling back to full-document mode', {
        error: error?.message || String(error),
      });
    }
  }

  const instructions = `You are an expert HTML editor.

You will receive:
- A complete HTML document (WITHOUT any editing overlays).
- Optionally, a CSS selector and the selected element's outerHTML.
- A user request describing changes.

Your task:
- Apply the user's requested changes to the HTML.
- Return the COMPLETE, VALID, modified HTML document.
- Do NOT return a diff. Return the full HTML.
- Preserve all existing scripts, styles, and structure unless explicitly asked to change them.
- Do NOT include any markdown code fences in your response. Just the raw HTML.

Input HTML is provided below.`;

  const inputParts: string[] = [];
  if (pageUrl) inputParts.push(`Page URL:\n${pageUrl}\n`);
  if (selector) inputParts.push(`Selected selector:\n${selector}\n`);
  if (selectedOuterHtml) inputParts.push(`Selected outerHTML (may be truncated):\n${selectedOuterHtml}\n`);
  inputParts.push(`User request:\n${prompt}\n`);
  inputParts.push(`index.html:\n${cleanedHtml}`);

  logger.info('[HtmlPatchService] Calling OpenAI to patch HTML (Full Document Mode)', {
    model,
    promptLength: prompt.length,
    htmlLength: cleanedHtml.length,
    hasSelector: Boolean(selector),
    hasSelectedOuterHtml: Boolean(selectedOuterHtml),
  });

  // NOTE: No app-level timeout is enforced here. Upstream infrastructure (like API Gateway/Lambda)
  // may still enforce request timeouts depending on deployment configuration.
  const response = await retryWithBackoff(
    () =>
      callResponsesWithTimeout(
        () =>
          (openai as any).responses.create({
            model,
            instructions,
            input: inputParts.join('\n'),
            ...(supportsReasoningEffort && reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
            // NOTE: Avoid forcing priority tier here; it can be unavailable in some environments.
          }),
        'HTML Patch OpenAI call (full document)',
        25000
      ),
    {
      maxAttempts: 2,
      initialDelayMs: 750,
      retryableErrors: isRetryable,
      onRetry: (attempt, error) => {
        logger.warn('[HtmlPatchService] Retrying full-document OpenAI call', {
          attempt,
          status: getStatus(error),
          error: error instanceof Error ? error.message : String(error),
        });
      },
    }
  );

  const outputText = String((response as any)?.output_text || '');
  
  if (!outputText || outputText.length < 10) {
      throw new Error('AI returned empty or invalid HTML.');
  }

  // Strip markdown fences if present
  const patchedHtmlRaw = stripMarkdownCodeFences(outputText);

  // Re-inject the blocks we stripped out earlier
  const patchedWithBlocks = injectBlocksBeforeBodyClose(patchedHtmlRaw, injectedBlocks);

  return {
    summary: 'Updated HTML based on your request.',
    patchedHtml: patchedWithBlocks,
  };
}
