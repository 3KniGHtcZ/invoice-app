import dotenv from 'dotenv'

dotenv.config()

export const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
}

export const POST_LOGOUT_REDIRECT_URI =
  process.env.FRONTEND_URL || 'http://localhost:5173'

// Gmail API scopes - must match Google Cloud Console app registration
export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
]
