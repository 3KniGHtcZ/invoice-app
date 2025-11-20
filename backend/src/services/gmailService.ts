import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { googleConfig } from '../config/googleConfig.js'

export interface EmailAttachment {
  id: string
  name: string
  contentType: string
  size: number
}

export interface EmailMessage {
  id: string
  subject: string
  from: string
  receivedDateTime: string
  hasAttachments: boolean
  attachments?: EmailAttachment[]
}

class GmailService {
  private getGmailClient(accessToken: string) {
    const auth = new OAuth2Client(googleConfig.clientId, googleConfig.clientSecret)
    auth.setCredentials({ access_token: accessToken })
    return google.gmail({ version: 'v1', auth })
  }

  /**
   * List all Gmail labels (equivalent to folders in Outlook)
   */
  async listAllFolders(accessToken: string): Promise<any[]> {
    const gmail = this.getGmailClient(accessToken)

    try {
      const response = await gmail.users.labels.list({
        userId: 'me',
      })

      return response.data.labels || []
    } catch (error) {
      console.error('Error listing labels:', error)
      throw error
    }
  }

  /**
   * Get emails from a specific Gmail label (folder)
   */
  async getEmailsFromFolder(accessToken: string, folderName: string): Promise<EmailMessage[]> {
    const gmail = this.getGmailClient(accessToken)

    try {
      // First, find the label by name
      const labelsResponse = await gmail.users.labels.list({
        userId: 'me',
      })

      const labels = labelsResponse.data.labels || []
      console.log('Available labels:', labels.map((l: any) => l.name))

      const targetLabel = labels.find(
        (label: any) => label.name.toLowerCase() === folderName.toLowerCase()
      )

      if (!targetLabel) {
        const availableLabels = labels.map((l: any) => l.name).join(', ')
        throw new Error(`Label "${folderName}" not found. Available labels: ${availableLabels}`)
      }

      // Get messages with this label
      const messagesResponse = await gmail.users.messages.list({
        userId: 'me',
        labelIds: [targetLabel.id!],
        maxResults: 50,
      })

      const messageIds = messagesResponse.data.messages || []

      if (messageIds.length === 0) {
        return []
      }

      // Fetch full message details in parallel
      const messagePromises = messageIds.map(async (msg) => {
        try {
          const messageDetail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date'],
          })

          const headers = messageDetail.data.payload?.headers || []
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject'
          const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown'
          const date = headers.find((h: any) => h.name === 'Date')?.value || new Date().toISOString()

          // Check if message has attachments
          const hasAttachments = this.checkHasAttachments(messageDetail.data)

          // Parse date - Gmail uses RFC 2822 format
          const receivedDateTime = new Date(date).toISOString()

          return {
            id: msg.id!,
            subject,
            from,
            receivedDateTime,
            hasAttachments,
          }
        } catch (err) {
          console.error(`Error fetching message ${msg.id}:`, err)
          return null
        }
      })

      const messages = await Promise.all(messagePromises)

      // Filter out nulls and sort by date descending
      return messages
        .filter((m): m is EmailMessage => m !== null)
        .sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime())
    } catch (error) {
      console.error('Error fetching emails:', error)
      throw error
    }
  }

  /**
   * Check if a message has attachments
   */
  private checkHasAttachments(message: any): boolean {
    const parts = message.payload?.parts || []

    const hasAttachment = (part: any): boolean => {
      if (part.filename && part.body?.attachmentId) {
        return true
      }
      if (part.parts) {
        return part.parts.some((p: any) => hasAttachment(p))
      }
      return false
    }

    return parts.some((part: any) => hasAttachment(part))
  }

  /**
   * Get attachments for a specific message
   */
  async getEmailAttachments(accessToken: string, messageId: string): Promise<EmailAttachment[]> {
    const gmail = this.getGmailClient(accessToken)

    try {
      const messageDetail = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
      })

      const attachments: EmailAttachment[] = []

      const extractAttachments = (part: any) => {
        if (part.filename && part.body?.attachmentId) {
          const mimeType = part.mimeType || 'application/octet-stream'

          // Only include PDF attachments
          if (mimeType === 'application/pdf') {
            attachments.push({
              id: part.body.attachmentId,
              name: part.filename,
              contentType: mimeType,
              size: part.body.size || 0,
            })
          }
        }

        if (part.parts) {
          part.parts.forEach((p: any) => extractAttachments(p))
        }
      }

      const parts = messageDetail.data.payload?.parts || []
      parts.forEach((part: any) => extractAttachments(part))

      // Also check the main payload
      if (messageDetail.data.payload?.filename && messageDetail.data.payload?.body?.attachmentId) {
        const mimeType = messageDetail.data.payload.mimeType || 'application/octet-stream'
        if (mimeType === 'application/pdf') {
          attachments.push({
            id: messageDetail.data.payload.body.attachmentId,
            name: messageDetail.data.payload.filename,
            contentType: mimeType,
            size: messageDetail.data.payload.body.size || 0,
          })
        }
      }

      return attachments
    } catch (error) {
      console.error('Error fetching attachments:', error)
      throw error
    }
  }

  /**
   * Get attachment content (returns base64 encoded string)
   */
  async getAttachmentContent(
    accessToken: string,
    messageId: string,
    attachmentId: string
  ): Promise<string> {
    const gmail = this.getGmailClient(accessToken)

    try {
      const attachment = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId,
      })

      // Gmail returns base64url encoded data, we need to convert it to standard base64
      const base64Data = attachment.data.data || ''

      // Convert base64url to base64
      const standardBase64 = base64Data.replace(/-/g, '+').replace(/_/g, '/')

      return standardBase64
    } catch (error) {
      console.error('Error fetching attachment content:', error)
      throw error
    }
  }

  /**
   * Batch fetch attachments for multiple messages (fixes N+1 query pattern)
   */
  async getBatchEmailAttachments(
    accessToken: string,
    messageIds: string[]
  ): Promise<Record<string, EmailAttachment[]>> {
    try {
      // Fetch attachments for all messages in parallel
      const attachmentPromises = messageIds.map(async (messageId) => {
        try {
          const attachments = await this.getEmailAttachments(accessToken, messageId)
          return { messageId, attachments }
        } catch (error) {
          console.error(`Error fetching attachments for message ${messageId}:`, error)
          // Return empty array for failed requests instead of failing the entire batch
          return { messageId, attachments: [] }
        }
      })

      const results = await Promise.all(attachmentPromises)

      // Convert array to object keyed by messageId
      return results.reduce(
        (acc, { messageId, attachments }) => {
          acc[messageId] = attachments
          return acc
        },
        {} as Record<string, EmailAttachment[]>
      )
    } catch (error) {
      console.error('Error in batch fetch attachments:', error)
      throw error
    }
  }
}

export const gmailService = new GmailService()
