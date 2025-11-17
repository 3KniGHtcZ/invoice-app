import { graphService } from './graphService'
import { databaseService } from './databaseService'

interface SyncResult {
  success: boolean
  newInvoices: number
  totalInvoices: number
  timestamp: string
  error?: string
}

class SyncService {
  private lastSyncTimestamp: string | null = null
  private knownEmailIds: Set<string> = new Set()
  private isInitialized = false

  async syncEmails(accessToken: string): Promise<SyncResult> {
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


      // Update last sync timestamp
      this.lastSyncTimestamp = startTime
      databaseService.updateSyncTimestamp(startTime)

      return {
        success: true,
        newInvoices: newEmails.length,
        totalInvoices: emails.length,
        timestamp: startTime
      }
    } catch (error) {
      console.error('Error syncing emails:', error)
      return {
        success: false,
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
