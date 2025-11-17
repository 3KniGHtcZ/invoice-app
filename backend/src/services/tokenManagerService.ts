import { ConfidentialClientApplication } from '@azure/msal-node'
import { databaseService, AuthTokens } from './databaseService'

class TokenManagerService {
  private msalClient: ConfidentialClientApplication

  constructor() {
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.AZURE_CLIENT_ID!,
        authority: `https://login.microsoftonline.com/consumers`,
        clientSecret: process.env.AZURE_CLIENT_SECRET!,
      },
    })
  }

  /**
   * Save tokens to database after successful authentication
   */
  async saveTokens(userId: string, accessToken: string, refreshToken: string | null, expiresIn: number): Promise<void> {
    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    const tokens: AuthTokens = {
      userId,
      accessToken,
      refreshToken,
      expiresAt,
    }

    databaseService.saveAuthTokens(tokens)
    console.log('Tokens saved to database')
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidAccessToken(): Promise<string | null> {
    const tokens = databaseService.getAuthTokens()

    if (!tokens) {
      console.log('No tokens found in database')
      return null
    }

    // Check if access token is still valid (with 5 minute buffer)
    const expiresAt = new Date(tokens.expiresAt)
    const now = new Date()
    const bufferMs = 5 * 60 * 1000 // 5 minutes

    if (expiresAt.getTime() - now.getTime() > bufferMs) {
      // Token is still valid
      return tokens.accessToken
    }

    // Token expired or expiring soon, refresh it
    if (!tokens.refreshToken) {
      console.log('No refresh token available, re-authentication required')
      return null
    }

    console.log('Access token expired or expiring soon, refreshing...')
    return await this.refreshAccessToken(tokens.refreshToken)
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshAccessToken(refreshToken: string | null): Promise<string | null> {
    if (!refreshToken) {
      console.log('No refresh token provided')
      return null
    }
    try {
      const refreshRequest = {
        refreshToken: refreshToken,
        scopes: [
          'https://graph.microsoft.com/Mail.Read',
          'https://graph.microsoft.com/MailboxFolder.Read',
          'https://graph.microsoft.com/MailboxItem.Read',
          'https://graph.microsoft.com/User.Read',
          'offline_access',
        ],
      }

      const response = await this.msalClient.acquireTokenByRefreshToken(refreshRequest)

      if (response) {
        // Save the new tokens
        await this.saveTokens(
          response.account?.homeAccountId || 'default',
          response.accessToken,
          response.refreshToken || refreshToken, // Use old refresh token if new one not provided
          response.expiresOn ? Math.floor((response.expiresOn.getTime() - Date.now()) / 1000) : 3600
        )

        console.log('Access token refreshed successfully')
        return response.accessToken
      }

      return null
    } catch (error) {
      console.error('Error refreshing access token:', error)

      // If refresh fails, clear tokens to force re-authentication
      databaseService.clearAuthTokens()
      return null
    }
  }

  /**
   * Clear all stored tokens
   */
  clearTokens(): void {
    databaseService.clearAuthTokens()
    console.log('Tokens cleared from database')
  }

  /**
   * Check if we have stored tokens
   */
  hasStoredTokens(): boolean {
    return databaseService.getAuthTokens() !== null
  }
}

export const tokenManagerService = new TokenManagerService()
