/**
 * Auth module exports
 * Provides authentication functions and components
 */

import { authService } from './auth/service'
import { AuthResponse } from '@/types/auth'
import { CognitoUser, CognitoUserSession } from 'amazon-cognito-identity-js'

// Re-export service
export { authService }

// Legacy function exports (wrappers around authService for backward compatibility)
export const signIn = async (email: string, password: string): Promise<AuthResponse> => {
  return authService.signIn(email, password)
}

export const signUp = async (
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> => {
  return authService.signUp(email, password, name)
}

export const signOut = (): void => {
  authService.signOut()
}

export const getCurrentUser = (): CognitoUser | null => {
  return authService.getCurrentUser()
}

export const getSession = (): Promise<CognitoUserSession | null> => {
  return authService.getSession()
}

export const isAuthenticated = async (): Promise<boolean> => {
  return authService.isAuthenticated()
}

// Re-export types
export type { AuthResponse, AuthUser } from '@/types/auth'

// Re-export components
export { AuthProvider, useAuth } from './auth/context'

