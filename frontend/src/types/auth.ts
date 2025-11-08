/**
 * Authentication-related types
 */

import { CognitoUserSession } from 'amazon-cognito-identity-js'

export interface AuthResponse {
  success: boolean
  session?: CognitoUserSession
  error?: string
}

export interface AuthUser {
  email: string
  name?: string
  username: string
}

export interface TokenStorage {
  getAccessToken(): string | null
  getIdToken(): string | null
  getRefreshToken(): string | null
  setTokens(accessToken: string, idToken: string, refreshToken: string): void
  clearTokens(): void
  hasTokens(): boolean
}

