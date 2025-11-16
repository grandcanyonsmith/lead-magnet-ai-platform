import { Artifact } from '@/types/artifact'
import { MergedStep } from '@/types/job'
import { extractImageUrls } from '@/utils/imageUtils'

export type FileToShow = {
  type: 'imageArtifact' | 'imageUrl'
  data: Artifact | string
  key: string
}

/**
 * Extract filename from URL string
 * 
 * Attempts to parse URL and extract filename from pathname.
 * Falls back to string splitting if URL parsing fails.
 * 
 * @param url - URL string to extract filename from
 * @returns Filename or original URL if extraction fails
 */
function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    return pathname.split('/').pop() || ''
  } catch {
    // If URL parsing fails, try to extract from string
    const parts = url.split('/')
    return parts[parts.length - 1] || url
  }
}

/**
 * Normalize filename for comparison
 * 
 * Removes query parameters and converts to lowercase for consistent
 * duplicate detection across different URL formats.
 * 
 * @param filename - Filename to normalize
 * @returns Normalized filename (lowercase, no query params)
 */
function normalizeFilename(filename: string): string {
  return filename.split('?')[0].toLowerCase()
}

/**
 * Deduplicate files from step image URLs and image artifacts
 * 
 * Returns unique files to display, avoiding duplicates between:
 * - Main artifact (shown in Output section, excluded here)
 * - Image artifacts from hook
 * - Image URLs from step.image_urls
 * 
 * Deduplication strategy:
 * 1. Track displayed files by artifact ID and normalized filename
 * 2. Skip main artifact (already shown in Output section)
 * 3. Process image artifacts first (higher priority)
 * 4. Process image URLs, skipping if filename or URL matches existing artifact
 * 
 * @param step - The merged step with image_urls and artifact_id
 * @param imageArtifacts - Image artifacts from the useImageArtifacts hook
 * @returns Array of unique files to display, ordered by priority
 */
function collectStepOutputImageUrls(step: MergedStep): string[] {
  if (!step.output) {
    return []
  }

  if (typeof step.output === 'string') {
    return extractImageUrls(step.output)
  }

  try {
    return extractImageUrls(JSON.stringify(step.output))
  } catch {
    return []
  }
}

export function deduplicateStepFiles(
  step: MergedStep,
  imageArtifacts: Artifact[]
): FileToShow[] {
  const rawImageUrls = (step.image_urls && Array.isArray(step.image_urls) && step.image_urls.length > 0) 
    ? step.image_urls 
    : []
  const outputImageUrls = collectStepOutputImageUrls(step)
  const stepImageUrls = Array.from(
    new Set(
      [...rawImageUrls, ...outputImageUrls].filter(
        (url): url is string => typeof url === 'string' && url.length > 0
      )
    )
  )
  const stepImageArtifacts = imageArtifacts || []
  const mainArtifactId = step.artifact_id
  
  const displayedFiles = new Set<string>()
  const filesToShow: FileToShow[] = []
  
  // Priority 1: Main artifact (step.artifact_id) - shown in Output section, skip here to avoid duplicates
  if (mainArtifactId) {
    displayedFiles.add(`artifact:${mainArtifactId}`)
  }
  
  // Priority 2: Image artifacts (from imageArtifacts hook)
  stepImageArtifacts.forEach((artifact: Artifact) => {
    const artifactId = artifact.artifact_id
    const fileName = artifact.file_name || artifact.artifact_name || ''
    const normalizedName = normalizeFilename(fileName)
    
    // Skip if this is the main artifact
    if (artifactId === mainArtifactId) {
      return
    }
    
    // Skip if we've already seen this filename from another source
    if (normalizedName && displayedFiles.has(`filename:${normalizedName}`)) {
      return
    }
    
    displayedFiles.add(`filename:${normalizedName}`)
    displayedFiles.add(`artifact:${artifactId}`)
    filesToShow.push({
      type: 'imageArtifact',
      data: artifact,
      key: `image-artifact-${artifactId}`
    })
  })
  
  // Priority 3: Image URLs (from step.image_urls)
  stepImageUrls.forEach((imageUrl: string, idx: number) => {
    const filename = getFilenameFromUrl(imageUrl)
    const normalizedName = normalizeFilename(filename)
    
    // Skip if we've already seen this filename
    if (normalizedName && displayedFiles.has(`filename:${normalizedName}`)) {
      return
    }
    
    // Check if this URL matches any artifact we're already showing
    const matchesExistingArtifact = stepImageArtifacts.some((artifact: Artifact) => {
      const artifactUrl = artifact.object_url || artifact.public_url
      return artifactUrl === imageUrl || 
        normalizeFilename(artifact.file_name || artifact.artifact_name || '') === normalizedName
    })
    
    if (matchesExistingArtifact) {
      return
    }
    
    displayedFiles.add(`filename:${normalizedName}`)
    filesToShow.push({
      type: 'imageUrl',
      data: imageUrl,
      key: `image-url-${idx}`
    })
  })
  
  return filesToShow
}

