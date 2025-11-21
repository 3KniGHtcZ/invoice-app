import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tokenManagerService } from './tokenManagerService'
import { databaseService } from './databaseService'
import { authService } from './authService'

// Mock dependencies
vi.mock('./databaseService', () => ({
  databaseService: {
    saveAuthTokens: vi.fn(),
    getAuthTokens: vi.fn(),
    clearAuthTokens: vi.fn(),
  },
}))

vi.mock('./authService', () => ({
  authService: {
    refreshAccessToken: vi.fn(),
  },
}))

describe('TokenManagerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveTokens', () => {
    it('should save tokens to database with correct expiration', async () => {
      const userId = 'user123'
      const accessToken = 'access_token_123'
      const refreshToken = 'refresh_token_123'
      const expiresIn = 3600

      await tokenManagerService.saveTokens(userId, accessToken, refreshToken, expiresIn)

      expect(databaseService.saveAuthTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          accessToken,
          refreshToken,
        })
      )

      const savedTokens = vi.mocked(databaseService.saveAuthTokens).mock.calls[0][0]
      expect(savedTokens.expiresAt).toBeDefined()

      // Verify expiration is approximately correct (within 1 second tolerance)
      const expiresAt = new Date(savedTokens.expiresAt)
      const expectedExpiry = new Date(Date.now() + expiresIn * 1000)
      expect(Math.abs(expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(1000)
    })

    it('should handle null refresh token', async () => {
      await tokenManagerService.saveTokens('user123', 'access_token', null, 3600)

      expect(databaseService.saveAuthTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: null,
        })
      )
    })
  })

  describe('getValidAccessToken', () => {
    it('should return null if no tokens exist', async () => {
      vi.mocked(databaseService.getAuthTokens).mockReturnValue(null)

      const token = await tokenManagerService.getValidAccessToken()

      expect(token).toBeNull()
    })

    it('should return existing access token if still valid', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      vi.mocked(databaseService.getAuthTokens).mockReturnValue({
        userId: 'user123',
        accessToken: 'valid_token',
        refreshToken: 'refresh_token',
        expiresAt: futureExpiry.toISOString(),
      })

      const token = await tokenManagerService.getValidAccessToken()

      expect(token).toBe('valid_token')
      expect(authService.refreshAccessToken).not.toHaveBeenCalled()
    })

    it('should refresh token if expiring within 5 minutes', async () => {
      const nearExpiry = new Date(Date.now() + 4 * 60 * 1000) // 4 minutes from now
      vi.mocked(databaseService.getAuthTokens).mockReturnValue({
        userId: 'user123',
        accessToken: 'expiring_token',
        refreshToken: 'refresh_token_123',
        expiresAt: nearExpiry.toISOString(),
      })

      vi.mocked(authService.refreshAccessToken).mockResolvedValue({
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresOn: new Date(Date.now() + 3600 * 1000),
      })

      const token = await tokenManagerService.getValidAccessToken()

      expect(authService.refreshAccessToken).toHaveBeenCalledWith('refresh_token_123')
      expect(token).toBe('new_access_token')
    })

    it('should return null if no refresh token available', async () => {
      const pastExpiry = new Date(Date.now() - 1000) // Already expired
      vi.mocked(databaseService.getAuthTokens).mockReturnValue({
        userId: 'user123',
        accessToken: 'expired_token',
        refreshToken: null,
        expiresAt: pastExpiry.toISOString(),
      })

      const token = await tokenManagerService.getValidAccessToken()

      expect(token).toBeNull()
    })

    it('should return null if refresh fails', async () => {
      const pastExpiry = new Date(Date.now() - 1000)
      vi.mocked(databaseService.getAuthTokens).mockReturnValue({
        userId: 'user123',
        accessToken: 'expired_token',
        refreshToken: 'refresh_token',
        expiresAt: pastExpiry.toISOString(),
      })

      vi.mocked(authService.refreshAccessToken).mockRejectedValue(new Error('Refresh failed'))

      const token = await tokenManagerService.getValidAccessToken()

      expect(token).toBeNull()
    })
  })

  describe('clearTokens', () => {
    it('should clear tokens from database', () => {
      tokenManagerService.clearTokens()

      expect(databaseService.clearAuthTokens).toHaveBeenCalled()
    })
  })

  describe('hasStoredTokens', () => {
    it('should return true if tokens exist', () => {
      vi.mocked(databaseService.getAuthTokens).mockReturnValue({
        userId: 'user123',
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: new Date().toISOString(),
      })

      expect(tokenManagerService.hasStoredTokens()).toBe(true)
    })

    it('should return false if no tokens exist', () => {
      vi.mocked(databaseService.getAuthTokens).mockReturnValue(null)

      expect(tokenManagerService.hasStoredTokens()).toBe(false)
    })
  })
})
