import express, { Request, Response } from 'express'
import cors from 'cors'
import session from 'express-session'
import dotenv from 'dotenv'
import connectSqlite3 from 'connect-sqlite3'
import helmet from 'helmet'
import authRoutes from './routes/authRoutes'
import emailRoutes from './routes/emailRoutes'
import { syncService } from './services/syncService'
import { tokenManagerService } from './services/tokenManagerService'
import { backgroundJobService } from './services/backgroundJobService'
import './types/session.types'

dotenv.config()

// Initialize SQLite session store
const SQLiteStore = connectSqlite3(session)

const app = express()
const PORT = process.env.PORT || 3000

// Trust proxy - required for cookies to work behind Cloudflare/nginx
// This allows Express to read X-Forwarded-Proto header and know the request came via HTTPS
app.set('trust proxy', 1)

// Middleware

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for OAuth callback page
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://accounts.google.com', 'https://www.googleapis.com'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
  })
)

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173']

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true)

      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    maxAge: 600, // Cache preflight for 10 minutes
  })
)
app.use(express.json())

// Debug middleware - log all request details
app.use((req, res, next) => {
  console.log('=== Request Debug Info ===')
  console.log('URL:', req.url)
  console.log('Protocol:', req.protocol)
  console.log('Secure:', req.secure)
  console.log('X-Forwarded-Proto:', req.headers['x-forwarded-proto'])
  console.log('X-Forwarded-For:', req.headers['x-forwarded-for'])
  console.log('X-Real-IP:', req.headers['x-real-ip'])
  console.log('Host:', req.headers.host)
  console.log('Origin:', req.headers.origin)
  console.log('Cookie header:', req.headers.cookie)
  console.log('========================')

  // Log response headers
  const originalWriteHead = res.writeHead.bind(res)
  res.writeHead = function(statusCode: number, ...args: any[]) {
    console.log('=== Response Debug Info ===')
    console.log('Status:', statusCode)
    console.log('Set-Cookie header:', res.getHeader('Set-Cookie'))
    console.log('===========================')
    return originalWriteHead(statusCode, ...args)
  } as typeof res.writeHead

  next()
})

// Session configuration
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required')
}

// Use /app/data in production (Docker), current directory in development
const sessionDbDir = process.env.NODE_ENV === 'production' ? '/app/data' : './'

app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: sessionDbDir,
    }) as any,
    secret: process.env.SESSION_SECRET,
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    rolling: true, // Reset cookie MaxAge on every request (rolling sessions)
    name: 'invoice.sid', // Don't use default name
    cookie: {
      secure: process.env.COOKIE_SECURE === 'true',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (increased from 24 hours)
      sameSite: 'lax', // Use 'lax' for better compatibility with redirects
      domain: process.env.COOKIE_DOMAIN || undefined,
    },
  })
)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/emails', emailRoutes)

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Version info
app.get('/api/version', (req: Request, res: Response) => {
  try {
    const fs = require('fs')
    const path = require('path')
    const buildInfoPath = path.join(__dirname, '../../build-info.json')

    if (fs.existsSync(buildInfoPath)) {
      const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf-8'))
      res.json(buildInfo)
    } else {
      // Local development fallback
      res.json({
        buildDate: 'development',
        gitCommit: 'local',
        gitBranch: 'local',
        version: 'dev'
      })
    }
  } catch (error) {
    console.error('Error reading build info:', error)
    res.status(500).json({ error: 'Failed to read build information' })
  }
})

// Initialize sync service from database
syncService.initializeFromDatabase()

// Start background job for automatic email checking
backgroundJobService.start()

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
