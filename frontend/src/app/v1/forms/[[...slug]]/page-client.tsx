'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

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
  // Handle catch-all route: slug can be string or string[]
  const slugParam = params?.slug
  const slug = Array.isArray(slugParam) ? slugParam[0] : (slugParam as string)
  
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

  useEffect(() => {
    if (slug) {
      loadForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const loadForm = async () => {
    try {
      const response = await axios.get(`${API_URL}/v1/forms/${slug}`)
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
    } catch (error: any) {
      console.error('Failed to load form:', error)
      setError(error.response?.data?.message || error.message || 'Form not found')
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

    try {
      const response = await axios.post(`${API_URL}/v1/forms/${slug}/submit`, {
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
        const response = await axios.get(`${API_URL}/v1/jobs/${jobIdToPoll}/status`)
        
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
        console.warn('Could not poll job status:', error)
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              required={field.required}
            />
            <label htmlFor={field.field_id} className="ml-2 text-sm text-gray-700">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-sm sm:text-base text-gray-600">Loading form...</p>
        </div>
      </div>
    )
  }

  if (error && !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6">
        <div className="bg-white rounded-lg shadow p-6 sm:p-8 max-w-md w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Form Not Found</h1>
          <p className="text-sm sm:text-base text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6">
        <div className="bg-white rounded-lg shadow p-6 sm:p-8 max-w-md w-full text-center">
          {generating ? (
            <>
              <div className="mb-4">
                <div className="mx-auto h-10 w-10 sm:h-12 sm:w-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Generating Your Lead Magnet...</h1>
              <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 px-2">
                {form?.thank_you_message || 'Your submission has been received. We&apos;re generating your personalized lead magnet now.'}
              </p>
              {jobStatus && (
                <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
                  Status: {jobStatus === 'pending' ? 'Queued' : jobStatus === 'processing' ? 'Processing' : jobStatus}
                </p>
              )}
              <p className="text-xs text-gray-400 px-2">This may take a minute. Please don&apos;t close this page.</p>
            </>
          ) : outputUrl ? (
            <>
              <div className="mb-4">
                <svg className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Your Lead Magnet is Ready!</h1>
              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 px-2">
                {form?.thank_you_message || 'Your personalized lead magnet has been generated successfully.'}
              </p>
              <a
                href={outputUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full sm:w-auto px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm sm:text-base"
              >
                View Your Lead Magnet
              </a>
              {form?.redirect_url && (
                <div className="mt-4">
                  <a
                    href={form.redirect_url}
                    className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 break-all"
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
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Thank You!</h1>
              <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 px-2">
                {form?.thank_you_message || 'Your submission has been received and is being processed.'}
              </p>
              {form?.redirect_url && (
                <p className="text-xs sm:text-sm text-gray-500">Redirecting...</p>
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
    <div className="min-h-screen bg-gray-50 py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 lg:p-8">
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
          
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">{form.form_name}</h1>
          
          {error && (
            <div className="mb-4 sm:mb-6 bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {form.form_fields_schema?.fields?.map((field: FormField) => (
              <div key={field.field_id}>
                {field.field_type !== 'checkbox' && (
                  <label htmlFor={field.field_id} className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                )}
                {renderField(field)}
                {field.field_type === 'checkbox' && !field.required && (
                  <span className="text-xs text-gray-500 ml-6">Optional</span>
                )}
              </div>
            ))}

            <div className="pt-3 sm:pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm sm:text-base font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

