import { useState, useEffect } from 'react'
import { BACKEND_URL, FRONTEND_URL } from '@/config/constants'

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuthStatus()

    // Listen for OAuth callback from popup
    const handleMessage = (event: MessageEvent) => {
      // SECURITY: Validate origin before processing
      const allowedOrigins = [BACKEND_URL, FRONTEND_URL]
      if (!allowedOrigins.includes(event.origin)) {
        console.warn(`Rejected message from unauthorized origin: ${event.origin}`)
        return
      }

      if (event.data.type === 'AUTH_SUCCESS') {
        console.log('Authentication successful!')
        checkAuthStatus()
      } else if (event.data.type === 'AUTH_ERROR') {
        setError('Authentication failed. Please try again.')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const checkAuthStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/status', {
        credentials: 'include',
      })
      const data = await response.json()
      setIsAuthenticated(data.isAuthenticated)
    } catch (err) {
      console.error('Error checking auth status:', err)
      setError('Failed to check authentication status')
    } finally {
      setLoading(false)
    }
  }

  const login = async () => {
    setError(null)
    setLoading(true)

    try {
      // Get auth URL from backend
      const response = await fetch('/api/auth/login')
      const data = await response.json()

      if (data.authUrl) {
        // Open popup window for OAuth
        const width = 600
        const height = 700
        const left = window.screen.width / 2 - width / 2
        const top = window.screen.height / 2 - height / 2

        window.open(
          data.authUrl,
          'Microsoft Login',
          `width=${width},height=${height},left=${left},top=${top}`
        )
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Failed to initiate login')
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      setIsAuthenticated(false)
    } catch (err) {
      console.error('Logout error:', err)
      setError('Failed to log out')
    } finally {
      setLoading(false)
    }
  }

  return {
    isAuthenticated,
    loading,
    error,
    login,
    logout,
    setError,
  }
}
