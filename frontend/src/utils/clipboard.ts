import { toast } from 'react-hot-toast'

/**
 * Copy text to clipboard with toast notification
 * 
 * Uses the modern Clipboard API when available, with fallback to document.execCommand
 * for older browsers. Shows success/error toast notifications.
 * 
 * @param text - Text to copy to clipboard
 * @param successMessage - Optional custom success message (default: 'Copied to clipboard')
 * @param errorMessage - Optional custom error message (default: 'Unable to copy automatically. Please copy manually.')
 * @returns Promise that resolves when copy operation completes
 * @throws Does not throw, but shows error toast on failure
 * 
 * @example
 * ```ts
 * await copyToClipboard('Hello World')
 * await copyToClipboard('Custom text', 'Copied!', 'Failed to copy')
 * ```
 */
export async function copyToClipboard(
  text: string,
  successMessage: string = 'Copied to clipboard',
  errorMessage: string = 'Unable to copy automatically. Please copy manually.'
): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      toast.success(successMessage)
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      toast.success(successMessage)
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    toast.error(errorMessage)
  }
}

