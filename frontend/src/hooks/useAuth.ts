import { useState, useEffect } from 'react'

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check auth status on mount and when returning from OAuth redirect
  useEffect(() => {
    checkAuthStatus()
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
        // Redirect to OAuth in same window
        window.location.href = data.authUrl
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
