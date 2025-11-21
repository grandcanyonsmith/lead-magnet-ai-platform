import { Artifact } from '@/features/artifacts/types'
import { MergedStep } from '@/features/jobs/types'
import { collectStepOutputImageUrls, deduplicateStepFiles, type FileToShow } from '@/shared/utils/fileDeduplication'
import { isLikelyImageUrl } from '@/shared/utils/imageUtils'

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
      [...stepUrls, ...outputUrls]
        .filter((url): url is string => typeof url === 'string' && url.length > 0)
        .filter((url) => isLikelyImageUrl(url))
    )
  )
}

export function isImageArtifact(artifact: Artifact): boolean {
  if (!artifact) return false
  const contentType = artifact.content_type || ''
  const fileName = artifact.file_name || artifact.artifact_name || ''
  const isImageMime = typeof contentType === 'string' && contentType.toLowerCase().startsWith('image/')
  const isImageExt = typeof fileName === 'string' && /\.(png|jpe?g)$/i.test(fileName)
  return isImageMime || isImageExt
}

export function stepUsesImageGeneration(step: MergedStep, artifacts: Artifact[]): boolean {
  const toolNames = getStepToolNames(step).map((name) => name.toLowerCase())
  const IMAGE_TOOL_KEYS = ['image_generation', 'image-gen', 'image', 'vision', 'dalle', 'generate_image']
  const hasImageTool = toolNames.some((name) =>
    IMAGE_TOOL_KEYS.some((key) => name.includes(key))
  )
  if (!hasImageTool) return false

  const imageArtifacts = artifacts.filter(isImageArtifact)
  const imageUrls = getMergedImageUrls(step)
  return imageArtifacts.length > 0 || imageUrls.length > 0
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
