'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from '@/features/auth/lib'
import { api } from '@/shared/lib/api'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Security: remove any credentials that might have been placed in the URL
    const emailParam = searchParams?.get('email')
    const redirectParam = searchParams?.get('redirect')
    const cleanedEmail = emailParam || ''
    const basePath = redirectParam
      ? `/auth/login?redirect=${encodeURIComponent(redirectParam)}`
      : '/auth/login'

    // Always strip password query params if they exist
    if (typeof window !== 'undefined') {
      const nextUrl = new URL(window.location.href)
      if (nextUrl.searchParams.has('password') || nextUrl.searchParams.has('pass')) {
        nextUrl.searchParams.delete('password')
        nextUrl.searchParams.delete('pass')
        nextUrl.searchParams.delete('password1')
        window.history.replaceState({}, '', nextUrl.toString())
        router.replace(cleanedEmail ? `${basePath}&email=${encodeURIComponent(cleanedEmail)}` : basePath, {
          scroll: false,
        })
      }
    }

    if (cleanedEmail) {
      setEmail(cleanedEmail)
    }
  }, [searchParams, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const redirectParam = searchParams?.get('redirect')
    
    // Security: Ensure URL is clean before submission and route stays POST-only
    if (typeof window !== 'undefined') {
      const newUrl = new URL(window.location.href)
      if (newUrl.searchParams.size > 0 || redirectParam) {
        newUrl.search = redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ''
        window.history.replaceState({}, '', newUrl.toString())
      }
    }
    
    setError('')
    setLoading(true)

    try {
      const result = await signIn(email.trim(), password)
      if (result.success) {
        // Wait a bit longer to ensure tokens are stored in localStorage
        // Cognito SDK stores tokens asynchronously
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Verify tokens are stored before redirecting
        const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || ''
        if (clientId) {
          const lastAuthUser = localStorage.getItem(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`)
          if (lastAuthUser) {
            const idToken = localStorage.getItem(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`)
            if (idToken) {
              // Check onboarding status
              await checkOnboardingAndRedirect()
              return
            }
          }
        }
        
        // If Cognito tokens aren't ready, try again after a delay
        await new Promise(resolve => setTimeout(resolve, 200))
        await checkOnboardingAndRedirect()
      } else {
        setError(result.error || 'Failed to sign in')
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setLoading(false)
    }
  }

  const checkOnboardingAndRedirect = async () => {
    try {
      // Check if onboarding survey is completed
      const settings = await api.getSettings()
      const redirectParam = searchParams?.get('redirect')
      
      if (!settings.onboarding_survey_completed) {
        // Redirect to onboarding survey
        router.push('/onboarding/survey')
      } else if (redirectParam) {
        // Redirect to specified path
        router.push(redirectParam)
      } else {
        // Default to dashboard
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error)
      // Default to dashboard on error
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-brand-600 rounded-2xl flex items-center justify-center mb-4 shadow-soft">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-ink-900">
            Lead Magnet AI
          </h2>
          <p className="mt-2 text-sm text-ink-600">
            Sign in to your account to get started
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-soft p-8 border border-white/60">
          <form 
            className="space-y-6" 
            onSubmit={handleSubmit}
            noValidate
          >
            {error && (
              <div className="bg-red-50/80 border-l-4 border-red-400 text-red-700 px-4 py-3 rounded-2xl flex items-start">
                <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-ink-800 mb-2 leading-5">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none text-ink-900 placeholder-ink-400 shadow-soft text-base leading-6"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-ink-800 mb-2 leading-5">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none text-ink-900 placeholder-ink-400 shadow-soft text-base leading-6"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-2xl text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-soft disabled:transform-none"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>

            <div className="text-center pt-4 border-t border-white/60">
              <p className="text-sm text-ink-600">
                Don&apos;t have an account?{' '}
                <Link href="/auth/signup" className="font-medium text-brand-600 hover:text-brand-700 transition-colors">
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-ink-600">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
