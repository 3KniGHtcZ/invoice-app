import { Router, Request, Response } from 'express'
import { graphService } from '../services/graphService'
import { requireAuth } from '../middleware/requireAuth'
import { invoiceExtractionService } from '../services/invoiceExtractionService'
import { databaseService } from '../services/databaseService'
import { syncService } from '../services/syncService'
import { cachePresets } from '../middleware/cacheControl'

const router = Router()

// List all folders
router.get('/folders', requireAuth, cachePresets.mediumCache, async (req: Request, res: Response) => {
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
router.get('/faktury', requireAuth, cachePresets.shortCache, async (req: Request, res: Response) => {
  try {
    const accessToken = req.session.accessToken!
    const emails = await graphService.getEmailsFromFolder(accessToken, 'faktury')

    // Add extraction status to each email
    const emailsWithStatus = emails.map((email: any) => ({
      ...email,
      hasExtractedData: databaseService.hasExtractedData(email.id)
    }))

    res.json(emailsWithStatus)
  } catch (error) {
    console.error('Error fetching faktury emails:', error)
    res.status(500).json({ error: 'Failed to fetch emails' })
  }
})

// Batch get attachments for multiple emails (fixes N+1 query pattern)
router.post('/attachments/batch', requireAuth, cachePresets.mediumCache, async (req: Request, res: Response) => {
  try {
    const { messageIds } = req.body

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'messageIds must be a non-empty array' })
    }

    // Limit batch size to prevent abuse
    if (messageIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 message IDs allowed per batch request' })
    }

    const accessToken = req.session.accessToken!
    const batchAttachments = await graphService.getBatchEmailAttachments(accessToken, messageIds)
    res.json(batchAttachments)
  } catch (error) {
    console.error('Error fetching batch attachments:', error)
    res.status(500).json({ error: 'Failed to fetch batch attachments' })
  }
})

// Get attachments for a specific email
router.get('/:messageId/attachments', requireAuth, cachePresets.mediumCache, async (req: Request, res: Response) => {
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
      const regenerate = req.query.regenerate === 'true'

      // Try to get from database first (unless regenerate is requested)
      if (!regenerate) {
        const cachedData = databaseService.getInvoiceData(messageId, attachmentId)
        if (cachedData) {
          console.log('Returning cached invoice data from database')
          return res.json({ ...cachedData, fromCache: true })
        }
      }

      // Get PDF content
      const contentBytes = await graphService.getAttachmentContent(
        accessToken,
        messageId,
        attachmentId
      )

      // Extract invoice data using Gemini AI
      console.log('Extracting invoice data with AI...')
      const invoiceData = await invoiceExtractionService.extractInvoiceData(contentBytes)

      // Save to database
      databaseService.saveInvoiceData(messageId, attachmentId, invoiceData)
      console.log('Invoice data saved to database')

      res.json({ ...invoiceData, fromCache: false })
    } catch (error) {
      console.error('Error extracting invoice data:', error)
      res.status(500).json({ error: 'Failed to extract invoice data' })
    }
  }
)

// Get sync status
router.get('/sync/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const lastSync = syncService.getLastSyncTimestamp()
    res.json({
      lastSyncTimestamp: lastSync,
      hasSync: lastSync !== null
    })
  } catch (error) {
    console.error('Error getting sync status:', error)
    res.status(500).json({ error: 'Failed to get sync status' })
  }
})

// Trigger manual sync
router.post('/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const accessToken = req.session.accessToken!
    const result = await syncService.syncEmails(accessToken)
    res.json(result)
  } catch (error) {
    console.error('Error syncing emails:', error)
    res.status(500).json({ error: 'Failed to sync emails' })
  }
})

export default router
