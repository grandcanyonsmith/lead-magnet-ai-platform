import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Helper to get token from Cognito storage or fallback
const getAuthToken = (): string | null => {
  // First try custom storage keys
  let token = localStorage.getItem('access_token') || localStorage.getItem('id_token')
  if (token) return token

  // Then try Cognito SDK storage format
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || ''
  if (!clientId) return null

  const lastAuthUser = localStorage.getItem(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`)
  if (!lastAuthUser) return null

  // Get access token or id token from Cognito storage
  token = localStorage.getItem(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`) ||
          localStorage.getItem(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`)
  
  return token
}

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      const token = getAuthToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    // Handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Log the error but don't clear tokens automatically
          // Let the authentication check in the layout handle token clearing
          console.warn('API returned 401 Unauthorized:', {
            url: error.config?.url,
            message: error.response?.data?.message || error.message,
            hasToken: !!getAuthToken()
          })
          
          // Only clear tokens if explicitly an auth error AND we have a clear error message
          const errorData = error.response?.data || {}
          const errorMessage = typeof errorData === 'string' ? errorData.toLowerCase() : JSON.stringify(errorData).toLowerCase()
          
          // Only clear tokens if it's a clear authentication error, not just any 401
          // API Gateway might return 401 for various reasons
          const isAuthError = errorMessage.includes('invalid token') || 
                             errorMessage.includes('token expired') || 
                             errorMessage.includes('jwt') ||
                             (errorMessage.includes('unauthorized') && errorMessage.includes('authentication'))
          
          if (isAuthError) {
            console.warn('Authentication token invalid, clearing tokens')
            
            // Clear all auth tokens (both custom and Cognito format)
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
            
            // Only redirect if we're not already on login page
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
              window.location.href = '/auth/login'
            }
          }
        }
        return Promise.reject(error)
      }
    )
  }

  // Workflows
  async getWorkflows(params?: any) {
    const response = await this.client.get('/admin/workflows', { params })
    return response.data
  }

  async getWorkflow(id: string) {
    const response = await this.client.get(`/admin/workflows/${id}`)
    return response.data
  }

  async createWorkflow(data: any) {
    const response = await this.client.post('/admin/workflows', data)
    return response.data
  }

  async updateWorkflow(id: string, data: any) {
    const response = await this.client.put(`/admin/workflows/${id}`, data)
    return response.data
  }

  async deleteWorkflow(id: string) {
    const response = await this.client.delete(`/admin/workflows/${id}`)
    return response.data
  }

  // Forms
  async getForms(params?: any) {
    const response = await this.client.get('/admin/forms', { params })
    return response.data
  }

  async getForm(id: string) {
    const response = await this.client.get(`/admin/forms/${id}`)
    return response.data
  }

  async createForm(data: any) {
    const response = await this.client.post('/admin/forms', data)
    return response.data
  }

  async updateForm(id: string, data: any) {
    const response = await this.client.put(`/admin/forms/${id}`, data)
    return response.data
  }

  async deleteForm(id: string) {
    const response = await this.client.delete(`/admin/forms/${id}`)
    return response.data
  }

  // Templates
  async getTemplates(params?: any) {
    const response = await this.client.get('/admin/templates', { params })
    return response.data
  }

  async getTemplate(id: string) {
    const response = await this.client.get(`/admin/templates/${id}`)
    return response.data
  }

  async createTemplate(data: any) {
    const response = await this.client.post('/admin/templates', data)
    return response.data
  }

  async updateTemplate(id: string, data: any) {
    const response = await this.client.put(`/admin/templates/${id}`, data)
    return response.data
  }

  async deleteTemplate(id: string) {
    const response = await this.client.delete(`/admin/templates/${id}`)
    return response.data
  }

  // Jobs
  async getJobs(params?: any) {
    const response = await this.client.get('/admin/jobs', { params })
    return response.data
  }

  async getJob(id: string) {
    const response = await this.client.get(`/admin/jobs/${id}`)
    return response.data
  }

  // Submissions
  async getSubmissions(params?: any) {
    const response = await this.client.get('/admin/submissions', { params })
    return response.data
  }

  async getSubmission(id: string) {
    const response = await this.client.get(`/admin/submissions/${id}`)
    return response.data
  }

  // Artifacts
  async getArtifacts(params?: any) {
    const response = await this.client.get('/admin/artifacts', { params })
    return response.data
  }

  async getArtifact(id: string) {
    const response = await this.client.get(`/admin/artifacts/${id}`)
    return response.data
  }

  // Settings
  async getSettings() {
    const response = await this.client.get('/admin/settings')
    return response.data
  }

  async updateSettings(data: any) {
    const response = await this.client.put('/admin/settings', data)
    return response.data
  }

  // Analytics
  async getAnalytics(params?: any) {
    const response = await this.client.get('/admin/analytics', { params })
    return response.data
  }
}

export const api = new ApiClient()

