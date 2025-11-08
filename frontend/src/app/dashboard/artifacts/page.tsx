'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { FiExternalLink, FiDownload, FiFileText, FiRefreshCw } from 'react-icons/fi'

type Artifact = {
  artifact_id: string
  job_id?: string
  artifact_type?: string
  file_name?: string
  content_type?: string
  size_bytes?: number
  s3_bucket?: string
  s3_key?: string
  object_url?: string
  created_at?: string
}

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadArtifacts()
  }, [])

  const loadArtifacts = async () => {
    try {
      const data = await api.getArtifacts({ limit: 100 })
      const artifactsList = data.artifacts || []
      // Sort by created_at DESC (most recent first)
      artifactsList.sort((a: Artifact, b: Artifact) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateB - dateA // DESC order
      })
      setArtifacts(artifactsList)
    } catch (error) {
      console.error('Failed to load artifacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      await loadArtifacts()
    } finally {
      setRefreshing(false)
    }
  }

  const formatBytes = (bytes?: number) => {
    if (!bytes && bytes !== 0) return '-'
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  if (loading) {
    return <div className="text-center py-12">Loading downloads...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Downloads</h1>
          <p className="text-gray-600">Generated lead magnet files and documents</p>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center px-3 py-2 bg-white border rounded-lg text-gray-700 hover:bg-gray-50"
        >
          <FiRefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {artifacts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600">No downloads found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generated For</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Download URL</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {artifacts.map((a) => (
                <tr key={a.artifact_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FiFileText className="w-4 h-4 text-gray-500 mr-2" />
                      <div>
                        {a.object_url ? (
                          <a
                            href={a.object_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary-600 hover:text-primary-900 hover:underline"
                            title="Click to preview"
                          >
                            {a.file_name || a.artifact_id}
                          </a>
                        ) : (
                          <div className="text-sm font-medium text-gray-900">{a.file_name || a.artifact_id}</div>
                        )}
                        {a.content_type && (
                          <div className="text-xs text-gray-500">{a.content_type}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {a.artifact_type || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {a.job_id ? (
                      <span className="font-mono">{a.job_id.substring(0, 12)}...</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatBytes(a.size_bytes)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {a.created_at ? new Date(a.created_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm max-w-md">
                    {a.object_url ? (
                      <a
                        href={a.object_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-900 break-all hover:underline"
                        title={a.object_url}
                      >
                        <span className="truncate block max-w-md">{a.object_url}</span>
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {a.object_url ? (
                      <div className="flex items-center justify-end space-x-3">
                        <a
                          href={a.object_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-900 p-2 rounded hover:bg-gray-100 touch-target"
                          title="Preview in new tab"
                        >
                          <FiExternalLink className="w-5 h-5" />
                        </a>
                        <a
                          href={a.object_url}
                          download={a.file_name || `${a.artifact_id}.${a.content_type?.split('/')[1] || 'txt'}`}
                          className="text-primary-600 hover:text-primary-900 p-2 rounded hover:bg-gray-100 touch-target"
                          title="Download"
                        >
                          <FiDownload className="w-5 h-5" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


