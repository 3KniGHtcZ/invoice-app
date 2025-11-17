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

      // Send Discord notifications for new invoices
      if (newEmails.length > 0) {
        await this.sendDiscordNotifications(newEmails)
      }

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

  private async sendDiscordNotifications(newEmails: any[]) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL

    if (!webhookUrl) {
      console.warn('DISCORD_WEBHOOK_URL not set, skipping Discord notifications')
      return
    }

    for (const email of newEmails) {
      try {
        const message = {
          embeds: [{
            title: '📧 Nová faktura',
            description: email.subject,
            color: 0x00ff00, // Green
            fields: [
              {
                name: 'Od',
                value: email.from || 'N/A',
                inline: true
              },
              {
                name: 'Datum',
                value: new Date(email.receivedDateTime).toLocaleString('cs-CZ'),
                inline: true
              },
              {
                name: 'Má přílohy',
                value: email.hasAttachments ? 'Ano' : 'Ne',
                inline: true
              }
            ],
            timestamp: email.receivedDateTime
          }]
        }

        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message)
        })

        // Rate limit: wait 1 second between notifications
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error('Error sending Discord notification:', error)
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
