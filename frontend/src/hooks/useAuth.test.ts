import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAuth } from './useAuth'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (window as any).location
    ;(window as any).location = { href: '' }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should check auth status on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ isAuthenticated: true }),
      })

      const { result } = renderHook(() => useAuth())

      // Initially loading
      expect(result.current.loading).toBe(true)

      // Wait for auth check to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/status', {
        credentials: 'include',
      })
    })

    it('should handle unauthenticated state', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ isAuthenticated: false }),
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle auth check errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.error).toBe('Failed to check authentication status')
    })
  })

  describe('login', () => {
    it('should redirect to OAuth URL on successful login initiation', async () => {
      mockFetch
        // Initial auth check
        .mockResolvedValueOnce({
          json: async () => ({ isAuthenticated: false }),
        })
        // Login request
        .mockResolvedValueOnce({
          json: async () => ({ authUrl: 'https://accounts.google.com/o/oauth2/auth' }),
        })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.login()
      })

      expect(window.location.href).toBe('https://accounts.google.com/o/oauth2/auth')
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login')
    })

    it('should handle login errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          json: async () => ({ isAuthenticated: false }),
        })
        .mockRejectedValueOnce(new Error('Login failed'))

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.login()
      })

      expect(result.current.error).toBe('Failed to initiate login')
    })

    it('should clear previous errors before login', async () => {
      mockFetch
        .mockResolvedValueOnce({
          json: async () => ({ isAuthenticated: false }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ authUrl: 'https://example.com/auth' }),
        })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Set an error first
      act(() => {
        result.current.setError('Previous error')
      })

      expect(result.current.error).toBe('Previous error')

      await act(async () => {
        await result.current.login()
      })

      // Error should be cleared during login
      expect(result.current.error).toBeNull()
    })
  })

  describe('logout', () => {
    it('should successfully log out', async () => {
      mockFetch
        // Initial auth check
        .mockResolvedValueOnce({
          json: async () => ({ isAuthenticated: true }),
        })
        // Logout request
        .mockResolvedValueOnce({
          ok: true,
        })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    })

    it('should handle logout errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          json: async () => ({ isAuthenticated: true }),
        })
        .mockRejectedValueOnce(new Error('Logout failed'))

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.error).toBe('Failed to log out')
    })

    it('should set loading state during logout', async () => {
      mockFetch
        .mockResolvedValueOnce({
          json: async () => ({ isAuthenticated: true }),
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                  }),
                100
              )
            )
        )

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      let loadingDuringLogout = false

      act(() => {
        result.current.logout().then(() => {
          // Check loading state was true during operation
        })
      })

      // Check that loading is true immediately after calling logout
      await waitFor(() => {
        if (result.current.loading) {
          loadingDuringLogout = true
        }
        return !result.current.loading
      })

      expect(loadingDuringLogout).toBe(true)
    })
  })

  describe('setError', () => {
    it('should allow manually setting errors', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ isAuthenticated: false }),
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.setError('Custom error message')
      })

      expect(result.current.error).toBe('Custom error message')
    })

    it('should allow clearing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ isAuthenticated: false }),
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.setError('Error message')
      })

      expect(result.current.error).toBe('Error message')

      act(() => {
        result.current.setError(null)
      })

      expect(result.current.error).toBeNull()
    })
  })
})
