import { Request, Response, NextFunction } from 'express'
import { tokenManagerService } from '../services/tokenManagerService.js'

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = req.session

  // Check if user has a valid session
  if (!session.userId || !session.isAuthenticated) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    // Get valid access token from database (auto-refreshes if needed)
    const accessToken = await tokenManagerService.getValidAccessToken()

    if (!accessToken) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' })
    }

    // Store access token in request for use by route handlers
    req.accessToken = accessToken

    next()
  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(401).json({ error: 'Authentication failed. Please log in again.' })
  }
}
