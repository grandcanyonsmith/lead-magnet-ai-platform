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
  const slug = params?.slug as string
  
  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})

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

    try {
      const response = await axios.post(`${API_URL}/v1/forms/${slug}/submit`, {
        submission_data: formData,
      })

      setSuccess(true)
      
      // Show thank you message or redirect
      if (response.data.redirect_url) {
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    )
  }

  if (error && !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Form Not Found</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Thank You!</h1>
          <p className="text-gray-600 mb-4">
            {form?.thank_you_message || 'Your submission has been received and is being processed.'}
          </p>
          {form?.redirect_url && (
            <p className="text-sm text-gray-500">Redirecting...</p>
          )}
        </div>
      </div>
    )
  }

  if (!form) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{form.form_name}</h1>
          
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {form.form_fields_schema?.fields?.map((field: FormField) => (
              <div key={field.field_id}>
                {field.field_type !== 'checkbox' && (
                  <label htmlFor={field.field_id} className="block text-sm font-medium text-gray-700 mb-2">
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

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

