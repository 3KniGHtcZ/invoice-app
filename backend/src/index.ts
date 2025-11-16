import express, { Request, Response } from 'express'
import cors from 'cors'

const app = express()
const PORT = 3000

// Middleware
app.use(cors())
app.use(express.json())

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
