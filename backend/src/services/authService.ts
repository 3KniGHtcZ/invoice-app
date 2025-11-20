import { ConfidentialClientApplication, AuthorizationUrlRequest, AuthorizationCodeRequest, AccountInfo } from '@azure/msal-node'
import { msalConfig, REDIRECT_URI, SCOPES } from '../config/msalConfig.js'

class AuthService {
  private msalClient: ConfidentialClientApplication

  constructor() {
    this.msalClient = new ConfidentialClientApplication(msalConfig)
  }

  /**
   * Generate the Microsoft login URL
   */
  async getAuthUrl(): Promise<string> {
    const authCodeUrlParameters: AuthorizationUrlRequest = {
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      prompt: 'consent', // Force consent dialog to ensure refresh token is returned
      responseMode: 'query',
    }

    try {
      const response = await this.msalClient.getAuthCodeUrl(authCodeUrlParameters)
      return response
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
    refreshToken: string | undefined
    expiresOn: Date | null
    account: AccountInfo | null
  }> {
    const tokenRequest: AuthorizationCodeRequest = {
      code,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
    }

    try {
      const response = await this.msalClient.acquireTokenByCode(tokenRequest)

      return {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresOn: response.expiresOn,
        account: response.account,
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
    refreshToken: string | undefined
    expiresOn: Date | null
  }> {
    try {
      const response = await this.msalClient.acquireTokenByRefreshToken({
        refreshToken,
        scopes: SCOPES,
      })

      return {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresOn: response.expiresOn,
      }
    } catch (error) {
      console.error('Error refreshing token:', error)
      throw new Error('Failed to refresh access token')
    }
  }
}

export const authService = new AuthService()
