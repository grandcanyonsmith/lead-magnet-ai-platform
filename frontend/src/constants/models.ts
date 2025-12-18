/**
 * AI model constants
 */

import { AIModel } from '@/types/workflow'

export const AI_MODELS: Array<{ value: AIModel; label: string }> = [
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-5.1', label: 'GPT-5.1' },
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'computer-use-preview', label: 'Computer Use Preview' },
  { value: 'o4-mini-deep-research', label: 'O4-Mini-Deep-Research' },
] as const

export const DEFAULT_AI_MODEL: AIModel = 'gpt-5'
export const DEFAULT_REWRITE_MODEL: AIModel = 'gpt-5'
export const DEFAULT_TEMPLATE_MODEL = 'gpt-4o'

