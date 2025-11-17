import express, { Request, Response } from 'express'
import cors from 'cors'
import session from 'express-session'
import dotenv from 'dotenv'
import connectSqlite3 from 'connect-sqlite3'
import cron from 'node-cron'
import helmet from 'helmet'
import authRoutes from './routes/authRoutes'
import emailRoutes from './routes/emailRoutes'
import { syncService } from './services/syncService'
import { tokenManagerService } from './services/tokenManagerService'
import './types/session.types'

dotenv.config()

// Initialize SQLite session store
const SQLiteStore = connectSqlite3(session)

const app = express()
const PORT = process.env.PORT || 3000

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
        connectSrc: ["'self'", 'https://login.microsoftonline.com', 'https://graph.microsoft.com'],
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

// Session configuration
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required')
}

app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: './',
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'invoice.sid', // Don't use default name
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
    },
  })
)

// In-memory data store
interface Message {
  id: number
  text: string
  timestamp: string
}

let messages: Message[] = [
  {
    id: 1,
    text: 'Welcome to the example app!',
    timestamp: new Date().toISOString(),
  },
]

let nextId = 2

// Auth routes
app.use('/api/auth', authRoutes)

// Email routes
app.use('/api/emails', emailRoutes)

// Routes
app.get('/api/messages', (req: Request, res: Response) => {
  res.json(messages)
})

app.post('/api/messages', (req: Request, res: Response) => {
  const { text } = req.body

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' })
  }

  const newMessage: Message = {
    id: nextId++,
    text,
    timestamp: new Date().toISOString(),
  }

  messages.push(newMessage)
  res.status(201).json(newMessage)
})

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Initialize sync service from database
syncService.initializeFromDatabase()

// Setup cron job for automatic email synchronization (every 10 minutes)
cron.schedule('*/10 * * * *', async () => {
  console.log('Running scheduled email sync...')

  try {
    // Get valid access token (will automatically refresh if needed)
    const accessToken = await tokenManagerService.getValidAccessToken()

    if (!accessToken) {
      console.log('No valid access token available - user needs to log in first')
      return
    }

    // Run sync with the valid token
    const result = await syncService.syncEmails(accessToken)

    if (result.success) {
      console.log(`Scheduled sync completed: ${result.newInvoices} new invoices found`)
    } else {
      console.error('Scheduled sync failed:', result.error)
    }
  } catch (error) {
    console.error('Error in scheduled sync:', error)
  }
})

console.log('Email sync cron job scheduled (every 10 minutes)')

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
