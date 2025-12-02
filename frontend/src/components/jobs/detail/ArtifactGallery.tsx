import { FiCopy, FiExternalLink, FiFileText, FiMaximize2 } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { PreviewRenderer } from '@/components/artifacts/PreviewRenderer'
import type { ArtifactGalleryItem } from '@/types/job'

interface ArtifactGalleryProps {
  items: ArtifactGalleryItem[]
  loading: boolean
  onPreview: (item: ArtifactGalleryItem) => void
}

export function ArtifactGallery({ items, loading, onPreview }: ArtifactGalleryProps) {
  if (loading && items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-4 text-sm text-gray-600">
        Loading artifacts…
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-4 text-sm text-gray-600">
        No artifacts have been generated for this run yet.
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <ArtifactCard key={item.id} item={item} onPreview={onPreview} />
      ))}
    </div>
  )
}

interface ArtifactCardProps {
  item: ArtifactGalleryItem
  onPreview: (item: ArtifactGalleryItem) => void
}

const BADGE_CLASS_MAP: Record<ArtifactGalleryItem['kind'], string> = {
  artifact: 'bg-blue-100 text-blue-800 border border-blue-200',
  imageArtifact: 'bg-purple-100 text-purple-800 border border-purple-200',
  imageUrl: 'bg-teal-100 text-teal-800 border border-teal-200',
  jobOutput: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
}

function ArtifactCard({ item, onPreview }: ArtifactCardProps) {
  const artifactUrl = item.artifact?.object_url || item.artifact?.public_url || item.url
  const fileName =
    item.artifact?.file_name || item.artifact?.artifact_name || item.url || item.label || 'Artifact'

  const badgeLabel = (() => {
    switch (item.kind) {
      case 'jobOutput':
        return 'Final Output'
      case 'imageArtifact':
        return 'Image Artifact'
      case 'imageUrl':
        return 'Image URL'
      default:
        return 'Artifact'
    }
  })()

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

  return (
    <article className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {item.stepOrder !== undefined && (
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step {item.stepOrder}</p>
          )}
          <p className="text-base font-semibold text-gray-900 mt-0.5 break-words">{item.label}</p>
          {item.description && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>}
        </div>
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${BADGE_CLASS_MAP[item.kind]}`}>
          {badgeLabel}
        </span>
      </div>

      {artifactUrl && item.kind !== 'jobOutput' && (
        <div className="border-t border-gray-100">
          <div className="aspect-video bg-gray-50 relative overflow-hidden">
            <PreviewRenderer
              contentType={item.artifact?.content_type || (item.kind === 'imageUrl' ? 'image/png' : undefined)}
              objectUrl={artifactUrl}
              fileName={fileName}
              className="w-full h-full"
              artifactId={item.artifact?.artifact_id}
            />
          </div>
        </div>
      )}

      {item.kind === 'jobOutput' && (
        <div className="px-4 pb-2 text-sm text-gray-600">Access the final deliverable generated for this run.</div>
      )}

      <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-gray-100">
        {artifactUrl && (
          <a
            href={artifactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            <FiExternalLink className="h-4 w-4" aria-hidden="true" />
            View
          </a>
        )}
        {item.kind === 'jobOutput' && item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FiFileText className="h-4 w-4" aria-hidden="true" />
            Download
          </a>
        )}
        {artifactUrl && item.kind !== 'jobOutput' && (
          <button
            type="button"
            onClick={() => onPreview(item)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FiMaximize2 className="h-4 w-4" aria-hidden="true" />
            Expand
          </button>
        )}
        {artifactUrl && (
          <button
            type="button"
            onClick={() => handleCopy(artifactUrl, 'Link copied')}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FiCopy className="h-4 w-4" aria-hidden="true" />
            Copy link
          </button>
        )}
      </div>
    </article>
  )
}
