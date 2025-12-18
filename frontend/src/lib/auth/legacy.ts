/**
 * Legacy auth functions for backward compatibility
 * These wrap the new AuthService
 */

import { authService } from './service'
import { AuthResponse } from '@/types/auth'
import { CognitoUser } from 'amazon-cognito-identity-js'
import { CognitoUserSession } from 'amazon-cognito-identity-js'

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

export const forgotPassword = async (email: string): Promise<AuthResponse> => {
  return authService.forgotPassword(email)
}

export const confirmForgotPassword = async (
  email: string,
  code: string,
  newPassword: string
): Promise<AuthResponse> => {
  return authService.confirmForgotPassword(email, code, newPassword)
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

export const getIdToken = async (): Promise<string | null> => {
  // Prefer tokens stored by our app (set during sign-in). This is more resilient than
  // relying on Cognito SDK session reconstruction, and supports mock/e2e auth flows.
  const stored = authService.getTokenStorage().getIdToken()
  if (stored) return stored

  const session = await authService.getSession()
  return session?.getIdToken().getJwtToken() ?? null
}

