import { logger } from '../utils/logger';
import { stripMarkdownCodeFences, callResponsesWithTimeout } from '../utils/openaiHelpers';
import { getOpenAIClient } from './openaiService';

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

function parsePatchOutput(outputText: string): { summary: string; html: string } {
  const cleaned = stripMarkdownCodeFences(String(outputText || '')).trim();

  // Preferred format:
  // SUMMARY:
  // ...
  // HTML:
  // <full html>
  const match = cleaned.match(/^\s*SUMMARY:\s*([\s\S]*?)\nHTML:\s*\n?([\s\S]*)$/i);
  if (match) {
    return {
      summary: (match[1] || '').trim() || 'Patched HTML.',
      html: (match[2] || '').trim(),
    };
  }

  // Fallback: treat all output as HTML.
  return {
    summary: 'Patched HTML.',
    html: cleaned,
  };
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
- Rewrite the FULL HTML document to apply the requested changes.
- Preserve everything else as-is as much as possible.
- Do not include markdown code fences.
- Do not include explanations outside the required output format.

Output EXACTLY in this format:

SUMMARY:
<1-3 bullet points describing what changed>
HTML:
<the full updated HTML document>`;

  const inputParts: string[] = [];
  if (pageUrl) inputParts.push(`Page URL:\n${pageUrl}\n`);
  if (selector) inputParts.push(`Selected selector:\n${selector}\n`);
  if (selectedOuterHtml) inputParts.push(`Selected outerHTML (may be truncated):\n${selectedOuterHtml}\n`);
  inputParts.push(`User request:\n${prompt}\n`);
  inputParts.push(`HTML document:\n${cleanedHtml}`);

  // Use gpt-4o for speed to stay within API Gateway's 30s limit.
  // Note: gpt-5.2 is significantly slower and reliably triggers 503 Gateway timeouts on large documents.
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
        temperature: 0.2,
      }),
    'HTML Patch OpenAI call',
    25000 // 25 seconds
  );

  const outputText = String((response as any)?.output_text || '');
  const parsed = parsePatchOutput(outputText);

  const patchedWithBlocks = injectBlocksBeforeBodyClose(parsed.html, injectedBlocks);

  return {
    summary: parsed.summary,
    patchedHtml: patchedWithBlocks,
  };
}
