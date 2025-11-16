import { useParams } from 'next/navigation'

/**
 * Extract job ID from Next.js params or browser URL
 * 
 * Handles multiple scenarios:
 * - Normal Next.js routing with params.id
 * - Vercel rewrite scenarios where param might be '_'
 * - Static exports where params may not be available
 * - SPA routing with hash-based navigation
 * 
 * Priority order:
 * 1. params.id (if valid and not '_')
 * 2. window.location.pathname match
 * 3. window.location.hash match
 * 4. Fallback to params.id or empty string
 * 
 * @param params - Next.js params object (from useParams hook)
 * @returns Job ID string or empty string if not found
 * 
 * @example
 * ```ts
 * const params = useParams()
 * const jobId = extractJobId(params)
 * ```
 */
export function extractJobId(params: ReturnType<typeof useParams>): string {
  // First try to get from params
  const paramId = params?.id as string
  if (paramId && paramId !== '_' && paramId.trim() !== '') {
    return paramId
  }
  
  // Fallback: extract from browser URL (works for static exports and direct navigation)
  if (typeof window !== 'undefined') {
    const pathMatch = window.location.pathname.match(/\/dashboard\/jobs\/([^/?#]+)/)
    if (pathMatch && pathMatch[1] && pathMatch[1] !== '_' && pathMatch[1].trim() !== '') {
      return pathMatch[1]
    }
    
    // Also check hash in case of SPA routing
    const hashMatch = window.location.hash.match(/\/dashboard\/jobs\/([^/?#]+)/)
    if (hashMatch && hashMatch[1] && hashMatch[1] !== '_' && hashMatch[1].trim() !== '') {
      return hashMatch[1]
    }
  }
  
  return paramId || ''
}

