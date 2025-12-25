import { useState } from 'react'
import {
  ClipboardDocumentIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
  ArrowsPointingOutIcon,
  EyeIcon,
  CodeBracketIcon,
  PhotoIcon,
  DocumentIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { PreviewRenderer } from '@/components/artifacts/PreviewRenderer'
import { openJobDocumentInNewTab } from '@/utils/jobs/openJobDocument'
import type { ArtifactGalleryItem } from '@/types/job'
import { Tooltip } from '@/components/ui/Tooltip'
import Link from 'next/link'

interface ArtifactGalleryProps {
  items: ArtifactGalleryItem[]
  loading: boolean
  onPreview: (item: ArtifactGalleryItem) => void
}

function groupFinalHtmlArtifacts(items: ArtifactGalleryItem[]): ArtifactGalleryItem[] {
  const groups = new Map<string, ArtifactGalleryItem[]>()
  const passthrough: ArtifactGalleryItem[] = []

  for (const item of items) {
    const artifactType = String(item.artifact?.artifact_type || '').toLowerCase()
    const fileName = String(item.artifact?.file_name || item.artifact?.artifact_name || '').toLowerCase()

    // Group repeated html_final artifacts (commonly "final.html") into a single card.
    if (item.kind === 'artifact' && artifactType === 'html_final' && fileName) {
      const key = `${artifactType}:${fileName}`
      const arr = groups.get(key) || []
      arr.push(item)
      groups.set(key, arr)
      continue
    }

    passthrough.push(item)
  }

  const grouped: ArtifactGalleryItem[] = []
  for (const [key, versions] of groups.entries()) {
    if (versions.length <= 1) {
      grouped.push(versions[0])
      continue
    }

    const latest = versions.reduce(
      (acc, cur) => ((cur.sortOrder ?? 0) > (acc.sortOrder ?? 0) ? cur : acc),
      versions[0]
    )
    const versionNumber = versions.length
    const baseDescription =
      latest.description ||
      latest.artifact?.artifact_type?.replace(/_/g, ' ') ||
      latest.artifact?.file_name ||
      'html final'

    grouped.push({
      ...latest,
      id: `group-${key}`,
      description: `${baseDescription} · v${versionNumber}`,
    })
  }

  return [...passthrough, ...grouped].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

export function ArtifactGallery({
  items,
  loading,
  onPreview,
}: ArtifactGalleryProps) {
  const displayItems = groupFinalHtmlArtifacts(items)

  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-gray-300 bg-white p-4"
          >
            <div className="aspect-[4/3] w-full rounded-xl bg-gray-100" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-3/4 rounded bg-gray-100" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center">
        <div className="rounded-full bg-gray-100 p-3">
          <PhotoIcon className="h-6 w-6 text-gray-400" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-gray-900">
          No artifacts generated
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Artifacts will appear here once the job completes successfully.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {displayItems.map((item) => (
        <ArtifactCard key={item.id} item={item} onPreview={onPreview} />
      ))}
    </div>
  )
}

interface ArtifactCardProps {
  item: ArtifactGalleryItem
  onPreview: (item: ArtifactGalleryItem) => void
}

function ArtifactCard({ item, onPreview }: ArtifactCardProps) {
  const artifactUrl =
    item.artifact?.object_url || item.artifact?.public_url || item.url
  const fileName =
    item.artifact?.file_name ||
    item.artifact?.artifact_name ||
    item.url ||
    item.label ||
    'Artifact'
  const [openingJobOutput, setOpeningJobOutput] = useState(false)

  const editorJobId = item.jobId || item.artifact?.job_id
  const editorHref =
    editorJobId
      ? `/dashboard/editor?jobId=${editorJobId}&artifactId=${item.artifact?.artifact_id || ''}&url=${encodeURIComponent(artifactUrl || '')}`
      : null

  const normalizedFileName = fileName.toLowerCase()
  const normalizedContentType = String(item.artifact?.content_type || '').toLowerCase()
  const normalizedUrlPath = (() => {
    try {
      return artifactUrl ? new URL(artifactUrl).pathname.toLowerCase() : ''
    } catch {
      return String(artifactUrl || '').toLowerCase()
    }
  })()

  const isHtml =
    normalizedContentType.includes('text/html') ||
    normalizedFileName.endsWith('.html') ||
    normalizedFileName.endsWith('.htm') ||
    normalizedUrlPath.endsWith('.html') ||
    normalizedUrlPath.endsWith('.htm')

  const handleCopy = async (value: string, successMessage: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value)
      } else {
        throw new Error('Clipboard API not available')
      }
      toast.success(successMessage)
    } catch {
      toast.error('Unable to copy to clipboard')
    }
  }

  const handleViewJobOutput = async () => {
    if (!item.jobId || openingJobOutput) return

    setOpeningJobOutput(true)

    try {
      await openJobDocumentInNewTab(item.jobId)
    } finally {
      setOpeningJobOutput(false)
    }
  }

  const isImage =
    item.kind === 'imageUrl' ||
    item.kind === 'imageArtifact' ||
    item.artifact?.content_type?.startsWith('image/')

  const isCode =
    item.artifact?.content_type === 'text/html' ||
    item.artifact?.content_type === 'application/json' ||
    item.artifact?.content_type === 'text/markdown' ||
    fileName.endsWith('.html') ||
    fileName.endsWith('.json') ||
    fileName.endsWith('.md')

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-300 bg-white shadow transition-all hover:shadow-md hover:border-gray-400">
      {/* Preview Area */}
      <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden group/preview">
        {artifactUrl && item.kind !== 'jobOutput' ? (
          <div className="relative h-full w-full">
            <PreviewRenderer
              contentType={
                item.artifact?.content_type ||
                (item.kind === 'imageUrl' ? 'image/png' : undefined)
              }
              objectUrl={artifactUrl}
              fileName={fileName}
              className="h-full w-full object-cover"
              artifactId={item.artifact?.artifact_id}
            />
            <div
              className="absolute inset-0 cursor-pointer z-10"
              onClick={() => onPreview(item)}
            />
          </div>
        ) : (
          <div
            className="flex h-full w-full cursor-pointer items-center justify-center bg-gray-50 text-gray-400"
            onClick={() => onPreview(item)}
          >
            {item.kind === 'jobOutput' ? (
              <DocumentIcon className="h-12 w-12" />
            ) : isCode ? (
              <CodeBracketIcon className="h-12 w-12" />
            ) : (
              <PhotoIcon className="h-12 w-12" />
            )}
          </div>
        )}

        {/* Overlay AI Editor button (restored) */}
        {isHtml && editorHref && (
          <Tooltip content="Open in AI Editor" position="top">
            <Link
              href={editorHref}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-3 top-3 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-gray-900/80 text-white shadow-lg transition-colors hover:bg-gray-900"
              aria-label="Open in AI Editor"
            >
              <PencilSquareIcon className="h-5 w-5" />
            </Link>
          </Tooltip>
        )}

        {/* Type Badge */}
        <div className="absolute left-3 top-3">
          <span className="inline-flex items-center rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-gray-700 shadow-sm backdrop-blur-sm">
            {isImage ? 'Image' : isCode ? 'Code' : 'Document'}
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-1" title={item.label}>
            {item.label}
          </h3>
          {item.description && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-2">
              {item.description}
            </p>
          )}
          {item.stepOrder !== undefined && (
            <p className="mt-2 text-xs font-medium text-gray-400">
              Step {item.stepOrder}
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1">
            {item.kind === 'jobOutput' && item.jobId ? (
              <button
                type="button"
                onClick={handleViewJobOutput}
                disabled={openingJobOutput}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-2.5 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 hover:text-primary-800 transition-colors"
              >
                {openingJobOutput ? (
                  <span className="animate-pulse">Opening...</span>
                ) : (
                  <>
                    <EyeIcon className="h-3.5 w-3.5" />
                    View Output
                  </>
                )}
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            {artifactUrl && (
              <Tooltip content="Open in new tab" position="top">
                <a
                  href={artifactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </a>
              </Tooltip>
            )}
            {isHtml && editorHref && (
              <Tooltip content="Open in AI Editor" position="top">
                <Link
                  href={editorHref}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                </Link>
              </Tooltip>
            )}
            {artifactUrl && (
              <Tooltip content="Copy Link" position="top">
                <button
                  onClick={() => handleCopy(artifactUrl, 'Link copied')}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <ClipboardDocumentIcon className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
            {item.kind === 'jobOutput' && item.url && (
              <Tooltip content="Download" position="top">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                </a>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

