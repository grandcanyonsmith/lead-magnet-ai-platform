'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { FiPlus, FiExternalLink, FiEdit, FiCopy, FiCheck } from 'react-icons/fi'

type FormItem = {
  form_id: string
  form_name?: string
  form_slug?: string
  public_slug?: string
  status?: string
  created_at?: string
}

export default function FormsPage() {
  const router = useRouter()
  const [forms, setForms] = useState<FormItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  useEffect(() => {
    loadForms()
  }, [])

  const loadForms = async () => {
    try {
      const data = await api.getForms()
      setForms(data.forms || [])
    } catch (error) {
      console.error('Failed to load forms:', error)
    } finally {
      setLoading(false)
    }
  }

  const publicUrlFor = (item: FormItem) => {
    const slug = item.public_slug || item.form_slug
    if (!slug) return null
    // Use frontend URL for public form rendering
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/v1/forms/${slug}`
    }
    return `/v1/forms/${slug}`
  }

  const copyToClipboard = async (text: string, formId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedUrl(formId)
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const formatUrl = (url: string) => {
    if (url.length > 40) {
      return url.substring(0, 37) + '...'
    }
    return url
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Capture Forms</h1>
          <p className="text-gray-600 text-sm sm:text-base">Forms that collect lead information and trigger AI lead magnet generation</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/forms/new')}
          className="flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 w-full sm:w-auto"
        >
          <FiPlus className="w-5 h-5 mr-2" />
          <span className="whitespace-nowrap">New Lead Capture Form</span>
        </button>
      </div>

      {forms.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600">No forms yet</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Public URL</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {forms.map((f) => (
                    <tr key={f.form_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{f.form_name || f.form_id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{f.public_slug || f.form_slug || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{f.status || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {f.created_at ? new Date(f.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm max-w-md">
                        {(f.public_slug || f.form_slug) && publicUrlFor(f) ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={publicUrlFor(f)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-900 break-all"
                              title={publicUrlFor(f)!}
                            >
                              {formatUrl(publicUrlFor(f)!)}
                            </a>
                            <button
                              onClick={() => copyToClipboard(publicUrlFor(f)!, f.form_id)}
                              className="text-gray-400 hover:text-gray-600 p-1"
                              title="Copy URL"
                            >
                              {copiedUrl === f.form_id ? (
                                <FiCheck className="w-4 h-4 text-green-600" />
                              ) : (
                                <FiCopy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">No slug set</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {(f.public_slug || f.form_slug) && publicUrlFor(f) && (
                            <a
                              href={publicUrlFor(f)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-900"
                              title="Open form"
                            >
                              <FiExternalLink className="w-5 h-5" />
                            </a>
                          )}
                          <button
                            onClick={() => router.push(`/dashboard/forms/${f.form_id}/edit`)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Edit form"
                          >
                            <FiEdit className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {forms.map((f) => {
              const url = publicUrlFor(f)
              return (
                <div key={f.form_id} className="bg-white rounded-lg shadow p-4 border border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {f.form_name || f.form_id}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Slug: <span className="font-mono">{f.public_slug || f.form_slug || '-'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all"
                          title="Open form"
                        >
                          <FiExternalLink className="w-5 h-5" />
                        </a>
                      )}
                      <button
                        onClick={() => router.push(`/dashboard/forms/${f.form_id}/edit`)}
                        className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all"
                        title="Edit form"
                      >
                        <FiEdit className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {url && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:text-primary-700 flex-1 min-w-0 break-all"
                        >
                          {url}
                        </a>
                        <button
                          onClick={() => copyToClipboard(url, f.form_id)}
                          className="p-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
                          title="Copy URL"
                        >
                          {copiedUrl === f.form_id ? (
                            <FiCheck className="w-4 h-4 text-green-600" />
                          ) : (
                            <FiCopy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                    <span>
                      Created: {f.created_at ? new Date(f.created_at).toLocaleDateString() : '-'}
                    </span>
                    {f.status && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        {f.status}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}


