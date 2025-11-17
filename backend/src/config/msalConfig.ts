import { Configuration, LogLevel } from '@azure/msal-node'
import dotenv from 'dotenv'

dotenv.config()

export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    authority: 'https://login.microsoftonline.com/consumers',
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        if (process.env.NODE_ENV === 'development') {
          console.log(message)
        }
      },
      piiLoggingEnabled: false,
      logLevel: LogLevel.Info,
    },
  },
}

// Redirect URIs - configurable via environment variables for production
export const REDIRECT_URI =
  process.env.REDIRECT_URI || 'http://localhost:3000/api/auth/callback'

export const POST_LOGOUT_REDIRECT_URI =
  process.env.FRONTEND_URL || 'http://localhost:5173'

// Microsoft Graph scopes - must match Azure AD app registration
export const SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/MailboxFolder.Read',
  'https://graph.microsoft.com/MailboxItem.Read',
  'https://graph.microsoft.com/User.Read',
  'offline_access',
  'openid',
  'profile',
]
