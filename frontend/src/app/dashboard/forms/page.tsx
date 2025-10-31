'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { FiPlus, FiExternalLink, FiEdit } from 'react-icons/fi'

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

  if (loading) {
    return <div className="text-center py-12">Loading forms...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Forms</h1>
          <p className="text-gray-600">Manage your lead capture forms</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/forms/new')}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <FiPlus className="w-5 h-5 mr-2" />
          New Form
        </button>
      </div>

      {forms.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600">No forms yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
                  <td className="px-6 py-4 text-sm max-w-md truncate">
                    {(f.public_slug || f.form_slug) && publicUrlFor(f) ? (
                      <a
                        href={publicUrlFor(f)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-900 break-all"
                        title={publicUrlFor(f)!}
                      >
                        {publicUrlFor(f)}
                      </a>
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
      )}
    </div>
  )
}


