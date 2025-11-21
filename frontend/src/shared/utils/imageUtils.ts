/**
 * Image URL detection utilities
 */

/**
 * Extract image URLs from text content
 * Supports: png, jpg, jpeg, gif, webp, svg, bmp, ico
 * Handles URLs with query parameters
 */
export function extractImageUrls(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return []
  }

  // Regex pattern to match image URLs
  // Matches URLs ending with image extensions, optionally followed by query parameters
  const imageUrlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)(\?[^\s<>"{}|\\^`\[\]]*)?/gi

  const matches = text.match(imageUrlPattern)
  if (!matches) {
    return []
  }

  // Remove duplicates and return
  return Array.from(new Set(matches))
}

/**
 * Check if a URL is an image URL
 */
export function isImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }
  return /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(url)
}

/**
 * Strict image URL check for rendered assets we support in UI (png/jpg/jpeg).
 */
export function isLikelyImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return /\.(png|jpe?g)(\?.*)?$/i.test(url)
}

/**
 * Recursively extract image URLs from an object (for JSON content)
 */
export function extractImageUrlsFromObject(obj: any): string[] {
  if (!obj) {
    return []
  }

  const urls: string[] = []

  if (typeof obj === 'string') {
    urls.push(...extractImageUrls(obj))
  } else if (Array.isArray(obj)) {
    obj.forEach(item => {
      urls.push(...extractImageUrlsFromObject(item))
    })
  } else if (typeof obj === 'object') {
    Object.values(obj).forEach(value => {
      urls.push(...extractImageUrlsFromObject(value))
    })
  }

  // Remove duplicates
  return Array.from(new Set(urls))
}
