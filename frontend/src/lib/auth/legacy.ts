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
  const session = await authService.getSession()
  if (!session) {
    return null
  }
  return session.getIdToken().getJwtToken()
}

