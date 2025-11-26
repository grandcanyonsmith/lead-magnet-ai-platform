'use client'

import { useRouter } from 'next/navigation'
import { FiChevronDown, FiChevronUp, FiCopy, FiExternalLink, FiLoader, FiFile } from 'react-icons/fi'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { PreviewRenderer } from '@/components/artifacts/PreviewRenderer'
import { Artifact } from '@/types/artifact'

interface TechnicalDetailsProps {
  job: any
  form: any | null
}

export function TechnicalDetails({ job, form }: TechnicalDetailsProps) {
  const router = useRouter()
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [copied, setCopied] = useState(false)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loadingArtifacts, setLoadingArtifacts] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Fetch all artifacts for this job (including images)
  useEffect(() => {
    const fetchArtifacts = async () => {
      if (!job?.job_id || !showTechnicalDetails) return
      
      try {
        setLoadingArtifacts(true)
        const response = await api.getArtifacts({ 
          job_id: job.job_id,
          limit: 100 // Get all artifacts
        })
        setArtifacts(response.artifacts || [])
      } catch (err) {
        console.error('Failed to fetch artifacts:', err)
        setArtifacts([])
      } finally {
        setLoadingArtifacts(false)
      }
    }

    fetchArtifacts()
  }, [job?.job_id, showTechnicalDetails])

  return (
    <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow p-4 sm:p-6">
      <button
        onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
        className="flex items-center justify-between w-full text-left mb-4 touch-target"
      >
        <h2 className="text-lg font-semibold text-gray-900">Technical Details</h2>
        {showTechnicalDetails ? (
          <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
        ) : (
          <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
        )}
      </button>

      {showTechnicalDetails && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job ID</label>
            <div className="flex items-center space-x-2">
              <p className="text-sm font-mono text-gray-900">{job.job_id}</p>
              <button
                onClick={() => copyToClipboard(job.job_id)}
                className="text-gray-500 hover:text-gray-700 p-2 touch-target"
                title="Copy Job ID"
              >
                <FiCopy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {job.submission_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Submission ID</label>
              <div className="flex items-center space-x-2">
                {form?.public_slug ? (
                  <a
                    href={`/v1/forms/${form.public_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono text-primary-600 hover:text-primary-900 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {job.submission_id}
                    <FiExternalLink className="w-3 h-3 ml-1 inline" />
                  </a>
                ) : (
                  <p className="text-sm font-mono text-gray-900">{job.submission_id}</p>
                )}
                <button
                  onClick={() => copyToClipboard(job.submission_id)}
                  className="text-gray-500 hover:text-gray-700 p-2 touch-target"
                  title="Copy Submission ID"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {job.workflow_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Workflow ID</label>
              <div className="flex items-center space-x-2">
                <p className="text-sm font-mono text-gray-900">{job.workflow_id}</p>
                <button
                  onClick={() => copyToClipboard(job.workflow_id)}
                  className="text-gray-500 hover:text-gray-700 p-2 touch-target"
                  title="Copy Workflow ID"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {job.tenant_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
              <div className="flex items-center space-x-2">
                <p className="text-sm font-mono text-gray-900">{job.tenant_id}</p>
                <button
                  onClick={() => copyToClipboard(job.tenant_id)}
                  className="text-gray-500 hover:text-gray-700 p-2 touch-target"
                  title="Copy Tenant ID"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {job.started_at && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Started At</label>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-900">
                  {(() => {
                    try {
                      const date = new Date(job.started_at)
                      if (isNaN(date.getTime())) {
                        return job.started_at
                      }
                      // Format: M/D/YYYY, H:MM:SS AM/PM
                      return date.toLocaleString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      })
                    } catch {
                      return job.started_at
                    }
                  })()}
                </p>
                <button
                  onClick={() => copyToClipboard(job.started_at)}
                  className="text-gray-500 hover:text-gray-700 p-2 touch-target"
                  title="Copy Started At"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {job.updated_at && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-900">
                  {(() => {
                    try {
                      const date = new Date(job.updated_at)
                      if (isNaN(date.getTime())) {
                        return job.updated_at
                      }
                      // Format: M/D/YYYY, H:MM:SS AM/PM
                      return date.toLocaleString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      })
                    } catch {
                      return job.updated_at
                    }
                  })()}
                </p>
                <button
                  onClick={() => copyToClipboard(job.updated_at)}
                  className="text-gray-500 hover:text-gray-700 p-2 touch-target"
                  title="Copy Last Updated"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {(job.artifacts && job.artifacts.length > 0) || artifacts.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Artifacts</label>
              
              {loadingArtifacts ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                  <FiLoader className="w-4 h-4 animate-spin" />
                  <span>Loading artifacts...</span>
                </div>
              ) : artifacts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                  {artifacts.map((artifact) => {
                    const artifactUrl = artifact.object_url || artifact.public_url
                    const fileName = artifact.file_name || artifact.artifact_name || artifact.artifact_id
                    
                    return (
                      <div 
                        key={artifact.artifact_id} 
                        className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-video bg-gray-100">
                          {artifactUrl ? (
                            <PreviewRenderer
                              contentType={artifact.content_type}
                              objectUrl={artifactUrl}
                              fileName={fileName}
                              className="w-full h-full"
                              artifactId={artifact.artifact_id}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <FiFile className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <div className="p-3 bg-gray-50 border-t border-gray-200">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate" title={fileName}>
                                {fileName}
                              </p>
                              <p className="text-xs text-gray-500 font-mono truncate mt-0.5" title={artifact.artifact_id}>
                                {artifact.artifact_id}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => copyToClipboard(artifact.artifact_id)}
                                className="text-gray-500 hover:text-gray-700 p-1.5 touch-target"
                                title="Copy Artifact ID"
                              >
                                <FiCopy className="w-3.5 h-3.5" />
                              </button>
                              {artifactUrl && (
                                <a
                                  href={artifactUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-500 hover:text-gray-700 p-1.5 touch-target"
                                  title="Open in new tab"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <FiExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                // Fallback: show artifact IDs if we couldn't fetch details
                <div className="space-y-2">
                  {job.artifacts?.map((artifactId: string) => (
                    <div key={artifactId} className="flex items-center space-x-2">
                      <a
                        href="/dashboard/artifacts"
                        className="text-sm font-mono text-primary-600 hover:text-primary-900 hover:underline"
                        onClick={(e) => {
                          e.preventDefault()
                          router.push('/dashboard/artifacts')
                        }}
                      >
                        {artifactId}
                        <FiExternalLink className="w-3 h-3 ml-1 inline" />
                      </a>
                      <button
                        onClick={() => copyToClipboard(artifactId)}
                        className="text-gray-500 hover:text-gray-700 p-2 touch-target"
                        title="Copy Artifact ID"
                      >
                        <FiCopy className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {job.error_message && job.status === 'failed' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Raw Error Details</label>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-800 whitespace-pre-wrap break-all">
                {job.error_message}
              </div>
            </div>
          )}

          {copied && (
            <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-[60]">
              Copied!
            </div>
          )}
        </div>
      )}
    </div>
  )
}

