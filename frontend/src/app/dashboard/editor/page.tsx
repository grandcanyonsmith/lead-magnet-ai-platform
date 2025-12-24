import { Suspense } from 'react'
import EditorClient from './client'

export default function EditorPage() {
  return (
    <div className="h-screen w-full bg-[#0c0d10] overflow-hidden">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading editor...</div>}>
        <EditorClient />
      </Suspense>
    </div>
  )
}

