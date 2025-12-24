import { logger } from '../utils/logger';
import { stripMarkdownCodeFences } from '../utils/openaiHelpers';
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
You have access to a file named "index.html".
You will receive:
- The content of "index.html" (WITHOUT any editing overlays).
- Optionally, a CSS selector and the selected element's outerHTML context indicating what the user was looking at.
- A user request describing changes.

Your task:
- Analyze the user request.
- Use the 'apply_patch' tool to modify "index.html" to fulfill the request.
- Ensure the HTML remains valid and well-formed.
- AFTER issuing the patch, provide a brief summary of changes in the text response.

IMPORTANT:
- The user may have selected a specific element (provided as context), but your edits are NOT restricted to that element.
- You may modify ANY part of the file as needed to fulfill the request.
- If the user asks to "delete this section" or makes a broad request, apply the change to the appropriate scope, even if it is larger than the selected element.
- **GLOBAL CHANGES:** If the user request implies a global change (e.g., "change background color", "change font"), apply it to the \`body\` tag, \`html\` tag, or global CSS, ensuring it affects the ENTIRE page. Do not limit it to the selected element unless explicitly requested.
- Do NOT output the full HTML in the text response. Only use the tool to edit the file.`;

  const inputParts: string[] = [];
  inputParts.push(`The user has the following files:
<BEGIN_FILES>
===== index.html
${cleanedHtml}
<END_FILES>
`);

  if (pageUrl) inputParts.push(`Page URL:\n${pageUrl}\n`);
  if (selector) inputParts.push(`Selected selector:\n${selector}\n`);
  if (selectedOuterHtml) inputParts.push(`Selected outerHTML (may be truncated):\n${selectedOuterHtml}\n`);
  inputParts.push(`User request:\n${prompt}\n`);

  // Use gpt-5.1-codex for apply_patch support
  const model = 'gpt-5.1-codex';

  logger.info('[HtmlPatchService] Calling OpenAI to patch HTML', {
    model,
    promptLength: prompt.length,
    htmlLength: cleanedHtml.length,
    hasSelector: Boolean(selector),
    hasSelectedOuterHtml: Boolean(selectedOuterHtml),
  });

  // Direct call without timeout and with priority service tier
  const response = await (openai as any).responses.create({
    model,
    instructions,
    input: inputParts.join('\n'),
    tools: [{ type: 'apply_patch' }],
    service_tier: 'priority',
  });

  let currentHtml = cleanedHtml;
  let summary = 'Patched HTML.';

  // Handle patch calls
  const outputItems = (response as any).output || [];
  const patchCalls = outputItems.filter((item: any) => item.type === 'apply_patch_call');

  if (patchCalls.length > 0) {
    logger.info('[HtmlPatchService] Received patch calls', { count: patchCalls.length });
    
    for (const call of patchCalls) {
      const { operation } = call;
      if (operation.path === 'index.html' && operation.type === 'update_file') {
        try {
          logger.debug('[HtmlPatchService] Applying patch', { diffLength: operation.diff?.length });
          currentHtml = applyDiff(currentHtml, operation.diff);
        } catch (err) {
          logger.error('[HtmlPatchService] Failed to apply patch', {
            error: err instanceof Error ? err.message : String(err),
            diffSnippet: operation.diff?.substring(0, 100)
          });
          // In a real agent loop, we would report failure back to model.
          // Here we just log and continue (or throw).
          // Throwing is safer so we don't return broken state.
          throw new Error('Failed to apply AI patch: ' + (err instanceof Error ? err.message : String(err)));
        }
      }
    }
  } else {
    logger.warn('[HtmlPatchService] No patch calls received from model');
    // Fallback: Check if model outputted HTML directly in text (unlikely given instructions but possible)
    const textOutput = outputItems.find((item: any) => item.type === 'message')?.content || '';
    if (textOutput.includes('<html') || textOutput.includes('<!DOCTYPE')) {
         // Attempt to extract HTML if model hallucinated and ignored tools
         // Use the old parser logic or similar
         const match = textOutput.match(/HTML:\s*\n?([\s\S]*)$/i);
         if (match) {
             currentHtml = match[1].trim();
         }
    }
  }

  // Extract summary from text message
  const messageItem = outputItems.find((item: any) => item.type === 'message');
  if (messageItem && messageItem.content) {
      // Clean up summary
      summary = stripMarkdownCodeFences(messageItem.content).trim();
  }

  const patchedWithBlocks = injectBlocksBeforeBodyClose(currentHtml, injectedBlocks);

  return {
    summary,
    patchedHtml: patchedWithBlocks,
  };
}
