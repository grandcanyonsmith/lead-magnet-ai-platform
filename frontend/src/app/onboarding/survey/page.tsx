'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { FiArrowRight, FiArrowLeft, FiCheck } from 'react-icons/fi'

const industries = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Real Estate',
  'E-commerce',
  'Marketing & Advertising',
  'Consulting',
  'Legal',
  'Manufacturing',
  'Retail',
  'Other',
]

const companySizes = ['1-10', '11-50', '51-200', '201-1000', '1000+']

const primaryGoals = [
  'Lead Generation',
  'Sales',
  'Brand Awareness',
  'Customer Education',
  'Product Demo',
  'Newsletter Signups',
  'Other',
]

export default function OnboardingSurveyPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated()
      if (!authenticated) {
        router.push('/auth/login?redirect=/onboarding/survey')
        return
      }
      setAuthChecked(true)
    }
    checkAuth()
  }, [router])

  const [formData, setFormData] = useState({
    businessName: '',
    industry: '',
    companySize: '',
    targetCustomerProfile: '',
    customerPainPoints: '',
    domain: '',
    primaryGoals: [] as string[],
  })

  const totalSteps = 4

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleGoalToggle = (goal: string) => {
    setFormData((prev) => ({
      ...prev,
      primaryGoals: prev.primaryGoals.includes(goal)
        ? prev.primaryGoals.filter((g) => g !== goal)
        : [...prev.primaryGoals, goal],
    }))
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.businessName.trim() !== '' && formData.industry !== '' && formData.companySize !== ''
      case 2:
        return formData.targetCustomerProfile.trim() !== ''
      case 3:
        return formData.customerPainPoints.trim() !== '' && formData.domain.trim() !== ''
      case 4:
        return formData.primaryGoals.length > 0
      default:
        return false
    }
  }

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError('')

    try {
      await api.updateOnboardingSurvey({
        business_name: formData.businessName,
        industry: formData.industry,
        company_size: formData.companySize,
        target_customer_profile: formData.targetCustomerProfile,
        customer_pain_points: formData.customerPainPoints,
        domain: formData.domain,
        primary_goals: formData.primaryGoals,
      })

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err: any) {
      console.error('Failed to submit survey:', err)
      setError(err.message || 'Failed to save survey. Please try again.')
      setLoading(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter your business name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Industry <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select your industry</option>
                {industries.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Size <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.companySize}
                onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select company size</option>
                {companySizes.map((size) => (
                  <option key={size} value={size}>
                    {size} employees
                  </option>
                ))}
              </select>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Customer Profile <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.targetCustomerProfile}
                onChange={(e) => setFormData({ ...formData, targetCustomerProfile: e.target.value })}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe your ideal customer. What are their characteristics, needs, and behaviors?"
              />
              <p className="mt-2 text-sm text-gray-500">
                Help us understand who you're targeting so we can personalize your lead magnets.
              </p>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Pain Points <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.customerPainPoints}
                onChange={(e) => setFormData({ ...formData, customerPainPoints: e.target.value })}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="What problems or challenges do your customers face that your lead magnets can solve?"
              />
              <p className="mt-2 text-sm text-gray-500">
                Understanding pain points helps create more valuable and relevant lead magnets.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Domain/Niche <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g., SaaS, Fitness, Real Estate Investing"
              />
              <p className="mt-2 text-sm text-gray-500">
                What specific domain or niche does your business operate in?
              </p>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Primary Goals <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Select all that apply. What are your main objectives with lead magnets?
              </p>
              <div className="space-y-3">
                {primaryGoals.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => handleGoalToggle(goal)}
                    className={`w-full flex items-center justify-between p-4 border-2 rounded-lg transition-all ${
                      formData.primaryGoals.includes(goal)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="font-medium text-gray-900">{goal}</span>
                    {formData.primaryGoals.includes(goal) && (
                      <FiCheck className="w-5 h-5 text-primary-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Step {currentStep} of {totalSteps}
              </span>
              <span className="text-sm font-medium text-gray-600">
                {Math.round((currentStep / totalSteps) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Step Title */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              {currentStep === 1 && 'Tell us about your business'}
              {currentStep === 2 && 'Who are your customers?'}
              {currentStep === 3 && 'What problems do you solve?'}
              {currentStep === 4 && 'What are your goals?'}
            </h2>
            <p className="text-gray-600">
              {currentStep === 1 && 'Help us personalize your Lead Magnet AI experience'}
              {currentStep === 2 && 'Understanding your customers helps us create better lead magnets'}
              {currentStep === 3 && 'Knowing pain points enables us to create more valuable content'}
              {currentStep === 4 && 'Select your primary objectives to optimize your lead magnets'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Form Content */}
          <div className="mb-8">{renderStep()}</div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="flex items-center px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>

            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={() => {
                  if (validateStep(currentStep)) {
                    setError('')
                    handleNext()
                  } else {
                    setError('Please fill in all required fields')
                  }
                }}
                className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Next
                <FiArrowRight className="w-5 h-5 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !validateStep(currentStep)}
                className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <FiCheck className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

