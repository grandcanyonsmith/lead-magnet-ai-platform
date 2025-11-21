'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_PUBLIC_API_URL || API_URL

type FormField = {
  field_id: string
  field_type: 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'select' | 'checkbox'
  label: string
  placeholder?: string
  required: boolean
  validation_regex?: string
  max_length?: number
  options?: string[]
}

export default function PublicFormPage() {
  const params = useParams()
  // Extract slug from params or URL pathname (for static export/Vercel compatibility)
  const getSlug = useCallback(() => {
    // First try to get from params
    const slugParam = params?.slug
    const paramSlug = Array.isArray(slugParam) ? slugParam[0] : (slugParam as string)
    
    if (paramSlug && paramSlug !== '_' && paramSlug.trim() !== '') {
      return paramSlug
    }
    
    // Fallback: extract from browser URL (works for static exports and direct navigation)
    if (typeof window !== 'undefined') {
      const pathMatch = window.location.pathname.match(/\/v1\/forms\/([^/?#]+)/)
      if (pathMatch && pathMatch[1] && pathMatch[1] !== '_' && pathMatch[1].trim() !== '') {
        return pathMatch[1]
      }
      // Also check hash in case of SPA routing
      const hashMatch = window.location.hash.match(/\/v1\/forms\/([^/?#]+)/)
      if (hashMatch && hashMatch[1] && hashMatch[1] !== '_' && hashMatch[1].trim() !== '') {
        return hashMatch[1]
      }
    }
    
    return paramSlug || ''
  }, [params?.slug])
  
  const [slug, setSlug] = useState<string>(getSlug())
  
  // Update slug when params change (for client-side navigation)
  useEffect(() => {
    const newSlug = getSlug()
    if (newSlug && newSlug !== slug && newSlug.trim() !== '' && newSlug !== '_') {
      setSlug(newSlug)
    }
  }, [getSlug, slug])
  
  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [generating, setGenerating] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [statusUpdatesUnavailable, setStatusUpdatesUnavailable] = useState(false)

  useEffect(() => {
    if (slug && slug.trim() !== '' && slug !== '_') {
      loadForm()
    } else if (!slug || slug.trim() === '' || slug === '_') {
      setError('Invalid form URL. Please check the form link.')
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const loadForm = async () => {
    try {
      const response = await axios.get(`${PUBLIC_API_URL}/v1/forms/${slug}`)
      setForm(response.data)
      
      // Initialize form data with empty values
      const initialData: Record<string, any> = {}
      response.data.form_fields_schema?.fields?.forEach((field: FormField) => {
        if (field.field_type === 'checkbox') {
          initialData[field.field_id] = false
        } else if (field.field_type === 'select') {
          initialData[field.field_id] = ''
        } else {
          initialData[field.field_id] = ''
        }
      })
      setFormData(initialData)
    } catch (error) {
      // Handle errors gracefully
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'message' in error.response.data && typeof error.response.data.message === 'string')
          ? error.response.data.message
          : 'Form not found'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSubmitting(true)
    setGenerating(false)
    setJobId(null)
    setJobStatus(null)
    setOutputUrl(null)
    setStatusUpdatesUnavailable(false)

    try {
      const response = await axios.post(`${PUBLIC_API_URL}/v1/forms/${slug}/submit`, {
        submission_data: formData,
      })

      setSuccess(true)
      
      // If we have a job_id, start polling for completion
      if (response.data.job_id) {
        setJobId(response.data.job_id)
        setGenerating(true)
        setJobStatus('pending')
        pollJobStatus(response.data.job_id)
      }
      
      // Show thank you message or redirect (but only if no job_id or after completion)
      if (response.data.redirect_url && !response.data.job_id) {
        setTimeout(() => {
          window.location.href = response.data.redirect_url
        }, 2000)
      }
    } catch (error: any) {
      console.error('Failed to submit form:', error)
      setError(error.response?.data?.message || error.message || 'Failed to submit form')
    } finally {
      setSubmitting(false)
    }
  }

  const pollJobStatus = async (jobIdToPoll: string) => {
    let attempts = 0
    const maxAttempts = 180 // 3 minutes max (1 second intervals)
    
    const poll = async () => {
      try {
        // Poll the public job status endpoint (if it exists) or use admin endpoint
        // For now, we'll try to access job status - note: this might require auth
        // We'll need to handle this properly
        const response = await axios.get(`${PUBLIC_API_URL}/v1/jobs/${jobIdToPoll}/status`, {
          timeout: 10000,
        })
        
        const status = response.data.status
        setJobStatus(status)
        
        if (status === 'completed') {
          setGenerating(false)
          if (response.data.output_url) {
            setOutputUrl(response.data.output_url)
          }
          return
        } else if (status === 'failed') {
          setGenerating(false)
          setError(response.data.error_message || 'Lead magnet generation failed')
          return
        }
        
        // Continue polling if still processing
        if (status === 'pending' || status === 'processing') {
          attempts++
          if (attempts < maxAttempts) {
            setTimeout(poll, 1000)
          } else {
            setGenerating(false)
            setError('Generation is taking longer than expected. Please check back later.')
          }
        }
      } catch (error: any) {
        // If we can't poll (e.g., no public endpoint), just show generating message
        // and let user know to check back
        const statusCode = error?.response?.status
        if (statusCode === 401 || statusCode === 403) {
          setStatusUpdatesUnavailable(true)
          setGenerating(false)
          setJobStatus('unknown')
          return
        }
        if (attempts === 0) {
          console.warn('Could not poll job status:', error)
        }
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000) // Poll less frequently on error
        } else {
          setGenerating(false)
          setJobStatus('unknown')
        }
      }
    }
    
    // Start polling after a short delay
    setTimeout(poll, 1000)
  }

  const handleChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
  }

  const renderField = (field: FormField) => {
    const value = formData[field.field_id] || ''
    
    switch (field.field_type) {
      case 'textarea':
        return (
          <textarea
            id={field.field_id}
            value={value}
            onChange={(e) => handleChange(field.field_id, e.target.value)}
            className="w-full px-4 py-3 border border-white/60 rounded-2xl bg-white/90 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-ink-900 placeholder-ink-400 shadow-soft"
            placeholder={field.placeholder}
            required={field.required}
            maxLength={field.max_length}
            rows={4}
          />
        )
      
      case 'select':
        return (
          <select
            id={field.field_id}
            value={value}
            onChange={(e) => handleChange(field.field_id, e.target.value)}
            className="w-full px-4 py-3 border border-white/60 rounded-2xl bg-white/90 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-ink-900 placeholder-ink-400 shadow-soft"
            required={field.required}
          >
            <option value="">Select an option...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )
      
      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              id={field.field_id}
              checked={value || false}
              onChange={(e) => handleChange(field.field_id, e.target.checked)}
              className="w-4 h-4 text-brand-600 border-white/60 rounded focus:ring-brand-500"
              required={field.required}
            />
            <label htmlFor={field.field_id} className="ml-2 text-sm text-ink-700">
              {field.label}
            </label>
          </div>
        )
      
      default:
        return (
          <input
            type={field.field_type === 'email' ? 'email' : field.field_type === 'tel' ? 'tel' : field.field_type === 'number' ? 'number' : 'text'}
            id={field.field_id}
            value={value}
            onChange={(e) => handleChange(field.field_id, e.target.value)}
            className="w-full px-4 py-3 border border-white/60 rounded-2xl bg-white/90 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-ink-900 placeholder-ink-400 shadow-soft"
            placeholder={field.placeholder}
            required={field.required}
            maxLength={field.max_length}
            pattern={field.validation_regex}
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4">
        <div className="text-center">
          <p className="text-sm sm:text-base text-ink-600">Loading form...</p>
        </div>
      </div>
    )
  }

  if (error && !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4 sm:px-6">
        <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-6 sm:p-8 max-w-md w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-ink-900 mb-3 sm:mb-4">Form Not Found</h1>
          <p className="text-sm sm:text-base text-ink-600">{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4 sm:px-6">
        <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-6 sm:p-8 max-w-md w-full text-center">
          {generating ? (
            <>
              <div className="mb-4">
                <div className="mx-auto h-10 w-10 sm:h-12 sm:w-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-ink-900 mb-3 sm:mb-4">Generating Your Lead Magnet...</h1>
              <p className="text-sm sm:text-base text-ink-600 mb-3 sm:mb-4 px-2">
                {form?.thank_you_message || 'Your submission has been received. We&apos;re generating your personalized lead magnet now.'}
              </p>
              {jobStatus && (
                <p className="text-xs sm:text-sm text-ink-500 mb-3 sm:mb-4">
                  Status: {jobStatus === 'pending' ? 'Queued' : jobStatus === 'processing' ? 'Processing' : jobStatus}
                </p>
              )}
              <p className="text-xs text-ink-400 px-2">This may take a minute. Please don&apos;t close this page.</p>
              {statusUpdatesUnavailable && (
                <p className="mt-3 text-xs text-ink-500 px-2">
                  Live status updates are unavailable on this deployment. We&apos;ll email you when your lead magnet finishes generating.
                </p>
              )}
            </>
          ) : outputUrl ? (
            <>
              <div className="mb-4">
                <svg className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-ink-900 mb-3 sm:mb-4">Your Lead Magnet is Ready!</h1>
              <p className="text-sm sm:text-base text-ink-600 mb-4 sm:mb-6 px-2">
                {form?.thank_you_message || 'Your personalized lead magnet has been generated successfully.'}
              </p>
              <a
                href={outputUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full sm:w-auto px-6 py-3 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 transition-colors font-medium text-sm sm:text-base"
              >
                View Your Lead Magnet
              </a>
              {form?.redirect_url && (
                <div className="mt-4">
                  <a
                    href={form.redirect_url}
                    className="text-xs sm:text-sm text-brand-600 hover:text-brand-700 break-all"
                  >
                    Continue to {form.redirect_url}
                  </a>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-4">
                <svg className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-ink-900 mb-3 sm:mb-4">Thank You!</h1>
              <p className="text-sm sm:text-base text-ink-600 mb-3 sm:mb-4 px-2">
                {form?.thank_you_message || 'Your submission has been received and is being processed.'}
              </p>
              {form?.redirect_url && (
                <p className="text-xs sm:text-sm text-ink-500">Redirecting...</p>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  if (!form) {
    return null
  }

  return (
    <div className="min-h-screen bg-surface-50 py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-4 sm:p-6 lg:p-8">
          {/* Logo */}
          {form.logo_url && (
            <div className="mb-4 sm:mb-6 text-center">
              <img
                src={form.logo_url}
                alt="Logo"
                className="max-h-16 sm:max-h-20 mx-auto"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )}
          
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-2 sm:mb-3">{form.form_name}</h1>
          
          {error && (
            <div className="mb-4 sm:mb-6 bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-2xl text-sm sm:text-base">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {form.form_fields_schema?.fields?.map((field: FormField) => (
              <div key={field.field_id}>
                {field.field_type !== 'checkbox' && (
                  <label htmlFor={field.field_id} className="block text-sm font-medium text-ink-700 mb-1.5 sm:mb-2">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                )}
                {renderField(field)}
                {field.field_type === 'checkbox' && !field.required && (
                  <span className="text-xs text-ink-500 ml-6">Optional</span>
                )}
              </div>
            ))}

            <div className="pt-3 sm:pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center py-2.5 sm:py-3 px-4 border border-white/60 rounded-2xl shadow-soft text-sm sm:text-base font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>

          {form.custom_css && (
            <style dangerouslySetInnerHTML={{ __html: form.custom_css }} />
          )}
        </div>
      </div>
    </div>
  )
}
