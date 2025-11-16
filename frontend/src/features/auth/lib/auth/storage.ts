/**
 * Token storage abstraction
 * Provides a clean interface for managing authentication tokens
 */

import { TokenStorage } from '@/features/auth/types'

export class LocalStorageTokenStorage implements TokenStorage {
  private readonly ACCESS_TOKEN_KEY = 'access_token'
  private readonly ID_TOKEN_KEY = 'id_token'
  private readonly REFRESH_TOKEN_KEY = 'refresh_token'
  private readonly USERNAME_KEY = 'cognito_username'

  getAccessToken(): string | null {
    // First try custom storage keys
    let token = localStorage.getItem(this.ACCESS_TOKEN_KEY)
    if (token) return token

    // Then try Cognito SDK storage format
    return this.getCognitoToken('accessToken')
  }

  getIdToken(): string | null {
    // First try custom storage keys
    let token = localStorage.getItem(this.ID_TOKEN_KEY)
    if (token) return token

    // Then try Cognito SDK storage format
    return this.getCognitoToken('idToken')
  }

  getRefreshToken(): string | null {
    // First try custom storage keys
    let token = localStorage.getItem(this.REFRESH_TOKEN_KEY)
    if (token) return token

    // Then try Cognito SDK storage format
    return this.getCognitoToken('refreshToken')
  }

  setTokens(accessToken: string, idToken: string, refreshToken: string): void {
    // Store in custom format
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken)
    localStorage.setItem(this.ID_TOKEN_KEY, idToken)
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken)
  }

  clearTokens(): void {
    // Clear custom tokens
    localStorage.removeItem(this.ACCESS_TOKEN_KEY)
    localStorage.removeItem(this.ID_TOKEN_KEY)
    localStorage.removeItem(this.REFRESH_TOKEN_KEY)
    localStorage.removeItem(this.USERNAME_KEY)

    // Clear Cognito SDK tokens
    this.clearCognitoTokens()
  }

  hasTokens(): boolean {
    return !!(this.getAccessToken() || this.getIdToken())
  }

  setUsername(username: string): void {
    localStorage.setItem(this.USERNAME_KEY, username)
  }

  getUsername(): string | null {
    return localStorage.getItem(this.USERNAME_KEY)
  }

  private getCognitoToken(tokenType: 'accessToken' | 'idToken' | 'refreshToken'): string | null {
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || ''
    if (!clientId) return null

    const lastAuthUser = localStorage.getItem(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`)
    if (!lastAuthUser) return null

    const tokenKey = `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.${tokenType}`
    return localStorage.getItem(tokenKey)
  }

  private clearCognitoTokens(): void {
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || ''
    if (!clientId) return

    const lastAuthUser = localStorage.getItem(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`)
    if (lastAuthUser) {
      localStorage.removeItem(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`)
      localStorage.removeItem(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`)
      localStorage.removeItem(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`)
      localStorage.removeItem(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.refreshToken`)
    }
  }
}

