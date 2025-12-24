import { logger } from '../utils/logger';
import { callResponsesWithTimeout } from '../utils/openaiHelpers';
import { getOpenAIClient } from './openaiService';
import { applyDiff } from '../utils/patchUtils';

type PatchHtmlArgs = {
  html: string;
  prompt: string;
  selector?: string | null;
  selectedOuterHtml?: string | null;
  pageUrl?: string | null;
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

function stripDiffCodeFences(diff: string): string {
  let cleaned = String(diff || '').trim();
  cleaned = cleaned.replace(/^```diff\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  return cleaned.trim();
}

function parsePatchOutput(outputText: string): { summary: string; diff: string } {
  const raw = String(outputText || '').trim();

  // Preferred format:
  // SUMMARY:
  // ...
  // DIFF:
  // --- a/index.html
  // +++ b/index.html
  // @@ ...
  const match = raw.match(/^\s*SUMMARY:\s*([\s\S]*?)\nDIFF:\s*\n?([\s\S]*)$/i);
  if (match) {
    const summary = (match[1] || '').trim() || 'Patched HTML.';
    const diff = stripDiffCodeFences(match[2] || '');
    return { summary, diff };
  }

  // Fallback: try to extract a diff from anywhere in the output.
  const startIdx = raw.search(/(^|\n)---\s+a\/index\.html/i);
  if (startIdx >= 0) {
    const diff = stripDiffCodeFences(raw.slice(startIdx));
    return { summary: 'Patched HTML.', diff };
  }

  return { summary: 'Patched HTML.', diff: '' };
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
- Produce a UNIFIED DIFF patch that updates the HTML to satisfy the user request.
- Make the smallest possible change to fulfill the request.
- Preserve formatting and unrelated content as much as possible.
- Do NOT include any markdown code fences.

Output EXACTLY in this format:

SUMMARY:
<1-3 bullet points describing what changed>
DIFF:
--- a/index.html
+++ b/index.html
@@ ... @@
 ...`;

  const inputParts: string[] = [];
  if (pageUrl) inputParts.push(`Page URL:\n${pageUrl}\n`);
  if (selector) inputParts.push(`Selected selector:\n${selector}\n`);
  if (selectedOuterHtml) inputParts.push(`Selected outerHTML (may be truncated):\n${selectedOuterHtml}\n`);
  inputParts.push(`User request:\n${prompt}\n`);
  inputParts.push(`index.html:\n${cleanedHtml}`);

  // Use gpt-4o for speed to stay within API Gateway's 30s limit.
  // Codex-style models are slower and can trigger 503 Gateway timeouts on large documents.
  const model = 'gpt-4o';

  logger.info('[HtmlPatchService] Calling OpenAI to patch HTML', {
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
      }),
    'HTML Patch OpenAI call',
    2500000 // 2500 seconds
  );
  console.log('response', response);
  const outputText = String((response as any)?.output_text || '');
  const parsed = parsePatchOutput(outputText);

  if (!parsed.diff || !parsed.diff.includes('@@')) {
    throw new Error('AI patch response did not include a valid unified diff.');
  }

  const patchedHtml = applyDiff(cleanedHtml, parsed.diff);
  const patchedWithBlocks = injectBlocksBeforeBodyClose(patchedHtml, injectedBlocks);

  return {
    summary: parsed.summary,
    patchedHtml: patchedWithBlocks,
  };
}
