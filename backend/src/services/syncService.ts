import { graphService } from './graphService'
import { databaseService } from './databaseService'
import { invoiceExtractionService } from './invoiceExtractionService'

interface SyncResult {
  success: boolean
  newEmails: number
  newInvoices: number
  totalInvoices: number
  timestamp: string
  error?: string
}

class SyncService {
  private lastSyncTimestamp: string | null = null
  private knownEmailIds: Set<string> = new Set()
  private isInitialized = false

  async syncEmails(accessToken: string, autoExtract: boolean = false): Promise<SyncResult> {
    try {
      const startTime = new Date().toISOString()

      // Fetch current emails
      const emails = await graphService.getEmailsFromFolder(accessToken, 'faktury')
      const currentEmailIds = new Set(emails.map((e: any) => e.id))

      // Find new emails
      const newEmails = !this.isInitialized
        ? [] // On first run, don't treat all as new
        : emails.filter((e: any) => !this.knownEmailIds.has(e.id))

      // Update known emails
      this.knownEmailIds = currentEmailIds
      this.isInitialized = true

      let extractedCount = 0

      // Auto-extract invoices from new emails if enabled
      if (autoExtract && newEmails.length > 0) {
        console.log(`Auto-extracting invoices from ${newEmails.length} new emails...`)

        for (const email of newEmails) {
          try {
            // Get attachments for this email
            const attachments = await graphService.getEmailAttachments(accessToken, email.id)

            // Filter PDF attachments
            const pdfAttachments = attachments.filter((att: any) =>
              att.contentType === 'application/pdf' || att.name?.toLowerCase().endsWith('.pdf')
            )

            // Extract each PDF attachment
            for (const attachment of pdfAttachments) {
              try {
                // Skip if already extracted
                if (databaseService.getInvoiceData(email.id, attachment.id)) {
                  console.log(`Skipping already extracted invoice: ${attachment.name}`)
                  continue
                }

                // Get PDF content
                const contentBytes = await graphService.getAttachmentContent(
                  accessToken,
                  email.id,
                  attachment.id
                )

                // Extract invoice data using AI
                console.log(`Extracting invoice from: ${attachment.name}`)
                const invoiceData = await invoiceExtractionService.extractInvoiceData(contentBytes)

                // Save to database
                databaseService.saveInvoiceData(email.id, attachment.id, invoiceData)
                extractedCount++
                console.log(`Successfully extracted invoice #${invoiceData.invoiceNumber}`)
              } catch (attachError) {
                console.error(`Error extracting attachment ${attachment.name}:`, attachError)
                // Continue with next attachment
              }
            }
          } catch (emailError) {
            console.error(`Error processing email ${email.id}:`, emailError)
            // Continue with next email
          }
        }
      }

      // Update last sync timestamp
      this.lastSyncTimestamp = startTime
      databaseService.updateSyncTimestamp(startTime)

      return {
        success: true,
        newEmails: newEmails.length,
        newInvoices: extractedCount,
        totalInvoices: emails.length,
        timestamp: startTime
      }
    } catch (error) {
      console.error('Error syncing emails:', error)
      return {
        success: false,
        newEmails: 0,
        newInvoices: 0,
        totalInvoices: 0,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  getLastSyncTimestamp(): string | null {
    // Try to get from DB first
    const dbTimestamp = databaseService.getLastSyncTimestamp()
    if (dbTimestamp) {
      this.lastSyncTimestamp = dbTimestamp
    }
    return this.lastSyncTimestamp
  }

  initializeFromDatabase() {
    const timestamp = databaseService.getLastSyncTimestamp()
    if (timestamp) {
      this.lastSyncTimestamp = timestamp
      this.isInitialized = true
    }
  }
}

export const syncService = new SyncService()
