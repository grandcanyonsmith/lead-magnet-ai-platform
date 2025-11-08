/**
 * Template utility functions
 */

export function extractPlaceholders(html: string): string[] {
  const regex = /\{\{([A-Z_]+)\}\}/g
  const matches = html.matchAll(regex)
  const placeholders = new Set<string>()
  for (const match of matches) {
    placeholders.add(match[1])
  }
  return Array.from(placeholders).sort()
}

export function formatHTML(html: string): string {
  // Simple HTML formatting - indent based on tags
  let formatted = html
  formatted = formatted.replace(/>\s*</g, '>\n<')
  const lines = formatted.split('\n')
  let indent = 0
  const formattedLines = lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('</')) {
      indent = Math.max(0, indent - 2)
    }
    const indented = ' '.repeat(indent) + trimmed
    if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>')) {
      indent += 2
    }
    return indented
  })
  return formattedLines.join('\n')
}

export function getPreviewHtml(html: string, placeholders: Record<string, string> = {}): string {
  if (!html.trim()) return ''
  
  let previewHtml = html
  
  // Default sample data
  const sampleData: Record<string, string> = {
    TITLE: 'Sample Lead Magnet Title',
    CONTENT: 'This is sample content that will be replaced with your actual lead magnet content when the template is used.',
    AUTHOR_NAME: 'John Doe',
    COMPANY_NAME: 'Your Company',
    DATE: new Date().toLocaleDateString(),
    EMAIL: 'user@example.com',
    PHONE: '+1 (555) 123-4567',
    ...placeholders,
  }
  
  // Replace all placeholders
  Object.keys(sampleData).forEach(key => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    previewHtml = previewHtml.replace(regex, sampleData[key])
  })
  
  // Replace any remaining placeholders with generic text
  previewHtml = previewHtml.replace(/\{\{([A-Z_]+)\}\}/g, '[$1]')
  
  return previewHtml
}

export function getDevicePreviewWidth(device: 'mobile' | 'tablet' | 'desktop'): string {
  switch (device) {
    case 'mobile':
      return '375px'
    case 'tablet':
      return '768px'
    default:
      return '100%'
  }
}

