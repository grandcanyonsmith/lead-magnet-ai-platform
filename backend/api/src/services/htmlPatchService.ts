import { logger } from '../utils/logger';
import { callResponsesWithTimeout, stripMarkdownCodeFences } from '../utils/openaiHelpers';
import { getOpenAIClient } from './openaiService';

type PatchHtmlArgs = {
  html: string;
  prompt: string;
  selector?: string | null;
  selectedOuterHtml?: string | null;
  pageUrl?: string | null;
  model?: string;
};

export type PatchHtmlResult = {
  summary: string;
  patchedHtml: string;
};

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

  // Use provided model or default to gpt-5.1-codex
  const model = args.model || 'gpt-5.1-codex';

  logger.info('[HtmlPatchService] Calling OpenAI to patch HTML (Full Document Mode)', {
    model,
    promptLength: prompt.length,
    htmlLength: cleanedHtml.length,
    hasSelector: Boolean(selector),
    hasSelectedOuterHtml: Boolean(selectedOuterHtml),
  });

  // Wrap in a 25s timeout to fail before API Gateway (30s) does.
  const response = await callResponsesWithTimeout(
    () =>
      (openai as any).responses.create({
        model,
        instructions,
        input: inputParts.join('\n'),
        service_tier: 'priority',
      }),
    'HTML Patch OpenAI call',
    2500000 // 2500 seconds (long timeout allowed here)
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
