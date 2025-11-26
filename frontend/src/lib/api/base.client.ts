/**
 * Base API client with common functionality
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { ApiError } from './errors'
import { logger } from '@/utils/logger'

// Default to production API URL so hosted builds work even if env vars are missing.
// Local development overrides this via NEXT_PUBLIC_API_URL in .env.local.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://czp5b77azd.execute-api.us-east-1.amazonaws.com'

export interface TokenProvider {
  getToken(): string | null
}

export class BaseApiClient {
  protected client: AxiosInstance
  protected tokenProvider: TokenProvider

  constructor(tokenProvider: TokenProvider) {
    this.tokenProvider = tokenProvider
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 300000,
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth token, session ID, and view mode headers
    this.client.interceptors.request.use(
      (config) => {
        const token = this.tokenProvider.getToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        
        // Add session ID if present (for impersonation)
        const sessionId = localStorage.getItem('impersonation_session_id')
        if (sessionId) {
          config.headers['X-Session-Id'] = sessionId
        }
        
        // Add view mode headers if present (for agency view)
        const viewMode = localStorage.getItem('agency_view_mode')
        if (viewMode) {
          config.headers['X-View-Mode'] = viewMode
        }
        
        const selectedCustomerId = localStorage.getItem('agency_selected_customer_id')
        if (selectedCustomerId) {
          config.headers['X-Selected-Customer-Id'] = selectedCustomerId
        }
        
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor - handle errors and auth
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.handleUnauthorized(error)
        }
        return Promise.reject(ApiError.fromAxiosError(error))
      }
    )
  }

  private handleUnauthorized(error: unknown): void {
    const errorData = error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { data?: unknown } }).response?.data
      : null

    const errorMessage = typeof errorData === 'string' 
      ? errorData 
      : errorData 
        ? JSON.stringify(errorData) 
        : 'Unauthorized'

    logger.warn('API returned 401 Unauthorized', {
      context: 'BaseApiClient',
      data: {
        message: errorMessage,
        hasToken: !!this.tokenProvider.getToken(),
      },
    })

    // Check if this is an API Gateway rejection
    const isApiGatewayRejection = !errorData || 
      errorMessage.includes('Unauthorized') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('Invalid UserPoolId')

    if (isApiGatewayRejection) {
      logger.warn('Authentication failed (token expired or invalid), clearing tokens and redirecting to login', {
        context: 'BaseApiClient',
      })
      this.clearAuthTokens()
      
      // Only redirect if we're not already on login page
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
        window.location.href = '/auth/login'
      }
    }
  }

  private clearAuthTokens(): void {
    // Clear custom tokens
    localStorage.removeItem('access_token')
    localStorage.removeItem('id_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('cognito_username')

    // Clear Cognito SDK tokens
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || ''
    if (clientId) {
      const lastAuthUser = localStorage.getItem(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`)
      if (lastAuthUser) {
        localStorage.removeItem(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`)
        localStorage.removeItem(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`)
        localStorage.removeItem(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`)
        localStorage.removeItem(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.refreshToken`)
      }
    }
  }

  protected async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config)
    return response.data
  }

  protected async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config)
    return response.data
  }

  protected async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config)
    return response.data
  }

  protected async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config)
    return response.data
  }
}
