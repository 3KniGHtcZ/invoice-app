import express, { Request, Response } from 'express'
import cors from 'cors'
import session from 'express-session'
import dotenv from 'dotenv'
import connectSqlite3 from 'connect-sqlite3'
import cron from 'node-cron'
import authRoutes from './routes/authRoutes'
import emailRoutes from './routes/emailRoutes'
import { syncService } from './services/syncService'
import './types/session.types'

dotenv.config()

// Initialize SQLite session store
const SQLiteStore = connectSqlite3(session)

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
)
app.use(express.json())

// Session configuration
app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: './',
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
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
// Note: This requires a valid access token, which may not always be available
// Consider implementing a system user or service account for this
cron.schedule('*/10 * * * *', async () => {
  console.log('Running scheduled email sync...')
  // This is a placeholder - in production you'd need to handle authentication
  // for automated syncs differently (service account, refresh token, etc.)
})

console.log('Email sync cron job scheduled (every 10 minutes)')

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
