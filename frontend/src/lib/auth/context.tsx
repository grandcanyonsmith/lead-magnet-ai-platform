/**
 * Auth context and hook for React components
 */

'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { AuthService, authService } from './service'
import { AuthResponse, AuthUser, AuthMeResponse } from '@/types/auth'
import { CognitoUserSession } from 'amazon-cognito-identity-js'
import { api } from '@/lib/api'

interface AuthContextValue {
  user: AuthUser | null
  realUser: AuthUser | null
  actingUser: AuthUser | null
  role: string | null
  customerId: string | null
  isImpersonating: boolean
  session: CognitoUserSession | null
  sessionId: string | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<AuthResponse>
  signUp: (email: string, password: string, name: string) => Promise<AuthResponse>
  signOut: () => void
  checkAuth: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
  authService?: AuthService
}

export function AuthProvider({ children, authService: service = authService }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [realUser, setRealUser] = useState<AuthUser | null>(null)
  const [actingUser, setActingUser] = useState<AuthUser | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [session, setSession] = useState<CognitoUserSession | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const refreshAuth = useCallback(async () => {
    try {
      const meResponse = await api.get<AuthMeResponse>('/me')
      
      setRealUser(meResponse.realUser)
      setActingUser(meResponse.actingUser)
      setRole(meResponse.role)
      setCustomerId(meResponse.customerId)
      setIsImpersonating(meResponse.isImpersonating)
      
      // Set user to acting user for backward compatibility
      setUser(meResponse.actingUser)
      
      // Store session ID if impersonating
      if (meResponse.isImpersonating) {
        // Session ID should be stored in localStorage by impersonation controller
        const storedSessionId = localStorage.getItem('impersonation_session_id')
        setSessionId(storedSessionId)
      } else {
        setSessionId(null)
        localStorage.removeItem('impersonation_session_id')
      }
    } catch (error) {
      console.error('Error refreshing auth:', error)
      // If /me fails, fall back to Cognito token
      const currentSession = await service.getSession()
      if (currentSession) {
        const idToken = currentSession.getIdToken()
        const payload = idToken.payload
        
        const fallbackUser: AuthUser = {
          user_id: payload.sub as string || '',
          email: payload.email as string || '',
          name: payload.name as string | undefined,
          username: payload['cognito:username'] as string || payload.email as string || '',
          role: payload['custom:role'] as string || 'USER',
          customer_id: payload['custom:customer_id'] as string || undefined,
        }
        
        setUser(fallbackUser)
        setRealUser(fallbackUser)
        setActingUser(fallbackUser)
        setRole(fallbackUser.role || 'USER')
        setCustomerId(fallbackUser.customer_id || null)
        setIsImpersonating(false)
      }
    }
  }, [service])

  const checkAuth = useCallback(async () => {
    setIsLoading(true)
    try {
      const authenticated = await service.isAuthenticated()
      setIsAuthenticated(authenticated)
      
      if (authenticated) {
        const currentSession = await service.getSession()
        setSession(currentSession)
        
        // Fetch user info from /me endpoint
        await refreshAuth()
      } else {
        setUser(null)
        setRealUser(null)
        setActingUser(null)
        setRole(null)
        setCustomerId(null)
        setIsImpersonating(false)
        setSession(null)
        setSessionId(null)
      }
    } catch (error) {
      console.error('Auth check error:', error)
      setIsAuthenticated(false)
      setUser(null)
      setRealUser(null)
      setActingUser(null)
      setRole(null)
      setCustomerId(null)
      setIsImpersonating(false)
      setSession(null)
      setSessionId(null)
    } finally {
      setIsLoading(false)
    }
  }, [service, refreshAuth])

  useEffect(() => {
    // Small delay to ensure localStorage and Cognito SDK are ready
    const timer = setTimeout(() => {
      checkAuth()
    }, 100)

    return () => clearTimeout(timer)
  }, [checkAuth])

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResponse> => {
    const response = await service.signIn(email, password)
    if (response.success) {
      await checkAuth()
    }
    return response
  }, [service, checkAuth])

  const signUp = useCallback(async (email: string, password: string, name: string): Promise<AuthResponse> => {
    return service.signUp(email, password, name)
  }, [service])

  const signOut = useCallback(() => {
    service.signOut()
    setUser(null)
    setSession(null)
    setIsAuthenticated(false)
  }, [service])

  const value: AuthContextValue = {
    user,
    realUser,
    actingUser,
    role,
    customerId,
    isImpersonating,
    session,
    sessionId,
    isAuthenticated,
    isLoading,
    signIn,
    signUp,
    signOut,
    checkAuth,
    refreshAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

