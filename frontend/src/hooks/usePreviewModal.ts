import { useCallback, useState } from 'react'

export function usePreviewModal<T>() {
  const [previewItem, setPreviewItem] = useState<T | null>(null)

  const openPreview = useCallback((item: T) => {
    setPreviewItem(item)
  }, [])

  const closePreview = useCallback(() => {
    setPreviewItem(null)
  }, [])

  return {
    previewItem,
    openPreview,
    closePreview,
  }
}
