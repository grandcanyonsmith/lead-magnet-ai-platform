'use client'

import { useEffect, useRef } from 'react'

export function useScrollGlow<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const handleScroll = () => {
      element.classList.add('scrolling')
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        element.classList.remove('scrolling')
      }, 300)
    }

    element.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      element.removeEventListener('scroll', handleScroll)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  return ref
}

