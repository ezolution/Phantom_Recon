import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // No redirect; surface the error to the UI (no auth flow in this app)
    return Promise.reject(error)
  }
)
