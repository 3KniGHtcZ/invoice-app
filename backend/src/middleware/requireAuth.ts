import { Request, Response, NextFunction } from 'express'
import { authService } from '../services/authService.js'

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = req.session

  if (!session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  // Check if token is expired
  if (session.tokenExpiresAt && Date.now() >= session.tokenExpiresAt) {
    // Try to refresh token
    if (session.refreshToken) {
      try {
        const tokens = await authService.refreshAccessToken(session.refreshToken)

        // Update session with new tokens
        session.accessToken = tokens.accessToken
        session.refreshToken = tokens.refreshToken
        session.tokenExpiresAt = tokens.expiresOn ? tokens.expiresOn.getTime() : undefined

        return next()
      } catch (error) {
        console.error('Token refresh failed:', error)
        return res.status(401).json({ error: 'Session expired. Please log in again.' })
      }
    } else {
      return res.status(401).json({ error: 'Session expired. Please log in again.' })
    }
  }

  next()
}
