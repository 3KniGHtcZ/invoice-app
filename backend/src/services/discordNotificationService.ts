import { InvoiceData } from './invoiceExtractionService'

interface DiscordEmbed {
  title: string
  description?: string
  color: number
  fields: Array<{
    name: string
    value: string
    inline?: boolean
  }>
  footer?: {
    text: string
  }
  timestamp?: string
  url?: string
}

interface DiscordWebhookPayload {
  content?: string
  embeds: DiscordEmbed[]
}

class DiscordNotificationService {
  private webhookUrl: string | undefined

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL
  }

  /**
   * Send notification to Discord when a new invoice is found
   */
  async notifyNewInvoice(
    messageId: string,
    attachmentId: string,
    invoiceData: InvoiceData,
    emailSubject?: string
  ): Promise<void> {
    if (!this.webhookUrl) {
      console.log('Discord webhook URL not configured, skipping notification')
      return
    }

    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

      // Create rich embed with invoice details
      const embed: DiscordEmbed = {
        title: `🧾 Nová faktura: ${invoiceData.invoiceNumber || 'N/A'}`,
        description: emailSubject ? `Email: ${emailSubject}` : undefined,
        color: 0x00ff00, // Green color
        fields: [
          {
            name: '💰 Částka',
            value: invoiceData.totalAmount
              ? `${invoiceData.totalAmount} ${invoiceData.currency || 'CZK'}`
              : 'N/A',
            inline: true
          },
          {
            name: '📅 Datum vystavení',
            value: invoiceData.issueDate || 'N/A',
            inline: true
          },
          {
            name: '📅 Datum splatnosti',
            value: invoiceData.dueDate || 'N/A',
            inline: true
          },
          {
            name: '🏢 Dodavatel',
            value: invoiceData.supplierName || 'N/A',
            inline: false
          },
          {
            name: '🔗 Odkaz',
            value: `[Otevřít v aplikaci](${frontendUrl})`,
            inline: false
          }
        ],
        footer: {
          text: '📧 Invoice App'
        },
        timestamp: new Date().toISOString()
      }

      // Add variable symbol if available
      if (invoiceData.variableSymbol) {
        embed.fields.splice(3, 0, {
          name: '🔢 Variabilní symbol',
          value: invoiceData.variableSymbol,
          inline: true
        })
      }

      const payload: DiscordWebhookPayload = {
        content: '✨ Byla nalezena nová faktura!',
        embeds: [embed]
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Discord webhook failed: ${response.status} ${errorText}`)
      }

      console.log(`Discord notification sent for invoice ${invoiceData.invoiceNumber}`)
    } catch (error) {
      console.error('Error sending Discord notification:', error)
      // Don't throw - we don't want to fail invoice extraction if Discord fails
    }
  }

  /**
   * Send error notification to Discord
   */
  async notifyError(errorMessage: string, details?: string): Promise<void> {
    if (!this.webhookUrl) {
      return
    }

    try {
      const embed: DiscordEmbed = {
        title: '❌ Chyba v Invoice App',
        description: errorMessage,
        color: 0xff0000, // Red color
        fields: details ? [
          {
            name: 'Detaily',
            value: details.substring(0, 1024), // Discord field limit
            inline: false
          }
        ] : [],
        footer: {
          text: '📧 Invoice App'
        },
        timestamp: new Date().toISOString()
      }

      const payload: DiscordWebhookPayload = {
        embeds: [embed]
      }

      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      console.error('Error sending Discord error notification:', error)
    }
  }

  /**
   * Test Discord webhook connection
   */
  async testWebhook(): Promise<boolean> {
    if (!this.webhookUrl) {
      console.log('Discord webhook URL not configured')
      return false
    }

    try {
      const payload: DiscordWebhookPayload = {
        content: '🧪 Test notification from Invoice App',
        embeds: [{
          title: 'Webhook Test',
          description: 'Discord webhook is working correctly!',
          color: 0x0099ff,
          fields: [],
          timestamp: new Date().toISOString()
        }]
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        console.error('Discord webhook test failed:', response.status)
        return false
      }

      console.log('Discord webhook test successful')
      return true
    } catch (error) {
      console.error('Error testing Discord webhook:', error)
      return false
    }
  }
}

export const discordNotificationService = new DiscordNotificationService()
