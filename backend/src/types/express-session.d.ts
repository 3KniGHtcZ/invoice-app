import 'express-session'

declare module 'express-session' {
  interface SessionData {
    userId?: string
    isAuthenticated?: boolean
  }
}

declare global {
  namespace Express {
    interface Request {
      accessToken?: string
    }
  }
}
