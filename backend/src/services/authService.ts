import { OAuth2Client } from 'google-auth-library'
import { googleConfig, SCOPES } from '../config/googleConfig.js'

export interface UserInfo {
  id: string
  email: string
  name: string
  picture?: string
}

class AuthService {
  private oauth2Client: OAuth2Client

  constructor() {
    this.oauth2Client = new OAuth2Client(
      googleConfig.clientId,
      googleConfig.clientSecret,
      googleConfig.redirectUri
    )
  }

  /**
   * Generate the Google OAuth login URL
   */
  async getAuthUrl(): Promise<string> {
    try {
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline', // Required to get refresh token
        scope: SCOPES,
        prompt: 'consent', // Force consent dialog to ensure refresh token is returned
      })

      return authUrl
    } catch (error) {
      console.error('Error generating auth URL:', error)
      throw new Error('Failed to generate authentication URL')
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async acquireTokenByCode(code: string): Promise<{
    accessToken: string
    refreshToken: string | null | undefined
    expiresOn: Date | null
    account: UserInfo | null
  }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code)

      console.log('=== Google OAuth Token Response ===')
      console.log('Has access token:', !!tokens.access_token)
      console.log('Has refresh token:', !!tokens.refresh_token)
      console.log('Refresh token value:', tokens.refresh_token || 'NULL')
      console.log('Expiry date (raw):', tokens.expiry_date)
      console.log('Expiry date (type):', typeof tokens.expiry_date)
      console.log('Expires at:', tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'NULL')
      console.log('Current time:', new Date().toISOString())
      console.log('====================================')

      // Note: Not setting credentials on shared instance to avoid concurrency issues
      // Tokens are returned and will be saved separately

      // Get user info
      let userInfo: UserInfo | null = null
      if (tokens.access_token) {
        try {
          const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`)
          }

          const data = await response.json()
          userInfo = {
            id: data.id,
            email: data.email,
            name: data.name || data.email,
            picture: data.picture,
          }
        } catch (err) {
          console.error('Error fetching user info:', err)
        }
      }

      return {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token,
        expiresOn: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        account: userInfo,
      }
    } catch (error) {
      console.error('Error acquiring token by code:', error)
      throw new Error('Failed to acquire access token')
    }
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string
    refreshToken: string | null | undefined
    expiresOn: Date | null
  }> {
    try {
      // Create a new OAuth2Client instance for this operation to avoid race conditions
      const oauth2Client = new OAuth2Client(
        googleConfig.clientId,
        googleConfig.clientSecret,
        googleConfig.redirectUri
      )

      // Set the refresh token
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      })

      // Get new access token
      const { credentials } = await oauth2Client.refreshAccessToken()

      console.log('=== Google OAuth Refresh Token Response ===')
      console.log('Has access token:', !!credentials.access_token)
      console.log('Has refresh token:', !!credentials.refresh_token)
      console.log('Expires at:', credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : 'NULL')
      console.log('==========================================')

      return {
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token || refreshToken, // Keep old refresh token if new one not provided
        expiresOn: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      }
    } catch (error) {
      console.error('Error refreshing token:', error)
      throw new Error('Failed to refresh access token')
    }
  }
}

export const authService = new AuthService()
