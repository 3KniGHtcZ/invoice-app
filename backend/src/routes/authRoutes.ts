import { Router, Request, Response } from 'express'
import { authService } from '../services/authService.js'
import { tokenManagerService } from '../services/tokenManagerService'

const router = Router()

/**
 * GET /api/auth/login
 * Returns the Google OAuth login URL for frontend to redirect to
 */
router.get('/login', async (req: Request, res: Response) => {
  try {
    const authUrl = await authService.getAuthUrl()
    res.json({ authUrl })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Failed to initiate login' })
  }
})

/**
 * GET /api/auth/callback
 * OAuth callback endpoint - Google redirects here after user logs in
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code')
  }

  try {
    // Exchange code for tokens
    const tokens = await authService.acquireTokenByCode(code)

    // DEBUG: Log what we got from Google
    console.log('=== OAuth Callback - Token Response ===')
    console.log('Has access token:', !!tokens.accessToken)
    console.log('Has refresh token:', !!tokens.refreshToken)
    console.log('Refresh token value:', tokens.refreshToken ? 'present' : 'NULL')
    console.log('Account ID:', tokens.account?.id)
    console.log('Expires on:', tokens.expiresOn)
    console.log('=====================================')

    // Get userId from account info
    const userId = tokens.account?.id || 'default'
    const expiresIn = tokens.expiresOn
      ? Math.floor((tokens.expiresOn.getTime() - Date.now()) / 1000)
      : 3600 // Default to 1 hour if not provided

    // Save tokens to database (single source of truth)
    await tokenManagerService.saveTokens(
      userId,
      tokens.accessToken,
      tokens.refreshToken || null,
      expiresIn
    )

    // Store only userId in session for authentication reference
    req.session.userId = userId
    req.session.isAuthenticated = true

    // DEBUG: Log session before save
    console.log('=== Session Before Save ===')
    console.log('Session ID:', req.sessionID)
    console.log('Session userId:', req.session.userId)
    console.log('Session isAuthenticated:', req.session.isAuthenticated)
    console.log('Session cookie:', req.session.cookie)
    console.log('===========================')

    // Explicitly save session before redirect to ensure cookie is set
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err)
      } else {
        console.log('=== Session Saved Successfully ===')
        console.log('Session ID:', req.sessionID)
        console.log('Cookie settings:', {
          secure: req.session.cookie.secure,
          httpOnly: req.session.cookie.httpOnly,
          sameSite: req.session.cookie.sameSite,
          domain: req.session.cookie.domain,
          maxAge: req.session.cookie.maxAge,
        })
        console.log('==================================')
      }

      // Redirect back to frontend
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
      console.log('Redirecting to:', frontendUrl)
      res.redirect(frontendUrl)
    })
  } catch (error) {
    console.error('Callback error:', error)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    res.redirect(`${frontendUrl}?error=auth_failed`)
  }
})

/**
 * GET /api/auth/status
 * Check if user is authenticated
 */
router.get('/status', async (req: Request, res: Response) => {
  // Check if user has a valid session
  if (!req.session.userId || !req.session.isAuthenticated) {
    return res.json({ isAuthenticated: false })
  }

  // Check if tokens exist in database
  try {
    const accessToken = await tokenManagerService.getValidAccessToken()
    const isAuthenticated = !!accessToken

    res.json({ isAuthenticated })
  } catch (error) {
    console.error('Auth status check error:', error)
    res.json({ isAuthenticated: false })
  }
})

/**
 * POST /api/auth/logout
 * Clear session and log out user
 */
router.post('/logout', (req: Request, res: Response) => {
  // Clear tokens from database
  tokenManagerService.clearTokens()

  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err)
      return res.status(500).json({ error: 'Failed to log out' })
    }

    res.clearCookie('invoice.sid')
    res.json({ success: true })
  })
})

export default router
