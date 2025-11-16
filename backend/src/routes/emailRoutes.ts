import { Router, Request, Response } from 'express'
import { graphService } from '../services/graphService'
import { requireAuth } from '../middleware/requireAuth'
import { invoiceExtractionService } from '../services/invoiceExtractionService'

const router = Router()

// List all folders
router.get('/folders', requireAuth, async (req: Request, res: Response) => {
  try {
    const accessToken = req.session.accessToken!
    const folders = await graphService.listAllFolders(accessToken)
    res.json(folders)
  } catch (error) {
    console.error('Error listing folders:', error)
    res.status(500).json({ error: 'Failed to list folders' })
  }
})

// Get emails from 'faktury' folder
router.get('/faktury', requireAuth, async (req: Request, res: Response) => {
  try {
    const accessToken = req.session.accessToken!
    const emails = await graphService.getEmailsFromFolder(accessToken, 'faktury')
    res.json(emails)
  } catch (error) {
    console.error('Error fetching faktury emails:', error)
    res.status(500).json({ error: 'Failed to fetch emails' })
  }
})

// Get attachments for a specific email
router.get('/:messageId/attachments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params
    const accessToken = req.session.accessToken!
    const attachments = await graphService.getEmailAttachments(accessToken, messageId)
    res.json(attachments)
  } catch (error) {
    console.error('Error fetching attachments:', error)
    res.status(500).json({ error: 'Failed to fetch attachments' })
  }
})

// Get specific attachment content
router.get(
  '/:messageId/attachments/:attachmentId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { messageId, attachmentId } = req.params
      const accessToken = req.session.accessToken!
      const contentBytes = await graphService.getAttachmentContent(
        accessToken,
        messageId,
        attachmentId
      )

      // Convert base64 to buffer and send as PDF
      const buffer = Buffer.from(contentBytes, 'base64')
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'inline')
      res.send(buffer)
    } catch (error) {
      console.error('Error fetching attachment content:', error)
      res.status(500).json({ error: 'Failed to fetch attachment content' })
    }
  }
)

// Extract invoice data from PDF attachment
router.post(
  '/:messageId/attachments/:attachmentId/extract',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { messageId, attachmentId } = req.params
      const accessToken = req.session.accessToken!

      // Get PDF content
      const contentBytes = await graphService.getAttachmentContent(
        accessToken,
        messageId,
        attachmentId
      )

      // Extract invoice data using Gemini AI
      const invoiceData = await invoiceExtractionService.extractInvoiceData(contentBytes)

      res.json(invoiceData)
    } catch (error) {
      console.error('Error extracting invoice data:', error)
      res.status(500).json({ error: 'Failed to extract invoice data' })
    }
  }
)

export default router
