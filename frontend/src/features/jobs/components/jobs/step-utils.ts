import { Artifact } from '@/features/artifacts/types'
import { MergedStep } from '@/features/jobs/types'
import { collectStepOutputImageUrls, deduplicateStepFiles, type FileToShow } from '@/shared/utils/fileDeduplication'

export type ToolValue = string | { type?: string; [key: string]: unknown }

export function getToolName(tool: ToolValue): string {
  if (typeof tool === 'string') {
    return tool
  }

  if (tool && typeof tool === 'object' && 'type' in tool) {
    const value = (tool as { type?: string }).type
    if (typeof value === 'string' && value.length > 0) {
      return value
    }
  }

  return 'unknown'
}

export function normalizeTools(tools?: unknown[]): string[] {
  if (!Array.isArray(tools)) {
    return []
  }

  const names = tools
    .map((tool) => getToolName(tool as ToolValue))
    .filter((name): name is string => Boolean(name))

  return Array.from(new Set(names))
}

export function getStepTools(step: MergedStep): unknown[] {
  return (step.input?.tools || step.tools || []) as unknown[]
}

export function getStepToolNames(step: MergedStep): string[] {
  return normalizeTools(getStepTools(step))
}

export function getStepToolChoice(step: MergedStep): string | undefined {
  return step.input?.tool_choice || step.tool_choice || undefined
}

export function getStepModel(step: MergedStep): string | undefined {
  const modelValue = step.model || step.input?.model
  return typeof modelValue === 'string' ? modelValue : undefined
}

export function getMergedImageUrls(step: MergedStep): string[] {
  const stepUrls = Array.isArray(step.image_urls) ? step.image_urls : []
  const outputUrls = collectStepOutputImageUrls(step)

  return Array.from(
    new Set(
      [...stepUrls, ...outputUrls].filter(
        (url): url is string => typeof url === 'string' && url.length > 0
      )
    )
  )
}

export function stepUsesImageGeneration(step: MergedStep, artifacts: Artifact[]): boolean {
  if (artifacts.length > 0) {
    return true
  }

  if (getMergedImageUrls(step).length > 0) {
    return true
  }

  return getStepToolNames(step).some((name) => name === 'image_generation')
}

export function getStepFilePreviews(step: MergedStep, artifacts: Artifact[]): FileToShow[] {
  return deduplicateStepFiles(step, artifacts)
}

export function truncateUrl(url: string, maxLength = 50): string {
  if (url.length <= maxLength) {
    return url
  }

  return `${url.substring(0, maxLength)}...`
}

