import { Router, Request, Response } from 'express'
import { authService } from '../services/authService.js'

const router = Router()

/**
 * GET /api/auth/login
 * Returns the Microsoft login URL for frontend to redirect to
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
 * OAuth callback endpoint - Microsoft redirects here after user logs in
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code')
  }

  try {
    // Exchange code for tokens
    const tokens = await authService.acquireTokenByCode(code)

    // Store tokens in session
    req.session.accessToken = tokens.accessToken
    req.session.refreshToken = tokens.refreshToken
    req.session.tokenExpiresAt = tokens.expiresOn ? tokens.expiresOn.getTime() : undefined

    // Redirect to frontend with success message
    res.send(`
      <html>
        <head>
          <title>Login Successful</title>
        </head>
        <body>
          <h2>Authentication successful!</h2>
          <p>You can close this window now.</p>
          <script>
            // Close popup window if opened from popup
            if (window.opener) {
              window.opener.postMessage({ type: 'AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              // If not popup, redirect to frontend
              window.location.href = 'http://localhost:5173';
            }
          </script>
        </body>
      </html>
    `)
  } catch (error) {
    console.error('Callback error:', error)
    res.status(500).send(`
      <html>
        <head>
          <title>Login Failed</title>
        </head>
        <body>
          <h2>Authentication failed</h2>
          <p>Please try again.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'AUTH_ERROR' }, '*');
              window.close();
            }
          </script>
        </body>
      </html>
    `)
  }
})

/**
 * GET /api/auth/status
 * Check if user is authenticated
 */
router.get('/status', (req: Request, res: Response) => {
  const isAuthenticated = !!(
    req.session.accessToken &&
    req.session.tokenExpiresAt &&
    Date.now() < req.session.tokenExpiresAt
  )

  res.json({ isAuthenticated })
})

/**
 * POST /api/auth/logout
 * Clear session and log out user
 */
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err)
      return res.status(500).json({ error: 'Failed to log out' })
    }

    res.clearCookie('connect.sid')
    res.json({ success: true })
  })
})

export default router
