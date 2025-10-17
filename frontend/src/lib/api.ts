import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

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
      const token = localStorage.getItem('id_token')
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
          // Redirect to login
          localStorage.removeItem('access_token')
          localStorage.removeItem('id_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/auth/login'
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

