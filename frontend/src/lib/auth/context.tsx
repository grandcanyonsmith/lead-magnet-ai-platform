/**
 * Auth context and hook for React components
 */

'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { AuthService, authService } from './service'
import { AuthResponse, AuthUser } from '@/types/auth'
import { CognitoUserSession } from 'amazon-cognito-identity-js'

interface AuthContextValue {
  user: AuthUser | null
  session: CognitoUserSession | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<AuthResponse>
  signUp: (email: string, password: string, name: string) => Promise<AuthResponse>
  signOut: () => void
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
  authService?: AuthService
}

export function AuthProvider({ children, authService: service = authService }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<CognitoUserSession | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    setIsLoading(true)
    try {
      const authenticated = await service.isAuthenticated()
      setIsAuthenticated(authenticated)
      
      if (authenticated) {
        const currentSession = await service.getSession()
        setSession(currentSession)
        
        if (currentSession) {
          const idToken = currentSession.getIdToken()
            const payload = idToken.payload
          
          setUser({
            email: payload.email as string || '',
            name: payload.name as string | undefined,
            username: payload['cognito:username'] as string || payload.email as string || '',
          })
        }
      } else {
        setUser(null)
        setSession(null)
      }
    } catch (error) {
      console.error('Auth check error:', error)
      setIsAuthenticated(false)
      setUser(null)
      setSession(null)
    } finally {
      setIsLoading(false)
    }
  }, [service])

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
    session,
    isAuthenticated,
    isLoading,
    signIn,
    signUp,
    signOut,
    checkAuth,
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

